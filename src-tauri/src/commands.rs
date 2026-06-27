use crate::file::{self, Asset};
use crate::history;
use crate::mcp_registration::{self, Target};
use crate::state::AppState;
use serde::Serialize;
use serde_json::Value;
use std::path::PathBuf;
use tauri::State;

/// Ergebnis von `load_presentation`: Presentation + zugehörige Assets.
#[derive(Serialize)]
pub struct LoadResult {
    pub presentation: Value,
    pub assets: Vec<Asset>,
}

/// Lädt eine `.slideo`-Datei (Presentation + Assets).
/// Spiegelt das Ergebnis zusätzlich in den AppState (für den MCP-Server).
#[tauri::command]
pub fn load_presentation(path: String, state: State<'_, AppState>) -> Result<LoadResult, String> {
    let pb = PathBuf::from(&path);
    let presentation = file::read_presentation(&pb).map_err(|e| format!("{e:#}"))?;
    let assets = file::read_assets(&pb).unwrap_or_default();

    *state.presentation.lock().unwrap() = Some(presentation.clone());
    *state.file_path.lock().unwrap() = Some(pb);
    state.set_assets(assets.clone()); // + Decode-Cache invalidieren (P7)

    Ok(LoadResult { presentation, assets })
}

/// Schreibt die übergebene Presentation + Assets als `.slideo`-Datei an `path`.
#[tauri::command]
pub fn save_presentation(
    path: String,
    presentation: Value,
    assets: Vec<Asset>,
    state: State<'_, AppState>,
) -> Result<(), String> {
    let pb = PathBuf::from(&path);
    file::write_presentation(&pb, &presentation, &assets).map_err(|e| format!("{e:#}"))?;
    *state.presentation.lock().unwrap() = Some(presentation);
    *state.file_path.lock().unwrap() = Some(pb);
    state.set_assets(assets); // + Decode-Cache invalidieren (P7)
    Ok(())
}

/// Spiegelt den aktuellen Frontend-State (Zustand-Store) in den Backend-AppState.
/// Wird vom Frontend bei Änderungen aufgerufen, damit der MCP-Server jederzeit
/// den aktuellen Stand lesen/mutieren kann. Löst bewusst KEIN Event aus
/// (sonst Echo-Schleife mit den MCP-Events).
#[tauri::command]
pub fn sync_presentation(presentation: Option<Value>, state: State<'_, AppState>) {
    *state.presentation.lock().unwrap() = presentation;
}

/// Spiegelt die Asset-Map ins Backend (separat, da Assets selten/größer sind).
#[tauri::command]
pub fn sync_assets(assets: Vec<Asset>, state: State<'_, AppState>) {
    state.set_assets(assets); // + Decode-Cache invalidieren (P7)
}

/// Liefert den aktuellen Presentation-State (für das Presenter-Zweitfenster, Spec §19.3).
/// Das Projector-Fenster rendert daraus die Folien; gespiegelt wird er vom Hauptfenster.
#[tauri::command]
pub fn get_presentation(state: State<'_, AppState>) -> Option<Value> {
    state.presentation.lock().unwrap().clone()
}

/// Liefert die aktuellen Assets (für das Presenter-Zweitfenster).
#[tauri::command]
pub fn get_assets(state: State<'_, AppState>) -> Vec<Asset> {
    state.assets.lock().unwrap().clone()
}

/// Setzt den bekannten Dateipfad (z.B. nach "Neu"/Reset im Frontend).
#[tauri::command]
pub fn set_file_path(path: Option<String>, state: State<'_, AppState>) {
    *state.file_path.lock().unwrap() = path.map(PathBuf::from);
}

/// Schreibt eine fertige, eigenständige HTML-Page (Export/Teilen) an `path`.
/// Das Frontend rendert die Page (alle Assets inline) und reicht den String durch.
#[tauri::command]
pub fn export_html(path: String, html: String) -> Result<(), String> {
    std::fs::write(&path, html).map_err(|e| format!("Export fehlgeschlagen: {e}"))
}

/// Öffnet eine print-optimierte HTML-Page (PDF-Export) im Standardbrowser.
/// Der WKWebView unterstützt `window.print()` nicht zuverlässig — daher schreiben
/// wir die Page in eine Temp-Datei und öffnen sie extern; der Nutzer druckt dort
/// mit „Als PDF sichern" (Cmd/Strg+P). Gibt den Pfad der Temp-Datei zurück.
#[tauri::command]
pub fn open_print_view(html: String) -> Result<String, String> {
    // Zufälliger Dateiname (Audit S9): verhindert Symlink-/Clobber-Angriffe über einen
    // vorhersehbaren Namen in einem geteilten /tmp (Linux-Multiuser).
    let path = std::env::temp_dir().join(format!(
        "slideo-export-{}.html",
        uuid::Uuid::new_v4().simple()
    ));
    std::fs::write(&path, html).map_err(|e| format!("Schreiben fehlgeschlagen: {e}"))?;
    open_in_default_app(&path)?;
    Ok(path.to_string_lossy().to_string())
}

