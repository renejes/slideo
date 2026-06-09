use crate::file::{self, Asset};
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
    *state.assets.lock().unwrap() = assets.clone();

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
    *state.assets.lock().unwrap() = assets;
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
    *state.assets.lock().unwrap() = assets;
}

/// Setzt den bekannten Dateipfad (z.B. nach "Neu"/Reset im Frontend).
#[tauri::command]
pub fn set_file_path(path: Option<String>, state: State<'_, AppState>) {
    *state.file_path.lock().unwrap() = path.map(PathBuf::from);
}
