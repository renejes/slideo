//! Lokaler IPC-Kanal zwischen der laufenden App und dem MCP-stdio-Prozess.
//!
//! - Die App startet einen TCP-Server auf 127.0.0.1 (zufälliger Port) und
//!   schreibt Port + ein beim Start erzeugtes Shared-Secret-Token in eine
//!   Discovery-Datei (mit 0600-Rechten — Audit S1).
//! - Der MCP-Prozess (`slideo mcp`) liest die Datei und verbindet sich als
//!   Client. Protokoll: newline-delimited JSON, eine Zeile pro Request/Response.
//!     Request:  {"method": "...", "params": {...}, "token": "..."}
//!     Response: {"result": ...}  |  {"error": "..."}
//!   Anfragen ohne gültiges Token werden abgewiesen — die bloße Kenntnis des Ports
//!   reicht einem fremden lokalen Prozess nicht, um die Tools aufzurufen.
//!
//! Schreibende Tools mutieren den App-State und emittieren ein Tauri-Event,
//! sodass die UI sofort live aktualisiert ("Live über lokalen Socket").

use crate::state::AppState;
use crate::tools::{self, Effect};
use serde_json::{json, Value};
use std::io::{BufRead, BufReader as StdBufReader, Write};
use std::path::PathBuf;
use std::sync::OnceLock;
use tauri::{AppHandle, Emitter, Manager};
use tokio::io::{AsyncBufReadExt, AsyncReadExt, AsyncWriteExt, BufReader};
use tokio::net::TcpListener;

/// Obergrenze eingehender Request-Bytes pro Verbindung (DoS-Schutz, Audit S8).
/// Eine Tool-Anfrage ist klein; 16 MiB ist großzügig und begrenzt den Speicher,
/// falls ein lokaler Prozess eine endlose/riesige Zeile sendet.
const MAX_REQUEST_BYTES: u64 = 16 * 1024 * 1024;

/// Beim Start erzeugtes Shared-Secret (Audit S1). Liegt zusätzlich in `ipc.json`
/// (mit 0600 geschrieben), sodass nur der MCP-Client **desselben Nutzers** Tool-
/// Calls absetzen kann. `process_request` weist jede Anfrage ohne gültiges Token ab.
fn server_token() -> &'static str {
    static TOKEN: OnceLock<String> = OnceLock::new();
    TOKEN.get_or_init(|| uuid::Uuid::new_v4().simple().to_string())
}

/// Konstant-Zeit-Vergleich (vermeidet ein Timing-Leak des Tokens).
fn token_eq(a: &str, b: &str) -> bool {
    let (a, b) = (a.as_bytes(), b.as_bytes());
    if a.len() != b.len() {
        return false;
    }
    let mut diff = 0u8;
    for (x, y) in a.iter().zip(b.iter()) {
        diff |= x ^ y;
    }
    diff == 0
}

/// Pfad der Discovery-Datei (enthält den aktuellen Socket-Port + das Token).
fn discovery_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("slideo").join("ipc.json"))
}

fn write_discovery(port: u16, token: &str) {
    let Some(path) = discovery_path() else { return };
    if let Some(dir) = path.parent() {
        let _ = std::fs::create_dir_all(dir);
    }
    let content = json!({ "port": port, "token": token }).to_string();
    // Restriktive Rechte (0600): kein world-readable Port/Token (Audit S1). Datei
    // direkt mit 0600 anlegen, damit es kein kurzes world-readable Zeitfenster gibt.
    #[cfg(unix)]
    {
        use std::os::unix::fs::OpenOptionsExt;
        match std::fs::OpenOptions::new()
            .write(true)
            .create(true)
            .truncate(true)
            .mode(0o600)
            .open(&path)
        {
            Ok(mut f) => {
                let _ = f.write_all(content.as_bytes());
            }
            Err(e) => eprintln!("[slideo] failed to write ipc.json: {e}"),
        }
    }
    #[cfg(not(unix))]
    {
        // Windows: keine POSIX-Modi; das Token bleibt die Schutzschicht. ACL-Härtung
        // ist hier als künftiger Schritt notiert (Audit S1).
        let _ = std::fs::write(&path, content);
    }
}

/// Liest Port + Token aus der Discovery-Datei (Client-Seite).
pub fn read_discovery() -> Option<(u16, String)> {
    let path = discovery_path()?;
    let content = std::fs::read_to_string(path).ok()?;
    let value: Value = serde_json::from_str(&content).ok()?;
    let port = value.get("port").and_then(|p| p.as_u64())? as u16;
    let token = value
        .get("token")
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();
    Some((port, token))
}

/// Startet den IPC-Socket-Server im Tauri-Hintergrund.
pub fn start(app: AppHandle) {
    tauri::async_runtime::spawn(async move {
        let listener = match TcpListener::bind(("127.0.0.1", 0)).await {
            Ok(l) => l,
            Err(e) => {
                eprintln!("[slideo] IPC server failed to start: {e}");
                return;
            }
        };
        if let Ok(addr) = listener.local_addr() {
            write_discovery(addr.port(), server_token());
            eprintln!("[slideo] IPC server listening on 127.0.0.1:{}", addr.port());
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
    // Eingehende Bytes pro Verbindung begrenzen (Audit S8). Der MCP-Client öffnet
    // pro Tool-Call eine eigene Verbindung mit genau einer (kleinen) Anfrage.
    let mut lines = BufReader::new(read_half.take(MAX_REQUEST_BYTES)).lines();
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
        Err(e) => return json!({ "error": format!("Invalid JSON: {e}") }),
    };
    // Authentifizierung (Audit S1): nur Anfragen mit dem beim Start erzeugten Token
    // werden verarbeitet — verhindert, dass ein beliebiger lokaler Prozess die Tools
    // aufruft, nur weil er den Port kennt.
    let token = request.get("token").and_then(|t| t.as_str()).unwrap_or("");
    if !token_eq(token, server_token()) {
        return json!({ "error": "Not authorized (missing or invalid token)." });
    }
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
    let (port, token) = read_discovery()
        .ok_or("Slideo is not running (no IPC discovery file found). Please start the Slideo app.")?;

    let stream = std::net::TcpStream::connect(("127.0.0.1", port))
        .map_err(|e| format!("Connection to the Slideo app failed: {e}. Is the app running?"))?;

    // Token mitsenden (Audit S1) — der Server weist nicht-authentifizierte Anfragen ab.
    let request = json!({ "method": method, "params": params, "token": token });
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
        .map_err(|e| format!("Invalid response from the app: {e}"))?;

    if let Some(err) = response.get("error").and_then(|e| e.as_str()) {
        return Err(err.to_string());
    }
    Ok(response.get("result").cloned().unwrap_or(json!(null)))
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn token_eq_basics() {
        assert!(token_eq("abc", "abc"));
        assert!(!token_eq("abc", "abd"));
        assert!(!token_eq("abc", "ab"), "verschiedene Länge");
        assert!(!token_eq("", "x"));
        assert!(token_eq("", ""));
    }

    #[test]
    fn server_token_is_stable_and_hex() {
        let a = server_token();
        let b = server_token();
        assert_eq!(a, b, "Token ist prozessweit stabil (OnceLock)");
        assert_eq!(a.len(), 32, "uuid simple = 32 Hex-Zeichen");
        assert!(a.chars().all(|c| c.is_ascii_hexdigit()));
    }
}