/// Schreibt eine base64-kodierte Binärdatei (z.B. PPTX) an `path`. Das Frontend
/// baut die `.pptx` mit pptxgenjs (native Rekonstruktion — kein Canvas-Rastern,
/// das im WKWebView unzuverlässig ist) und reicht sie als base64 durch.
#[tauri::command]
pub fn export_pptx(path: String, base64: String) -> Result<(), String> {
    use base64::Engine;
    let bytes = base64::engine::general_purpose::STANDARD
        .decode(base64.as_bytes())
        .map_err(|e| format!("Ungültige PPTX-Daten: {e}"))?;
    std::fs::write(&path, bytes).map_err(|e| format!("Export fehlgeschlagen: {e}"))
}

/// Listet die verfügbaren token-bewussten Komponenten (Metadaten: type, label,
/// description, params) für die Editor-Palette (Spec §18.7). Nutzt dieselbe Quelle
/// wie der MCP-Server (`crate::components`) — so braucht die UI keine TS-Duplikation
/// des Generators; eine künftige neue Komponente erscheint automatisch in der Palette.
#[tauri::command]
pub fn list_components() -> Value {
    crate::components::list()
}

/// Rendert eine Komponente zu token-bewusstem HTML (für die Editor-Palette).
/// Nutzt **denselben** Generator wie das MCP-Tool `insert_component`
/// (`crate::components::render`) — eine Quelle der Wahrheit, keine Template-
/// Duplikation. Fehler (unbekannter Typ, ungültige Params) werden durchgereicht.
#[tauri::command]
pub fn render_component(
    kind: String,
    params: Value,
    data_id: Option<String>,
) -> Result<String, String> {
    let html = crate::components::render(&kind, &params)?;
    Ok(match data_id.as_deref() {
        Some(d) if !d.is_empty() => crate::components::with_data_id(&html, d),
        _ => html,
    })
}

// ----- Versionshistorie (Spec §19.9) -----

/// Listet die lokalen Snapshots eines Decks (neueste zuerst).
#[tauri::command]
pub fn list_snapshots(file_path: String) -> Vec<history::SnapshotMeta> {
    history::list(&file_path)
}

/// Schreibt einen Snapshot (volle `.slideo`-Kopie). Dedupe: ist der Inhalt
/// identisch zum jüngsten Snapshot, wird `null` zurückgegeben (nichts geschrieben).
/// `id`/`created` kommen vom Frontend (UUID + ISO-Zeit).
#[tauri::command]
pub fn create_snapshot(
    file_path: String,
    presentation: Value,
    assets: Vec<Asset>,
    label: String,
    auto: bool,
    created: String,
    id: String,
) -> Result<Option<history::SnapshotMeta>, String> {
    history::create(&file_path, &presentation, &assets, &label, auto, &created, &id)
        .map_err(|e| format!("{e:#}"))
}

/// Liest einen Snapshot zur Wiederherstellung (Presentation + Assets).
/// Das Frontend lädt das Ergebnis in den Store (Dateipfad bleibt unverändert).
#[tauri::command]
pub fn restore_snapshot(file_path: String, id: String) -> Result<LoadResult, String> {
    history::restore(&file_path, &id)
        .map(|(presentation, assets)| LoadResult { presentation, assets })
        .map_err(|e| format!("{e:#}"))
}

/// Entfernt einen Snapshot (Datei + Index-Eintrag).
#[tauri::command]
pub fn delete_snapshot(file_path: String, id: String) -> Result<(), String> {
    history::delete(&file_path, &id).map_err(|e| format!("{e:#}"))
}

/// Liefert das aktuelle MCP-Registrierungs-Ziel + Verfügbarkeit/Status je Ziel
/// (für die Einstellungen). Macht u.a. eine Live-Probe gegen Meta-MCP.
#[tauri::command]
pub fn mcp_status() -> Value {
    mcp_registration::status()
}

/// Setzt das aktive MCP-Ziel (`meta` | `claude` | `desktop`): registriert es und
/// deregistriert die anderen beiden. Gibt bei Erfolg den frischen Status zurück;
/// schlägt die Registrierung fehl (z.B. Meta-MCP down), bleibt alles unverändert
/// und der Fehler wird gemeldet.
#[tauri::command]
pub fn mcp_set_target(target: String) -> Result<Value, String> {
    let t = Target::from_key(&target).ok_or_else(|| format!("Unbekanntes Ziel: {target}"))?;
    mcp_registration::set_target(t)?;
    Ok(mcp_registration::status())
}

/// Öffnet einen Pfad mit der Standard-App des Betriebssystems.
fn open_in_default_app(path: &std::path::Path) -> Result<(), String> {
    #[cfg(target_os = "macos")]
    let mut cmd = std::process::Command::new("open");
    #[cfg(target_os = "macos")]
    cmd.arg(path);

    #[cfg(target_os = "windows")]
    let mut cmd = {
        let mut c = std::process::Command::new("cmd");
        c.args(["/C", "start", ""]).arg(path);
        c
    };

    #[cfg(all(unix, not(target_os = "macos")))]
    let mut cmd = {
        let mut c = std::process::Command::new("xdg-open");
        c.arg(path);
        c
    };

    cmd.spawn().map_err(|e| format!("Öffnen fehlgeschlagen: {e}"))?;
    Ok(())
}
