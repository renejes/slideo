//! Token-bewusste HTML-Komponenten-Bibliothek (Spec §18.7).
//!
//! EINE Quelle der Wahrheit: Generatoren `(params) -> HTML`, genutzt vom MCP
//! (`list_components` / `insert_component`) und perspektivisch von einer UI-
//! Palette (über einen Tauri-Command). Jede Komponente nutzt AUSSCHLIESSLICH
//! die Token-CSS-Variablen (var(--color-*)/var(--font-*)/var(--border-radius)),
//! damit sie über die Token-Sidebar global themebar bleibt.

use serde_json::{json, Value};

/// HTML-escape für Textinhalte (Attribute kommen hier nicht vor).
fn esc(s: &str) -> String {
    s.replace('&', "&amp;")
        .replace('<', "&lt;")
        .replace('>', "&gt;")
}

fn str_field(item: &Value, key: &str, default: &str) -> String {
    item.get(key).and_then(|v| v.as_str()).unwrap_or(default).to_string()
}

fn num_field(item: &Value, key: &str, default: f64) -> f64 {
    item.get(key).and_then(|v| v.as_f64()).unwrap_or(default)
}

/// Items-Array aus den params; bei Abwesenheit `fallback` (Platzhalter), damit
/// die Komponente immer etwas Sinnvolles rendert, das der Mensch ausfüllen kann.
fn items<'a>(params: &'a Value, fallback: &'a [Value]) -> Vec<Value> {
    match params.get("items").and_then(|v| v.as_array()) {
        Some(arr) if !arr.is_empty() => arr.clone(),
        _ => fallback.to_vec(),
    }
}

fn clamp_pct(v: f64) -> f64 {
    v.max(0.0).min(100.0)
}

// ---------- Generatoren ----------

fn stat_cards(params: &Value) -> String {
    let fallback = vec![
        json!({ "value": "98%", "label": "Zufriedenheit" }),
        json!({ "value": "3.2x", "label": "Wachstum" }),
        json!({ "value": "12k", "label": "Nutzer" }),
    ];
    let cards = items(params, &fallback)
        .iter()
        .map(|it| {
            format!(
                "<div style=\"flex:1 1 11rem;background:var(--color-surface);border-radius:var(--border-radius);padding:1.5rem 1.25rem;text-align:center\">\
<div style=\"font-family:var(--font-heading);font-size:2.6rem;font-weight:800;color:var(--color-accent);line-height:1\">{}</div>\
<div style=\"margin-top:.4rem;color:var(--color-secondary);font-size:1rem\">{}</div></div>",
                esc(&str_field(it, "value", "")),
                esc(&str_field(it, "label", ""))
            )
        })
        .collect::<String>();
    format!(
        "<div style=\"display:flex;gap:1.25rem;flex-wrap:wrap;justify-content:center;font-family:var(--font-body)\">{cards}</div>"
    )
}

fn bar_chart(params: &Value) -> String {
    let fallback = vec![
        json!({ "label": "Q1", "value": 40 }),
        json!({ "label": "Q2", "value": 65 }),
        json!({ "label": "Q3", "value": 80 }),
        json!({ "label": "Q4", "value": 100 }),
    ];
    let data = items(params, &fallback);
    let max = params
        .get("max")
        .and_then(|v| v.as_f64())
        .filter(|m| *m > 0.0)
        .unwrap_or_else(|| {
            data.iter()
                .map(|it| num_field(it, "value", 0.0))
                .fold(1.0, f64::max)
        });
    let rows = data
        .iter()
        .map(|it| {
            let value = num_field(it, "value", 0.0);
            let pct = clamp_pct(value / max * 100.0);
            format!(
                "<div style=\"display:flex;align-items:center;gap:1rem;margin:.55rem 0\">\
<div style=\"width:8rem;text-align:right;color:var(--color-text);font-size:1rem\">{}</div>\
<div style=\"flex:1;background:var(--color-surface);border-radius:999px;height:1.05rem;overflow:hidden\">\
<div style=\"width:{pct:.1}%;height:100%;background:var(--color-primary);border-radius:999px\"></div></div>\
<div style=\"width:3rem;color:var(--color-secondary);font-size:.9rem\">{}</div></div>",
                esc(&str_field(it, "label", "")),
                esc(&format!("{}", value as i64))
            )
        })
        .collect::<String>();
    format!("<div style=\"max-width:46rem;margin:0 auto;font-family:var(--font-body)\">{rows}</div>")
}

