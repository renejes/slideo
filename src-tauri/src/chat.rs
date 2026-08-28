//! Node-Sidecar für den In-App-Cursor-Chat.
//!
//! `@cursor/sdk` ist Node-only; die Tauri-App spawnt `host.mjs` (esbuild aus
//! `src-agent/`) und proxyt Commands als JSON-RPC über stdin/stdout. Stream-
//! Events kommen als Notifications (`method: "event"`) und werden als Tauri-
//! Event `chat:event` an das Frontend gereicht.

use crate::errcode;
use serde_json::{json, Value};
use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::process::Stdio;
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Arc;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

const RPC_TIMEOUT_MS: u64 = 180_000;

pub struct ChatState {
    inner: Mutex<Option<Host>>,
}

impl Default for ChatState {
    fn default() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }
}

struct Host {
    child: Child,
    stdin: ChildStdin,
    pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>,
    next_id: AtomicU64,
}

fn deck_key(file_path: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    file_path.hash(&mut h);
    let hash = h.finish();
    let stem = Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("deck");
    let safe: String = stem
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(40)
        .collect();
    let safe = if safe.is_empty() {
        "deck".to_string()
    } else {
        safe
    };
    format!("{safe}-{hash:016x}")
}

fn config_dir() -> Result<PathBuf, String> {
    dirs::config_dir()
        .map(|d| d.join("slideo"))
        .ok_or_else(|| errcode::code("chat.noConfigDir"))
}

fn repo_root_from_exe() -> Option<PathBuf> {
    let mut dir = std::env::current_exe().ok()?.parent()?.to_path_buf();
    for _ in 0..10 {
        if dir.join("package.json").is_file() && dir.join("src-tauri").is_dir() {
            return Some(dir);
        }
        if !dir.pop() {
            break;
        }
    }
    None
}

fn host_script() -> Result<PathBuf, String> {
    if let Some(root) = repo_root_from_exe() {
        let p = root.join("src-tauri").join("agent-host").join("host.mjs");
        if p.is_file() {
            return Ok(p);
        }
    }
    Err(errcode::code("chat.hostMissing"))
}

fn find_node() -> Result<PathBuf, String> {
    if let Ok(p) = std::env::var("SLIDEO_NODE") {
        let pb = PathBuf::from(&p);
        if pb.is_file() {
            return Ok(pb);
        }
    }
    let which = if cfg!(windows) { "where" } else { "which" };
    if let Ok(out) = std::process::Command::new(which).arg("node").output() {
        if out.status.success() {
            let line = String::from_utf8_lossy(&out.stdout)
                .lines()
                .next()
                .unwrap_or("")
                .trim()
                .to_string();
            if !line.is_empty() {
                let pb = PathBuf::from(line);
                if pb.is_file() {
                    return Ok(pb);
                }
            }
        }
    }
    for candidate in [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ] {
        let pb = PathBuf::from(candidate);
        if pb.is_file() {
            return Ok(pb);
        }
    }
    Err(errcode::code("chat.nodeMissing"))
}

async fn spawn_host(app: &AppHandle) -> Result<Host, String> {
    let node = find_node()?;
    let script = host_script()?;
    let exe = std::env::current_exe()
        .map_err(|e| errcode::code_with("mcp.selfPathUnknown", e))?
        .to_string_lossy()
        .into_owned();
    let cfg = config_dir()?;
    let cwd = repo_root_from_exe().unwrap_or_else(|| {
        script
            .parent()
            .and_then(|p| p.parent())
            .and_then(|p| p.parent())
            .unwrap_or_else(|| Path::new("."))
            .to_path_buf()
    });

    let mut cmd = Command::new(&node);
    cmd.arg(&script)
        .current_dir(&cwd)
        .env("SLIDEO_EXE", &exe)
        .env("SLIDEO_CONFIG_DIR", cfg.to_string_lossy().as_ref())
        .stdin(Stdio::piped())
        .stdout(Stdio::piped())
        .stderr(Stdio::inherit())
        .kill_on_drop(true);

    let mut child = cmd
        .spawn()
        .map_err(|e| errcode::code_with("chat.spawnFailed", e))?;
    let stdin = child
        .stdin
        .take()
        .ok_or_else(|| errcode::code("chat.spawnFailed"))?;
    let stdout = child
        .stdout
        .take()
        .ok_or_else(|| errcode::code("chat.spawnFailed"))?;

    let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let pending_r = pending.clone();
    let app_r = app.clone();

    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            let trimmed = line.trim();
            if trimmed.is_empty() {
                continue;
            }
            let Ok(v) = serde_json::from_str::<Value>(trimmed) else {
                continue;
            };
            if v.get("method").and_then(|m| m.as_str()) == Some("event") {
                if let Some(params) = v.get("params") {
                    let _ = app_r.emit("chat:event", params);
                }
                continue;
            }
            let Some(id) = v.get("id").and_then(|i| i.as_u64()) else {
                continue;
            };
            let result = if let Some(err) = v.get("error") {
                let msg = err
                    .get("message")
                    .and_then(|m| m.as_str())
                    .unwrap_or("RPC error")
                    .to_string();
                Err(msg)
            } else {
                Ok(v.get("result").cloned().unwrap_or(Value::Null))
            };
            if let Some(tx) = pending_r.lock().await.remove(&id) {
                let _ = tx.send(result);
            }
        }
    });

    Ok(Host {
        child,
        stdin,
        pending,
        next_id: AtomicU64::new(1),
    })
}

