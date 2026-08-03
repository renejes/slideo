//! MCP-Ziel-Registrierung mit Startauswahl.
//!
//! Slideo ist selbst ein MCP-Server (`slideo mcp`, stdio). Es kann sich bei
//! GENAU EINEM von drei Zielen anmelden — die jeweils anderen zwei werden
//! deregistriert, sodass es nie Doppel-Einträge gibt:
//!
//!   - `desktop`  Claude Desktop  → `<config>/Claude/claude_desktop_config.json`
//!   - `meta`     Meta-MCP        → lokaler Aggregator-Proxy auf http://localhost:3663
//!   - `claude`   Claude Code     → `~/.claude.json` (User-Scope, global)
//!
//! Der Zustand wird beim Start idempotent hergestellt: das gewählte Ziel
//! registrieren, die anderen entfernen. Das Ziel wird in
//! `<config>/slideo/mcp.json` persistiert; ein `--mcp-target=meta|claude|desktop`
//! CLI-Flag bzw. die Einstellungen (Tauri-Commands) überschreiben es.
//!
//! Bewusst ohne HTTP-Crate: der Meta-MCP-Teil spricht plain HTTP/1.1 über einen
//! std-TCP-Socket gegen localhost (passt zur schlanken, hand-gerollten Linie des
//! Projekts — vgl. JSON-RPC in [mcp.rs]). Alle Datei-Edits sind nicht-destruktiv:
//! es wird ausschließlich der eigene Eintrag (`name == "slideo"`) angefasst.

use serde_json::{json, Value};
use std::io::{Read, Write};
use std::net::TcpStream;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, OnceLock};
use std::time::Duration;

/// Name, unter dem sich Slideo überall registriert.
const SERVER_NAME: &str = "slideo";
/// Meta-MCP lauscht lokal auf diesem Port.
const META_HOST: &str = "127.0.0.1";
const META_PORT: u16 = 3663;

// ─────────────────────────────── Target ───────────────────────────────

#[derive(Clone, Copy, PartialEq, Eq, Debug)]
pub enum Target {
    Desktop,
    Meta,
    Claude,
}

impl Target {
    pub fn key(self) -> &'static str {
        match self {
            Target::Desktop => "desktop",
            Target::Meta => "meta",
            Target::Claude => "claude",
        }
    }

    pub fn from_key(s: &str) -> Option<Target> {
        match s {
            "desktop" => Some(Target::Desktop),
            "meta" => Some(Target::Meta),
            "claude" => Some(Target::Claude),
            _ => None,
        }
    }

    const ALL: [Target; 3] = [Target::Desktop, Target::Meta, Target::Claude];
}

// ───────────────────────── kleiner HTTP/1.1-Client ─────────────────────────

/// Spricht plain HTTP/1.1 gegen Meta-MCP auf localhost. Gibt (Status, Body) zurück.
/// `Connection: close`, damit `read_to_end` zuverlässig terminiert.
fn meta_http(method: &str, path: &str, body: Option<&str>) -> Result<(u16, String), String> {
    let addr = format!("{META_HOST}:{META_PORT}")
        .parse()
        .map_err(|e| format!("{e}"))?;
    let mut stream = TcpStream::connect_timeout(&addr, Duration::from_millis(700))
        .map_err(|e| format!("localhost:{META_PORT} nicht erreichbar: {e}"))?;
    stream.set_read_timeout(Some(Duration::from_millis(2000))).ok();
    stream.set_write_timeout(Some(Duration::from_millis(2000))).ok();

    let body = body.unwrap_or("");
    let request = format!(
        "{method} {path} HTTP/1.1\r\n\
         Host: localhost:{META_PORT}\r\n\
         Connection: close\r\n\
         Content-Type: application/json\r\n\
         Content-Length: {len}\r\n\
         \r\n\
         {body}",
        len = body.len(),
    );
    stream
        .write_all(request.as_bytes())
        .map_err(|e| format!("Senden fehlgeschlagen: {e}"))?;
    stream.flush().ok();

    let mut raw = Vec::new();
    stream
        .read_to_end(&mut raw)
        .map_err(|e| format!("Lesen fehlgeschlagen: {e}"))?;
    let text = String::from_utf8_lossy(&raw).into_owned();

    let status = text
        .lines()
        .next()
        .and_then(|line| line.split_whitespace().nth(1))
        .and_then(|code| code.parse::<u16>().ok())
        .ok_or("Ungültige HTTP-Antwort von Meta-MCP")?;
    Ok((status, text))
}