fn progress(params: &Value) -> String {
    let fallback = vec![
        json!({ "label": "Design", "percent": 90 }),
        json!({ "label": "Entwicklung", "percent": 70 }),
        json!({ "label": "Test", "percent": 45 }),
    ];
    let rows = items(params, &fallback)
        .iter()
        .map(|it| {
            let pct = clamp_pct(num_field(it, "percent", 0.0));
            format!(
                "<div style=\"margin:.7rem 0\">\
<div style=\"display:flex;justify-content:space-between;color:var(--color-text);font-size:1rem;margin-bottom:.3rem\">\
<span>{}</span><span style=\"color:var(--color-secondary)\">{pct:.0}%</span></div>\
<div style=\"background:var(--color-surface);border-radius:999px;height:.75rem;overflow:hidden\">\
<div style=\"width:{pct:.0}%;height:100%;background:var(--color-accent);border-radius:999px\"></div></div></div>",
                esc(&str_field(it, "label", ""))
            )
        })
        .collect::<String>();
    format!("<div style=\"max-width:40rem;margin:0 auto;font-family:var(--font-body)\">{rows}</div>")
}

fn quote(params: &Value) -> String {
    let text = str_field(params, "text", "Großartige Ideen brauchen Mut, nicht Erlaubnis.");
    let author = str_field(params, "author", "Unbekannt");
    format!(
        "<figure style=\"max-width:46rem;margin:0 auto;text-align:center;font-family:var(--font-heading)\">\
<blockquote style=\"font-size:2rem;line-height:1.3;color:var(--color-text);margin:0;font-weight:600\">&ldquo;{}&rdquo;</blockquote>\
<figcaption style=\"margin-top:1rem;color:var(--color-accent);font-family:var(--font-body);font-size:1.05rem\">&mdash; {}</figcaption></figure>",
        esc(&text),
        esc(&author)
    )
}

fn timeline(params: &Value) -> String {
    let fallback = vec![
        json!({ "title": "2024", "text": "Gründung" }),
        json!({ "title": "2025", "text": "Erste 1.000 Nutzer" }),
        json!({ "title": "2026", "text": "Internationaler Start" }),
    ];
    let rows = items(params, &fallback)
        .iter()
        .map(|it| {
            format!(
                "<div style=\"position:relative;padding:0 0 1.4rem 1.75rem;border-left:2px solid var(--color-surface)\">\
<span style=\"position:absolute;left:-0.5rem;top:.1rem;width:.85rem;height:.85rem;border-radius:999px;background:var(--color-accent);border:2px solid var(--color-bg)\"></span>\
<div style=\"font-family:var(--font-heading);font-weight:700;color:var(--color-text);font-size:1.15rem\">{}</div>\
<div style=\"color:var(--color-secondary);font-size:1rem;margin-top:.15rem\">{}</div></div>",
                esc(&str_field(it, "title", "")),
                esc(&str_field(it, "text", ""))
            )
        })
        .collect::<String>();
    format!("<div style=\"max-width:42rem;margin:0 auto;font-family:var(--font-body)\">{rows}</div>")
}

