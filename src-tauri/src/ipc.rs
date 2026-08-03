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

/// Entfernt die Discovery-Datei (Befund S32) — beim App-Exit aufgerufen, damit kein
/// toter Port zurueckbleibt, gegen den sich ein spaeterer `slideo mcp` verbindet.
pub fn cleanup_discovery() {
    if let Some(path) = discovery_path() {
        let _ = std::fs::remove_file(path);
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
        // Flush-Handshake VOR der (synchronen) Verarbeitung — und bewusst hier im
        // async-Kontext (Review 2026-08, Befund B7 + S13): `process_request` läuft auf
        // einem Tokio-Worker; ein blockierendes `std::thread::sleep` darin würde den
        // Worker für bis zu 250 ms lahmlegen. `tokio::time::sleep` gibt ihn frei.
        flush_frontend_state(&line, &app).await;
        let response = process_request(&line, &app);
        let mut out = response.to_string();
        out.push('\n');
        if write_half.write_all(out.as_bytes()).await.is_err() {
            break;
        }
    }
}

/// Flush-Handshake vor jeder Mutation (Review 2026-08, Befund B7).
///
/// Das Frontend spiegelt seinen Store debounced (400 ms) nach Rust. Ohne diesen
/// Handshake mutierte ein Tool-Call eine bis zu 400 ms alte Kopie und emittierte das
/// GANZE Deck zurück; `applyExternalPresentation` ersetzte den Store komplett — die in
/// diesem Fenster getippten Zeichen waren weg, ohne jede Konflikterkennung, und Undo
/// stellte denselben veralteten Stand wieder her. Ausgerechnet der Modus, den das
/// Produkt bewirbt („Mensch und Agent am selben Deck"), war der unsicherste.
///
/// Deshalb: um sofortige Spiegelung bitten und kurz warten, bis der Sync-Zähler
/// vorrückt. Bewusst mit knappem Deckel — hört niemand zu (Fenster zu, Frontend
/// beschäftigt), geht es nach 250 ms trotzdem weiter. Ein Tool-Call darf nicht daran
/// scheitern, dass das UI gerade nicht antwortet.
async fn flush_frontend_state(line: &str, app: &AppHandle) {
    // Nur für mutierende Tools — ein Read darf nicht 250 ms warten.
    let method = serde_json::from_str::<Value>(line)
        .ok()
        .and_then(|v| v.get("method").and_then(|m| m.as_str()).map(String::from));
    let Some(method) = method else { return };
    if tools::is_read_only_tool(&method) {
        return;
    }
    let state = app.state::<AppState>();
    let before = state.sync_seq();
    let _ = app.emit("slideo:flush-sync", ());
    for _ in 0..50 {
        if state.sync_seq() != before {
            return;
        }
        tokio::time::sleep(std::time::Duration::from_millis(5)).await;
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
        None => return json!({ "error": "Field 'method' is missing" }),
    };
    let params = request.get("params").cloned().unwrap_or(json!({}));

    // Lizenz-Gate (Trial/Read-only): nach Ablauf ohne gültige Lizenz sind MUTIERENDE
    // Tools gesperrt — sonst ließe sich die Demo unbegrenzt über den KI-Kanal weiterbetreiben.
    // Read-only-Tools (get_*/list_*/check_*/validate_deck/open+save/set_active_slide) bleiben erlaubt.
    if !tools::is_read_only_tool(method) && !crate::license::editing_allowed() {
        return json!({ "error": "Slideo trial expired. Activate a license in the Slideo app to keep authoring (editing is disabled)." });
    }

    let state = app.state::<AppState>();

    // Versions-Handshake (Review 2026-08, Befund M15). Der `slideo mcp`-Prozess wird
    // vom KI-Client gestartet und lebt unabhaengig von der App: nach einem Update
    // bewirbt ein noch laufender ALTER stdio-Prozess den alten Toolsatz und bekommt
    // von der neuen App „Unknown tool" zurueck — bisher konnte keine Seite den
    // Mismatch erkennen, weshalb CLAUDE.md sechsmal „cargo build + Neustart"
    // wiederholt. Das ist ein Entwickler-Workaround, keine Nutzer-Absicherung.
    let client_version = request
        .get("client_version")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    if let Some(ref cv) = client_version {
        if cv != env!("CARGO_PKG_VERSION") {
            let app_v = env!("CARGO_PKG_VERSION");
            return json!({
                "error": format!(
                    "Slideo was updated (app {app_v}, connector {cv}). Restart your MCP client so it picks up the new connector — the tool list is stale."
                )
            });
        }
    }
    // Erst NACH allen Ablehnungen festhalten: der Chip soll „verbunden" nur zeigen,
    // wenn wirklich ein Tool gelaufen ist (Befund B8).
    state.note_mcp_activity(method, client_version.clone());

    let mut pres = crate::state::lock_recover(&state.presentation);
    let mut file_path = crate::state::lock_recover(&state.file_path);
    let assets = crate::state::lock_recover(&state.assets);

    // Panic-Deckel (Review 2026-08, Befund S12): `tools::handle` verarbeitet vom KI-Client
    // gelieferte, beliebig geformte Parameter. Ein Panic darin würde ohne diesen Fang das
    // Unwinding durch den Verbindungs-Thread tragen und drei Mutexe vergiftet zurücklassen
    // → MCP *und* Speichern wären bis zum Neustart tot. Stattdessen: ein Fehler an den
    // Client, der Server läuft weiter. AssertUnwindSafe ist hier vertretbar, weil die
    // Guards nur JSON-/Pfad-Werte ohne Cross-Feld-Invarianten halten (siehe lock_recover).
    let outcome = std::panic::catch_unwind(std::panic::AssertUnwindSafe(|| {
        tools::handle(method, &params, &mut pres, &mut file_path, &assets)
    }));
    let outcome = match outcome {
        Ok(r) => r,
        Err(_) => {
            eprintln!("[slideo] PANIC in tools::handle('{method}') — abgefangen, Server läuft weiter");
            return json!({
                "error": format!("Internal error while handling '{method}'. The tool call was aborted; the presentation is unchanged or partially updated — verify with get_all_zones.")
            });
        }
    };

    match outcome {
        Ok(outcome) => {
            // Event-Payload klonen, bevor die Locks freigegeben werden.
            let pres_snapshot = pres.clone();
            drop(pres);
            drop(file_path);
            drop(assets);
            let zone_ids = outcome.zone_ids;
            match outcome.effect {
                Effect::Presentation => {
                    if let Some(p) = pres_snapshot {
                        // zoneIds fährt mit (Vorarbeit S2 + Provenance-UI): das Frontend
                        // weiß damit, WAS die KI angefasst hat, statt nur DASS sie es tat.
                        let _ = app.emit(
                            "mcp:presentation",
                            json!({ "presentation": p, "zoneIds": zone_ids }),
                        );
                    }
                }
                // Deckwechsel: Presentation + Pfad + Assets in EINEM Event, damit das
                // Frontend nicht in einen Zustand geraten kann, in dem es Deck B zeigt,
                // aber auf Datei A verweist (Befund B3).
                Effect::Opened { path, assets: loaded } => {
                    // Auch den Backend-Spiegel nachziehen (Befund B3d): `tools::handle`
                    // bekommt die Assets nur geliehen und kann sie nicht selbst setzen.
                    // Ohne das läse ein direkt folgendes `list_assets`/`save_presentation`
                    // weiterhin die Assets des vorherigen Decks.
                    let state = app.state::<AppState>();
                    state.set_assets(loaded.clone());
                    if let Some(p) = pres_snapshot {
                        let _ = app.emit(
                            "mcp:opened",
                            json!({
                                "presentation": p,
                                "path": path.as_ref().map(|p| p.to_string_lossy().to_string()),
                                "assets": loaded,
                            }),
                        );
                    }
                }
                Effect::Saved { path } => {
                    let _ = app.emit(
                        "mcp:saved",
                        json!({ "path": path.to_string_lossy().to_string() }),
                    );
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

    // Timeouts setzen (Review 2026-08, Befund M14): `client_request` hatte weder
    // Connect- noch Read-/Write-Timeout, obwohl der Meta-MCP-Helfer derselben
    // Codebasis 700 ms/2 s setzt — das Muster war bekannt. Zusammen mit der nie
    // aufgeraeumten `ipc.json` (recycelter Port) wurde aus „App laeuft nicht" ein
    // unbegrenzter Haenger statt eines Fehlers.
    let addr = std::net::SocketAddr::from(([127, 0, 0, 1], port));
    let stream = std::net::TcpStream::connect_timeout(&addr, std::time::Duration::from_millis(1500))
        .map_err(|e| format!("Connection to the Slideo app failed: {e}. Is the app running?"))?;
    // Grosszuegig: ein Tool-Call kann ein ganzes Deck schreiben (ZIP + Assets).
    let _ = stream.set_read_timeout(Some(std::time::Duration::from_secs(30)));
    let _ = stream.set_write_timeout(Some(std::time::Duration::from_secs(30)));

    // Token mitsenden (Audit S1) — der Server weist nicht-authentifizierte Anfragen ab.
    // `client_version` mitsenden (Befund M15): die App vergleicht sie mit ihrer
    // eigenen und meldet einen Mismatch als klaren Text, statt dass der Nutzer aus
    // „Unknown tool" raten muss, dass der Connector veraltet ist.
    let request = json!({
        "method": method,
        "params": params,
        "token": token,
        "client_version": env!("CARGO_PKG_VERSION"),
    });
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