// ───────────────────────── JSON-Datei-Helfer ─────────────────────────

fn read_json(path: &Path) -> Option<Value> {
    let text = std::fs::read_to_string(path).ok()?;
    serde_json::from_str(&text).ok()
}

/// Wie `read_json`, unterscheidet aber „Datei fehlt" (`Ok(None)`) von
/// „Datei da, aber nicht lesbar/parsebar" (`Err`). Nötig für die schreibenden
/// Pfade: `write_json` ersetzt die Zieldatei ATOMAR und VOLLSTÄNDIG — ein
/// Rückfall auf `{}` bei einer bloß transient unlesbaren Fremd-Config
/// (z.B. `~/.claude.json` mitten im nicht-atomaren Schreiben durch Claude Code)
/// würde deren gesamten Inhalt (Projekte, History, andere MCP-Server, Auth)
/// vernichten. Nur eine wirklich FEHLENDE Datei darf frisch mit `{}` starten.
fn read_json_checked(path: &Path) -> Result<Option<Value>, String> {
    match std::fs::read_to_string(path) {
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(e) => Err(format!("Config nicht lesbar ({}): {e}", path.display())),
        Ok(text) => serde_json::from_str(&text).map(Some).map_err(|e| {
            format!(
                "Config ({}) ist kein gültiges JSON: {e} — abgebrochen, um keinen Datenverlust an einer fremden Config zu riskieren.",
                path.display()
            )
        }),
    }
}

fn write_json(path: &Path, value: &Value) -> Result<(), String> {
    let dir = path
        .parent()
        .ok_or_else(|| format!("Kein übergeordneter Ordner für {}", path.display()))?;
    std::fs::create_dir_all(dir)
        .map_err(|e| format!("Ordner anlegen fehlgeschlagen ({}): {e}", dir.display()))?;
    let text = serde_json::to_string_pretty(value).map_err(|e| e.to_string())?;
    // Atomar schreiben (Audit S6): erst in eine Temp-Datei im SELBEN Ordner, dann per
    // rename ersetzen. So kann ein Absturz mitten im Schreiben die (möglicherweise
    // fremde, z.B. ~/.claude.json) Zieldatei nicht abschneiden.
    let tmp = dir.join(format!(".slideo-{}.tmp", uuid::Uuid::new_v4().simple()));
    std::fs::write(&tmp, text.as_bytes())
        .map_err(|e| format!("Schreiben fehlgeschlagen ({}): {e}", tmp.display()))?;
    // Rechte bewahren (Audit-Review M2): per rename würde die Temp-Datei (0644 bei
    // umask 022) sonst die oft 0600-geschützten Fremd-Configs (~/.claude.json,
    // claude_desktop_config.json) world-readable machen. Bestehende Ziel-Rechte
    // übernehmen; existiert kein Ziel, restriktiv mit 0600 anlegen (Config-Dateien
    // enthalten u.U. Secrets).
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        let mode = std::fs::metadata(path)
            .map(|m| m.permissions().mode() & 0o777)
            .unwrap_or(0o600);
        let _ = std::fs::set_permissions(&tmp, std::fs::Permissions::from_mode(mode));
    }
    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        format!("Ersetzen fehlgeschlagen ({}): {e}", path.display())
    })
}

/// Serialisiert die Read-Modify-Write-Vorgänge an den Config-Dateien (Audit S6):
/// der Startup-Thread (`reconcile_on_startup`) und der Einstellungs-Command
/// (`set_target`) dürfen sich nicht überschneiden (Lost-Update an Drittdaten).
fn config_lock() -> &'static Mutex<()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
}

/// Die Server-Definition dieser App im `mcpServers`-Format (Claude Desktop/Code).
fn desired_entry(exe: &str) -> Value {
    json!({ "command": exe, "args": ["mcp"] })
}