fn column(side: &Value, fallback_title: &str) -> String {
    let title = str_field(side, "title", fallback_title);
    let li = side
        .get("items")
        .and_then(|v| v.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str())
                .map(|s| format!("<li style=\"margin:.3rem 0\">{}</li>", esc(s)))
                .collect::<String>()
        })
        .unwrap_or_else(|| "<li>Punkt</li>".to_string());
    format!(
        "<div style=\"flex:1;background:var(--color-surface);border-radius:var(--border-radius);padding:1.5rem\">\
<div style=\"font-family:var(--font-heading);font-weight:700;color:var(--color-text);font-size:1.3rem;margin-bottom:.6rem\">{}</div>\
<ul style=\"margin:0;padding-left:1.1rem;color:var(--color-secondary);line-height:1.7;font-size:1.02rem\">{li}</ul></div>",
        esc(&title)
    )
}

fn comparison(params: &Value) -> String {
    let empty = json!({});
    let left = params.get("left").unwrap_or(&empty);
    let right = params.get("right").unwrap_or(&empty);
    format!(
        "<div style=\"display:flex;gap:1.25rem;max-width:52rem;margin:0 auto;font-family:var(--font-body)\">{}{}</div>",
        column(left, "Vorher"),
        column(right, "Nachher")
    )
}

fn callout(params: &Value) -> String {
    let title = str_field(params, "title", "Wichtig");
    let text = str_field(params, "text", "Die zentrale Botschaft dieser Folie.");
    format!(
        "<div style=\"max-width:44rem;margin:0 auto;background:var(--color-surface);border-left:4px solid var(--color-accent);border-radius:var(--border-radius);padding:1.25rem 1.5rem;font-family:var(--font-body)\">\
<div style=\"font-family:var(--font-heading);font-weight:700;color:var(--color-text);font-size:1.2rem;margin-bottom:.3rem\">{}</div>\
<div style=\"color:var(--color-secondary);font-size:1.05rem;line-height:1.6\">{}</div></div>",
        esc(&title),
        esc(&text)
    )
}

fn line_chart(params: &Value) -> String {
    let fallback = vec![
        json!({ "label": "Jan", "value": 12 }),
        json!({ "label": "Feb", "value": 19 }),
        json!({ "label": "Mär", "value": 15 }),
        json!({ "label": "Apr", "value": 27 }),
        json!({ "label": "Mai", "value": 34 }),
    ];
    let data = items(params, &fallback);
    let max = data
        .iter()
        .map(|it| num_field(it, "value", 0.0))
        .fold(1.0, f64::max);
    // Plotfläche im 640×340-viewBox.
    let (x0, x1, y0, y1) = (44.0_f64, 612.0_f64, 24.0_f64, 280.0_f64);
    let n = data.len().max(1);
    let step = if n > 1 { (x1 - x0) / (n as f64 - 1.0) } else { 0.0 };
    let px = |i: usize| x0 + step * i as f64;
    let py = |v: f64| y1 - (v / max) * (y1 - y0);

    let pts: Vec<(f64, f64)> = data
        .iter()
        .enumerate()
        .map(|(i, it)| (px(i), py(num_field(it, "value", 0.0))))
        .collect();
    let line = pts
        .iter()
        .map(|(x, y)| format!("{x:.1},{y:.1}"))
        .collect::<Vec<_>>()
        .join(" ");
    let area = format!("{x0:.1},{y1:.1} {line} {x1:.1},{y1:.1}");
    let dots = pts
        .iter()
        .map(|(x, y)| format!("<circle cx=\"{x:.1}\" cy=\"{y:.1}\" r=\"4\" fill=\"var(--color-accent)\"/>"))
        .collect::<String>();
    let labels = data
        .iter()
        .enumerate()
        .map(|(i, it)| {
            format!(
                "<text x=\"{x:.1}\" y=\"312\" text-anchor=\"middle\" font-size=\"15\" fill=\"var(--color-secondary)\" font-family=\"var(--font-body)\">{}</text>",
                esc(&str_field(it, "label", "")),
                x = px(i)
            )
        })
        .collect::<String>();
    format!(
        "<svg viewBox=\"0 0 640 340\" width=\"100%\" style=\"max-width:48rem;display:block;margin:0 auto;font-family:var(--font-body)\">\
<line x1=\"{x0:.1}\" y1=\"{y1:.1}\" x2=\"{x1:.1}\" y2=\"{y1:.1}\" stroke=\"var(--color-surface)\" stroke-width=\"1.5\"/>\
<polygon points=\"{area}\" fill=\"var(--color-primary)\" fill-opacity=\"0.12\"/>\
<polyline points=\"{line}\" fill=\"none\" stroke=\"var(--color-primary)\" stroke-width=\"3\" stroke-linejoin=\"round\" stroke-linecap=\"round\"/>\
{dots}{labels}</svg>"
    )
}

