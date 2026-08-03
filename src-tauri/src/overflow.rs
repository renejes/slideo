//! Heuristische Layout-/Overflow-Schätzung für die feste 1280×720-Bühne (Spec §21/§24).
//!
//! **Reine Rust-Schätzung — KEIN echtes Rendering / kein Headless-Browser.** Sie ist
//! bewusst approximativ, aber handlungsleitend: Sie gibt der KI über MCP
//! (`check_zone_overflow` / `validate_deck`) ein Signal, ob eine Folie aus der Bühne
//! läuft, BEVOR der Mensch es in der App sieht. Markdown wird aus Zeilen/Schriftgröße
//! geschätzt; HTML aus den inline gesetzten px-Werten (left/top/width/height/font-size).

use serde_json::{json, Value};

const STAGE_W: f64 = 1280.0;
const STAGE_H: f64 = 720.0;
const SAFE_W: f64 = 1152.0; // x 64–1216
const SAFE_H: f64 = 592.0; // y 64–656

/// Basis-Schriftgröße in px aus den Tokens (1rem = 16px).
fn font_base_px(tokens: &Value) -> f64 {
    let s = tokens
        .get("font-size-base")
        .and_then(|v| v.as_str())
        .unwrap_or("1rem");
    parse_len_px(s).unwrap_or(16.0)
}

/// Parst eine CSS-Länge → px. `rem`/`em` = ×16. `%` und andere Einheiten ⇒ None
/// (relative Maße sind für die feste Bühne unkritisch und werden nicht geflaggt).
fn parse_len_px(s: &str) -> Option<f64> {
    let s = s.trim();
    if let Some(n) = s.strip_suffix("px") {
        n.trim().parse::<f64>().ok()
    } else if let Some(n) = s.strip_suffix("rem") {
        n.trim().parse::<f64>().ok().map(|v| v * 16.0)
    } else if let Some(n) = s.strip_suffix("em") {
        n.trim().parse::<f64>().ok().map(|v| v * 16.0)
    } else {
        // einheitenlose Zahl (z.B. line-height) → ignorieren, außer reine Zahl als px
        s.parse::<f64>().ok()
    }
}

struct Estimate {
    width: f64,
    height: f64,
    overflows_width: bool,
    overflows_height: bool,
    issues: Vec<String>,
    /// Konnte die Heuristik die Geometrie ueberhaupt sehen? (Befund H5b)
    /// Im HTML-Pfad scannt sie NUR inline `style=`-Attribute — normaler Fluss
    /// (Karten, Tabellen, Flex/Grid) ergibt `max_bottom = 0` und haette bisher
    /// „fits: true" gemeldet. Das ist keine Entwarnung, das ist Blindheit, und
    /// die KI muss den Unterschied kennen.
    measured: bool,
}

/// Markdown: Höhe aus Zeilen/Schriftgröße summieren; Breite nur für Überschriften
/// schätzen (Fließtext umbricht → keine Breiten-Warnung).
fn analyze_markdown(md: &str, base: f64) -> Estimate {
    let mut height = 0.0;
    let mut max_w = 0.0;
    for raw in md.lines() {
        let line = raw.trim();
        if line.is_empty() {
            height += base * 0.8; // Absatzabstand
            continue;
        }
        let hashes = line.chars().take_while(|c| *c == '#').count();
        let mult = match hashes {
            1 => 2.6,
            2 => 1.9,
            3 => 1.5,
            _ => 1.0,
        };
        let text: &str = if (1..=3).contains(&hashes) {
            line[hashes..].trim_start()
        } else {
            line.trim_start_matches(['-', '*', '>', ' '])
        };
        let fs = base * mult;
        height += fs * 1.5;
        if mult > 1.0 {
            // Überschriften umbrechen kaum → Breite ist relevant.
            let w = text.chars().count() as f64 * fs * 0.55;
            if w > max_w {
                max_w = w;
            }
        }
    }

    let mut issues = Vec::new();
    let ow = false;
    let mut oh = false;
    // Breiten-Warnung für Überschriften ENTFERNT (Review 2026-08, Befund H5b).
    //
    // Sie war ein systematisches Falschpositiv: die Schätzung (Zeichenzahl × 0,55 em)
    // ignorierte, dass auch Überschriften umbrechen — `.slideo-content` ist auf
    // 56rem = 896px begrenzt, geprüft wurde aber gegen 1152/1280px. Eine lange
    // Überschrift läuft also nicht über, sie wird zweizeilig. Gemeldet wurde ein
    // Problem, das es nicht gab, während der reale Fall (zu viel Text ⇒ zu hoch)
    // unten weiterhin geprüft wird. `max_w` bleibt informativ im Report.
    let _ = max_w;
    if height > STAGE_H - 64.0 {
        oh = true;
        issues.push(format!(
            "Estimated content height ~{height:.0}px exceeds the slide (720px) — split the content across several slides."
        ));
    } else if height > SAFE_H {
        issues.push(format!(
            "Estimated content height ~{height:.0}px extends beyond the safe area (592px) — consider tightening."
        ));
    }
    Estimate { width: max_w, height, overflows_width: ow, overflows_height: oh, issues, measured: true }
}

