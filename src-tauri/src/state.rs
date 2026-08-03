use crate::file::Asset;
use serde_json::Value;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::atomic::{AtomicU64, Ordering};
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
    /// Zählt jede Spiegelung des Frontend-States nach Rust (`sync_presentation`).
    ///
    /// Grundlage des Flush-Handshakes (Review 2026-08, Befund B7): der Store spiegelt
    /// debounced nach Rust, ein Tool-Call mutierte also eine bis zu 400 ms alte Kopie
    /// und schickte sie als Ganzes zurück — die zuletzt getippten Zeichen waren weg,
    /// ohne Konflikterkennung. Vor einer Mutation wartet `ipc.rs` jetzt kurz darauf,
    /// dass dieser Zähler vorrückt, das Frontend also seinen frischen Stand geliefert hat.
    pub sync_seq: AtomicU64,
    /**
     * Zuletzt beobachtete MCP-Aktivität (Review 2026-08, Befund B8).
     *
     * Die Verbindung war prinzipiell unbeobachtbar: der IPC-Server trackte keine
     * Session, das Frontend zeigte nichts an, und der stdio-Prozess beantwortet
     * `initialize`/`tools/list` **lokal** — der KI-Client meldet also „Tools da,
     * gesund", auch wenn die App gar nicht läuft. Erst der erste echte Tool-Call
     * scheitert. Hier steht deshalb, wann zuletzt WIRKLICH ein Tool ausgeführt wurde.
     */
    pub mcp_activity: Mutex<Option<McpActivity>>,
}

/// Letzter tatsächlich ausgeführter MCP-Tool-Call.
#[derive(Clone, serde::Serialize)]
pub struct McpActivity {
    /// Name des Tools (z.B. "create_zone").
    pub tool: String,
    /// Unix-Millisekunden — das Frontend rechnet daraus „vor N s".
    pub at_ms: u64,
    /// Version des verbundenen `slideo mcp`-Binaries, falls mitgeschickt.
    pub client_version: Option<String>,
}

impl AppState {
    /// Meldet, dass das Frontend seinen Stand gespiegelt hat (Flush-Handshake, B7).
    pub fn bump_sync(&self) {
        self.sync_seq.fetch_add(1, Ordering::SeqCst);
    }

    /// Aktueller Stand des Sync-Zählers.
    pub fn sync_seq(&self) -> u64 {
        self.sync_seq.load(Ordering::SeqCst)
    }

    /// Hält fest, dass gerade ein Tool ausgeführt wurde (Befund B8).
    pub fn note_mcp_activity(&self, tool: &str, client_version: Option<String>) {
        let at_ms = std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .map(|d| d.as_millis() as u64)
            .unwrap_or(0);
        *lock_recover(&self.mcp_activity) = Some(McpActivity {
            tool: tool.to_string(),
            at_ms,
            client_version,
        });
    }

    /// Letzte MCP-Aktivität (für den Verbindungs-Chip im Frontend).
    pub fn mcp_activity(&self) -> Option<McpActivity> {
        lock_recover(&self.mcp_activity).clone()
    }

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
