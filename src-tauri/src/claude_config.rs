//! Trägt Slideo automatisch als MCP-Server in die Claude-Desktop-Config ein.
//!
//! Idempotent: existiert der Eintrag bereits korrekt, wird nichts geschrieben.
//! Andere mcpServers-Einträge bleiben unangetastet. Geschrieben wird nur, wenn
//! das Claude-Verzeichnis existiert (Claude Desktop also installiert ist) —
//! so legen wir keine Phantom-Config bei Nicht-Nutzern an.

use serde_json::{json, Value};

fn config_path() -> Option<std::path::PathBuf> {
    // macOS: ~/Library/Application Support/Claude/…
    // Windows: %APPDATA%/Claude/…   Linux: ~/.config/Claude/…
    dirs::config_dir().map(|d| d.join("Claude").join("claude_desktop_config.json"))
}

pub fn ensure_registered() {
    let Some(path) = config_path() else { return };
    let Some(claude_dir) = path.parent() else { return };
    if !claude_dir.exists() {
        return; // Claude Desktop nicht installiert → nichts tun
    }

    let exe = match std::env::current_exe() {
        Ok(e) => e.to_string_lossy().to_string(),
        Err(_) => return,
    };

    let mut config: Value = std::fs::read_to_string(&path)
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_else(|| json!({}));
    if !config.is_object() {
        config = json!({});
    }

    let desired = json!({ "command": exe, "args": ["mcp"] });

    let root = config.as_object_mut().unwrap();
    let servers = root.entry("mcpServers").or_insert_with(|| json!({}));
    if !servers.is_object() {
        *servers = json!({});
    }
    let servers = servers.as_object_mut().unwrap();

    if servers.get("slideo") == Some(&desired) {
        return; // bereits korrekt eingetragen
    }
    servers.insert("slideo".to_string(), desired);

    let _ = std::fs::write(&path, serde_json::to_string_pretty(&config).unwrap_or_default());
    eprintln!("[slideo] In Claude-Desktop-Config eingetragen: {}", path.display());
}
