//! Zentrale Tool-Logik des MCP-Servers.
//!
//! Alle Tools operieren direkt auf der Presentation als `serde_json::Value`
//! (Schema-Hoheit bleibt beim Frontend, siehe file/reader.rs). `handle()` wird
//! vom Socket-Server in der laufenden App aufgerufen; der MCP-stdio-Modus leitet
//! Tool-Calls nur dorthin weiter.

use crate::file::{self, Asset};
use anyhow::Result;
use serde_json::{json, Value};
use std::path::PathBuf;

/// Welche UI-Aktualisierung ein Tool-Aufruf auslöst.
pub enum Effect {
    /// Keine UI-Änderung nötig (reiner Read).
    None,
    /// Die Presentation hat sich geändert → Frontend neu spiegeln.
    Presentation,
    /// Im Präsentationsmodus zu Slide-Index springen.
    ActiveSlide(i64),
}

pub struct ToolOutcome {
    pub result: Value,
    pub effect: Effect,
}

fn ok(result: Value, effect: Effect) -> Result<ToolOutcome, String> {
    Ok(ToolOutcome { result, effect })
}

fn now_iso() -> String {
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

/// Standard-Design-Tokens (Spiegel von DEFAULT_TOKENS im Frontend).
pub fn default_tokens() -> Value {
    json!({
        "color-primary": "#6366f1",
        "color-secondary": "#818cf8",
        "color-bg": "#0f0f0f",
        "color-surface": "#1a1a2e",
        "color-text": "#f1f5f9",
        "color-accent": "#e94560",
        "font-heading": "Cal Sans",
        "font-body": "Inter",
        "font-size-base": "1rem",
        "spacing-base": "1rem",
        "border-radius": "0.5rem"
    })
}

fn default_zone_style() -> Value {
    json!({ "layout": "center", "padding": "4rem", "background": null, "text_align": "left" })
}

fn make_zone(order: i64, label: &str, markdown: &str) -> Value {
    json!({
        "id": uuid::Uuid::new_v4().to_string(),
        "label": label,
        "order": order,
        "content_type": "markdown",
        "markdown": markdown,
        "html": null,
        "custom_css": "",
        "style": default_zone_style(),
        "notes": ""
    })
}

fn new_presentation(title: &str) -> Value {
    let ts = now_iso();
    json!({
        "version": "1.0",
        "meta": { "title": title, "created": ts, "modified": ts },
        "tokens": default_tokens(),
        "zones": [ make_zone(0, "Slide 1", &format!("# {title}\n\nDein erster Slide. Leg los.")) ]
    })
}

// ---------- kleine Helfer ----------

fn p_param<'a>(params: &'a Value, key: &str) -> Option<&'a Value> {
    params.get(key)
}

fn req_str(params: &Value, key: &str) -> Result<String, String> {
    p_param(params, key)
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| format!("Pflichtfeld '{key}' (String) fehlt"))
}

fn opt_str(params: &Value, key: &str) -> Option<String> {
    p_param(params, key).and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn pres_mut<'a>(pres: &'a mut Option<Value>) -> Result<&'a mut Value, String> {
    pres.as_mut().ok_or_else(|| "Keine Präsentation geöffnet".to_string())
}

fn zones_mut<'a>(p: &'a mut Value) -> Result<&'a mut Vec<Value>, String> {
    p.get_mut("zones")
        .and_then(|z| z.as_array_mut())
        .ok_or_else(|| "Präsentation hat kein 'zones'-Array".to_string())
}

fn zone_index(zones: &[Value], id: &str) -> Result<usize, String> {
    zones
        .iter()
        .position(|z| z.get("id").and_then(|v| v.as_str()) == Some(id))
        .ok_or_else(|| format!("Zone '{id}' nicht gefunden"))
}

fn renumber(zones: &mut [Value]) {
    for (i, z) in zones.iter_mut().enumerate() {
        z["order"] = json!(i as i64);
    }
}

fn touch_modified(p: &mut Value) {
    if let Some(meta) = p.get_mut("meta") {
        meta["modified"] = json!(now_iso());
    }
}

// ---------- Dispatch ----------

