//! Theme-Presets (kuratierte Design-Token-Bündel) für die MCP-Tools
//! `list_presets` / `apply_preset`.
//!
//! WICHTIG: Spiegel dieser Liste lebt in src/lib/presets.ts (für den UI-Theme-
//! Picker). Beim Ändern beide Seiten anpassen — analog zu DEFAULT_TOKENS
//! (types/index.ts ↔ tools.rs default_tokens()).

use serde_json::{json, Value};

/// Alle Presets inkl. Tokens (Quelle der Wahrheit auf der Rust-Seite).
fn all() -> Value {
    json!([
        {
            "name": "editorial",
            "label": "Editorial",
            "description": "Hell, serif, redaktionell — ruhige Typo mit Terrakotta-Akzent.",
            "tokens": {
                "color-primary": "#1f1d1b", "color-secondary": "#6b6357",
                "color-bg": "#faf8f4", "color-surface": "#efece6", "color-text": "#1f1d1b",
                "color-accent": "#b5452f", "font-heading": "Georgia", "font-body": "Georgia",
                "font-size-base": "1rem", "spacing-base": "1rem", "border-radius": "0.25rem"
            }
        },
        {
            "name": "dark-tech",
            "label": "Dark Tech",
            "description": "Dunkel, sachlich — Blau/Cyan-Akzente auf tiefem Nachtblau.",
            "tokens": {
                "color-primary": "#3b82f6", "color-secondary": "#94a3b8",
                "color-bg": "#0b0f17", "color-surface": "#151b27", "color-text": "#e6edf6",
                "color-accent": "#22d3ee", "font-heading": "Inter", "font-body": "Inter",
                "font-size-base": "1rem", "spacing-base": "1rem", "border-radius": "0.5rem"
            }
        },
        {
            "name": "warm",
            "label": "Warm",
            "description": "Warmes Creme mit Orange — einladend und freundlich.",
            "tokens": {
                "color-primary": "#c2410c", "color-secondary": "#9a8478",
                "color-bg": "#fff7ed", "color-surface": "#ffedd5", "color-text": "#3b2f2a",
                "color-accent": "#ea580c", "font-heading": "Georgia", "font-body": "Helvetica Neue",
                "font-size-base": "1rem", "spacing-base": "1rem", "border-radius": "0.75rem"
            }
        },
        {
            "name": "minimal",
            "label": "Minimal",
            "description": "Schwarz-Weiß, maximale Zurückhaltung — keine Eckenradien.",
            "tokens": {
                "color-primary": "#111111", "color-secondary": "#8a8a8a",
                "color-bg": "#ffffff", "color-surface": "#f4f4f4", "color-text": "#111111",
                "color-accent": "#111111", "font-heading": "Helvetica Neue", "font-body": "Helvetica Neue",
                "font-size-base": "1rem", "spacing-base": "1rem", "border-radius": "0rem"
            }
        },
        {
            "name": "corporate",
            "label": "Corporate",
            "description": "Professionell — Marineblau auf Weiß, klare Blautöne.",
            "tokens": {
                "color-primary": "#1e3a8a", "color-secondary": "#64748b",
                "color-bg": "#ffffff", "color-surface": "#eef2f7", "color-text": "#0f172a",
                "color-accent": "#2563eb", "font-heading": "Arial", "font-body": "Arial",
                "font-size-base": "1rem", "spacing-base": "1rem", "border-radius": "0.375rem"
            }
        }
    ])
}

/// Nur Name/Label/Beschreibung (für `list_presets`).
pub fn list() -> Value {
    let items: Vec<Value> = all()
        .as_array()
        .unwrap()
        .iter()
        .map(|p| json!({ "name": p["name"], "label": p["label"], "description": p["description"] }))
        .collect();
    json!(items)
}

/// Tokens eines Presets (für `apply_preset`), oder `None` bei unbekanntem Namen.
pub fn tokens(name: &str) -> Option<Value> {
    all()
        .as_array()
        .unwrap()
        .iter()
        .find(|p| p["name"] == json!(name))
        .map(|p| p["tokens"].clone())
}
