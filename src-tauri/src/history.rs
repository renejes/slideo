//! Lokale Versionshistorie (Spec §19.9): Snapshots der `.slideo` als lokale Kopien.
//!
//! Snapshots liegen unter `<config>/slideo/history/<deck-key>/` — je Snapshot eine
//! vollständige `.slideo`-Datei (`<id>.slideo`, identisches Format wie der Hauptspeicher,
//! daher Reuse von `file::write_presentation`/`read_presentation`) plus ein `index.json`
//! mit den Metadaten (neueste zuerst). Der `deck-key` leitet sich aus dem Dateipfad ab,
//! d.h. die Historie hängt am Speicherort (nicht portabel — bewusst, Git-UI ist Spec §12).

use crate::file::{self, Asset};
use anyhow::{bail, Context, Result};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::path::{Path, PathBuf};
use std::sync::{Mutex, MutexGuard, OnceLock};

/// Prozessweiter Lock, der die Read-Modify-Write-Sequenz auf `index.json`
/// serialisiert (mehrere schnelle Saves → parallele `create_snapshot`-Commands
/// in eigenen Threads würden sich sonst überschreiben → verlorener Index-Eintrag).
fn index_lock() -> MutexGuard<'static, ()> {
    static LOCK: OnceLock<Mutex<()>> = OnceLock::new();
    LOCK.get_or_init(|| Mutex::new(()))
        .lock()
        .unwrap_or_else(|e| e.into_inner())
}

/// Snapshot-IDs landen in einem Dateinamen (`<id>.slideo`) — daher streng
/// validieren (kein Path-Traversal über `..`/Trenner). UUIDs erfüllen das.
fn valid_id(id: &str) -> bool {
    !id.is_empty()
        && id.len() <= 80
        && id.chars().all(|c| c.is_ascii_alphanumeric() || c == '-' || c == '_')
}

/// Metadaten eines Snapshots (in `index.json`, an das Frontend gereicht).
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct SnapshotMeta {
    pub id: String,      // Dateistamm des Snapshots (`<id>.slideo`)
    pub created: String, // ISO 8601 (vom Frontend gesetzt)
    pub label: String,   // optionale Beschriftung (leer bei Auto-Snapshots)
    pub auto: bool,      // true = automatisch beim Speichern, false = manuell
    pub title: String,   // Deck-Titel zum Zeitpunkt (für die Anzeige)
    pub slide_count: u64,
    pub size: u64, // Bytes der Snapshot-Datei
}

/// Maximale Anzahl Snapshots pro Deck; beim Überlauf werden bevorzugt die
/// ältesten **Auto**-Snapshots entfernt (manuelle Checkpoints bleiben länger erhalten).
const CAP: usize = 50;

/// Stabiler, dateisystemsicherer Schlüssel aus dem Dateipfad (lesbarer Stamm + Hash).
fn deck_key(file_path: &str) -> String {
    use std::hash::{Hash, Hasher};
    let mut h = std::collections::hash_map::DefaultHasher::new();
    file_path.hash(&mut h);
    let hash = h.finish();
    let stem = Path::new(file_path)
        .file_stem()
        .and_then(|s| s.to_str())
        .unwrap_or("deck");
    let safe: String = stem
        .chars()
        .filter(|c| c.is_ascii_alphanumeric() || *c == '-' || *c == '_')
        .take(40)
        .collect();
    let safe = if safe.is_empty() { "deck".to_string() } else { safe };
    format!("{safe}-{hash:016x}")
}

fn history_dir(file_path: &str) -> Result<PathBuf> {
    let base = dirs::config_dir().context("Kein Config-Verzeichnis gefunden")?;
    Ok(base.join("slideo").join("history").join(deck_key(file_path)))
}

fn index_path(dir: &Path) -> PathBuf {
    dir.join("index.json")
}