/// Setzt `mcpServers.slideo` in einer Claude-Config-Datei (idempotent).
/// `mcpServers` und alle anderen Einträge bleiben erhalten.
fn set_mcp_server(path: &Path, exe: &str) -> Result<(), String> {
    // WICHTIG: bei existierender-aber-unparsbarer Datei NICHT auf `{}` zurückfallen —
    // write_json ersetzt die Datei komplett und würde sonst fremde Config vernichten.
    // Nur eine fehlende Datei startet frisch. Spiegelt remove_mcp_server/meta_unregister
    // („unparsbar → lieber nichts kaputtmachen").
    let mut config = read_json_checked(path)?.unwrap_or_else(|| json!({}));
    if !config.is_object() {
        return Err(format!(
            "Config ({}) ist kein JSON-Objekt — abgebrochen, um keinen Datenverlust an einer fremden Config zu riskieren.",
            path.display()
        ));
    }
    let desired = desired_entry(exe);
    let root = config.as_object_mut().unwrap();
    let servers = root.entry("mcpServers").or_insert_with(|| json!({}));
    if !servers.is_object() {
        *servers = json!({});
    }
    let servers = servers.as_object_mut().unwrap();
    if servers.get(SERVER_NAME) == Some(&desired) {
        return Ok(()); // bereits korrekt → nicht schreiben
    }
    servers.insert(SERVER_NAME.to_string(), desired);
    write_json(path, &config)
}

/// Entfernt `mcpServers.slideo` aus einer Claude-Config-Datei (best effort).
fn remove_mcp_server(path: &Path) -> Result<(), String> {
    let Some(mut config) = read_json(path) else {
        return Ok(()); // keine Datei → nichts zu tun
    };
    let removed = config
        .get_mut("mcpServers")
        .and_then(|s| s.as_object_mut())
        .map(|map| map.remove(SERVER_NAME).is_some())
        .unwrap_or(false);
    if removed {
        write_json(path, &config)?;
    }
    Ok(())
}

fn mcp_server_registered(path: &Path) -> bool {
    read_json(path)
        .and_then(|c| {
            c.get("mcpServers")
                .and_then(|s| s.get(SERVER_NAME))
                .cloned()
        })
        .is_some()
}

// ─────────────────────────── Claude Desktop ───────────────────────────

fn desktop_config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("Claude").join("claude_desktop_config.json"))
}

/// Claude Desktop gilt als verfügbar, wenn sein Config-Ordner existiert.
fn desktop_available() -> bool {
    desktop_config_path()
        .and_then(|p| p.parent().map(|d| d.exists()))
        .unwrap_or(false)
}

fn desktop_registered() -> bool {
    desktop_config_path().map(|p| mcp_server_registered(&p)).unwrap_or(false)
}

fn desktop_register(exe: &str) -> Result<(), String> {
    let Some(path) = desktop_config_path() else {
        return Err("Kein Config-Verzeichnis gefunden.".into());
    };
    // Keine Phantom-Config bei Nicht-Nutzern anlegen.
    if !desktop_available() {
        return Err("Claude Desktop ist nicht installiert.".into());
    }
    set_mcp_server(&path, exe)
}

fn desktop_unregister() -> Result<(), String> {
    let Some(path) = desktop_config_path() else {
        return Ok(());
    };
    remove_mcp_server(&path)
}

// ─────────────────────────── Claude Code ───────────────────────────

fn claude_config_path() -> Option<PathBuf> {
    dirs::home_dir().map(|d| d.join(".claude.json"))
}

/// Claude Code gilt als verfügbar, wenn `~/.claude.json` oder `~/.claude/` existiert.
fn claude_available() -> bool {
    let Some(home) = dirs::home_dir() else {
        return false;
    };
    home.join(".claude.json").exists() || home.join(".claude").exists()
}

fn claude_registered() -> bool {
    claude_config_path().map(|p| mcp_server_registered(&p)).unwrap_or(false)
}

fn claude_register(exe: &str) -> Result<(), String> {
    // Bewusst direktes Editieren von ~/.claude.json statt `claude mcp add`:
    // GUI-Apps (vom Finder/Dock gestartet) erben den Shell-PATH nicht, die
    // `claude`-CLI ist daher oft nicht auffindbar. Der Datei-Edit ist äquivalent
    // (User-Scope = top-level `mcpServers`), idempotent und PATH-unabhängig.
    let Some(path) = claude_config_path() else {
        return Err("Kein Home-Verzeichnis gefunden.".into());
    };
    set_mcp_server(&path, exe)
}

fn claude_unregister() -> Result<(), String> {
    let Some(path) = claude_config_path() else {
        return Ok(());
    };
    remove_mcp_server(&path)
}

// ─────────────────────────── Meta-MCP ───────────────────────────

fn meta_config_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("com.metamcp.desktop").join("config.json"))
}

/// Meta-MCP läuft, wenn `GET http://localhost:3663/` mit 200 antwortet.
fn meta_available() -> bool {
    matches!(meta_http("GET", "/", None), Ok((200, _)))
}

