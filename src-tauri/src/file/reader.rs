use super::{guess_mime, Asset};
use anyhow::{bail, Context, Result};
use base64::Engine;
use serde_json::Value;
use std::fs::File;
use std::io::Read;
use std::path::Path;
use zip::ZipArchive;

// Obergrenzen gegen Decompression-Bombs / fehlerhafte Archive (Audit S7). Großzügig
// bemessen (eingebettete Videos sind erlaubt), bremsen aber Multi-GB-Bomben aus.
// `entry.size()` (deklarierte Größe) reicht für die schnelle Abweisung; zusätzlich
// begrenzt `Read::take(..)` die tatsächlich gelesenen Bytes (falls der Header lügt).
const MAX_JSON_BYTES: u64 = 64 * 1024 * 1024; // presentation.json (Text)
const MAX_ASSET_BYTES: u64 = 1024 * 1024 * 1024; // einzelnes Asset (z.B. Video)
const MAX_TOTAL_ASSET_BYTES: u64 = 2 * 1024 * 1024 * 1024; // alle Assets zusammen
const MAX_ENTRIES: usize = 10_000; // Schutz vor "tausende winzige Einträge"

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

    if entry.size() > MAX_JSON_BYTES {
        bail!(
            "presentation.json ist zu groß ({} Bytes, max {})",
            entry.size(),
            MAX_JSON_BYTES
        );
    }
    let mut contents = String::new();
    (&mut entry)
        .take(MAX_JSON_BYTES)
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

    if archive.len() > MAX_ENTRIES {
        bail!(
            "Archiv hat zu viele Einträge ({}, max {})",
            archive.len(),
            MAX_ENTRIES
        );
    }
    let mut assets = Vec::new();
    let mut total: u64 = 0;
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
        // Schnellabweisung über die deklarierte Größe (spart das Lesen offensichtlich
        // zu großer Einträge).
        if entry.size() > MAX_ASSET_BYTES {
            bail!(
                "Asset '{}' ist zu groß ({} Bytes, max {})",
                name,
                entry.size(),
                MAX_ASSET_BYTES
            );
        }
        // Tatsächlich gelesene Bytes (take begrenzt pro Eintrag) gegen das Gesamtlimit
        // führen — ein lügender ZIP-Header (deklarierte != echte Größe) umgeht das
        // Limit so nicht (Audit-Review S2).
        let mut bytes = Vec::new();
        (&mut entry).take(MAX_ASSET_BYTES).read_to_end(&mut bytes)?;
        total = total.saturating_add(bytes.len() as u64);
        if total > MAX_TOTAL_ASSET_BYTES {
            bail!(
                "Assets übersteigen das Gesamtlimit ({} Bytes)",
                MAX_TOTAL_ASSET_BYTES
            );
        }
        assets.push(Asset {
            name: name.to_string(),
            mime: guess_mime(name),
            data: base64::engine::general_purpose::STANDARD.encode(&bytes),
        });
    }
    Ok(assets)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use zip::write::SimpleFileOptions;

    fn tmp_dir(tag: &str) -> std::path::PathBuf {
        let dir = std::env::temp_dir().join(format!("slideo-reader-{tag}-{}", std::process::id()));
        std::fs::create_dir_all(&dir).unwrap();
        dir
    }

    #[test]
    fn read_assets_rejects_too_many_entries() {
        let dir = tmp_dir("many");
        let path = dir.join("toomany.slideo");
        {
            let mut zip = zip::ZipWriter::new(File::create(&path).unwrap());
            let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            for i in 0..(MAX_ENTRIES + 1) {
                zip.start_file(format!("assets/a{i}"), opts).unwrap();
            }
            zip.finish().unwrap();
        }
        assert!(
            read_assets(&path).is_err(),
            "Archiv mit > MAX_ENTRIES Einträgen muss abgewiesen werden (Audit S7)"
        );
        std::fs::remove_dir_all(&dir).ok();
    }

    #[test]
    fn read_assets_accepts_normal_archive() {
        let dir = tmp_dir("ok");
        let path = dir.join("ok.slideo");
        {
            let mut zip = zip::ZipWriter::new(File::create(&path).unwrap());
            let opts = SimpleFileOptions::default().compression_method(zip::CompressionMethod::Stored);
            zip.start_file("assets/a.txt", opts).unwrap();
            zip.write_all(b"hallo").unwrap();
            zip.finish().unwrap();
        }
        let assets = read_assets(&path).expect("normales Archiv liest");
        assert_eq!(assets.len(), 1);
        assert_eq!(assets[0].name, "a.txt");
        std::fs::remove_dir_all(&dir).ok();
    }
}
