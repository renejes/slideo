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

    // Atomar schreiben: erst VOLLSTÄNDIG in eine Temp-Datei im SELBEN Ordner (gleiches
    // Dateisystem → rename ist atomar), dann per rename über das Ziel. So bleibt ein
    // bestehendes .slideo bei einem Schreibfehler (Platte voll, Volume/Netzlaufwerk weg,
    // ungültiges Asset-base64) UNVERSEHRT, statt von File::create vorab truncatet zu werden.
    let dir = path
        .parent()
        .ok_or_else(|| anyhow::anyhow!("Kein übergeordneter Ordner für {}", path.display()))?;
    let tmp = dir.join(format!(".slideo-{}.tmp", uuid::Uuid::new_v4().simple()));

    // In einer Closure kapseln, damit die Temp-Datei bei JEDEM Fehler aufgeräumt wird.
    let write_tmp = || -> Result<()> {
        let file = File::create(&tmp)
            .with_context(|| format!("Temp-Datei konnte nicht erstellt werden: {}", tmp.display()))?;
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
    };

    if let Err(e) = write_tmp() {
        let _ = std::fs::remove_file(&tmp);
        return Err(e);
    }

    std::fs::rename(&tmp, path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        anyhow::anyhow!("Datei konnte nicht ersetzt werden ({}): {e}", path.display())
    })?;
    Ok(())
}