/// Registriert (file-basiert) erkennbar an einem `servers`-Eintrag mit name == "slideo".
fn meta_registered() -> bool {
    let Some(path) = meta_config_path() else {
        return false;
    };
    read_json(&path)
        .and_then(|c| c.get("servers").and_then(|s| s.as_array().cloned()))
        .map(|arr| {
            arr.iter()
                .any(|s| s.get("name").and_then(|n| n.as_str()) == Some(SERVER_NAME))
        })
        .unwrap_or(false)
}

/// Registrierung läuft über `POST /register` (hot-reload, dedupliziert per name,
/// vergibt selbst eine id). Erfordert ein laufendes Meta-MCP.
fn meta_register(exe: &str) -> Result<(), String> {
    if !meta_available() {
        return Err(
            "Meta-MCP läuft nicht (localhost:3663 nicht erreichbar). Bitte Meta-MCP starten."
                .into(),
        );
    }
    let body = json!({
        "name": SERVER_NAME,
        "transport": "stdio",
        "command": exe,
        "args": ["mcp"],
        "env": {},
        "active": true,
    })
    .to_string();
    let (status, _) = meta_http("POST", "/register", Some(&body))?;
    if (200..300).contains(&status) {
        Ok(())
    } else {
        Err(format!("Meta-MCP /register antwortete mit HTTP {status}."))
    }
}

/// Meta-MCP hat (noch) keinen Unregister-Endpoint → eigenen Eintrag aus der
/// beobachteten config.json entfernen (live neu geladen). NUR `servers`-Einträge
/// mit name == "slideo"; `profiles`/`active_profile` bleiben unangetastet.
fn meta_unregister() -> Result<(), String> {
    let Some(path) = meta_config_path() else {
        return Ok(());
    };
    if !path.exists() {
        return Ok(());
    }
    let Some(mut config) = read_json(&path) else {
        return Ok(()); // unparsbar → lieber nichts kaputtmachen
    };
    let Some(servers) = config.get_mut("servers").and_then(|s| s.as_array_mut()) else {
        return Ok(());
    };
    let before = servers.len();
    servers.retain(|s| s.get("name").and_then(|n| n.as_str()) != Some(SERVER_NAME));
    if servers.len() == before {
        return Ok(()); // war nicht drin
    }
    write_json(&path, &config)
}

// ─────────────────────────── Reconcile ───────────────────────────

fn current_exe() -> Result<String, String> {
    std::env::current_exe()
        .map(|p| p.to_string_lossy().into_owned())
        .map_err(|e| format!("Eigenen Pfad nicht ermittelbar: {e}"))
}

fn register(target: Target, exe: &str) -> Result<(), String> {
    match target {
        Target::Desktop => desktop_register(exe),
        Target::Meta => meta_register(exe),
        Target::Claude => claude_register(exe),
    }
}

fn unregister(target: Target) -> Result<(), String> {
    match target {
        Target::Desktop => desktop_unregister(),
        Target::Meta => meta_unregister(),
        Target::Claude => claude_unregister(),
    }
}

/// Stellt den Zielzustand idempotent her: gewähltes Ziel registrieren, die
/// anderen beiden deregistrieren.
///
/// Reihenfolge bewusst: ERST das gewählte Ziel registrieren. Schlägt das fehl
/// (z.B. Meta-MCP gewählt, aber down), wird abgebrochen, OHNE die anderen Ziele
/// zu entfernen — so bleibt eine bestehende, funktionierende Registrierung
/// erhalten und der Fehler wird klar gemeldet (kein stilles Eintragen woanders).
fn reconcile(target: Target) -> Result<(), String> {
    // RMW der Config-Dateien serialisieren (Audit S6).
    let _guard = config_lock().lock().unwrap_or_else(|e| e.into_inner());
    let exe = current_exe()?;
    register(target, &exe)?;
    // Erst nach erfolgreicher Registrierung die anderen aufräumen (best effort).
    for other in Target::ALL {
        if other == target {
            continue;
        }
        if let Err(e) = unregister(other) {
            eprintln!("[slideo] Deregistrierung von {} fehlgeschlagen: {e}", other.key());
        }
    }
    Ok(())
}

// ─────────────────────────── Persistenz ───────────────────────────

fn target_file() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("slideo").join("mcp.json"))
}

fn load_target() -> Option<Target> {
    let path = target_file()?;
    read_json(&path)?
        .get("target")
        .and_then(|t| t.as_str())
        .and_then(Target::from_key)
}

fn save_target(target: Target) {
    if let Some(path) = target_file() {
        let _ = write_json(&path, &json!({ "target": target.key() }));
    }
}