/// Farbe + Deckkraft für die i-te Tortenscheibe (zyklisch über die Tokens).
fn slice_color(i: usize) -> (&'static str, f64) {
    const PAL: [&str; 3] = [
        "var(--color-primary)",
        "var(--color-accent)",
        "var(--color-secondary)",
    ];
    let opacity = 1.0 - 0.28 * (i / PAL.len()) as f64;
    (PAL[i % PAL.len()], opacity.max(0.4))
}

fn donut_chart(params: &Value) -> String {
    let fallback = vec![
        json!({ "label": "Direkt", "value": 45 }),
        json!({ "label": "Suche", "value": 30 }),
        json!({ "label": "Social", "value": 25 }),
    ];
    let data = items(params, &fallback);
    let total: f64 = data.iter().map(|it| num_field(it, "value", 0.0)).sum();
    let (cx, cy, r) = (160.0_f64, 160.0_f64, 148.0_f64);
    let mut a0 = -std::f64::consts::FRAC_PI_2;

    let slices: String = if data.len() == 1 || total <= 0.0 {
        let (c, o) = slice_color(0);
        format!("<circle cx=\"{cx}\" cy=\"{cy}\" r=\"{r}\" fill=\"{c}\" fill-opacity=\"{o}\"/>")
    } else {
        data.iter()
            .enumerate()
            .map(|(i, it)| {
                let frac = num_field(it, "value", 0.0) / total;
                let a1 = a0 + frac * std::f64::consts::TAU;
                let (x0, y0) = (cx + r * a0.cos(), cy + r * a0.sin());
                let (x1, y1) = (cx + r * a1.cos(), cy + r * a1.sin());
                let large = if (a1 - a0) > std::f64::consts::PI { 1 } else { 0 };
                let (c, o) = slice_color(i);
                a0 = a1;
                format!(
                    "<path d=\"M{cx} {cy} L{x0:.2} {y0:.2} A{r} {r} 0 {large} 1 {x1:.2} {y1:.2} Z\" fill=\"{c}\" fill-opacity=\"{o}\"/>"
                )
            })
            .collect()
    };
    // Loch (Donut) in Folien-Hintergrundfarbe.
    let hole = format!("<circle cx=\"{cx}\" cy=\"{cy}\" r=\"86\" fill=\"var(--color-bg)\"/>");

    let legend = data
        .iter()
        .enumerate()
        .map(|(i, it)| {
            let (c, o) = slice_color(i);
            let pct = if total > 0.0 { num_field(it, "value", 0.0) / total * 100.0 } else { 0.0 };
            format!(
                "<div style=\"display:flex;align-items:center;gap:.5rem;font-size:1rem;color:var(--color-text)\">\
<span style=\"width:.85rem;height:.85rem;border-radius:3px;background:{c};opacity:{o}\"></span>\
<span>{}</span><span style=\"margin-left:auto;color:var(--color-secondary)\">{pct:.0}%</span></div>",
                esc(&str_field(it, "label", ""))
            )
        })
        .collect::<String>();

    format!(
        "<div style=\"display:flex;gap:2.5rem;align-items:center;justify-content:center;flex-wrap:wrap;font-family:var(--font-body)\">\
<svg viewBox=\"0 0 320 320\" width=\"320\" style=\"max-width:60%;height:auto\">{slices}{hole}</svg>\
<div style=\"display:flex;flex-direction:column;gap:.6rem;min-width:12rem\">{legend}</div></div>"
    )
}