/// Führt ein Tool aus. `pres`/`file_path`/`assets` sind der App-State.
pub fn handle(
    method: &str,
    params: &Value,
    pres: &mut Option<Value>,
    file_path: &mut Option<PathBuf>,
    assets: &[Asset],
) -> Result<ToolOutcome, String> {
    match method {
        // ----- Presentation -----
        "create_presentation" => {
            let title = req_str(params, "title")?;
            *pres = Some(new_presentation(&title));
            *file_path = None;
            ok(json!({ "title": title }), Effect::Presentation)
        }
        "open_presentation" => {
            let path = req_str(params, "path")?;
            let pb = PathBuf::from(&path);
            let value = file::read_presentation(&pb).map_err(|e| format!("{e:#}"))?;
            *pres = Some(value);
            *file_path = Some(pb);
            ok(json!({ "path": path }), Effect::Presentation)
        }
        "save_presentation" => {
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            let target = opt_str(params, "path")
                .map(PathBuf::from)
                .or_else(|| file_path.clone())
                .ok_or("Kein Speicherpfad bekannt (path angeben)")?;
            file::write_presentation(&target, p, assets).map_err(|e| format!("{e:#}"))?;
            *file_path = Some(target.clone());
            ok(json!({ "saved": target.to_string_lossy() }), Effect::None)
        }
        "get_presentation_meta" => {
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            let zone_count = p.get("zones").and_then(|z| z.as_array()).map(|a| a.len()).unwrap_or(0);
            ok(
                json!({
                    "title": p.get("meta").and_then(|m| m.get("title")),
                    "zone_count": zone_count,
                    "tokens": p.get("tokens"),
                }),
                Effect::None,
            )
        }

        // ----- Zones -----
        "create_zone" => {
            let label = req_str(params, "label")?;
            let markdown = opt_str(params, "markdown").unwrap_or_default();
            let after_id = opt_str(params, "after_id");
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let insert_at = match after_id {
                Some(id) => zone_index(zones, &id)? + 1,
                None => zones.len(),
            };
            let zone = make_zone(insert_at as i64, &label, &markdown);
            let new_id = zone["id"].as_str().unwrap_or_default().to_string();
            zones.insert(insert_at, zone);
            renumber(zones);
            touch_modified(p);
            ok(json!({ "id": new_id }), Effect::Presentation)
        }
        "delete_zone" => {
            let id = req_str(params, "id")?;
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            zones.remove(idx);
            renumber(zones);
            touch_modified(p);
            ok(json!({ "deleted": id }), Effect::Presentation)
        }
        "reorder_zones" => {
            let ids: Vec<String> = p_param(params, "ordered_ids")
                .and_then(|v| v.as_array())
                .ok_or("Pflichtfeld 'ordered_ids' (Array) fehlt")?
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let mut reordered: Vec<Value> = Vec::with_capacity(zones.len());
            for id in &ids {
                if let Ok(idx) = zone_index(zones, id) {
                    reordered.push(zones[idx].clone());
                }
            }
            // nicht genannte Zones anhängen (kein Datenverlust)
            for z in zones.iter() {
                let zid = z.get("id").and_then(|v| v.as_str()).unwrap_or("");
                if !ids.iter().any(|i| i == zid) {
                    reordered.push(z.clone());
                }
            }
            renumber(&mut reordered);
            *zones = reordered;
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "get_zone" => {
            let id = req_str(params, "id")?;
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("Kein 'zones'-Array")?;
            let idx = zone_index(zones, &id)?;
            ok(zones[idx].clone(), Effect::None)
        }
        "get_all_zones" => {
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            ok(p.get("zones").cloned().unwrap_or(json!([])), Effect::None)
        }

        // ----- Content -----
        "set_zone_content" => {
            let id = req_str(params, "id")?;
            let content_type = req_str(params, "content_type")?;
            let content = req_str(params, "content")?;
            if content_type != "markdown" && content_type != "html" {
                return Err("content_type muss 'markdown' oder 'html' sein".into());
            }
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            let zone = &mut zones[idx];
            zone["content_type"] = json!(content_type);
            if content_type == "html" {
                zone["html"] = json!(content);
            } else {
                zone["markdown"] = json!(content);
            }
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "append_to_zone" => {
            let id = req_str(params, "id")?;
            let markdown = req_str(params, "markdown")?;
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            let zone = &mut zones[idx];
            let is_html = zone.get("content_type").and_then(|v| v.as_str()) == Some("html");
            let field = if is_html { "html" } else { "markdown" };
            let existing = zone.get(field).and_then(|v| v.as_str()).unwrap_or("");
            let joined = if existing.is_empty() {
                markdown
            } else {
                format!("{existing}\n\n{markdown}")
            };
            zone[field] = json!(joined);
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "replace_in_zone" => {
            let id = req_str(params, "id")?;
            let search = req_str(params, "search")?;
            let replace = req_str(params, "replace")?;
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            let zone = &mut zones[idx];
            let is_html = zone.get("content_type").and_then(|v| v.as_str()) == Some("html");
            let field = if is_html { "html" } else { "markdown" };
            let existing = zone.get(field).and_then(|v| v.as_str()).unwrap_or("").to_string();
            let count = existing.matches(&search).count();
            zone[field] = json!(existing.replace(&search, &replace));
            touch_modified(p);
            ok(json!({ "replacements": count }), Effect::Presentation)
        }
        "get_zone_content" => {
            let id = req_str(params, "id")?;
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("Kein 'zones'-Array")?;
            let idx = zone_index(zones, &id)?;
            let zone = &zones[idx];
            let is_html = zone.get("content_type").and_then(|v| v.as_str()) == Some("html");
            let content = if is_html {
                zone.get("html").and_then(|v| v.as_str()).unwrap_or("")
            } else {
                zone.get("markdown").and_then(|v| v.as_str()).unwrap_or("")
            };
            ok(
                json!({ "content_type": if is_html { "html" } else { "markdown" }, "content": content }),
                Effect::None,
            )
        }

        // ----- Tokens -----
        "get_tokens" => {
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            ok(p.get("tokens").cloned().unwrap_or(json!({})), Effect::None)
        }
        "set_token" => {
            let key = req_str(params, "key")?;
            let value = req_str(params, "value")?;
            let p = pres_mut(pres)?;
            let tokens = p.get_mut("tokens").and_then(|t| t.as_object_mut()).ok_or("Kein 'tokens'-Objekt")?;
            tokens.insert(key, json!(value));
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "set_tokens_bulk" => {
            let incoming = p_param(params, "tokens")
                .and_then(|v| v.as_object())
                .ok_or("Pflichtfeld 'tokens' (Objekt) fehlt")?
                .clone();
            let p = pres_mut(pres)?;
            let tokens = p.get_mut("tokens").and_then(|t| t.as_object_mut()).ok_or("Kein 'tokens'-Objekt")?;
            for (k, v) in incoming {
                tokens.insert(k, v);
            }
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "reset_tokens" => {
            let p = pres_mut(pres)?;
            p["tokens"] = default_tokens();
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        // ----- Themes / Presets -----
        "list_presets" => ok(json!({ "presets": crate::presets::list() }), Effect::None),
        "apply_preset" => {
            let name = req_str(params, "name")?;
            let preset = crate::presets::tokens(&name)
                .ok_or_else(|| format!("Theme '{name}' nicht gefunden"))?;
            let p = pres_mut(pres)?;
            let tokens = p
                .get_mut("tokens")
                .and_then(|t| t.as_object_mut())
                .ok_or("Kein 'tokens'-Objekt")?;
            if let Some(obj) = preset.as_object() {
                for (k, v) in obj {
                    tokens.insert(k.clone(), v.clone());
                }
            }
            touch_modified(p);
            ok(json!({ "ok": true, "applied": name }), Effect::Presentation)
        }

        // ----- Styles -----
        "set_zone_style" => {
            let id = req_str(params, "id")?;
            // style ist optional; custom_css kann hier ODER via set_zone_css gesetzt werden.
            let style = p_param(params, "style").and_then(|v| v.as_object()).cloned();
            let custom_css = opt_str(params, "custom_css");
            if style.is_none() && custom_css.is_none() {
                return Err("Mindestens 'style' oder 'custom_css' angeben".into());
            }
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            if let Some(style) = style {
                let zone_style = zones[idx]
                    .get_mut("style")
                    .and_then(|s| s.as_object_mut())
                    .ok_or("Zone hat kein 'style'-Objekt")?;
                for (k, v) in style {
                    zone_style.insert(k, v);
                }
            }
            if let Some(css) = custom_css {
                zones[idx]["custom_css"] = json!(css);
            }
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "get_zone_style" => {
            let id = req_str(params, "id")?;
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("Kein 'zones'-Array")?;
            let idx = zone_index(zones, &id)?;
            ok(zones[idx].get("style").cloned().unwrap_or(json!({})), Effect::None)
        }
        "set_zone_css" => {
            let id = req_str(params, "id")?;
            let css = req_str(params, "css")?;
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            zones[idx]["custom_css"] = json!(css);
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        // ----- Notes -----
        "set_zone_notes" => {
            let id = req_str(params, "id")?;
            let notes = req_str(params, "notes")?;
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            zones[idx]["notes"] = json!(notes);
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        // ----- Builds (Spec §19.1) -----
        "set_zone_reveal" => {
            let id = req_str(params, "id")?;
            let mode = req_str(params, "mode")?;
            if mode != "none" && mode != "steps" {
                return Err("mode muss 'none' oder 'steps' sein".into());
            }
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            zones[idx]["reveal"] = json!(mode);
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        // ----- Assets -----
        "list_assets" => {
            let list: Vec<Value> = assets
                .iter()
                .map(|a| json!({ "name": a.name, "mime": a.mime }))
                .collect();
            ok(json!({ "assets": list }), Effect::None)
        }

        // ----- Komponenten (Spec §18.7) -----
        "list_components" => ok(json!({ "components": crate::components::list() }), Effect::None),
        "insert_component" => {
            let zone_id = req_str(params, "zone_id")?;
            let kind = req_str(params, "type")?;
            let comp_params = p_param(params, "params").cloned().unwrap_or(json!({}));
            let mode = opt_str(params, "mode").unwrap_or_else(|| "replace".to_string());
            let html = crate::components::render(&kind, &comp_params)?;
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &zone_id)?;
            let zone = &mut zones[idx];
            let new_html = if mode == "append" {
                let existing = zone
                    .get("html")
                    .and_then(|v| v.as_str())
                    .filter(|s| !s.is_empty())
                    .map(|s| s.to_string());
                match existing {
                    Some(e) => format!("{e}\n{html}"),
                    None => html,
                }
            } else {
                html
            };
            zone["content_type"] = json!("html");
            zone["html"] = json!(new_html);
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        // ----- Presentation Mode -----
        "get_slide_count" => {
            let p = pres.as_ref().ok_or("Keine Präsentation geöffnet")?;
            let count = p.get("zones").and_then(|z| z.as_array()).map(|a| a.len()).unwrap_or(0);
            ok(json!({ "count": count }), Effect::None)
        }
        "set_active_slide" => {
            let index = p_param(params, "index")
                .and_then(|v| v.as_i64())
                .ok_or("Pflichtfeld 'index' (Zahl) fehlt")?;
            ok(json!({ "index": index }), Effect::ActiveSlide(index))
        }
        "set_transition" => {
            let kind = req_str(params, "kind")?;
            if !["none", "fade", "slide", "zoom"].contains(&kind.as_str()) {
                return Err("kind muss 'none', 'fade', 'slide' oder 'zoom' sein".into());
            }
            let duration = p_param(params, "duration_ms")
                .and_then(|v| v.as_i64())
                .unwrap_or(500)
                .max(0);
            let p = pres_mut(pres)?;
            let meta = p
                .get_mut("meta")
                .and_then(|m| m.as_object_mut())
                .ok_or("Kein 'meta'-Objekt")?;
            meta.insert(
                "transition".to_string(),
                json!({ "kind": kind, "duration_ms": duration }),
            );
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        other => Err(format!("Unbekanntes Tool: {other}")),
    }
}

/// Nutzungshinweis für das Modell (MCP `initialize` → `instructions`).
/// Steuert Claude Richtung Markdown-first und token-bewusstes HTML, damit
/// Präsentationen für Menschen editierbar/themebar bleiben.
pub fn server_instructions() -> &'static str {
    "Slideo baut Präsentationen aus 'Zones' (Slides). Wichtigste Regeln, damit die \
Präsentation für den Menschen editierbar bleibt:\n\n\
1. BEVORZUGE Markdown-Zonen (content_type 'markdown') für Text-, Titel-, Bullet- und \
Bild-Folien. Markdown bleibt im WYSIWYG-Editor bearbeitbar.\n\
2. Gestalte das Look & Feel über DESIGN-TOKENS (set_tokens_bulk: color-primary, color-bg, \
color-text, color-accent, font-heading, font-body, font-size-base, border-radius …) und über \
set_zone_style (layout: center|top|split|full, text_align, padding, background) — NICHT über \
Inline-HTML/CSS. SCHNELLSTART: list_presets + apply_preset wählt in einem Schritt ein stimmiges \
Theme (editorial, dark-tech, warm, minimal, corporate); danach mit set_token feinjustieren.\n\
3. Reiche Layouts gibt es auch mit Markdown – nutze sie statt HTML: set_zone_style layout \
'hero' (große Titel-Folie), 'split' (ZWEI SPALTEN – trenne die beiden Spalten im Markdown mit \
einer eigenen Zeile '+++'; eine Spalte kann ein Bild sein, z.B. ![](assets/x.png)), 'center', \
'top', 'full'.\n\
4. FERTIGE KOMPONENTEN statt handgeschriebenem HTML: Für Diagramme, KPI-Karten, Zeitstrahl, \
Vergleich, Fortschritt, Zitat, Hinweis nutze list_components + insert_component(zone_id, type, \
params). Diese Komponenten sind bereits token-bewusst (themebar) und sehen gut aus — der \
schnellste Weg zu hochwertigen Inhalten.\n\
5. Für GESTYLTEN, aber editierbaren Text: Markdown + set_zone_css (zonen-gescoptes \
Custom-CSS) statt HTML. So bleibt der Text im Editor lesbar/bearbeitbar UND hat volles \
CSS-Styling. Beispiel: set_zone_css(id, 'h1 { letter-spacing: -.02em } strong { color: \
var(--color-accent) }').\n\
6. Bild-Positionierung in Markdown-Zonen: ein normales Bild ist ![](assets/x.png). Für Größe/\
Ausrichtung/Umfluss schreibe rohes <img>: <img src=\"assets/x.png\" style=\"width:50%\" \
class=\"align-right\"> bzw. class=\"float-left\" (Textumfluss). Klassen: align-left|center|right, \
float-left|right.\n\
7. EIGENES HTML (content_type 'html') NUR für Interaktives/Animiertes, das die Komponenten nicht \
abdecken: eigene Charts (SVG/JS), CSS/JS-Animationen (@keyframes), interaktive SVGs/Diagramme, \
eingebettete Player, Demos — ODER Video/Audio: <video controls src=\"assets/x.mp4\"> bzw. \
<audio controls src=\"assets/x.mp3\"> (Asset zuvor mit list_assets finden; Video/Audio nur in \
HTML-Zonen).\n\
8. WENN du HTML nutzt: style AUSSCHLIESSLICH über die CSS-Variablen der Design-Tokens \
(var(--color-primary), var(--color-bg), var(--color-text), var(--color-accent), \
var(--font-heading), var(--font-body), var(--border-radius) …). KEINE hartkodierten Farben/Fonts. \
Halte HTML-Folien fokussiert und klein.\n\
9. Optional: set_zone_notes(id, notes) für Sprechernotizen (nur in der Speaker-View sichtbar); \
set_transition(kind, duration_ms) für den deck-weiten Folienübergang (none|fade|slide|zoom); \
set_zone_reveal(id, 'steps') für Builds (Blöcke der Folie erscheinen schrittweise)."
}

/// MCP-Prompt-Definitionen (`prompts/list`). Der "slideo_guide"-Prompt ist die
/// in Slideo integrierte „Agenten-Skill": ein aufrufbarer Leitfaden, der einer
/// KI erklärt, wie sie Slideo nutzen soll.
pub fn prompt_definitions() -> Value {
    json!([{
        "name": "slideo_guide",
        "description": "Leitfaden: wie man mit Slideo eine hochwertige, für Menschen editierbare Präsentation baut (Design-Tokens, Layouts, Markdown vs. HTML, Bilder).",
        "arguments": [
            { "name": "thema", "description": "Thema/Inhalt der Präsentation (optional)", "required": false }
        ]
    }])
}

/// Vollständiger Leitfaden-Text (Inhalt des "slideo_guide"-Prompts).
pub fn build_guide(thema: Option<&str>) -> String {
    let intro = "Du baust eine Präsentation in Slideo über den MCP-Server. Slideo-Präsentationen \
bestehen aus 'Zones' (Slides). Ziel: eine schöne Präsentation, die für den Menschen NACHHER \
editierbar und global umgestaltbar bleibt.\n\n";

    let workflow = "EMPFOHLENER ABLAUF:\n\
1) Designsystem zuerst: ENTWEDER apply_preset(name) für ein fertiges Theme (list_presets zeigt \
editorial, dark-tech, warm, minimal, corporate) ODER set_tokens_bulk mit einem stimmigen Set — \
color-primary, color-secondary, color-bg, color-surface, color-text, color-accent, font-heading, \
font-body, font-size-base, spacing-base, border-radius. (get_tokens zeigt die aktuellen Werte.)\n\
2) Folien anlegen: create_zone + set_zone_content (content_type 'markdown'). Schreibe klaren, \
knappen Markdown-Inhalt (eine Kernaussage pro Folie).\n\
3) Layout je Folie über set_zone_style:\n\
   - 'hero': große, zentrierte Titel-Folie (Auftakt).\n\
   - 'split': ZWEI SPALTEN — trenne die beiden Spalten im Markdown mit einer eigenen Zeile '+++'. \
Eine Spalte kann ein Bild sein.\n\
   - 'center' / 'top' / 'full': einspaltig.\n\
   - text_align (left|center|right), padding, background (überschreibt color-bg, z.B. Gradient).\n\
4) Bilder: vorhandene Assets mit list_assets entdecken und als ![](assets/<name>) referenzieren. \
Für Größe/Ausrichtung/Umfluss rohes <img> nutzen: <img src=\"assets/x.png\" style=\"width:50%\" \
class=\"align-right\"> (Klassen: align-left|center|right, float-left|right).\n\
5) Reiche Inhalte ohne HTML-Handarbeit: insert_component(zone_id, type, params) setzt fertige, \
token-bewusste Komponenten ein — list_components zeigt Typen + Parameter: stat_cards (KPIs), \
bar_chart, line_chart (Trend), donut_chart (Anteile), progress, quote, timeline, comparison \
(zwei Spalten), callout, icon (Symbol). Bevorzuge diese für Daten/Diagramme/Vergleiche.\n\
6) Feinschliff: set_zone_notes(id, notes) für Sprechernotizen (nur Speaker-View); \
set_transition(kind, duration_ms) für den Folienübergang (none|fade|slide|zoom); \
set_zone_reveal(id, 'steps') für Builds — die Blöcke der Folie erscheinen im \
Präsentationsmodus nacheinander (gut für Bullet-Listen, die schrittweise aufgebaut werden).\n\n";

    let principles = "WICHTIGE PRINZIPIEN (Editierbarkeit):\n\
- BEVORZUGE Markdown + Tokens + Layouts + fertige Komponenten. Markdown-Folien bleiben im \
WYSIWYG-Editor bearbeitbar, Komponenten bleiben themebar.\n\
- Eigenes content_type 'html' NUR für Interaktives/Animiertes, das die Komponenten nicht abdecken \
(eigene Charts SVG/JS, CSS-@keyframes-Animationen, interaktive SVGs, eingebettete Player, Demos) \
ODER Video/Audio. Das volle Browser-Repertoire ist erlaubt — aber klein und fokussiert halten.\n\
- WENN HTML: style ausschließlich über die Token-CSS-Variablen (var(--color-primary), \
var(--font-heading), var(--color-bg), var(--border-radius) …), NIE hartkodierte Farben/Fonts — \
so bleibt die Folie über die Token-Sidebar global themebar.\n\
- Konsistenz: gleiche Tokens für die ganze Deck; pro Folie nur gezielte Overrides.\n";

    let mut out = String::new();
    out.push_str(intro);
    if let Some(t) = thema {
        if !t.trim().is_empty() {
            out.push_str(&format!("THEMA DIESER PRÄSENTATION: {t}\n\n"));
        }
    }
    out.push_str(workflow);
    out.push_str(principles);
    out
}

/// Tool-Definitionen für MCP `tools/list` (Spec §5).
pub fn tool_schemas() -> Value {
    let obj = || json!({ "type": "object", "properties": {} });
    let s = |d: &str| json!({ "type": "string", "description": d });
    json!([
        {
            "name": "create_presentation",
            "description": "Erstellt eine neue leere Präsentation und öffnet sie in der App.",
            "inputSchema": { "type": "object", "properties": { "title": s("Titel der Präsentation") }, "required": ["title"] }
        },
        {
            "name": "open_presentation",
            "description": "Öffnet eine bestehende .slideo Datei.",
            "inputSchema": { "type": "object", "properties": { "path": s("Absoluter Pfad zur .slideo Datei") }, "required": ["path"] }
        },
        {
            "name": "save_presentation",
            "description": "Speichert die aktuelle Präsentation. Ohne path wird am bestehenden Ort gespeichert.",
            "inputSchema": { "type": "object", "properties": { "path": s("Optionaler Speicherpfad (Save As)") } }
        },
        {
            "name": "get_presentation_meta",
            "description": "Gibt Metadaten der aktuellen Präsentation zurück: Titel, Anzahl Zones, Token-Übersicht.",
            "inputSchema": obj()
        },
        {
            "name": "create_zone",
            "description": "Erstellt eine neue Zone (Slide) am Ende oder an einer bestimmten Position.",
            "inputSchema": { "type": "object", "properties": {
                "label": s("Anzeigename z.B. 'Slide 3'"),
                "after_id": s("UUID der Zone nach der eingefügt wird. Ohne Angabe: ans Ende."),
                "markdown": s("Optionaler initialer Inhalt als Markdown")
            }, "required": ["label"] }
        },
        {
            "name": "delete_zone",
            "description": "Löscht eine Zone permanent.",
            "inputSchema": { "type": "object", "properties": { "id": s("UUID der Zone") }, "required": ["id"] }
        },
        {
            "name": "reorder_zones",
            "description": "Ändert die Reihenfolge aller Zones.",
            "inputSchema": { "type": "object", "properties": {
                "ordered_ids": { "type": "array", "items": { "type": "string" }, "description": "Alle Zone-UUIDs in der gewünschten neuen Reihenfolge" }
            }, "required": ["ordered_ids"] }
        },
        {
            "name": "get_zone",
            "description": "Gibt eine einzelne Zone zurück (id, label, content_type, markdown, html, style, notes).",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
        },
        {
            "name": "get_all_zones",
            "description": "Gibt alle Zones in ihrer aktuellen Reihenfolge zurück.",
            "inputSchema": obj()
        },
        {
            "name": "set_zone_content",
            "description": "Ersetzt den Inhalt einer Zone. BEVORZUGE content_type 'markdown' (bleibt für den Menschen WYSIWYG-editierbar; style über Design-Tokens + set_zone_style). Nutze 'html' NUR für Interaktives/Animiertes (Charts, SVG, JS) – und dann ausschließlich mit den Token-CSS-Variablen (var(--color-primary), var(--font-heading) …) statt hartkodierter Farben/Fonts, damit der Mensch es global umgestalten kann.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "content_type": { "type": "string", "enum": ["markdown", "html"], "description": "markdown für Text-Slides, html für interaktive oder animierte Inhalte" },
                "content": s("Inhalt als Markdown-String oder als HTML-String je nach content_type")
            }, "required": ["id", "content_type", "content"] }
        },
        {
            "name": "append_to_zone",
            "description": "Fügt Inhalt am Ende einer Zone hinzu (Markdown bzw. HTML je nach content_type).",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" }, "markdown": { "type": "string" } }, "required": ["id", "markdown"] }
        },
        {
            "name": "replace_in_zone",
            "description": "Ersetzt einen bestimmten Text in einer Zone durch neuen Text.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" }, "search": s("Zu ersetzender Text"), "replace": s("Neuer Text")
            }, "required": ["id", "search", "replace"] }
        },
        {
            "name": "get_zone_content",
            "description": "Gibt den Inhalt einer Zone zurück (Markdown, bzw. rohes HTML bei HTML-Zonen).",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
        },
        {
            "name": "get_tokens",
            "description": "Gibt alle aktuellen Design Tokens zurück.",
            "inputSchema": obj()
        },
        {
            "name": "set_token",
            "description": "Setzt einen einzelnen Design Token.",
            "inputSchema": { "type": "object", "properties": { "key": s("Token-Name z.B. 'color-primary'"), "value": s("Token-Wert z.B. '#6366f1'") }, "required": ["key", "value"] }
        },
        {
            "name": "set_tokens_bulk",
            "description": "Setzt mehrere Design Tokens auf einmal. Ideal zum Erstellen eines kompletten Design Systems.",
            "inputSchema": { "type": "object", "properties": {
                "tokens": { "type": "object", "description": "Key-Value Paare aller zu setzenden Tokens", "additionalProperties": { "type": "string" } }
            }, "required": ["tokens"] }
        },
        {
            "name": "reset_tokens",
            "description": "Setzt alle Design Tokens auf die Standard-Werte zurück.",
            "inputSchema": obj()
        },
        {
            "name": "list_presets",
            "description": "Listet die verfügbaren Theme-Presets (kuratierte Design-Token-Bündel) mit Name, Label und Beschreibung. Wende eines mit apply_preset an, um in einem Schritt ein stimmiges Farb-/Font-System zu setzen.",
            "inputSchema": obj()
        },
        {
            "name": "apply_preset",
            "description": "Wendet ein Theme-Preset an (setzt die Design-Tokens des Presets per Bulk). Schneller Start für ein konsistentes Look & Feel; danach kann per set_token/set_tokens_bulk feinjustiert werden. Verfügbare Namen via list_presets.",
            "inputSchema": { "type": "object", "properties": {
                "name": s("Preset-Name, z.B. 'editorial', 'dark-tech', 'warm', 'minimal', 'corporate' (siehe list_presets)")
            }, "required": ["name"] }
        },
        {
            "name": "set_zone_style",
            "description": "Setzt Style-Properties einer Zone: layout/padding/background/text_align (im 'style'-Objekt) und/oder zonen-gescoptes 'custom_css'. Mit custom_css stylst du eine Markdown-Folie frei, ohne den Text in HTML zu vergraben (Text bleibt editierbar). Mindestens eines von 'style'/'custom_css' angeben.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "style": { "type": "object", "properties": {
                    "layout": { "type": "string", "enum": ["center", "hero", "top", "split", "full"], "description": "Layout: center (zentriert), hero (große Titel-Folie), top (oben), split (zwei Spalten – Markdown an einer '+++'-Zeile trennen), full (vollflächig)" },
                    "padding": s("CSS padding z.B. '4rem'"),
                    "background": s("CSS background, überschreibt Token. z.B. '#1a1a2e' oder 'linear-gradient(...)'"),
                    "text_align": { "type": "string", "enum": ["left", "center", "right"] }
                } },
                "custom_css": s("Zonen-gescoptes CSS, z.B. 'h1 { letter-spacing: -.02em } strong { color: var(--color-accent) }'. Selektoren beziehen sich auf den Folieninhalt. Nutze Token-Variablen, damit es themebar bleibt.")
            }, "required": ["id"] }
        },
        {
            "name": "get_zone_style",
            "description": "Gibt die Style-Properties einer Zone zurück.",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
        },
        {
            "name": "set_zone_css",
            "description": "Setzt zonen-spezifisches Custom-CSS, das auf DIESE Zone gescoped angewendet wird – ideal, um eine Markdown-Folie zu stylen, ohne den Text in HTML zu vergraben (Text bleibt editierbar). Selektoren beziehen sich auf den Folieninhalt, z.B. 'h1 { ... }', '.slideo-content p { ... }'. Nutze die Token-CSS-Variablen (var(--color-primary) …), damit es themebar bleibt.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "css": s("CSS-Regeln für diese Zone, z.B. 'h1 { letter-spacing: -0.02em } strong { color: var(--color-accent) }'")
            }, "required": ["id", "css"] }
        },
        {
            "name": "set_zone_notes",
            "description": "Setzt die Sprechernotizen (Speaker Notes) einer Zone. Notizen erscheinen NUR in der Speaker-View während der Präsentation, nie auf der Folie selbst. Ideal für Stichpunkte, was der Vortragende zu dieser Folie sagen will.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "notes": s("Sprechernotizen als reiner Text (mehrzeilig erlaubt). Leerer String löscht die Notizen.")
            }, "required": ["id", "notes"] }
        },
        {
            "name": "set_zone_reveal",
            "description": "Schaltet Builds (schrittweises Einblenden) einer Markdown-Zone. 'steps' = die Top-Level-Blöcke (Absätze/Bullets/Bilder) erscheinen im Präsentationsmodus nacheinander pro Pfeil/Klick; 'none' = alles sofort (Default). Nur Markdown-Zonen ohne 'split'.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "mode": { "type": "string", "enum": ["none", "steps"], "description": "steps = schrittweise, none = sofort" }
            }, "required": ["id", "mode"] }
        },
        {
            "name": "list_assets",
            "description": "Listet die in der Präsentation hinterlegten Assets (Bilder) mit Dateiname + MIME-Typ. Referenziere ein Asset im Inhalt als 'assets/<name>', z.B. Markdown ![](assets/logo.png) oder HTML <img src=\"assets/logo.png\">. Der Mensch legt Assets in der App ab (Import/Settings).",
            "inputSchema": obj()
        },
        {
            "name": "list_components",
            "description": "Listet fertige, token-bewusste HTML-Komponenten (Kennzahlen-Karten, Diagramme: Balken/Linie/Donut, Fortschritt, Zitat, Zeitstrahl, Vergleich, Hinweis-Box, Icons) mit Typ, Label, Beschreibung und Parametern. Mit insert_component in eine Zone einsetzen. Schneller Weg zu hochwertigen, themebaren Inhalten ohne eigenes HTML.",
            "inputSchema": obj()
        },
        {
            "name": "insert_component",
            "description": "Erzeugt eine fertige, token-bewusste HTML-Komponente und setzt sie in eine Zone (die Zone wird zu content_type 'html'). Die Komponente nutzt ausschließlich Token-CSS-Variablen und bleibt damit über die Token-Sidebar global themebar. Verfügbare Typen + Parameter via list_components. Tipp: vorher create_zone, dann hier einsetzen.",
            "inputSchema": { "type": "object", "properties": {
                "zone_id": s("UUID der Ziel-Zone"),
                "type": s("Komponententyp, z.B. 'bar_chart', 'stat_cards', 'timeline', 'comparison' (siehe list_components)"),
                "params": { "type": "object", "description": "Parameter der Komponente (Struktur je Typ, siehe list_components), z.B. { \"items\": [{ \"label\": \"Q1\", \"value\": 40 }] }" },
                "mode": { "type": "string", "enum": ["replace", "append"], "description": "replace (Default): Zoneninhalt ersetzen; append: an bestehendes HTML der Zone anhängen" }
            }, "required": ["zone_id", "type"] }
        },
        {
            "name": "get_slide_count",
            "description": "Gibt die Anzahl der Zones (Slides) zurück.",
            "inputSchema": obj()
        },
        {
            "name": "set_active_slide",
            "description": "Springt im Präsentationsmodus zu einem bestimmten Slide.",
            "inputSchema": { "type": "object", "properties": { "index": { "type": "number", "description": "0-basierter Index des Slides" } }, "required": ["index"] }
        },
        {
            "name": "set_transition",
            "description": "Setzt den präsentationsweiten Folienübergang (Animation beim Folienwechsel im Präsentationsmodus und im HTML-Export). 'none' = reines Scrollen (Default).",
            "inputSchema": { "type": "object", "properties": {
                "kind": { "type": "string", "enum": ["none", "fade", "slide", "zoom"], "description": "none (kein Übergang), fade (Überblenden), slide (horizontal Schieben), zoom (Ein-/Auszoomen)" },
                "duration_ms": { "type": "number", "description": "Dauer des Übergangs in Millisekunden (Default 500)" }
            }, "required": ["kind"] }
        }
    ])
}

