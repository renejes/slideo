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
use std::sync::atomic::{AtomicBool, AtomicU64, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tauri::{AppHandle, Emitter, State};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::process::{Child, ChildStdin, Command};
use tokio::sync::{oneshot, Mutex};

const RPC_TIMEOUT_MS: u64 = 180_000;
const HOST_READY_MS: u64 = 8_000;
const STDERR_CAP: usize = 4_096;

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
    dead: Arc<AtomicBool>,
    stderr: Arc<Mutex<String>>,
}

fn should_respawn(err: &str) -> bool {
    let body = err.strip_prefix("slideo:").unwrap_or(err);
    let code = body.split_once('|').map(|(c, _)| c).unwrap_or(body);
    matches!(code, "chat.rpc" | "chat.hostMissing")
}

fn clip_detail(s: &str) -> String {
    let t = s.trim();
    if t.chars().count() <= 400 {
        t.to_string()
    } else {
        t.chars()
            .skip(t.chars().count().saturating_sub(400))
            .collect()
    }
}

async fn fail_pending(pending: &Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>>) {
    let mut map = pending.lock().await;
    for (_, tx) in map.drain() {
        let _ = tx.send(Err(errcode::code("chat.rpc")));
    }
}

async fn drop_host(host: Option<Host>) {
    let Some(mut host) = host else {
        return;
    };
    host.dead.store(true, Ordering::Relaxed);
    fail_pending(&host.pending).await;
    let _ = host.child.kill().await;
}

fn host_exited(host: &mut Host) -> bool {
    host.dead.load(Ordering::Relaxed) || !matches!(host.child.try_wait(), Ok(None))
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
        .stderr(Stdio::piped())
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
    let stderr = child
        .stderr
        .take()
        .ok_or_else(|| errcode::code("chat.spawnFailed"))?;

    let pending: Arc<Mutex<HashMap<u64, oneshot::Sender<Result<Value, String>>>>> =
        Arc::new(Mutex::new(HashMap::new()));
    let stderr_buf: Arc<Mutex<String>> = Arc::new(Mutex::new(String::new()));
    let dead = Arc::new(AtomicBool::new(false));
    let (ready_tx, ready_rx) = oneshot::channel::<()>();
    let ready_tx = Arc::new(Mutex::new(Some(ready_tx)));

    let stderr_w = stderr_buf.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stderr).lines();
        while let Ok(Some(line)) = lines.next_line().await {
            eprintln!("[chat-host] {line}");
            let mut buf = stderr_w.lock().await;
            buf.push_str(&line);
            buf.push('\n');
            if buf.len() > STDERR_CAP {
                let drain = buf.len() - STDERR_CAP;
                buf.drain(..drain);
            }
        }
    });

    let pending_r = pending.clone();
    let dead_r = dead.clone();
    let ready_r = ready_tx.clone();
    let app_r = app.clone();
    tokio::spawn(async move {
        let mut lines = BufReader::new(stdout).lines();
        loop {
            match lines.next_line().await {
                Ok(Some(line)) => {
                    let trimmed = line.trim();
                    if trimmed.is_empty() {
                        continue;
                    }
                    let Ok(v) = serde_json::from_str::<Value>(trimmed) else {
                        continue;
                    };
                    let method = v.get("method").and_then(|m| m.as_str());
                    if method == Some("ready") {
                        if let Some(tx) = ready_r.lock().await.take() {
                            let _ = tx.send(());
                        }
                        continue;
                    }
                    if method == Some("event") {
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
                Ok(None) | Err(_) => break,
            }
        }
        dead_r.store(true, Ordering::Relaxed);
        fail_pending(&pending_r).await;
    });

    let mut host = Host {
        child,
        stdin,
        pending,
        next_id: AtomicU64::new(1),
        dead,
        stderr: stderr_buf,
    };

    tokio::select! {
        _ = ready_rx => {}
        status = host.child.wait() => {
            let status = status.map_err(|e| errcode::code_with("chat.spawnFailed", e))?;
            let detail = clip_detail(&host.stderr.lock().await);
            let msg = if detail.is_empty() {
                format!("exited {status}")
            } else {
                detail
            };
            return Err(errcode::code_with("chat.spawnFailed", msg));
        }
        _ = tokio::time::sleep(Duration::from_millis(HOST_READY_MS)) => {}
    }
    match host.child.try_wait() {
        Ok(None) => Ok(host),
        Ok(Some(status)) => {
            let detail = clip_detail(&host.stderr.lock().await);
            let msg = if detail.is_empty() {
                format!("exited {status}")
            } else {
                detail
            };
            Err(errcode::code_with("chat.spawnFailed", msg))
        }
        Err(e) => Err(errcode::code_with("chat.spawnFailed", e)),
    }
}

async fn ensure_host(app: &AppHandle, state: &ChatState) -> Result<(), String> {
    let mut g = state.inner.lock().await;
    if let Some(host) = g.as_mut() {
        if host_exited(host) {
            drop_host(g.take()).await;
        }
    }
    if g.is_none() {
        *g = Some(spawn_host(app).await?);
    }
    Ok(())
}

async fn rpc_once(state: &ChatState, method: &str, params: &Value) -> Result<Value, String> {
    let mut g = state.inner.lock().await;
    let host = g
        .as_mut()
        .ok_or_else(|| errcode::code("chat.hostMissing"))?;
    if host_exited(host) {
        return Err(errcode::code("chat.rpc"));
    }
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
    if let Err(e) = async {
        host.stdin.write_all(line.as_bytes()).await?;
        host.stdin.write_all(b"\n").await?;
        host.stdin.flush().await?;
        Ok::<(), std::io::Error>(())
    }
    .await
    {
        host.pending.lock().await.remove(&id);
        host.dead.store(true, Ordering::Relaxed);
        return Err(errcode::code_with("chat.rpc", e));
    }
    drop(g);

    match tokio::time::timeout(Duration::from_millis(RPC_TIMEOUT_MS), rx).await {
        Ok(Ok(res)) => res,
        Ok(Err(_)) => Err(errcode::code("chat.rpc")),
        Err(_) => Err(errcode::code("chat.rpcTimeout")),
    }
}

async fn rpc(
    app: &AppHandle,
    state: &ChatState,
    method: &str,
    params: Value,
) -> Result<Value, String> {
    let mut last = errcode::code("chat.rpc");
    for attempt in 0..2 {
        if let Err(e) = ensure_host(app, state).await {
            last = e;
            break;
        }
        match rpc_once(state, method, &params).await {
            Ok(v) => return Ok(v),
            Err(e) if attempt == 0 && should_respawn(&e) => {
                last = e;
                let mut g = state.inner.lock().await;
                drop_host(g.take()).await;
            }
            Err(e) => return Err(e),
        }
    }
    Err(last)
}

pub async fn shutdown(state: &ChatState) {
    let mut g = state.inner.lock().await;
    drop_host(g.take()).await;
}

#[tauri::command]
pub async fn chat_status(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "status", json!({})).await
}

