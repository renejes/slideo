pub mod reader;
pub mod writer;

pub use reader::{read_assets, read_presentation};
pub use writer::write_presentation;

use serde::{Deserialize, Serialize};

/// Ein Asset (z.B. Bild) im `.slideo`-Archiv. `data` ist base64-kodiert,
/// damit es über die Tauri-IPC-Grenze als JSON transportiert werden kann.
#[derive(Serialize, Deserialize, Clone, Debug)]
pub struct Asset {
    pub name: String,
    pub mime: String,
    pub data: String,
}

/// Errät den MIME-Typ anhand der Dateiendung (für gängige Bildformate).
pub fn guess_mime(name: &str) -> String {
    let ext = name.rsplit('.').next().unwrap_or("").to_ascii_lowercase();
    match ext.as_str() {
        // Bilder
        "png" => "image/png",
        "jpg" | "jpeg" => "image/jpeg",
        "gif" => "image/gif",
        "webp" => "image/webp",
        "svg" => "image/svg+xml",
        "avif" => "image/avif",
        "bmp" => "image/bmp",
        "ico" => "image/x-icon",
        // Video
        "mp4" => "video/mp4",
        "webm" => "video/webm",
        "ogv" => "video/ogg",
        "mov" => "video/quicktime",
        // Audio
        "mp3" => "audio/mpeg",
        "ogg" => "audio/ogg",
        "wav" => "audio/wav",
        "weba" => "audio/webm",
        "m4a" => "audio/mp4",
        "aac" => "audio/aac",
        // Fonts (Spec §19.4)
        "woff2" => "font/woff2",
        "woff" => "font/woff",
        "ttf" => "font/ttf",
        "otf" => "font/otf",
        _ => "application/octet-stream",
    }
    .to_string()
}

#[cfg(test)]
mod tests {
    use super::{read_assets, read_presentation, write_presentation, Asset};
    use base64::Engine;
    use serde_json::json;
    use std::env;

    /// Spec Phase 1, Schritt 6: schreiben → lesen → wieder schreiben → lesen.
    /// Stellt sicher, dass das .slideo-Format verlustfrei round-trippt
    /// (inkl. der neuen content_type/html-Felder).
    #[test]
    fn roundtrip_preserves_content() {
        let original = json!({
            "version": "1.0",
            "meta": { "title": "Test", "created": "2026-01-01T00:00:00Z", "modified": "2026-01-01T00:00:00Z" },
            "tokens": { "color-primary": "#6366f1", "font-body": "Inter" },
            "zones": [{
                "id": "abc-123",
                "label": "Slide 1",
                "order": 0,
                "content_type": "html",
                "markdown": "# Hallo",
                "html": "<h1>Hallo</h1><script>console.log('hi')</script>",
                "style": { "layout": "center", "padding": "4rem", "background": null, "text_align": "left" },
                "notes": ""
            }]
        });

        // Ein Asset (1x1 PNG-ähnliche Bytes) base64-kodiert mitschreiben.
        let raw_bytes: &[u8] = &[0u8, 1, 2, 3, 255, 254, 200, 42];
        let asset = Asset {
            name: "img-1.png".to_string(),
            mime: "image/png".to_string(),
            data: base64::engine::general_purpose::STANDARD.encode(raw_bytes),
        };

        let mut path = env::temp_dir();
        path.push("slideo_roundtrip_test.slideo");

        write_presentation(&path, &original, &[asset.clone()]).expect("write 1");
        let read_back = read_presentation(&path).expect("read 1");
        let assets_back = read_assets(&path).expect("read assets 1");
        write_presentation(&path, &read_back, &assets_back).expect("write 2");
        let read_again = read_presentation(&path).expect("read 2");
        let assets_again = read_assets(&path).expect("read assets 2");

        assert_eq!(original, read_again);
        assert_eq!(assets_again.len(), 1);
        assert_eq!(assets_again[0].name, "img-1.png");
        assert_eq!(assets_again[0].mime, "image/png");
        // Bytes überstehen den Roundtrip verlustfrei.
        let decoded = base64::engine::general_purpose::STANDARD
            .decode(assets_again[0].data.as_bytes())
            .unwrap();
        assert_eq!(decoded, raw_bytes);

        let _ = std::fs::remove_file(&path);
    }
}
