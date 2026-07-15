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
        "zones": [ make_zone(0, "Slide 1", &format!("# {title}\n\nYour first slide. Let's go.")) ]
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
        .ok_or_else(|| format!("Required field '{key}' (string) is missing"))
}

fn opt_str(params: &Value, key: &str) -> Option<String> {
    p_param(params, key).and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn pres_mut<'a>(pres: &'a mut Option<Value>) -> Result<&'a mut Value, String> {
    pres.as_mut().ok_or_else(|| "No presentation open".to_string())
}

fn zones_mut<'a>(p: &'a mut Value) -> Result<&'a mut Vec<Value>, String> {
    p.get_mut("zones")
        .and_then(|z| z.as_array_mut())
        .ok_or_else(|| "Presentation has no 'zones' array".to_string())
}

fn zone_index(zones: &[Value], id: &str) -> Result<usize, String> {
    zones
        .iter()
        .position(|z| z.get("id").and_then(|v| v.as_str()) == Some(id))
        .ok_or_else(|| format!("Zone '{id}' not found"))
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
            let p = pres.as_ref().ok_or("No presentation open")?;
            let target = opt_str(params, "path")
                .map(PathBuf::from)
                .or_else(|| file_path.clone())
                .ok_or("No save path known (provide 'path')")?;
            file::write_presentation(&target, p, assets).map_err(|e| format!("{e:#}"))?;
            *file_path = Some(target.clone());
            ok(json!({ "saved": target.to_string_lossy() }), Effect::None)
        }
        "get_presentation_meta" => {
            let p = pres.as_ref().ok_or("No presentation open")?;
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
                .ok_or("Required field 'ordered_ids' (array) is missing")?
                .iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect();
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let mut reordered: Vec<Value> = Vec::with_capacity(zones.len());
            let mut seen: std::collections::HashSet<&str> = std::collections::HashSet::new();
            for id in &ids {
                // Wiederholte id NICHT ein zweites Mal klonen — sonst entstünden zwei
                // Zonen mit identischer UUID (persistierte, stille Datenkorruption).
                if !seen.insert(id.as_str()) {
                    continue;
                }
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
            let p = pres.as_ref().ok_or("No presentation open")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("No 'zones' array")?;
            let idx = zone_index(zones, &id)?;
            ok(zones[idx].clone(), Effect::None)
        }
        // ----- Layout-Heuristik (Spec §24): read-only, misst NICHT echtes Layout -----
        "check_zone_overflow" => {
            let id = req_str(params, "id")?;
            let p = pres.as_ref().ok_or("No presentation open")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("No 'zones' array")?;
            let idx = zone_index(zones, &id)?;
            let tokens = p.get("tokens").cloned().unwrap_or_else(|| json!({}));
            ok(crate::overflow::analyze(&zones[idx], &tokens), Effect::None)
        }
        "validate_deck" => {
            let p = pres.as_ref().ok_or("No presentation open")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("No 'zones' array")?;
            let tokens = p.get("tokens").cloned().unwrap_or_else(|| json!({}));
            let problems: Vec<Value> = zones
                .iter()
                .filter_map(|z| {
                    let rep = crate::overflow::analyze(z, &tokens);
                    if rep.get("fits").and_then(|f| f.as_bool()).unwrap_or(true) {
                        None
                    } else {
                        Some(json!({
                            "id": z.get("id"),
                            "label": z.get("label"),
                            "issues": rep.get("issues"),
                        }))
                    }
                })
                .collect();
            ok(
                json!({
                    "zones_total": zones.len(),
                    "zones_with_issues": problems.len(),
                    "problems": problems,
                    "note": "Heuristic check — per-slide details via check_zone_overflow(id)."
                }),
                Effect::None,
            )
        }
        "get_all_zones" => {
            let p = pres.as_ref().ok_or("No presentation open")?;
            ok(p.get("zones").cloned().unwrap_or(json!([])), Effect::None)
        }

        // ----- Content -----
        "set_zone_content" => {
            let id = req_str(params, "id")?;
            let content_type = req_str(params, "content_type")?;
            let content = req_str(params, "content")?;
            if content_type != "markdown" && content_type != "html" {
                return Err("content_type must be 'markdown' or 'html'".into());
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
            // Leerer Suchstring würde `replace` an JEDER Char-Grenze einfügen
            // (str::replace("", r)) und den Inhalt zerhacken → früh ablehnen.
            if search.is_empty() {
                return Err("'search' must not be empty".to_string());
            }
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
            let p = pres.as_ref().ok_or("No presentation open")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("No 'zones' array")?;
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
            let p = pres.as_ref().ok_or("No presentation open")?;
            ok(p.get("tokens").cloned().unwrap_or(json!({})), Effect::None)
        }
        "set_token" => {
            let key = req_str(params, "key")?;
            let value = req_str(params, "value")?;
            let p = pres_mut(pres)?;
            let tokens = p.get_mut("tokens").and_then(|t| t.as_object_mut()).ok_or("No 'tokens' object")?;
            tokens.insert(key, json!(value));
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "set_tokens_bulk" => {
            let incoming = p_param(params, "tokens")
                .and_then(|v| v.as_object())
                .ok_or("Required field 'tokens' (object) is missing")?
                .clone();
            let p = pres_mut(pres)?;
            let tokens = p.get_mut("tokens").and_then(|t| t.as_object_mut()).ok_or("No 'tokens' object")?;
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
                .ok_or_else(|| format!("Theme '{name}' not found"))?;
            let p = pres_mut(pres)?;
            let tokens = p
                .get_mut("tokens")
                .and_then(|t| t.as_object_mut())
                .ok_or("No 'tokens' object")?;
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
                return Err("Provide at least 'style' or 'custom_css'".into());
            }
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            if let Some(style) = style {
                let zone_style = zones[idx]
                    .get_mut("style")
                    .and_then(|s| s.as_object_mut())
                    .ok_or("Zone has no 'style' object")?;
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
            let p = pres.as_ref().ok_or("No presentation open")?;
            let zones = p.get("zones").and_then(|z| z.as_array()).ok_or("No 'zones' array")?;
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
                return Err("mode must be 'none' or 'steps'".into());
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
            let mut html = crate::components::render(&kind, &comp_params)?;
            // Optionales data-id für Auto-Animate (Spec §19.1): Komponente morphbar machen.
            if let Some(did) = opt_str(params, "data_id") {
                html = crate::components::with_data_id(&html, &did);
            }
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
            let p = pres.as_ref().ok_or("No presentation open")?;
            let count = p.get("zones").and_then(|z| z.as_array()).map(|a| a.len()).unwrap_or(0);
            ok(json!({ "count": count }), Effect::None)
        }
        "set_active_slide" => {
            let index = p_param(params, "index")
                .and_then(|v| v.as_i64())
                .ok_or("Required field 'index' (number) is missing")?;
            ok(json!({ "index": index }), Effect::ActiveSlide(index))
        }
        "set_transition" => {
            let kind = req_str(params, "kind")?;
            if !["none", "fade", "slide", "zoom", "auto"].contains(&kind.as_str()) {
                return Err("kind must be 'none', 'fade', 'slide', 'zoom' or 'auto'".into());
            }
            let duration = p_param(params, "duration_ms")
                .and_then(|v| v.as_i64())
                .unwrap_or(500)
                .max(0);
            let p = pres_mut(pres)?;
            let meta = p
                .get_mut("meta")
                .and_then(|m| m.as_object_mut())
                .ok_or("No 'meta' object")?;
            meta.insert(
                "transition".to_string(),
                json!({ "kind": kind, "duration_ms": duration }),
            );
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        // ----- Marke / Meta / Schriften (Spec §19.4, MCP-Parität) -----
        "set_presentation_title" => {
            let title = req_str(params, "title")?;
            let p = pres_mut(pres)?;
            let meta = p
                .get_mut("meta")
                .and_then(|m| m.as_object_mut())
                .ok_or("No 'meta' object")?;
            meta.insert("title".to_string(), json!(title));
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "set_logo" => {
            let asset = req_str(params, "asset")?;
            // Die KI lädt keine Binärdateien hoch — sie referenziert vorhandene Assets.
            if !assets.iter().any(|a| a.name == asset) {
                return Err(format!("Asset '{asset}' not found (see list_assets)"));
            }
            let position = opt_str(params, "position").unwrap_or_else(|| "bottom-right".to_string());
            if !["top-left", "top-right", "bottom-left", "bottom-right"].contains(&position.as_str()) {
                return Err("position must be top-left, top-right, bottom-left or bottom-right".into());
            }
            let p = pres_mut(pres)?;
            let meta = p
                .get_mut("meta")
                .and_then(|m| m.as_object_mut())
                .ok_or("No 'meta' object")?;
            meta.insert("logo".to_string(), json!({ "asset": asset, "position": position }));
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "clear_logo" => {
            let p = pres_mut(pres)?;
            if let Some(meta) = p.get_mut("meta").and_then(|m| m.as_object_mut()) {
                meta.remove("logo");
            }
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "register_font" => {
            let family = req_str(params, "family")?;
            let asset = req_str(params, "asset")?;
            if !assets.iter().any(|a| a.name == asset) {
                return Err(format!("Asset '{asset}' not found (see list_assets)"));
            }
            let p = pres_mut(pres)?;
            let obj = p.as_object_mut().ok_or("Invalid presentation")?;
            let fonts = obj.entry("fonts").or_insert_with(|| json!([]));
            let arr = fonts.as_array_mut().ok_or("'fonts' is not an array")?;
            // Dedup nach Familienname (bestehende ersetzen, sonst anhängen).
            match arr
                .iter_mut()
                .find(|f| f.get("family").and_then(|v| v.as_str()) == Some(family.as_str()))
            {
                Some(existing) => existing["asset"] = json!(asset),
                None => arr.push(json!({ "family": family, "asset": asset })),
            }
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }
        "set_zone_label" => {
            let id = req_str(params, "id")?;
            let label = req_str(params, "label")?;
            let p = pres_mut(pres)?;
            let zones = zones_mut(p)?;
            let idx = zone_index(zones, &id)?;
            zones[idx]["label"] = json!(label);
            touch_modified(p);
            ok(json!({ "ok": true }), Effect::Presentation)
        }

        other => Err(format!("Unknown tool: {other}")),
    }
}

/// Nutzungshinweis für das Modell (MCP `initialize` → `instructions`).
/// Steuert Claude Richtung Markdown-first und token-bewusstes HTML, damit
/// Präsentationen für Menschen editierbar/themebar bleiben.
pub fn server_instructions() -> &'static str {
    "Slideo builds presentations from 'Zones' (slides). Key rules so the presentation stays \
editable for the human:\n\n\
0. FORMAT (mandatory): Every slide is a FIXED stage of exactly 1280×720 px (16:9). It does NOT \
grow with its content — anything beyond 1280×720 is CLIPPED (no scrolling, no second page). Design \
EVERY slide so everything fits completely: rather split content across several slides than overfill \
one (one key message per slide). For HTML slides think strictly in the 1280×720 coordinate system — \
see rule 8.\n\
1. PREFER Markdown zones (content_type 'markdown') for text, title, bullet and image slides. \
Markdown stays editable in the WYSIWYG editor.\n\
2. Design the look & feel via DESIGN TOKENS (set_tokens_bulk: color-primary, color-bg, \
color-text, color-accent, font-heading, font-body, font-size-base, border-radius …) and via \
set_zone_style (layout: center|top|split|full, text_align, padding, background) — NOT via \
inline HTML/CSS. QUICK START: list_presets + apply_preset picks a coherent theme in one step \
(editorial, dark-tech, warm, minimal, corporate); fine-tune afterwards with set_token.\n\
3. Rich layouts are available with Markdown too – use them instead of HTML: set_zone_style layout \
'hero' (large title slide), 'split' (TWO COLUMNS – separate the two columns in the Markdown with \
a line of its own containing '+++'; a column can be an image, e.g. ![](assets/x.png)), 'center', \
'top', 'full'.\n\
4. READY-MADE COMPONENTS instead of hand-written HTML: for charts, KPI cards (big_number, \
stat_cards), tables (data_table), feature grids (feature_grid), process steps (process_steps), \
pricing (pricing), image galleries (gallery), timeline, comparison, progress, quote, callout use \
list_components + insert_component(zone_id, type, params). These components are already \
token-aware (themeable) and look good — the fastest route to high-quality content.\n\
5. For STYLED but editable text: Markdown + set_zone_css (zone-scoped custom CSS) instead of HTML. \
This keeps the text readable/editable in the editor AND gives it full CSS styling. Example: \
set_zone_css(id, 'h1 { letter-spacing: -.02em } strong { color: var(--color-accent) }').\n\
6. Image positioning in Markdown zones: a normal image is ![](assets/x.png). For size/alignment/\
wrap write raw <img>: <img src=\"assets/x.png\" style=\"width:50%\" class=\"align-right\"> or \
class=\"float-left\" (text wrap). Classes: align-left|center|right, float-left|right.\n\
7. CUSTOM HTML (content_type 'html') ONLY for interactive/animated content the components do not \
cover: custom charts (SVG/JS), CSS/JS animations (@keyframes), interactive SVGs/diagrams, \
embedded players, demos — OR video/audio: <video controls src=\"assets/x.mp4\"> or \
<audio controls src=\"assets/x.mp3\"> (find the asset first with list_assets; video/audio only in \
HTML zones).\n\
8. WHEN you use HTML: (a) SIZE — the slide is 1280×720 px. Position and size EVERYTHING so it \
fits; keep readable content (text, numbers, important elements) within a safe area of about \
x 64–1216 / y 64–656 (720 px is SHORT — watch the height and font sizes in particular: an \
oversized headline runs sideways out of the 1280-px frame). Purely decorative shapes \
(blobs/circles/stripes without text) may deliberately bleed past the edge, but NEVER place text \
or content outside the slide — it would be clipped. (b) STYLE exclusively via the design-token \
CSS variables (var(--color-primary), var(--color-bg), var(--color-text), \
var(--color-accent), var(--font-heading), var(--font-body), var(--border-radius) …). NO \
hard-coded colors/fonts. Keep HTML slides focused and small.\n\
9. Optional: set_zone_notes(id, notes) for speaker notes (visible only in the Speaker View); \
set_transition(kind, duration_ms) for the deck-wide slide transition (none|fade|slide|zoom|auto — \
auto morphs elements with the same data-id between slides, set data-id via an HTML zone or insert_component(data_id)); \
set_zone_reveal(id, 'steps') for builds (the slide's blocks appear step by step).\n\
10. Brand/meta: set_presentation_title(title); set_zone_label(id, label) (slide display name); \
set_logo(asset, position?)/clear_logo (asset = an existing image from list_assets); register_font(family, asset) \
registers an existing font asset → then activate it via set_token('font-heading'|'font-body', family).\n\
11. SLIDE LINKS (non-linear): a clickable element jumps to another slide via the attribute data-slideo-goto — \
value = zone id OR 1-based slide number. Fastest is a table of contents via \
insert_component(zone_id, 'toc', { items: [{ label, target }] }); alternatively in an HTML zone \
<a data-slideo-goto=\"3\">Chapter</a> or as a Markdown link [Chapter](#zone-<zone-id>). A back link \
(data-slideo-goto to the contents slide) returns. Works in presentation, standalone export & preview.\n\
12. CHECK LAYOUT: the stage is a fixed 1280×720 and clips overflow — but the server measures NO real \
layout. After building a slide call check_zone_overflow(id) (estimate: does content run off the stage \
right/bottom or out of the safe area?) and at the end validate_deck() across all slides. On reported \
overflow: split content across more slides, reduce the font size, or simplify the layout."
}

/// MCP-Prompt-Definitionen (`prompts/list`). Der "slideo_guide"-Prompt ist die
/// in Slideo integrierte „Agenten-Skill": ein aufrufbarer Leitfaden, der einer
/// KI erklärt, wie sie Slideo nutzen soll.
pub fn prompt_definitions() -> Value {
    json!([{
        "name": "slideo_guide",
        "description": "Guide: how to build a high-quality, human-editable presentation with Slideo (design tokens, layouts, Markdown vs. HTML, images).",
        "arguments": [
            { "name": "topic", "description": "Topic/content of the presentation (optional)", "required": false }
        ]
    }])
}

/// Vollständiger Leitfaden-Text (Inhalt des "slideo_guide"-Prompts).
pub fn build_guide(topic: Option<&str>) -> String {
    let intro = "You are building a presentation in Slideo via the MCP server. Slideo presentations \
consist of 'Zones' (slides). Goal: a beautiful presentation that stays editable and globally \
restyleable for the human AFTERWARDS.\n\n";

    let workflow = "RECOMMENDED WORKFLOW:\n\
1) Design system first: EITHER apply_preset(name) for a ready-made theme (list_presets shows \
editorial, dark-tech, warm, minimal, corporate) OR set_tokens_bulk with a coherent set — \
color-primary, color-secondary, color-bg, color-surface, color-text, color-accent, font-heading, \
font-body, font-size-base, spacing-base, border-radius. (get_tokens shows the current values.)\n\
2) Create slides: create_zone + set_zone_content (content_type 'markdown'). Write clear, \
concise Markdown content (one key message per slide).\n\
3) Layout per slide via set_zone_style:\n\
   - 'hero': large, centered title slide (opener).\n\
   - 'split': TWO COLUMNS — separate the two columns in the Markdown with a line of its own containing '+++'. \
A column can be an image.\n\
   - 'center' / 'top' / 'full': single column.\n\
   - text_align (left|center|right), padding, background (overrides color-bg, e.g. a gradient).\n\
4) Images: discover existing assets with list_assets and reference them as ![](assets/<name>). \
For size/alignment/wrap use raw <img>: <img src=\"assets/x.png\" style=\"width:50%\" \
class=\"align-right\"> (classes: align-left|center|right, float-left|right).\n\
5) Rich content without hand-written HTML: insert_component(zone_id, type, params) inserts ready-made, \
token-aware components — list_components shows types + parameters: stat_cards (KPIs), \
big_number (one large number), bar_chart, line_chart (trend), donut_chart (shares), progress, \
data_table (table), feature_grid (icon cards), process_steps (1-2-3), pricing (prices), \
gallery (image grid from assets), quote, timeline, comparison (two columns), callout, icon. \
Prefer these for data/charts/comparisons/tables.\n\
6) Finishing touches: set_zone_notes(id, notes) for speaker notes (Speaker View only); \
set_transition(kind, duration_ms) for the slide transition (none|fade|slide|zoom|auto — auto = Magic Move \
of elements with the same data-id); \
set_zone_reveal(id, 'steps') for builds — the slide's blocks appear one after another in \
presentation mode (good for bullet lists built up step by step). \
SLIDE LINKS (non-linear): insert_component(zone_id, 'toc', { items: [{ label, target }] }) builds a \
clickable table of contents (target = zone id or 1-based slide number); in general any element with \
data-slideo-goto jumps to the target slide, a back link returns.\n\
7) LAYOUT CHECK (1280×720 is fixed, overflow is clipped): the server measures no real layout — \
after building a slide call check_zone_overflow(id) and at the end validate_deck() (heuristic); on \
reported overflow split content across more slides, reduce the font size, or simplify the layout.\n\n";

    let principles = "FORMAT (mandatory): Every slide is a FIXED 1280×720-px stage (16:9) — it does \
NOT grow with its content, everything beyond is CLIPPED. Plan each slide so everything fits \
completely (one key message per slide; rather more slides than one overfilled). For \
HTML slides think strictly in the 1280×720 grid: keep readable content in the safe area x 64–1216 / y 64–656 \
(720 px is short!), check font sizes (oversized headlines run out of the frame); only \
purely decorative shapes may bleed past the edge, never text/content.\n\n\
IMPORTANT PRINCIPLES (editability):\n\
- PREFER Markdown + tokens + layouts + ready-made components. Markdown slides stay editable in the \
WYSIWYG editor, components stay themeable.\n\
- Custom content_type 'html' ONLY for interactive/animated content the components do not cover \
(custom charts SVG/JS, CSS @keyframes animations, interactive SVGs, embedded players, demos) \
OR video/audio. The full browser repertoire is allowed — but keep it small and focused.\n\
- WHEN HTML: style exclusively via the token CSS variables (var(--color-primary), \
var(--font-heading), var(--color-bg), var(--border-radius) …), NEVER hard-coded colors/fonts — \
so the slide stays globally themeable via the token sidebar.\n\
- Consistency: the same tokens for the whole deck; only targeted overrides per slide.\n";

    let mut out = String::new();
    out.push_str(intro);
    if let Some(t) = topic {
        if !t.trim().is_empty() {
            out.push_str(&format!("TOPIC OF THIS PRESENTATION: {t}\n\n"));
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
            "description": "Creates a new empty presentation and opens it in the app.",
            "inputSchema": { "type": "object", "properties": { "title": s("Presentation title") }, "required": ["title"] }
        },
        {
            "name": "open_presentation",
            "description": "Opens an existing .slideo file.",
            "inputSchema": { "type": "object", "properties": { "path": s("Absolute path to the .slideo file") }, "required": ["path"] }
        },
        {
            "name": "save_presentation",
            "description": "Saves the current presentation. Without path it saves to the existing location.",
            "inputSchema": { "type": "object", "properties": { "path": s("Optional save path (Save As)") } }
        },
        {
            "name": "get_presentation_meta",
            "description": "Returns metadata of the current presentation: title, number of zones, token overview.",
            "inputSchema": obj()
        },
        {
            "name": "create_zone",
            "description": "Creates a new zone (slide) at the end or at a specific position.",
            "inputSchema": { "type": "object", "properties": {
                "label": s("Display name, e.g. 'Slide 3'"),
                "after_id": s("UUID of the zone to insert after. Omit to append at the end."),
                "markdown": s("Optional initial content as Markdown")
            }, "required": ["label"] }
        },
        {
            "name": "delete_zone",
            "description": "Permanently deletes a zone.",
            "inputSchema": { "type": "object", "properties": { "id": s("UUID of the zone") }, "required": ["id"] }
        },
        {
            "name": "reorder_zones",
            "description": "Changes the order of all zones.",
            "inputSchema": { "type": "object", "properties": {
                "ordered_ids": { "type": "array", "items": { "type": "string" }, "description": "All zone UUIDs in the desired new order" }
            }, "required": ["ordered_ids"] }
        },
        {
            "name": "get_zone",
            "description": "Returns a single zone (id, label, content_type, markdown, html, style, notes).",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
        },
        {
            "name": "get_all_zones",
            "description": "Returns all zones in their current order.",
            "inputSchema": obj()
        },
        {
            "name": "check_zone_overflow",
            "description": "Heuristic layout check of ONE slide against the fixed 1280×720 stage (Spec §21): estimates whether content runs off the stage right/bottom or exceeds the safe area (x64–1216 / y64–656). ONLY an estimate (no real rendering). Call after building a slide; on overflow split the content / use a smaller font / simplify the layout.",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
        },
        {
            "name": "validate_deck",
            "description": "Heuristic layout check of ALL slides at once (Spec §21): lists the slides with estimated overflow + hints. Good as a final check after building a deck.",
            "inputSchema": obj()
        },
        {
            "name": "set_zone_content",
            "description": "Replaces a zone's content. PREFER content_type 'markdown' (stays WYSIWYG-editable for the human; style via design tokens + set_zone_style). Use 'html' ONLY for interactive/animated content (charts, SVG, JS) – and then exclusively with the token CSS variables (var(--color-primary), var(--font-heading) …) instead of hard-coded colors/fonts, so the human can restyle it globally.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "content_type": { "type": "string", "enum": ["markdown", "html"], "description": "markdown for text slides, html for interactive or animated content" },
                "content": s("Content as a Markdown string or an HTML string depending on content_type")
            }, "required": ["id", "content_type", "content"] }
        },
        {
            "name": "append_to_zone",
            "description": "Appends content at the end of a zone (Markdown or HTML depending on content_type).",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" }, "markdown": { "type": "string" } }, "required": ["id", "markdown"] }
        },
        {
            "name": "replace_in_zone",
            "description": "Replaces a specific text in a zone with new text.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" }, "search": s("Text to replace"), "replace": s("New text")
            }, "required": ["id", "search", "replace"] }
        },
        {
            "name": "get_zone_content",
            "description": "Returns a zone's content (Markdown, or raw HTML for HTML zones).",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
        },
        {
            "name": "get_tokens",
            "description": "Returns all current design tokens.",
            "inputSchema": obj()
        },
        {
            "name": "set_token",
            "description": "Sets a single design token.",
            "inputSchema": { "type": "object", "properties": { "key": s("Token name, e.g. 'color-primary'"), "value": s("Token value, e.g. '#6366f1'") }, "required": ["key", "value"] }
        },
        {
            "name": "set_tokens_bulk",
            "description": "Sets several design tokens at once. Ideal for creating a complete design system.",
            "inputSchema": { "type": "object", "properties": {
                "tokens": { "type": "object", "description": "Key-value pairs of all tokens to set", "additionalProperties": { "type": "string" } }
            }, "required": ["tokens"] }
        },
        {
            "name": "reset_tokens",
            "description": "Resets all design tokens to their default values.",
            "inputSchema": obj()
        },
        {
            "name": "list_presets",
            "description": "Lists the available theme presets (curated design-token bundles) with name, label and description. Apply one with apply_preset to set a coherent color/font system in one step.",
            "inputSchema": obj()
        },
        {
            "name": "apply_preset",
            "description": "Applies a theme preset (sets the preset's design tokens in bulk). A quick start for a consistent look & feel; fine-tune afterwards via set_token/set_tokens_bulk. Available names via list_presets.",
            "inputSchema": { "type": "object", "properties": {
                "name": s("Preset name, e.g. 'editorial', 'dark-tech', 'warm', 'minimal', 'corporate' (see list_presets)")
            }, "required": ["name"] }
        },
        {
            "name": "set_zone_style",
            "description": "Sets a zone's style properties: layout/padding/background/text_align (in the 'style' object) and/or zone-scoped 'custom_css'. With custom_css you style a Markdown slide freely without burying the text in HTML (text stays editable). Provide at least one of 'style'/'custom_css'.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "style": { "type": "object", "properties": {
                    "layout": { "type": "string", "enum": ["center", "hero", "top", "split", "full"], "description": "Layout: center (centered), hero (large title slide), top (top), split (two columns – separate the Markdown at a '+++' line), full (full-bleed)" },
                    "padding": s("CSS padding, e.g. '4rem'"),
                    "background": s("CSS background, overrides the token, e.g. '#1a1a2e' or 'linear-gradient(...)'"),
                    "text_align": { "type": "string", "enum": ["left", "center", "right"] }
                } },
                "custom_css": s("Zone-scoped CSS, e.g. 'h1 { letter-spacing: -.02em } strong { color: var(--color-accent) }'. Selectors refer to the slide content. Use token variables so it stays themeable.")
            }, "required": ["id"] }
        },
        {
            "name": "get_zone_style",
            "description": "Returns a zone's style properties.",
            "inputSchema": { "type": "object", "properties": { "id": { "type": "string" } }, "required": ["id"] }
        },
        {
            "name": "set_zone_css",
            "description": "Sets zone-specific custom CSS applied scoped to THIS zone – ideal for styling a Markdown slide without burying the text in HTML (text stays editable). Selectors refer to the slide content, e.g. 'h1 { ... }', '.slideo-content p { ... }'. Use the token CSS variables (var(--color-primary) …) so it stays themeable.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "css": s("CSS rules for this zone, e.g. 'h1 { letter-spacing: -0.02em } strong { color: var(--color-accent) }'")
            }, "required": ["id", "css"] }
        },
        {
            "name": "set_zone_notes",
            "description": "Sets a zone's speaker notes. Notes appear ONLY in the Speaker View during the presentation, never on the slide itself. Ideal for bullet points of what the presenter wants to say about this slide.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "notes": s("Speaker notes as plain text (multi-line allowed). An empty string clears the notes.")
            }, "required": ["id", "notes"] }
        },
        {
            "name": "set_zone_reveal",
            "description": "Toggles builds (step-by-step reveal) of a Markdown zone. 'steps' = the top-level blocks (paragraphs/bullets/images) appear one per arrow/click in presentation mode; 'none' = everything at once (default). Only Markdown zones without 'split'.",
            "inputSchema": { "type": "object", "properties": {
                "id": { "type": "string" },
                "mode": { "type": "string", "enum": ["none", "steps"], "description": "steps = step by step, none = at once" }
            }, "required": ["id", "mode"] }
        },
        {
            "name": "list_assets",
            "description": "Lists the assets (images) stored in the presentation with file name + MIME type. Reference an asset in content as 'assets/<name>', e.g. Markdown ![](assets/logo.png) or HTML <img src=\"assets/logo.png\">. The human adds assets in the app (import/settings).",
            "inputSchema": obj()
        },
        {
            "name": "list_components",
            "description": "Lists ready-made, token-aware HTML components (KPI cards, charts: bar/line/donut, progress, quote, timeline, comparison, callout box, icons) with type, label, description and parameters. Insert one into a zone with insert_component. The fast route to high-quality, themeable content without your own HTML.",
            "inputSchema": obj()
        },
        {
            "name": "insert_component",
            "description": "Creates a ready-made, token-aware HTML component and inserts it into a zone (the zone becomes content_type 'html'). The component uses only token CSS variables and therefore stays globally themeable via the token sidebar. Available types + parameters via list_components. Tip: create_zone first, then insert here.",
            "inputSchema": { "type": "object", "properties": {
                "zone_id": s("UUID of the target zone"),
                "type": s("Component type, e.g. 'bar_chart', 'stat_cards', 'timeline', 'comparison' (see list_components)"),
                "params": { "type": "object", "description": "Component parameters (structure per type, see list_components), e.g. { \"items\": [{ \"label\": \"Q1\", \"value\": 40 }] }" },
                "mode": { "type": "string", "enum": ["replace", "append"], "description": "replace (default): replace the zone content; append: append to the zone's existing HTML" },
                "data_id": s("Optional: data-id for Auto-Animate (transition 'auto'). Components with the same data-id on adjacent slides morph into each other (FLIP).")
            }, "required": ["zone_id", "type"] }
        },
        {
            "name": "get_slide_count",
            "description": "Returns the number of zones (slides).",
            "inputSchema": obj()
        },
        {
            "name": "set_active_slide",
            "description": "Jumps to a specific slide in presentation mode.",
            "inputSchema": { "type": "object", "properties": { "index": { "type": "number", "description": "0-based index of the slide" } }, "required": ["index"] }
        },
        {
            "name": "set_transition",
            "description": "Sets the presentation-wide slide transition (animation on slide change in presentation mode and in the HTML export). 'none' = plain scrolling (default).",
            "inputSchema": { "type": "object", "properties": {
                "kind": { "type": "string", "enum": ["none", "fade", "slide", "zoom", "auto"], "description": "none (no transition), fade, slide (horizontal), zoom (zoom in/out), auto (Auto-Animate: elements with the same data-id morph between adjacent slides via FLIP; the rest cuts hard — best with the same background). Set data-id in HTML zones or via insert_component(data_id)." },
                "duration_ms": { "type": "number", "description": "Transition duration in milliseconds (default 500)" }
            }, "required": ["kind"] }
        },
        {
            "name": "set_presentation_title",
            "description": "Renames the presentation (meta.title).",
            "inputSchema": { "type": "object", "properties": { "title": s("New presentation title") }, "required": ["title"] }
        },
        {
            "name": "set_logo",
            "description": "Sets the brand logo (appears in a corner of every slide, including in exports). 'asset' must be an already existing image asset (see list_assets — the AI does not upload files).",
            "inputSchema": { "type": "object", "properties": {
                "asset": s("File name of an existing image asset, e.g. 'img-ab12.png'"),
                "position": { "type": "string", "enum": ["top-left", "top-right", "bottom-left", "bottom-right"], "description": "Corner (default bottom-right)" }
            }, "required": ["asset"] }
        },
        {
            "name": "clear_logo",
            "description": "Removes the brand logo (meta.logo).",
            "inputSchema": obj()
        },
        {
            "name": "register_font",
            "description": "Registers a font file already present as an asset (woff2/woff/ttf/otf) as a font family (presentation.fonts) — then usable in the font tokens (set_token font-heading|font-body). 'asset' see list_assets.",
            "inputSchema": { "type": "object", "properties": {
                "family": s("Family name, e.g. 'Cal Sans'"),
                "asset": s("File name of an existing font asset, e.g. 'font-ab12.woff2'")
            }, "required": ["family", "asset"] }
        },
        {
            "name": "set_zone_label",
            "description": "Renames a zone/slide (editor display name in the slide list — NOT the heading on the slide; you set that via the Markdown content).",
            "inputSchema": { "type": "object", "properties": {
                "id": s("UUID of the zone"),
                "label": s("New display name")
            }, "required": ["id", "label"] }
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

    #[test]
    fn marke_meta_and_font_tools() {
        // MCP-Parität (Spec §19.4): Logo, Schriften, Titel, Folien-Label.
        let assets = vec![
            Asset { name: "logo.png".into(), mime: "image/png".into(), data: String::new() },
            Asset { name: "f.woff2".into(), mime: "font/woff2".into(), data: String::new() },
        ];
        let (mut pres, mut fp) = (Some(new_presentation("Alt")), None);

        // Titel umbenennen.
        handle("set_presentation_title", &json!({ "title": "Neu" }), &mut pres, &mut fp, &assets).unwrap();
        assert_eq!(pres.as_ref().unwrap()["meta"]["title"], "Neu");

        // Logo: fehlendes Asset → Fehler; vorhandenes → meta.logo; ungültige Position → Fehler.
        assert!(handle("set_logo", &json!({ "asset": "missing.png" }), &mut pres, &mut fp, &assets).is_err());
        handle("set_logo", &json!({ "asset": "logo.png", "position": "top-left" }), &mut pres, &mut fp, &assets).unwrap();
        assert_eq!(pres.as_ref().unwrap()["meta"]["logo"]["asset"], "logo.png");
        assert_eq!(pres.as_ref().unwrap()["meta"]["logo"]["position"], "top-left");
        assert!(handle("set_logo", &json!({ "asset": "logo.png", "position": "middle" }), &mut pres, &mut fp, &assets).is_err());

        // Logo entfernen.
        handle("clear_logo", &json!({}), &mut pres, &mut fp, &assets).unwrap();
        assert!(pres.as_ref().unwrap()["meta"].get("logo").is_none());

        // Font registrieren: fehlendes Asset → Fehler; Dedup nach Familie.
        assert!(handle("register_font", &json!({ "family": "Cal Sans", "asset": "nope.woff2" }), &mut pres, &mut fp, &assets).is_err());
        handle("register_font", &json!({ "family": "Cal Sans", "asset": "f.woff2" }), &mut pres, &mut fp, &assets).unwrap();
        handle("register_font", &json!({ "family": "Cal Sans", "asset": "f.woff2" }), &mut pres, &mut fp, &assets).unwrap();
        let fonts = pres.as_ref().unwrap()["fonts"].as_array().unwrap();
        assert_eq!(fonts.len(), 1, "register_font dedupliziert nach Familienname");
        assert_eq!(fonts[0]["family"], "Cal Sans");

        // Folien-Label.
        let zid = pres.as_ref().unwrap()["zones"][0]["id"].as_str().unwrap().to_string();
        handle("set_zone_label", &json!({ "id": zid, "label": "Intro" }), &mut pres, &mut fp, &assets).unwrap();
        assert_eq!(pres.as_ref().unwrap()["zones"][0]["label"], "Intro");
    }
}

