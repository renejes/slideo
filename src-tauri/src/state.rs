use crate::file::Asset;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::{Arc, Mutex, MutexGuard};

/// Sperrt einen Mutex und erholt sich von Vergiftung (Review 2026-08, Befund S12).
///
/// Vorher stand überall `.lock().unwrap()`. Ein einziger Panic in `tools::handle`
/// vergiftete damit `presentation`/`file_path`/`assets` — und JEDER spätere
/// MCP-Request **und jedes Tauri-Command**, das denselben Mutex anfasst, panickte
/// nach: MCP und Speichern waren bis zum App-Neustart tot.
///
/// Die Daten hinter dem Mutex sind reine JSON-/Pfad-Werte ohne Invarianten, die ein
/// halb ausgeführter Handler brechen könnte (`tools::handle` mutiert `Option<Value>`
/// in sich abgeschlossen). Weiterarbeiten ist hier also sicher — und in jedem Fall
/// besser als eine Anwendung, die bis zum Neustart nicht mehr speichern kann.
pub fn lock_recover<T>(m: &Mutex<T>) -> MutexGuard<'_, T> {
    m.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

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
        *lock_recover(&self.assets) = assets;
        lock_recover(&self.asset_cache).clear();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn lock_recover_arbeitet_nach_vergiftung_weiter() {
        // Der Fehlermodus aus Befund S12 nachgestellt: ein Panic, der einen Mutex
        // vergiftet. Mit `.lock().unwrap()` wäre danach JEDER weitere Zugriff ein
        // Panic (MCP + Speichern tot bis Neustart); lock_recover muss weiterlaufen
        // und den zuletzt geschriebenen Wert sehen.
        let m = std::sync::Arc::new(Mutex::new(1_u32));
        let m2 = m.clone();
        let _ = std::thread::spawn(move || {
            let mut g = m2.lock().unwrap();
            *g = 42;
            panic!("vergiftet den Mutex");
        })
        .join();

        assert!(m.lock().is_err(), "Mutex sollte vergiftet sein");
        assert_eq!(*lock_recover(&m), 42);
        *lock_recover(&m) = 7;
        assert_eq!(*lock_recover(&m), 7);
    }
}