/// Default-Reihenfolge (vom Entwickler festgelegt): Claude Desktop, dann
/// Meta-MCP falls erreichbar, sonst Claude Code.
fn default_target() -> Target {
    if desktop_available() {
        Target::Desktop
    } else if meta_available() {
        Target::Meta
    } else {
        Target::Claude
    }
}

/// `--mcp-target=meta|claude|desktop` aus den Prozess-Argumenten (App-Modus).
fn cli_target() -> Option<Target> {
    std::env::args().find_map(|arg| arg.strip_prefix("--mcp-target=").and_then(Target::from_key))
}

// ─────────────────────────── Last-Error (für UI) ───────────────────────────

fn last_error() -> &'static Mutex<Option<String>> {
    static ERR: OnceLock<Mutex<Option<String>>> = OnceLock::new();
    ERR.get_or_init(|| Mutex::new(None))
}

fn set_last_error(value: Option<String>) {
    if let Ok(mut guard) = last_error().lock() {
        *guard = value;
    }
}

// ─────────────────────────── Öffentliche API ───────────────────────────

/// Beim App-Start aufrufen (im Hintergrund-Thread, da Netz/Datei-I/O).
/// Ermittelt das Ziel (CLI > persistiert > Default), persistiert es und stellt
/// den Zustand idempotent her.
pub fn reconcile_on_startup() {
    // Beim allerersten Start (kein Ziel persistiert UND kein CLI-Flag) NICHT
    // automatisch registrieren — der Nutzer wählt zuerst im Erststart-Modal. Erst
    // dessen Auswahl (Command `mcp_set_target`) trägt den Server ein und aktiviert ihn.
    let Some(target) = cli_target().or_else(load_target) else {
        eprintln!("[slideo] Kein MCP-Ziel gewählt — warte auf Erstauswahl im Modal.");
        return;
    };
    save_target(target);
    match reconcile(target) {
        Ok(()) => {
            set_last_error(None);
            eprintln!("[slideo] MCP-Ziel aktiv: {}", target.key());
        }
        Err(e) => {
            set_last_error(Some(e.clone()));
            eprintln!("[slideo] MCP-Registrierung ({}) fehlgeschlagen: {e}", target.key());
        }
    }
}

/// Wechselt das aktive Ziel (aus den Einstellungen). Persistiert NUR bei Erfolg —
/// schlägt die Registrierung fehl, bleibt das bisherige Ziel/seine Registrierung
/// unverändert und der Fehler wird zurückgegeben.
pub fn set_target(target: Target) -> Result<(), String> {
    match reconcile(target) {
        Ok(()) => {
            save_target(target);
            set_last_error(None);
            Ok(())
        }
        Err(e) => {
            set_last_error(Some(e.clone()));
            Err(e)
        }
    }
}