async fn ensure_host(app: &AppHandle, state: &ChatState) -> Result<(), String> {
    let mut g = state.inner.lock().await;
    if g.is_some() {
        return Ok(());
    }
    *g = Some(spawn_host(app).await?);
    Ok(())
}

async fn rpc(state: &ChatState, method: &str, params: Value) -> Result<Value, String> {
    let mut g = state.inner.lock().await;
    let host = g.as_mut().ok_or_else(|| errcode::code("chat.hostMissing"))?;
    let id = host.next_id.fetch_add(1, Ordering::Relaxed);
    let (tx, rx) = oneshot::channel();
    host.pending.lock().await.insert(id, tx);
    let line = json!({
        "jsonrpc": "2.0",
        "id": id,
        "method": method,
        "params": params,
    })
    .to_string();
    host.stdin
        .write_all(line.as_bytes())
        .await
        .map_err(|e| errcode::code_with("chat.rpc", e))?;
    host.stdin
        .write_all(b"\n")
        .await
        .map_err(|e| errcode::code_with("chat.rpc", e))?;
    host.stdin
        .flush()
        .await
        .map_err(|e| errcode::code_with("chat.rpc", e))?;
    drop(g);

    match tokio::time::timeout(std::time::Duration::from_millis(RPC_TIMEOUT_MS), rx).await {
        Ok(Ok(res)) => res,
        Ok(Err(_)) => Err(errcode::code("chat.rpc")),
        Err(_) => Err(errcode::code("chat.rpcTimeout")),
    }
}

pub async fn shutdown(state: &ChatState) {
    let mut g = state.inner.lock().await;
    if let Some(mut host) = g.take() {
        let _ = host.child.kill().await;
    }
}

#[tauri::command]
pub async fn chat_status(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "status", json!({})).await
}

#[tauri::command]
pub async fn chat_login(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "login", json!({})).await
}

#[tauri::command]
pub async fn chat_logout(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "logout", json!({})).await
}

#[tauri::command]
pub async fn chat_set_model(
    app: AppHandle,
    state: State<'_, ChatState>,
    model_id: String,
    params: Option<Value>,
) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(
        &state,
        "setModel",
        json!({ "modelId": model_id, "params": params.unwrap_or(Value::Null) }),
    )
    .await
}

#[tauri::command]
pub async fn chat_models(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "models", json!({})).await
}

#[tauri::command]
pub async fn chat_history(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "history", json!({})).await
}

#[tauri::command]
pub async fn chat_sessions(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "sessions", json!({})).await
}

#[tauri::command]
pub async fn chat_new(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "new", json!({})).await
}

#[tauri::command]
pub async fn chat_switch(
    app: AppHandle,
    state: State<'_, ChatState>,
    id: String,
) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "switch", json!({ "id": id })).await
}

#[tauri::command]
pub async fn chat_close_tab(
    app: AppHandle,
    state: State<'_, ChatState>,
    id: String,
) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "closeTab", json!({ "id": id })).await
}

#[tauri::command]
pub async fn chat_delete(
    app: AppHandle,
    state: State<'_, ChatState>,
    id: String,
) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "delete", json!({ "id": id })).await
}

#[tauri::command]
pub async fn chat_cancel(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "cancel", json!({})).await
}

#[tauri::command]
pub async fn chat_bind(
    app: AppHandle,
    state: State<'_, ChatState>,
    file_path: Option<String>,
) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    let cfg = config_dir()?;
    let (cwd, deck_key) = match file_path.as_deref().filter(|s| !s.is_empty()) {
        Some(p) => {
            let parent = Path::new(p)
                .parent()
                .map(|d| d.to_string_lossy().into_owned())
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| cfg.join("workspace").to_string_lossy().into_owned());
            (parent, deck_key(p))
        }
        None => {
            let ws = cfg.join("workspace");
            let _ = std::fs::create_dir_all(&ws);
            (ws.to_string_lossy().into_owned(), "untitled".to_string())
        }
    };
    rpc(&state, "bind", json!({ "cwd": cwd, "deckKey": deck_key })).await
}

#[tauri::command]
pub async fn chat_send(
    app: AppHandle,
    state: State<'_, ChatState>,
    payload: Value,
) -> Result<Value, String> {
    ensure_host(&app, &state).await?;
    rpc(&state, "send", payload).await
}