/// Sanitisiert eine CSS-Farbe/Token-Variable für ein style-Attribut (verhindert
/// Attribut-Ausbruch). Erlaubt nur unverfängliche Zeichen; sonst Akzent-Default.
fn safe_color(c: &str) -> String {
    let ok = c.len() <= 64
        && c.chars().all(|ch| {
            ch.is_ascii_alphanumeric() || matches!(ch, ' ' | '(' | ')' | ',' | '.' | '#' | '%' | '-')
        });
    if ok && !c.is_empty() {
        c.to_string()
    } else {
        "var(--color-accent)".to_string()
    }
}

/// Inline-SVG-Body (24×24-viewBox) für einen Icon-Namen. Linien-Icons nutzen den
/// SVG-Default (stroke=currentColor, fill=none); Flächen-Icons überschreiben das
/// pro Pfad. `currentColor` koppelt an die per `style="color:…"` gesetzte Token-Farbe.
fn icon_path(name: &str) -> Option<&'static str> {
    let body = match name {
        "check" => "<path d=\"M5 13l4 4 10-10\"/>",
        "close" | "x" => "<path d=\"M6 6l12 12M18 6L6 18\"/>",
        "arrow_right" => "<path d=\"M5 12h13M13 6l6 6-6 6\"/>",
        "arrow_up" => "<path d=\"M12 19V6M6 12l6-6 6 6\"/>",
        "plus" => "<path d=\"M12 5v14M5 12h14\"/>",
        "minus" => "<path d=\"M5 12h14\"/>",
        "star" => "<path fill=\"currentColor\" stroke=\"none\" d=\"M12 2.5l2.9 5.9 6.5.9-4.7 4.6 1.1 6.5L12 17.8 6.2 20.9l1.1-6.5L2.6 9.3l6.5-.9z\"/>",
        "heart" => "<path fill=\"currentColor\" stroke=\"none\" d=\"M12 20.3l-1.3-1.2C6 14.8 3 12 3 8.6 3 6.1 5 4 7.6 4c1.5 0 2.9.7 3.8 1.8L12 7l.6-1.2C13.5 4.7 14.9 4 16.4 4 19 4 21 6.1 21 8.6c0 3.4-3 6.2-7.7 10.5z\"/>",
        "bolt" => "<path fill=\"currentColor\" stroke=\"none\" d=\"M13 2L4.5 13.5H10l-1 8.5 9.5-12H12z\"/>",
        "circle" => "<circle cx=\"12\" cy=\"12\" r=\"8.5\" fill=\"currentColor\" stroke=\"none\"/>",
        "check_circle" => "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M8 12.5l2.5 2.5 5-5.5\"/>",
        "shield" => "<path d=\"M12 3l7 2.5v5.5c0 4.3-3 7.4-7 8.5-4-1.1-7-4.2-7-8.5V5.5z\"/>",
        "info" => "<circle cx=\"12\" cy=\"12\" r=\"9\"/><path d=\"M12 11v5\"/><circle cx=\"12\" cy=\"8\" r=\"0.7\" fill=\"currentColor\" stroke=\"none\"/>",
        "warning" => "<path d=\"M12 4l9 16H3z\"/><path d=\"M12 10v4\"/><circle cx=\"12\" cy=\"17.5\" r=\"0.7\" fill=\"currentColor\" stroke=\"none\"/>",
        "lightbulb" => "<path d=\"M9.5 18h5M10.5 21h3M12 3a6 6 0 00-3.5 10.9c.4.3.5.8.5 1.3V16h6v-.8c0-.5.1-1 .5-1.3A6 6 0 0012 3z\"/>",
        _ => return None,
    };
    Some(body)
}