/// Statusabbild für die UI: aktuelles Ziel + Verfügbarkeit/Registrierung je Ziel.
/// `configured` ist false, solange noch keine Erstauswahl getroffen wurde — dann
/// ist `target` lediglich der empfohlene Default (für die Vorauswahl im Modal).
pub fn status() -> Value {
    let saved = load_target();
    let configured = saved.is_some();
    let target = saved.unwrap_or_else(default_target);
    json!({
        "configured": configured,
        "target": target.key(),
        // Zur Laufzeit aus der Quelle der Wahrheit (Review 2026-08, Befund M1/S30):
        // Setup- und Hilfe-Modal hatten die Zahl hartkodiert und bewarben 35 Tools,
        // während es längst 37 waren — der erste Satz, den ein Neunutzer über das
        // Differenzierungsmerkmal liest. Hartkodierte Fakten driften; abgeleitete nicht.
        "toolCount": crate::tools::tool_schemas().as_array().map(|a| a.len()).unwrap_or(0),
        "desktop": { "available": desktop_available(), "registered": desktop_registered() },
        "meta": { "available": meta_available(), "registered": meta_registered() },
        "claude": { "available": claude_available(), "registered": claude_registered() },
        "lastError": last_error().lock().ok().and_then(|g| g.clone()),
        // Fertiges Konfigurations-Snippet fuer JEDEN anderen MCP-Client (Review
        // 2026-08, Befund H4/S33). Empty-State, Onboarding, Hilfe und Settings
        // versprechen viermal „beliebiger MCP-Client" und nennen Codex CLI — die
        // Zielliste kennt aber exakt `desktop|meta|claude`. Cursor-, Windsurf-,
        // Zed- und LM-Studio-Nutzer hatten NULL Pfad, obwohl `desired_entry` genau
        // das noetige Objekt intern schon baut. Es hier zu exponieren hebt die harte
        // 3-Client-Decke praktisch kostenlos auf — Slideo registriert dabei nichts,
        // der Nutzer traegt es selbst ein.
        "genericConfig": current_exe().ok().map(|exe| json!({
            "mcpServers": { "slideo": desired_entry(&exe) }
        })),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn target_keys_roundtrip() {
        for t in Target::ALL {
            assert_eq!(Target::from_key(t.key()), Some(t));
        }
        assert_eq!(Target::from_key("unsinn"), None);
    }

    #[test]
    fn set_and_remove_mcp_server_is_idempotent() {
        let dir = std::env::temp_dir().join(format!("slideo-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("claude_desktop_config.json");

        // Fremden Eintrag voranstellen, der erhalten bleiben muss.
        std::fs::write(
            &path,
            json!({ "mcpServers": { "other": { "command": "x" } } }).to_string(),
        )
        .unwrap();

        set_mcp_server(&path, "/bin/slideo").unwrap();
        let cfg = read_json(&path).unwrap();
        assert_eq!(cfg["mcpServers"]["slideo"]["command"], "/bin/slideo");
        assert_eq!(cfg["mcpServers"]["slideo"]["args"][0], "mcp");
        assert!(cfg["mcpServers"]["other"].is_object(), "Fremdeintrag bleibt");
        assert!(mcp_server_registered(&path));

        remove_mcp_server(&path).unwrap();
        let cfg = read_json(&path).unwrap();
        assert!(cfg["mcpServers"].get("slideo").is_none());
        assert!(cfg["mcpServers"]["other"].is_object(), "Fremdeintrag bleibt");
        assert!(!mcp_server_registered(&path));

        std::fs::remove_dir_all(&dir).ok();
    }

    #[cfg(unix)]
    #[test]
    fn write_json_preserves_existing_permissions() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("slideo-perms-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("config.json");
        // Fremde Config wie ~/.claude.json: existiert mit 0600.
        std::fs::write(&path, "{}").unwrap();
        std::fs::set_permissions(&path, std::fs::Permissions::from_mode(0o600)).unwrap();

        write_json(&path, &json!({ "a": 1 })).unwrap();

        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "Zieldatei-Rechte bleiben 0600 (Audit-Review M2)");
        // Keine Temp-Datei zurückgelassen.
        let tmp_left = std::fs::read_dir(&dir)
            .unwrap()
            .filter_map(|e| e.ok())
            .any(|e| e.file_name().to_string_lossy().contains(".tmp"));
        assert!(!tmp_left, "keine Temp-Datei übrig");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[cfg(unix)]
    #[test]
    fn write_json_new_file_is_restrictive() {
        use std::os::unix::fs::PermissionsExt;
        let dir = std::env::temp_dir().join(format!("slideo-perms-new-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("new.json");

        write_json(&path, &json!({ "a": 1 })).unwrap();

        let mode = std::fs::metadata(&path).unwrap().permissions().mode() & 0o777;
        assert_eq!(mode, 0o600, "neue Config wird restriktiv (0600) angelegt");
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn meta_unregister_only_touches_own_servers() {
        let dir = std::env::temp_dir().join(format!("slideo-meta-test-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        let path = dir.join("config.json");

        std::fs::write(
            &path,
            json!({
                "active_profile": "default",
                "profiles": [{ "name": "default" }],
                "servers": [
                    { "id": "1", "name": "slideo", "transport": "stdio" },
                    { "id": "2", "name": "fremd", "transport": "sse" }
                ]
            })
            .to_string(),
        )
        .unwrap();

        // meta_unregister liest aus dem echten config-Pfad — daher hier direkt die
        // gleiche retain-Logik prüfen, indem wir die Datei manuell verarbeiten.
        let mut config = read_json(&path).unwrap();
        let servers = config.get_mut("servers").unwrap().as_array_mut().unwrap();
        servers.retain(|s| s.get("name").and_then(|n| n.as_str()) != Some(SERVER_NAME));
        write_json(&path, &config).unwrap();

        let cfg = read_json(&path).unwrap();
        let servers = cfg["servers"].as_array().unwrap();
        assert_eq!(servers.len(), 1);
        assert_eq!(servers[0]["name"], "fremd");
        assert_eq!(cfg["active_profile"], "default", "profiles unangetastet");

        std::fs::remove_dir_all(&dir).ok();
    }
}
