//! Lokaler IPC-Kanal zwischen der laufenden App und dem MCP-stdio-Prozess.
//!
//! - Die App startet einen TCP-Server auf 127.0.0.1 (zufälliger Port) und
//!   schreibt den Port in eine Discovery-Datei.
//! - Der MCP-Prozess (`slideo mcp`) liest die Datei und verbindet sich als
//!   Client. Protokoll: newline-delimited JSON, eine Zeile pro Request/Response.
//!     Request:  {"method": "...", "params": {...}}
//!     Response: {"result": ...}  |  {"error": "..."}
//!
//! Schreibende Tools mutieren den App-State und emittieren ein Tauri-Event,
//! sodass die UI sofort live aktualisiert ("Live über lokalen Socket").

use crate::state::AppState;
use crate::tools::{self, Effect};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader as StdBufReader, Write};
use std::path::PathBuf;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;

/// Pfad der Discovery-Datei (enthält den aktuellen Socket-Port).
fn discovery_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("slideo").join("ipc.json"))
}

fn write_discovery(port: u16) {
    if let Some(path) = discovery_path() {
        if let Some(dir) = path.parent() {
            let _ = std::fs::create_dir_all(dir);
        }
        let _ = std::fs::write(&path, json!({ "port": port }).to_string());
    }
}

/// Liest den aktuellen Socket-Port aus der Discovery-Datei (Client-Seite).
pub fn read_discovery_port() -> Option<u16> {
    let path = discovery_path()?;
    let content = std::fs::read_to_string(path).ok()?;
    let value: Value = serde_json::from_str(&content).ok()?;
    value.get("port").and_then(|p| p.as_u64()).map(|p| p as u16)
}

/// Startet den IPC-Socket-Server im Tauri-Hintergrund.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind(("127.0.0.1", 0)).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[slideo] IPC-Server konnte nicht starten: {e}");
                return;
            }
        };
        if let Ok(addr) = listener.local_addr() {
            write_discovery(addr.port());
            eprintln!("[slideo] IPC-Server läuft auf 127.0.0.1:{}", addr.port());
        }
        loop {
            match listener.accept().await {
                Ok((stream, _)) => {
                    let app = app.clone();
                    tauri::async_runtime::spawn(handle_connection(stream, app));
                }
                Err(e) => {
                    eprintln!("[slideo] IPC accept-Fehler: {e}");
                    break;
                }
            }
        }
    });
}

async fn handle_connection(stream: tokio::net::TcpStream, app: AppHandle) {
    let (read_half, mut write_half) = stream.into_split();
    let mut lines = BufReader::new(read_half).lines();
    while let Ok(Some(line)) = lines.next_line().await {
        if line.trim().is_empty() {
            continue;
        }
        let response = process_request(&line, &app);
        let mut out = response.to_string();
        out.push('\n');
        if write_half.write_all(out.as_bytes()).await.is_err() {
            break;
        }
    }
}

/// Verarbeitet eine Request-Zeile synchron gegen den App-State und emittiert
/// bei Bedarf ein UI-Update-Event.
fn process_request(line: &str, app: &AppHandle) -> Value {
    let request: Value = match serde_json::from_str(line) {
        Ok(v) => v,
        Err(e) => return json!({ "error": format!("Ungültiges JSON: {e}") }),
    };
    let method = match request.get("method").and_then(|m| m.as_str()) {
        Some(m) => m,
        None => return json!({ "error": "Feld 'method' fehlt" }),
    };
    let params = request.get("params").cloned().unwrap_or(json!({}));

    let state = app.state::<AppState>();
    let mut pres = state.presentation.lock().unwrap();
    let mut file_path = state.file_path.lock().unwrap();
    let assets = state.assets.lock().unwrap();

    match tools::handle(method, &params, &mut pres, &mut file_path, &assets) {
        Ok(outcome) => {
            // Event-Payload klonen, bevor die Locks freigegeben werden.
            let pres_snapshot = pres.clone();
            drop(pres);
            drop(file_path);
            drop(assets);
            match outcome.effect {
                Effect::Presentation => {
                    if let Some(p) = pres_snapshot {
                        let _ = app.emit("mcp:presentation", p);
                    }
                }
                Effect::ActiveSlide(index) => {
                    let _ = app.emit("mcp:active-slide", index);
                }
                Effect::None => {}
            }
            json!({ "result": outcome.result })
        }
        Err(msg) => json!({ "error": msg }),
    }
}

// ---------- Client-Seite (MCP-stdio-Prozess) ----------

/// Sendet einen Request an die laufende App und gibt deren Antwort zurück.
/// Blockierend (std::net), da der MCP-stdio-Modus ohnehin synchron läuft.
pub fn client_request(method: &str, params: &Value) -> Result<Value, String> {
    let port = read_discovery_port()
        .ok_or("Slideo läuft nicht (keine IPC-Discovery-Datei gefunden). Bitte die Slideo-App starten.")?;

    let stream = std::net::TcpStream::connect(("127.0.0.1", port))
        .map_err(|e| format!("Verbindung zur Slideo-App fehlgeschlagen: {e}. Läuft die App?"))?;

    let request = json!({ "method": method, "params": params });
    // Ganze Zeile in EINEM write_all senden (sonst zerlegt Display die JSON-Value
    // in viele winzige TCP-Pakete).
    let mut payload = request.to_string();
    payload.push('\n');
    let mut writer = stream.try_clone().map_err(|e| e.to_string())?;
    writer.write_all(payload.as_bytes()).map_err(|e| e.to_string())?;
    writer.flush().map_err(|e| e.to_string())?;

    let mut reader = StdBufReader::new(stream);
    let mut line = String::new();
    reader.read_line(&mut line).map_err(|e| e.to_string())?;

    let response: Value = serde_json::from_str(line.trim())
        .map_err(|e| format!("Ungültige Antwort der App: {e}"))?;

    if let Some(err) = response.get("error").and_then(|e| e.as_str()) {
        return Err(err.to_string());
    }
    Ok(response.get("result").cloned().unwrap_or(json!(null)))
}