/// Liest den Index (neueste zuerst). Fehlt/defekt → leer.
fn read_index(dir: &Path) -> Vec<SnapshotMeta> {
    let mut idx: Vec<SnapshotMeta> = std::fs::read_to_string(index_path(dir))
        .ok()
        .and_then(|s| serde_json::from_str(&s).ok())
        .unwrap_or_default();
    // Defensiv neu sortieren (created ISO 8601 → lexikografisch = chronologisch).
    idx.sort_by(|a, b| b.created.cmp(&a.created));
    idx
}

fn write_index(dir: &Path, idx: &[SnapshotMeta]) -> Result<()> {
    std::fs::create_dir_all(dir)?;
    let json = serde_json::to_string_pretty(idx).context("Index-Serialisierung fehlgeschlagen")?;
    // Atomar: Temp im SELBEN Ordner + rename, damit ein Crash/Stromausfall mitten im
    // Schreiben nicht eine truncatete index.json hinterlässt (read_index würde sie still
    // zu einer LEEREN Historie degradieren → alle <id>.slideo-Snapshots unerreichbar).
    let tmp = dir.join(format!(".index-{}.tmp", uuid::Uuid::new_v4().simple()));
    std::fs::write(&tmp, json.as_bytes()).context("Index (temp) konnte nicht geschrieben werden")?;
    std::fs::rename(&tmp, index_path(dir))
        .map_err(|e| {
            let _ = std::fs::remove_file(&tmp);
            e
        })
        .context("Index konnte nicht ersetzt werden")?;
    Ok(())
}

fn snapshot_path(dir: &Path, id: &str) -> PathBuf {
    dir.join(format!("{id}.slideo"))
}

/// Listet die Snapshots eines Decks (neueste zuerst); überspringt Einträge ohne Datei.
pub fn list(file_path: &str) -> Vec<SnapshotMeta> {
    let Ok(dir) = history_dir(file_path) else {
        return Vec::new();
    };
    read_index(&dir)
        .into_iter()
        .filter(|m| snapshot_path(&dir, &m.id).exists())
        .collect()
}

/// Schreibt einen Snapshot. Dedupe: ist `presentation` identisch zum jüngsten
/// Snapshot, wird **nichts** geschrieben (Rückgabe `None`). Sonst wird gekürzt und
/// die neue Metadaten-Zeile zurückgegeben.
#[allow(clippy::too_many_arguments)]
pub fn create(
    file_path: &str,
    presentation: &Value,
    assets: &[Asset],
    label: &str,
    auto: bool,
    created: &str,
    id: &str,
) -> Result<Option<SnapshotMeta>> {
    if !valid_id(id) {
        bail!("Ungültige Snapshot-ID");
    }
    let _guard = index_lock(); // Index-Mutation atomar gegenüber parallelen Saves
    let dir = history_dir(file_path)?;
    std::fs::create_dir_all(&dir)?;
    let mut idx = read_index(&dir);

    // Dedupe gegen den jüngsten Snapshot (nur Inhalt der presentation.json).
    if let Some(latest) = idx.first() {
        if let Ok(prev) = file::read_presentation(&snapshot_path(&dir, &latest.id)) {
            if &prev == presentation {
                return Ok(None);
            }
        }
    }

    let snap = snapshot_path(&dir, id);
    file::write_presentation(&snap, presentation, assets)
        .context("Snapshot konnte nicht geschrieben werden")?;
    let size = std::fs::metadata(&snap).map(|m| m.len()).unwrap_or(0);
    let title = presentation
        .get("meta")
        .and_then(|m| m.get("title"))
        .and_then(|t| t.as_str())
        .unwrap_or("")
        .to_string();
    let slide_count = presentation
        .get("zones")
        .and_then(|z| z.as_array())
        .map(|a| a.len() as u64)
        .unwrap_or(0);

    let meta = SnapshotMeta {
        id: id.to_string(),
        created: created.to_string(),
        label: label.to_string(),
        auto,
        title,
        slide_count,
        size,
    };
    idx.insert(0, meta.clone());

    // Kürzen: bevorzugt den ältesten Auto-Snapshot entfernen, sonst den ältesten.
    // WICHTIG: nie den gerade eingefügten Snapshot (Index 0) wegkürzen — sonst würde
    // bei vollem Cap aus lauter manuellen Snapshots der neue Auto-Snapshot sofort
    // wieder gelöscht (create() meldete fälschlich Erfolg). Daher Suche ab Index 1.
    while idx.len() > CAP {
        let pos = idx
            .iter()
            .enumerate()
            .skip(1)
            .rev()
            .find(|(_, s)| s.auto)
            .map(|(i, _)| i)
            .unwrap_or(idx.len() - 1);
        let old = idx.remove(pos);
        let _ = std::fs::remove_file(snapshot_path(&dir, &old.id));
    }

    write_index(&dir, &idx)?;
    Ok(Some(meta))
}