#[cfg(test)]
mod tests {
    use super::*;

    fn call(method: &str, params: Value, pres: &mut Option<Value>, fp: &mut Option<PathBuf>) -> Value {
        handle(method, &params, pres, fp, &[]).expect(method).result
    }

    #[test]
    fn full_build_flow() {
        let (mut pres, mut fp) = (None, None);

        call("create_presentation", json!({ "title": "Demo" }), &mut pres, &mut fp);
        assert!(pres.is_some());

        let zones = call("get_all_zones", json!({}), &mut pres, &mut fp);
        assert_eq!(zones.as_array().unwrap().len(), 1);
        let first_id = zones[0]["id"].as_str().unwrap().to_string();

        // Zone nach der ersten anlegen + zu HTML machen
        let created = call(
            "create_zone",
            json!({ "label": "Slide 2", "after_id": first_id }),
            &mut pres,
            &mut fp,
        );
        let new_id = created["id"].as_str().unwrap().to_string();
        call(
            "set_zone_content",
            json!({ "id": new_id, "content_type": "html", "content": "<b>hi</b><script>1</script>" }),
            &mut pres,
            &mut fp,
        );
        let content = call("get_zone_content", json!({ "id": new_id }), &mut pres, &mut fp);
        assert_eq!(content["content_type"], "html");
        assert_eq!(content["content"], "<b>hi</b><script>1</script>");

        // Custom CSS bleibt am Zone-Objekt erhalten (dediziertes Tool)
        call("set_zone_css", json!({ "id": new_id, "css": "h1 { color: red }" }), &mut pres, &mut fp);
        let zone = call("get_zone", json!({ "id": new_id }), &mut pres, &mut fp);
        assert_eq!(zone["custom_css"], "h1 { color: red }");

        // … und auch über set_zone_style (Auffindbarkeit)
        call(
            "set_zone_style",
            json!({ "id": new_id, "custom_css": "p { font-weight: 600 }" }),
            &mut pres,
            &mut fp,
        );
        let zone = call("get_zone", json!({ "id": new_id }), &mut pres, &mut fp);
        assert_eq!(zone["custom_css"], "p { font-weight: 600 }");

        // Speaker Notes
        call("set_zone_notes", json!({ "id": new_id, "notes": "Hier langsam sprechen." }), &mut pres, &mut fp);
        let zone = call("get_zone", json!({ "id": new_id }), &mut pres, &mut fp);
        assert_eq!(zone["notes"], "Hier langsam sprechen.");

        // Transition (deck-weit, in meta)
        call("set_transition", json!({ "kind": "fade", "duration_ms": 400 }), &mut pres, &mut fp);
        let meta = call("get_presentation_meta", json!({}), &mut pres, &mut fp);
        assert_eq!(pres.as_ref().unwrap()["meta"]["transition"]["kind"], "fade");
        assert_eq!(pres.as_ref().unwrap()["meta"]["transition"]["duration_ms"], 400);
        let _ = meta;
        assert!(handle("set_transition", &json!({ "kind": "spin" }), &mut pres, &mut fp, &[]).is_err());

        // Tokens
        call("set_token", json!({ "key": "color-primary", "value": "#ffffff" }), &mut pres, &mut fp);
        let tokens = call("get_tokens", json!({}), &mut pres, &mut fp);
        assert_eq!(tokens["color-primary"], "#ffffff");

        // Komponente einsetzen: Zone wird HTML, nutzt Token-Variablen
        call(
            "insert_component",
            json!({ "zone_id": first_id, "type": "bar_chart", "params": { "items": [{ "label": "A", "value": 10 }] } }),
            &mut pres,
            &mut fp,
        );
        let zone = call("get_zone", json!({ "id": first_id }), &mut pres, &mut fp);
        assert_eq!(zone["content_type"], "html");
        assert!(zone["html"].as_str().unwrap().contains("var(--color-primary)"));
        assert!(handle("insert_component", &json!({ "zone_id": first_id, "type": "nope" }), &mut pres, &mut fp, &[]).is_err());

        // Reorder: neue Zone nach vorn
        call("reorder_zones", json!({ "ordered_ids": [new_id, first_id] }), &mut pres, &mut fp);
        let reordered = call("get_all_zones", json!({}), &mut pres, &mut fp);
        assert_eq!(reordered[0]["id"], json!(new_id));
        assert_eq!(reordered[0]["order"], json!(0));

        // Löschen + Zählung
        call("delete_zone", json!({ "id": first_id }), &mut pres, &mut fp);
        let count = call("get_slide_count", json!({}), &mut pres, &mut fp);
        assert_eq!(count["count"], 1);
    }

    #[test]
    fn missing_required_field_errors() {
        let (mut pres, mut fp) = (Some(new_presentation("x")), None);
        assert!(handle("create_zone", &json!({}), &mut pres, &mut fp, &[]).is_err());
    }

    #[test]
    fn apply_preset_sets_tokens() {
        let (mut pres, mut fp) = (Some(new_presentation("x")), None);
        // Unbekanntes Preset → Fehler.
        assert!(handle("apply_preset", &json!({ "name": "gibts-nicht" }), &mut pres, &mut fp, &[]).is_err());
        // Bekanntes Preset → Tokens werden übernommen.
        call("apply_preset", json!({ "name": "dark-tech" }), &mut pres, &mut fp);
        let tokens = call("get_tokens", json!({}), &mut pres, &mut fp);
        assert_eq!(tokens["color-accent"], "#22d3ee");
        assert_eq!(tokens["color-bg"], "#0b0f17");
        // list_presets enthält alle fünf.
        let presets = call("list_presets", json!({}), &mut pres, &mut fp);
        assert_eq!(presets["presets"].as_array().unwrap().len(), 5);
    }
}

