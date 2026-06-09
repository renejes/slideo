use crate::file::Asset;
use serde_json::Value;
use std::path::PathBuf;
use std::sync::Mutex;

/// In-Memory-Zustand der App.
///
/// Autoritativ liegt der State im Frontend (Zustand-Store). Dies ist die
/// Backend-Spiegelung der zuletzt geladenen/gespeicherten Presentation – an ihr
/// dockt der MCP-Socket-Server an (laufende App hält den State, MCP-Client
/// verbindet sich live). `assets` wird vom Frontend gespiegelt, damit MCP-Saves
/// die Bilder nicht verlieren.
#[derive(Default)]
pub struct AppState {
    pub presentation: Mutex<Option<Value>>,
    pub file_path: Mutex<Option<PathBuf>>,
    pub assets: Mutex<Vec<Asset>>,
}