const ICON_NAMES: &str =
    "check, close, arrow_right, arrow_up, plus, minus, star, heart, bolt, circle, check_circle, shield, info, warning, lightbulb";

/// Inline-SVG-Icon (Spec §19.8): token-gefärbtes Symbol, optional mit Beschriftung.
/// params: name: string, color?: string (Token/CSS-Farbe), size?: number (rem), label?: string.
/// Unbekannte Namen sind ein Fehler (kein stilles Ersetzen), damit Tippfehler auffallen.
fn icon(params: &Value) -> Result<String, String> {
    let name = str_field(params, "name", "check");
    let color = safe_color(&str_field(params, "color", "var(--color-accent)"));
    let size = num_field(params, "size", 6.0).max(1.0).min(24.0);
    let label = str_field(params, "label", "");
    let body = icon_path(&name)
        .ok_or_else(|| format!("Unbekanntes Icon: '{name}' (verfügbar: {ICON_NAMES})"))?;
    let label_html = if label.is_empty() {
        String::new()
    } else {
        format!(
            "<div style=\"color:var(--color-secondary);font-size:1.05rem\">{}</div>",
            esc(&label)
        )
    };
    Ok(format!(
        "<div style=\"display:flex;flex-direction:column;align-items:center;gap:.7rem;font-family:var(--font-body)\">\
<svg viewBox=\"0 0 24 24\" width=\"{size}rem\" height=\"{size}rem\" style=\"color:{color}\" fill=\"none\" stroke=\"currentColor\" stroke-width=\"2\" stroke-linecap=\"round\" stroke-linejoin=\"round\">{body}</svg>{label_html}</div>"
    ))
}

// ---------- öffentliche API ----------

/// Metadaten aller Komponenten (für `list_components` und die spätere UI-Palette).
pub fn list() -> Value {
    json!([
        { "type": "stat_cards", "label": "Kennzahlen-Karten",
          "description": "Reihe großer KPI-Karten (Wert + Beschriftung).",
          "params": "items: [{ value: string, label: string }]" },
        { "type": "bar_chart", "label": "Balkendiagramm",
          "description": "Horizontale Balken, automatisch skaliert.",
          "params": "items: [{ label: string, value: number }], max?: number" },
        { "type": "line_chart", "label": "Liniendiagramm",
          "description": "Linienverlauf (Trend über Zeit) als SVG, token-bewusst.",
          "params": "items: [{ label: string, value: number }]" },
        { "type": "donut_chart", "label": "Donut-/Kreisdiagramm",
          "description": "Anteile als Donut mit Legende (Prozente automatisch).",
          "params": "items: [{ label: string, value: number }]" },
        { "type": "progress", "label": "Fortschrittsbalken",
          "description": "Beschriftete Prozent-Balken (0–100).",
          "params": "items: [{ label: string, percent: number }]" },
        { "type": "quote", "label": "Zitat",
          "description": "Großes zentriertes Zitat mit Quelle.",
          "params": "text: string, author: string" },
        { "type": "timeline", "label": "Zeitstrahl",
          "description": "Vertikaler Zeitstrahl mit Punkten.",
          "params": "items: [{ title: string, text: string }]" },
        { "type": "comparison", "label": "Vergleich (zwei Spalten)",
          "description": "Zwei gegenübergestellte Listen-Spalten.",
          "params": "left: { title: string, items: string[] }, right: { title: string, items: string[] }" },
        { "type": "callout", "label": "Hinweis-Box",
          "description": "Hervorgehobener Kasten mit Titel und Text.",
          "params": "title: string, text: string" },
        { "type": "icon", "label": "Icon (Inline-SVG)",
          "description": "Token-gefärbtes Symbol (optional mit Beschriftung). Namen: check, close, arrow_right, arrow_up, plus, minus, star, heart, bolt, circle, check_circle, shield, info, warning, lightbulb.",
          "params": "name: string, color?: string (z.B. var(--color-accent)), size?: number (rem), label?: string" }
    ])
}