/// HTML: pro `style="…"`-Block die px-Werte parsen → rechte/untere Kante schätzen.
/// (Relative `%`-Maße werden ignoriert; left+width bzw. top+height ergeben die Kante.)
fn analyze_html(html: &str) -> Estimate {
    let mut max_right = 0.0_f64;
    let mut max_bottom = 0.0_f64;
    let mut max_font = 0.0_f64;
    for style in extract_styles(html) {
        let left = style_px(&style, "left");
        let top = style_px(&style, "top");
        let width = style_px(&style, "width");
        let height = style_px(&style, "height");
        if let Some(f) = style_px(&style, "font-size") {
            if f > max_font {
                max_font = f;
            }
        }
        let right = match (left, width) {
            (Some(l), Some(w)) => Some(l + w),
            (Some(l), None) => Some(l),
            (None, Some(w)) => Some(w),
            _ => None,
        };
        if let Some(r) = right {
            if r > max_right {
                max_right = r;
            }
        }
        let bottom = match (top, height) {
            (Some(t), Some(h)) => Some(t + h),
            (Some(t), None) => Some(t),
            (None, Some(h)) => Some(h),
            _ => None,
        };
        if let Some(b) = bottom {
            if b > max_bottom {
                max_bottom = b;
            }
        }
    }

    let mut issues = Vec::new();
    let mut ow = false;
    let mut oh = false;
    if max_right > STAGE_W {
        ow = true;
        issues.push(format!(
            "An element reaches ~{max_right:.0}px on the right and will be clipped at 1280px."
        ));
    }
    if max_bottom > STAGE_H {
        oh = true;
        issues.push(format!(
            "An element reaches ~{max_bottom:.0}px at the bottom and will be clipped at 720px."
        ));
    }
    if max_font > 220.0 {
        issues.push(format!(
            "Very large font-size (~{max_font:.0}px) — check whether the headline fits the slide."
        ));
    }
    // Ohne jede Inline-Geometrie hat die Heuristik NICHTS gesehen.
    let measured = max_right > 0.0 || max_bottom > 0.0;
    if !measured {
        issues.push(
            "No inline geometry found — this estimator only reads inline style= px values and cannot see flow/flex/grid layout. Treat 'fits' as unknown and check the slide visually."
                .to_string(),
        );
    }
    Estimate { width: max_right, height: max_bottom, overflows_width: ow, overflows_height: oh, issues, measured }
}

/// Alle `style="…"`/`style='…'`-Werte aus dem HTML (roh, ohne DOM).
fn extract_styles(html: &str) -> Vec<String> {
    let mut out = Vec::new();
    let bytes = html.as_bytes();
    let mut i = 0;
    while let Some(p) = html[i..].find("style=") {
        let start = i + p + 6;
        if start >= html.len() {
            break;
        }
        let q = bytes[start];
        if q == b'"' || q == b'\'' {
            if let Some(end) = html[start + 1..].find(q as char) {
                out.push(html[start + 1..start + 1 + end].to_string());
                i = start + 1 + end + 1;
                continue;
            }
        }
        // Char-Grenze wahren: bei einem nicht-quotierten `style=` (z.B. `style=ä`)
        // würde +1 mitten in ein Multibyte-Zeichen springen → Panic beim nächsten
        // Slice. Stattdessen um genau EIN Zeichen weiter (mind. 1 Byte).
        i = start + html[start..].chars().next().map_or(1, |c| c.len_utf8());
    }
    out
}

/// Wert einer CSS-Property aus einem style-String als px (oder None). Matcht die
/// Property EXAKT (declaration-weise), damit `left` nicht `padding-left` trifft.
fn style_px(style: &str, prop: &str) -> Option<f64> {
    for decl in style.split(';') {
        let mut it = decl.splitn(2, ':');
        let p = it.next().unwrap_or("").trim();
        let v = it.next().unwrap_or("").trim();
        if p.eq_ignore_ascii_case(prop) {
            return parse_len_px(v);
        }
    }
    None
}

