//! Crash-Recovery: automatisch geschriebene Sicherungskopien (Review 2026-08, Befund B4).
//!
//! Vorher wurde ausschließlich bei einem expliziten Cmd+S auf Platte geschrieben.
//! Das Risikofenster war exakt die Kernschleife des Produkts: ein Agent baut zehn
//! Minuten lang ein Deck über 100+ Tool-Calls, die WebView stürzt ab — und alles ist
//! weg. Die Versionshistorie half nicht, denn `createSnapshot` braucht einen
//! Dateipfad und lief nur aus `savePresentation` heraus.
//!
//! Bewusst getrennt von der Versionshistorie ([history.rs]):
//!   - Historie = **kuratierte** Stände, die der Mensch wiederherstellen will.
//!   - Recovery = **eine** flüchtige Sicherung pro Sitzung, die nach einem sauberen
//!     Speichern verschwindet und nur nach einem Absturz auftaucht.
//! Deshalb auch kein Index und keine Kappung: es gibt höchstens eine Datei je Sitzung.

use crate::file::{self, Asset};
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;

/// `<config>/slideo/recovery/`
fn dir() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("slideo").join("recovery"))
}

/// Pfad der Sicherung dieser Sitzung. `session` ist eine vom Frontend erzeugte UUID,
/// damit zwei parallel laufende Instanzen sich nicht gegenseitig überschreiben.
fn session_path(session: &str) -> Result<PathBuf, String> {
    // Pfad-Traversal ausschließen (dieselbe Härtung wie history::valid_id).
    if session.is_empty()
        || session.len() > 64
        || !session.chars().all(|c| c.is_ascii_alphanumeric() || c == '-')
    {
        return Err("Ungültige Sitzungs-ID".into());
    }
    let d = dir().ok_or("Kein Config-Verzeichnis gefunden")?;
    Ok(d.join(format!("{session}.slideo")))
}

#[derive(Serialize, Clone)]
pub struct RecoveryInfo {
    /// Sitzungs-ID der gefundenen Sicherung.
    pub session: String,
    /// Ursprünglicher Dateipfad des Decks (leer, wenn es nie gespeichert wurde).
    pub original_path: Option<String>,
    /// Titel des Decks, für die Rückfrage beim Nutzer.
    pub title: String,
    /// Anzahl Folien.
    pub zone_count: usize,
    /// Änderungszeitpunkt (RFC3339, aus `meta.modified`).
    pub modified: Option<String>,
}

/// Schreibt die Sicherung dieser Sitzung (atomar über `file::write_presentation`).
/// `original_path` wandert als Zusatzfeld in die Kopie, damit „Wiederherstellen"
/// später weiß, wohin der Stand eigentlich gehört.
#[tauri::command]
pub fn recovery_write(
    session: String,
    presentation: Value,
    assets: Vec<Asset>,
    original_path: Option<String>,
) -> Result<(), String> {
    let path = session_path(&session)?;
    if let Some(parent) = path.parent() {
        std::fs::create_dir_all(parent).map_err(|e| e.to_string())?;
    }
    // Additiv unter `meta`: der Reader ist schema-agnostisch, das Feld überlebt also
    // den Round-Trip und stört kein reguläres Deck (es landet nie in einer echten
    // .slideo-Datei, weil die Recovery-Kopie nach dem Speichern gelöscht wird).
    let mut copy = presentation;
    if let Some(meta) = copy.get_mut("meta").and_then(|m| m.as_object_mut()) {
        meta.insert(
            "_recovery_original_path".into(),
            match &original_path {
                Some(p) => Value::String(p.clone()),
                None => Value::Null,
            },
        );
    }
    file::write_presentation(&path, &copy, &assets).map_err(|e| format!("{e:#}"))
}

/// Löscht die Sicherung dieser Sitzung (nach erfolgreichem Speichern bzw. sauberem Beenden).
#[tauri::command]
pub fn recovery_clear(session: String) -> Result<(), String> {
    let path = session_path(&session)?;
    match std::fs::remove_file(&path) {
        Ok(()) => Ok(()),
        Err(e) if e.kind() == std::io::ErrorKind::NotFound => Ok(()),
        Err(e) => Err(e.to_string()),
    }
}

/// Sucht beim Start nach einer verwaisten Sicherung (= letzte Sitzung endete nicht sauber).
/// Gibt die jüngste zurück; ältere werden dabei nicht angefasst.
#[tauri::command]
pub fn recovery_scan() -> Option<RecoveryInfo> {
    let d = dir()?;
    let entries = std::fs::read_dir(&d).ok()?;
    let mut best: Option<(std::time::SystemTime, PathBuf)> = None;
    for e in entries.flatten() {
        let p = e.path();
        if p.extension().and_then(|s| s.to_str()) != Some("slideo") {
            continue;
        }
        let mtime = e.metadata().ok().and_then(|m| m.modified().ok())?;
        if best.as_ref().map(|(t, _)| mtime > *t).unwrap_or(true) {
            best = Some((mtime, p));
        }
    }
    let (_, path) = best?;
    let value = file::read_presentation(&path).ok()?;
    let meta = value.get("meta");
    Some(RecoveryInfo {
        session: path.file_stem()?.to_string_lossy().to_string(),
        original_path: meta
            .and_then(|m| m.get("_recovery_original_path"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        title: meta
            .and_then(|m| m.get("title"))
            .and_then(|v| v.as_str())
            .unwrap_or("Unbenannt")
            .to_string(),
        zone_count: value
            .get("zones")
            .and_then(|z| z.as_array())
            .map(|a| a.len())
            .unwrap_or(0),
        modified: meta
            .and_then(|m| m.get("modified"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
    })
}

/// Lädt eine gefundene Sicherung (Presentation + Assets) und löscht sie danach.
#[tauri::command]
pub fn recovery_take(session: String) -> Result<crate::commands::LoadResult, String> {
    let path = session_path(&session)?;
    let mut presentation = file::read_presentation(&path).map_err(|e| format!("{e:#}"))?;
    let assets = file::read_assets(&path).unwrap_or_default();
    // Das interne Feld nicht ins wiederhergestellte Deck durchreichen.
    if let Some(meta) = presentation.get_mut("meta").and_then(|m| m.as_object_mut()) {
        meta.remove("_recovery_original_path");
    }
    let _ = std::fs::remove_file(&path);
    Ok(crate::commands::LoadResult { presentation, assets })
}

/// Verwirft eine gefundene Sicherung, ohne sie zu laden.
#[tauri::command]
pub fn recovery_discard(session: String) -> Result<(), String> {
    recovery_clear(session)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn session_path_weist_pfad_traversal_ab() {
        assert!(session_path("../../etc/passwd").is_err());
        assert!(session_path("a/b").is_err());
        assert!(session_path("").is_err());
        assert!(session_path(&"x".repeat(65)).is_err());
        assert!(session_path("2f1c9a4e-1111-4222-8333-444455556666").is_ok());
    }
}