/// Liest einen Snapshot (presentation + assets) für die Wiederherstellung.
pub fn restore(file_path: &str, id: &str) -> Result<(Value, Vec<Asset>)> {
    if !valid_id(id) {
        bail!("Ungültige Snapshot-ID");
    }
    let dir = history_dir(file_path)?;
    let snap = snapshot_path(&dir, id);
    let presentation = file::read_presentation(&snap)
        .with_context(|| format!("Snapshot {id} konnte nicht gelesen werden"))?;
    let assets = file::read_assets(&snap).unwrap_or_default();
    Ok((presentation, assets))
}

/// Entfernt einen Snapshot (Datei + Index-Eintrag).
pub fn delete(file_path: &str, id: &str) -> Result<()> {
    if !valid_id(id) {
        bail!("Ungültige Snapshot-ID");
    }
    let _guard = index_lock();
    let dir = history_dir(file_path)?;
    let _ = std::fs::remove_file(snapshot_path(&dir, id));
    let idx: Vec<SnapshotMeta> = read_index(&dir).into_iter().filter(|m| m.id != id).collect();
    write_index(&dir, &idx)?;
    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;
    use serde_json::json;

    fn deck(title: &str, zones: usize) -> Value {
        let z: Vec<Value> = (0..zones)
            .map(|i| json!({ "id": format!("z{i}"), "label": format!("Slide {i}"), "order": i,
                "content_type": "markdown", "markdown": format!("# {title} {i}"), "html": null,
                "style": { "layout": "center", "padding": "4rem", "background": null, "text_align": "left" }, "notes": "" }))
            .collect();
        json!({ "version": "1.0", "meta": { "title": title, "created": "2026-01-01T00:00:00Z", "modified": "2026-01-01T00:00:00Z" }, "tokens": {}, "zones": z })
    }

    // Eindeutiger Test-Dateipfad → eigener (isolierter) History-Ordner; danach aufräumen.
    fn unique_path(tag: &str) -> String {
        std::env::temp_dir()
            .join(format!("slideo-hist-test-{tag}.slideo"))
            .to_string_lossy()
            .to_string()
    }
    fn cleanup(file_path: &str) {
        if let Ok(dir) = history_dir(file_path) {
            let _ = std::fs::remove_dir_all(dir);
        }
    }

    #[test]
    fn create_list_restore_roundtrip() {
        let fp = unique_path("roundtrip");
        cleanup(&fp);
        let p = deck("Doku", 3);
        let m = create(&fp, &p, &[], "Erster", false, "2026-06-23T10:00:00Z", "id-1")
            .unwrap()
            .expect("Snapshot erwartet");
        assert_eq!(m.slide_count, 3);
        assert_eq!(m.title, "Doku");
        assert!(!m.auto);

        let list = list(&fp);
        assert_eq!(list.len(), 1);
        assert_eq!(list[0].label, "Erster");

        let (restored, _assets) = restore(&fp, "id-1").unwrap();
        assert_eq!(restored, p);
        cleanup(&fp);
    }

    #[test]
    fn dedupe_skips_identical_content() {
        let fp = unique_path("dedupe");
        cleanup(&fp);
        let p = deck("Gleich", 1);
        assert!(create(&fp, &p, &[], "", true, "2026-06-23T10:00:00Z", "a").unwrap().is_some());
        // identischer Inhalt → kein neuer Snapshot
        assert!(create(&fp, &p, &[], "", true, "2026-06-23T10:01:00Z", "b").unwrap().is_none());
        assert_eq!(list(&fp).len(), 1);
        // geänderter Inhalt → neuer Snapshot
        assert!(create(&fp, &deck("Gleich", 2), &[], "", true, "2026-06-23T10:02:00Z", "c").unwrap().is_some());
        assert_eq!(list(&fp).len(), 2);
        cleanup(&fp);
    }

    #[test]
    fn prune_prefers_auto_keeps_manual() {
        let fp = unique_path("prune");
        cleanup(&fp);
        // CAP+5 Auto-Snapshots, dazwischen ein manueller — der manuelle muss überleben.
        for i in 0..(CAP + 5) {
            let auto = i != 0; // der erste (älteste) ist manuell
            let label = if auto { "" } else { "WICHTIG" };
            create(&fp, &deck("D", i + 1), &[], label, auto, &format!("2026-06-23T10:{:02}:00Z", i), &format!("id{i}")).unwrap();
        }
        let l = list(&fp);
        assert_eq!(l.len(), CAP);
        assert!(l.iter().any(|m| m.label == "WICHTIG"), "manueller Snapshot wurde fälschlich gekürzt");
        cleanup(&fp);
    }

    #[test]
    fn new_snapshot_survives_prune_when_cap_full_of_manual() {
        // Regression: Cap voll mit manuellen Snapshots → der neue (Auto-)Snapshot
        // darf NICHT sofort wieder gekürzt werden (sonst „lautloser" Verlust).
        let fp = unique_path("prune-new");
        cleanup(&fp);
        for i in 0..CAP {
            create(&fp, &deck("M", i + 1), &[], "manuell", false, &format!("2026-06-23T09:{:02}:00Z", i), &format!("m{i}")).unwrap();
        }
        assert_eq!(list(&fp).len(), CAP);
        // Ein neuer Auto-Snapshot mit anderem Inhalt:
        let m = create(&fp, &deck("AUTO-NEU", 1), &[], "", true, "2026-06-23T10:00:00Z", "auto-new")
            .unwrap()
            .expect("Snapshot erwartet");
        assert_eq!(m.id, "auto-new");
        let l = list(&fp);
        assert_eq!(l.len(), CAP);
        assert!(l.iter().any(|s| s.id == "auto-new"), "neuer Auto-Snapshot wurde fälschlich gekürzt");
        // … und die Datei existiert auch wirklich (kein Geist-Eintrag).
        assert!(restore(&fp, "auto-new").is_ok());
        cleanup(&fp);
    }

    #[test]
    fn rejects_unsafe_ids() {
        let fp = unique_path("unsafe");
        cleanup(&fp);
        assert!(create(&fp, &deck("D", 1), &[], "", false, "2026-06-23T10:00:00Z", "../escape").is_err());
        assert!(restore(&fp, "../../etc/passwd").is_err());
        assert!(delete(&fp, "a/b").is_err());
        assert!(valid_id("550e8400-e29b-41d4-a716-446655440000"));
        cleanup(&fp);
    }

    #[test]
    fn delete_removes_entry_and_file() {
        let fp = unique_path("delete");
        cleanup(&fp);
        create(&fp, &deck("D", 1), &[], "", false, "2026-06-23T10:00:00Z", "x").unwrap();
        assert_eq!(list(&fp).len(), 1);
        delete(&fp, "x").unwrap();
        assert_eq!(list(&fp).len(), 0);
        cleanup(&fp);
    }
}
