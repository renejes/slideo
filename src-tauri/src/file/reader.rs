use super::{guess_mime, Asset};
use anyhow::{Context, Result};
use base64::Engine;
use serde_json::Value;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

/// Liest eine `.slideo`-Datei (ZIP) und gibt die enthaltene `presentation.json`
/// als JSON-Value zurück. Der Inhalt wird bewusst NICHT in typisierte Structs
/// geparst – so bleibt die Schema-Hoheit beim Frontend und das Format
/// vorwärtskompatibel (z.B. neue Token- oder Zone-Felder).
pub fn read_presentation(path: &Path) -> Result<Value> {
    let file = File::open(path)
        .with_context(|| format!("Datei konnte nicht geöffnet werden: {}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .with_context(|| format!("Kein gültiges .slideo-Archiv (ZIP): {}", path.display()))?;

    let mut entry = archive
        .by_name("presentation.json")
        .context("presentation.json nicht im .slideo-Archiv gefunden")?;

    let mut contents = String::new();
    entry
        .read_to_string(&mut contents)
        .context("presentation.json konnte nicht gelesen werden")?;

    let value: Value =
        serde_json::from_str(&contents).context("presentation.json ist kein gültiges JSON")?;
    Ok(value)
}

/// Liest alle Dateien aus dem `assets/`-Ordner des Archivs und gibt sie
/// base64-kodiert zurück. Fehlt der Ordner, ist das Ergebnis leer.
pub fn read_assets(path: &Path) -> Result<Vec<Asset>> {
    let file = File::open(path)
        .with_context(|| format!("Datei konnte nicht geöffnet werden: {}", path.display()))?;
    let mut archive = ZipArchive::new(file)
        .with_context(|| format!("Kein gültiges .slideo-Archiv (ZIP): {}", path.display()))?;

    let mut assets = Vec::new();
    for i in 0..archive.len() {
        let mut entry = archive.by_index(i)?;
        if !entry.is_file() {
            continue;
        }
        let full_name = entry.name().to_string();
        let Some(name) = full_name.strip_prefix("assets/") else {
            continue;
        };
        if name.is_empty() {
            continue;
        }
        let mut bytes = Vec::new();
        entry.read_to_end(&mut bytes)?;
        assets.push(Asset {
            name: name.to_string(),
            mime: guess_mime(name),
            data: base64::engine::general_purpose::STANDARD.encode(&bytes),
        });
    }
    Ok(assets)
}
