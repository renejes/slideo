use super::Asset;
use anyhow::{Context, Result};
use base64::Engine;
use serde_json::Value;
use std::fs::File;
use std::io::Write;
use std::path::Path;
use zip::write::SimpleFileOptions;
use zip::{CompressionMethod, ZipWriter};

/// Schreibt eine Presentation als `.slideo`-Datei: ein ZIP mit
/// `presentation.json` (hübsch formatiert für lesbare Git-Diffs) und allen
/// Assets unter `assets/`.
pub fn write_presentation(path: &Path, presentation: &Value, assets: &[Asset]) -> Result<()> {
    let json = serde_json::to_string_pretty(presentation)
        .context("Presentation konnte nicht serialisiert werden")?;

    let file = File::create(path)
        .with_context(|| format!("Datei konnte nicht erstellt werden: {}", path.display()))?;
    let mut zip = ZipWriter::new(file);
    // presentation.json ist Text → Deflate lohnt (kleinere, lesbare Git-Diffs sind eh JSON).
    let options = SimpleFileOptions::default().compression_method(CompressionMethod::Deflated);
    // Assets (Bilder/Video/Audio) sind bereits komprimiert → Deflate kostet CPU für ~0
    // Größengewinn. `Stored` (kein Deflate) macht das Speichern spürbar schneller (Audit P13).
    let stored = SimpleFileOptions::default().compression_method(CompressionMethod::Stored);

    zip.start_file("presentation.json", options)
        .context("presentation.json konnte nicht geschrieben werden")?;
    zip.write_all(json.as_bytes())?;

    // assets/-Ordner anlegen und alle Assets als Binärdateien schreiben (unkomprimiert).
    zip.add_directory("assets/", stored)?;
    for asset in assets {
        let bytes = base64::engine::general_purpose::STANDARD
            .decode(asset.data.as_bytes())
            .with_context(|| format!("Asset '{}' ist kein gültiges base64", asset.name))?;
        zip.start_file(format!("assets/{}", asset.name), stored)
            .with_context(|| format!("Asset '{}' konnte nicht geschrieben werden", asset.name))?;
        zip.write_all(&bytes)?;
    }

    zip.finish().context("ZIP konnte nicht finalisiert werden")?;
    Ok(())
}