#[tauri::command]
pub async fn chat_login(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "login", json!({})).await
}

#[tauri::command]
pub async fn chat_logout(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "logout", json!({})).await
}

#[tauri::command]
pub async fn chat_set_model(
    app: AppHandle,
    state: State<'_, ChatState>,
    model_id: String,
    params: Option<Value>,
) -> Result<Value, String> {
    rpc(
        &app,
        &state,
        "setModel",
        json!({ "modelId": model_id, "params": params.unwrap_or(Value::Null) }),
    )
    .await
}

#[tauri::command]
pub async fn chat_models(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "models", json!({})).await
}

#[tauri::command]
pub async fn chat_history(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "history", json!({})).await
}

#[tauri::command]
pub async fn chat_sessions(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "sessions", json!({})).await
}

#[tauri::command]
pub async fn chat_new(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "new", json!({})).await
}

#[tauri::command]
pub async fn chat_switch(
    app: AppHandle,
    state: State<'_, ChatState>,
    id: String,
) -> Result<Value, String> {
    rpc(&app, &state, "switch", json!({ "id": id })).await
}

#[tauri::command]
pub async fn chat_close_tab(
    app: AppHandle,
    state: State<'_, ChatState>,
    id: String,
) -> Result<Value, String> {
    rpc(&app, &state, "closeTab", json!({ "id": id })).await
}

#[tauri::command]
pub async fn chat_delete(
    app: AppHandle,
    state: State<'_, ChatState>,
    id: String,
) -> Result<Value, String> {
    rpc(&app, &state, "delete", json!({ "id": id })).await
}

#[tauri::command]
pub async fn chat_cancel(app: AppHandle, state: State<'_, ChatState>) -> Result<Value, String> {
    rpc(&app, &state, "cancel", json!({})).await
}

#[tauri::command]
pub async fn chat_bind(
    app: AppHandle,
    state: State<'_, ChatState>,
    file_path: Option<String>,
) -> Result<Value, String> {
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
    rpc(
        &app,
        &state,
        "bind",
        json!({ "cwd": cwd, "deckKey": deck_key }),
    )
    .await
}

#[tauri::command]
pub async fn chat_send(
    app: AppHandle,
    state: State<'_, ChatState>,
    payload: Value,
) -> Result<Value, String> {
    rpc(&app, &state, "send", payload).await
}

#[cfg(test)]
mod tests {
    use super::should_respawn;

    #[test]
    fn respawns_on_broken_pipe_not_on_timeout_or_host_errors() {
        assert!(should_respawn("slideo:chat.rpc|Broken pipe (os error 32)"));
        assert!(should_respawn("slideo:chat.rpc"));
        assert!(should_respawn("slideo:chat.hostMissing"));
        assert!(!should_respawn("slideo:chat.rpcTimeout"));
        assert!(!should_respawn("slideo:chat.spawnFailed|exited"));
        assert!(!should_respawn("busy-switch"));
    }
}