/// Rendert eine Komponente zu HTML (mit Token-Variablen). Fehler bei unbekanntem Typ.
pub fn render(kind: &str, params: &Value) -> Result<String, String> {
    let html = match kind {
        "stat_cards" => stat_cards(params),
        "bar_chart" => bar_chart(params),
        "line_chart" => line_chart(params),
        "donut_chart" => donut_chart(params),
        "progress" => progress(params),
        "quote" => quote(params),
        "timeline" => timeline(params),
        "comparison" => comparison(params),
        "callout" => callout(params),
        "icon" => icon(params)?,
        other => return Err(format!("Unbekannte Komponente: '{other}' (siehe list_components)")),
    };
    Ok(html)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn list_has_components() {
        assert_eq!(list().as_array().unwrap().len(), 10);
    }

    #[test]
    fn every_listed_component_renders() {
        // list() und render() müssen konsistent bleiben (kein „advertised aber nicht
        // renderbar"): jeder beworbene Typ muss mit leeren Params Ok liefern.
        for c in list().as_array().unwrap() {
            let t = c["type"].as_str().unwrap();
            assert!(render(t, &json!({})).is_ok(), "{t} ist nicht renderbar");
        }
    }

    #[test]
    fn icon_renders_token_colored_svg_and_sanitizes_color() {
        let html = render("icon", &json!({ "name": "check", "label": "Fertig" })).unwrap();
        assert!(html.contains("<svg"));
        assert!(html.contains("color:var(--color-accent)")); // Default-Token
        assert!(html.contains("Fertig"));

        // Unsichere Farbe (Attribut-Ausbruch) → Akzent-Default.
        let bad = render("icon", &json!({ "name": "star", "color": "red\"></svg><script>x" })).unwrap();
        assert!(!bad.contains("<script>"));
        assert!(bad.contains("color:var(--color-accent)"));

        // Gültige Token-Farbe wird übernommen.
        let ok = render("icon", &json!({ "name": "bolt", "color": "var(--color-primary)" })).unwrap();
        assert!(ok.contains("color:var(--color-primary)"));

        // Unbekannter Icon-Name ist ein Fehler (kein stilles Ersetzen durch einen Kreis).
        assert!(render("icon", &json!({ "name": "does_not_exist" })).is_err());
    }

    #[test]
    fn charts_render_token_aware_svg() {
        let line = render(
            "line_chart",
            &json!({ "items": [{ "label": "A", "value": 10 }, { "label": "B", "value": 20 }] }),
        )
        .unwrap();
        assert!(line.contains("<polyline"));
        assert!(line.contains("var(--color-primary)"));

        let donut = render(
            "donut_chart",
            &json!({ "items": [{ "label": "X", "value": 1 }, { "label": "Y", "value": 3 }] }),
        )
        .unwrap();
        assert!(donut.contains("<path") || donut.contains("<circle"));
        assert!(donut.contains("var(--color-bg)")); // Donut-Loch
        assert!(donut.contains("75%")); // 3 von 4 = 75 %
    }

    #[test]
    fn render_uses_tokens_and_escapes() {
        let html = render(
            "stat_cards",
            &json!({ "items": [{ "value": "<b>1</b>", "label": "A & B" }] }),
        )
        .unwrap();
        assert!(html.contains("var(--color-accent)"));
        assert!(html.contains("&lt;b&gt;1&lt;/b&gt;")); // escaped
        assert!(html.contains("A &amp; B"));
    }

    #[test]
    fn unknown_component_errors() {
        assert!(render("does_not_exist", &json!({})).is_err());
    }

    #[test]
    fn bar_chart_scales_to_max() {
        let html = render("bar_chart", &json!({ "items": [{ "label": "x", "value": 50 }], "max": 100 })).unwrap();
        assert!(html.contains("width:50.0%"));
    }
}