/// Öffentliche Heuristik: schätzt Overflow einer Zone gegen die 1280×720-Bühne.
pub fn analyze(zone: &Value, tokens: &Value) -> Value {
    let ct = zone
        .get("content_type")
        .and_then(|v| v.as_str())
        .unwrap_or("markdown");
    let est = if ct == "html" {
        analyze_html(zone.get("html").and_then(|v| v.as_str()).unwrap_or(""))
    } else {
        analyze_markdown(
            zone.get("markdown").and_then(|v| v.as_str()).unwrap_or(""),
            font_base_px(tokens),
        )
    };
    json!({
        "content_type": ct,
        "estimated_width_px": (est.width * 10.0).round() / 10.0,
        "estimated_height_px": (est.height * 10.0).round() / 10.0,
        "overflows_width": est.overflows_width,
        "overflows_height": est.overflows_height,
        // `fits` ist NULL, wenn nichts gemessen werden konnte — vorher stand dort
        // ein erfundenes `true` (Befund H5b).
        "fits": if est.measured { json!(!est.overflows_width && !est.overflows_height) } else { Value::Null },
        "measured": est.measured,
        "issues": est.issues,
        "note": "Heuristic estimate (no real rendering) — stage 1280×720, safe area x64–1216 / y64–656. 'measured': false means the geometry was not visible to the estimator."
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    fn tokens() -> Value {
        json!({ "font-size-base": "1rem" })
    }

    #[test]
    fn short_markdown_fits() {
        let z = json!({ "content_type": "markdown", "markdown": "# Titel\n\nEin kurzer Satz." });
        let r = analyze(&z, &tokens());
        assert_eq!(r["fits"], true);
        assert!(r["issues"].as_array().unwrap().is_empty());
    }

    #[test]
    fn lange_ueberschrift_ist_kein_breiten_problem_mehr() {
        // Befund H5b: die alte Breiten-Heuristik war ein systematisches Falschpositiv —
        // sie tat so, als wuerden Ueberschriften nicht umbrechen, und mass gegen
        // 1152/1280px, obwohl .slideo-content auf 896px begrenzt ist. Eine lange
        // Ueberschrift laeuft nicht ueber, sie wird zweizeilig.
        let long = "#".to_string() + " " + &"Sehr lange Überschrift ".repeat(6);
        let z = json!({ "content_type": "markdown", "markdown": long });
        let r = analyze(&z, &tokens());
        assert_eq!(r["overflows_width"], false, "keine Breiten-Warnung mehr");
        let issues = r["issues"].as_array().unwrap();
        assert!(
            !issues.iter().any(|i| i.as_str().unwrap_or("").contains("wide")),
            "keine Breiten-Meldung im Report"
        );
    }

    #[test]
    fn many_lines_overflow_height() {
        let md = (0..40).map(|i| format!("Zeile {i}")).collect::<Vec<_>>().join("\n");
        let z = json!({ "content_type": "markdown", "markdown": md });
        let r = analyze(&z, &tokens());
        assert_eq!(r["overflows_height"], true);
    }

    #[test]
    fn html_absolute_out_of_bounds_flagged() {
        let z = json!({
            "content_type": "html",
            "html": "<div style=\"position:absolute;left:1100px;width:400px;top:10px\">x</div>"
        });
        let r = analyze(&z, &tokens());
        // left 1100 + width 400 = 1500 > 1280
        assert_eq!(r["overflows_width"], true);
    }

    #[test]
    fn html_ohne_inline_geometrie_meldet_unbekannt_statt_passt() {
        // Befund H5b: nur %-Angaben (oder ganz normaler Fluss) sind fuer diese
        // Heuristik unsichtbar. Vorher meldete sie dafuer `fits: true` — eine
        // erfundene Entwarnung. Jetzt: `fits: null` + `measured: false`.
        let z = json!({
            "content_type": "html",
            "html": "<div style=\"position:absolute;left:10%;width:40%;top:20%\">x</div>"
        });
        let r = analyze(&z, &tokens());
        assert!(r["fits"].is_null(), "fits muss unbekannt sein, nicht true");
        assert_eq!(r["measured"], false);
        assert!(!r["issues"].as_array().unwrap().is_empty(), "Blindheit wird gemeldet");
    }

    #[test]
    fn html_mit_inline_geometrie_gilt_als_gemessen() {
        let z = json!({
            "content_type": "html",
            "html": "<div style=\"position:absolute;left:100px;width:200px;top:50px;height:80px\">x</div>"
        });
        let r = analyze(&z, &tokens());
        assert_eq!(r["measured"], true);
        assert_eq!(r["fits"], true);
    }

    #[test]
    fn style_prop_matches_exactly_not_padding_left() {
        // padding-left darf NICHT als left gewertet werden.
        assert_eq!(style_px("padding-left:2000px", "left"), None);
        assert_eq!(style_px("left:1300px", "left"), Some(1300.0));
    }

    #[test]
    fn html_bare_style_eq_with_multibyte_does_not_panic() {
        // `style=` ohne Anführungszeichen, direkt gefolgt von einem Multibyte-Zeichen:
        // der Byte-Scan darf nicht mitten in das Zeichen springen (sonst Panic). Eine
        // gültige quotierte style-Deklaration danach muss weiterhin erkannt werden.
        let z = json!({
            "content_type": "html",
            "html": "<p style=ä>x</p> style=€ <b style=\"left:9px\">ok</b>"
        });
        let r = analyze(&z, &tokens()); // darf NICHT panicken
        assert_eq!(r["fits"], true); // left:9px ist im Rahmen
    }
}
