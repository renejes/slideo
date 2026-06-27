use crate::file::Asset;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex};

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
    /// Decode-Cache des `slideoasset://`-Protokoll-Handlers (Audit P7): name → (mime,
    /// dekodierte Bytes). Vermeidet das base64-Dekodieren pro Request (v.a. bei großen,
    /// wiederholt angefragten Videos). Wird bei jeder Asset-Änderung invalidiert.
    pub asset_cache: Mutex<HashMap<String, Arc<(String, Vec<u8>)>>>,
}

impl AppState {
    /// Setzt die Asset-Liste und invalidiert den Decode-Cache (Audit P7) — in einem
    /// Schritt, damit der Cache nie veraltete Bytes zu einem neuen Asset gleichen Namens
    /// liefert. Einziger Schreibpfad für `assets`.
    pub fn set_assets(&self, assets: Vec<Asset>) {
        *self.assets.lock().unwrap() = assets;
        self.asset_cache.lock().unwrap().clear();
    }
}
