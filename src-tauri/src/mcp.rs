//! MCP-Server im stdio-Modus (`slideo mcp`).
//!
//! Schlanke, selbst-implementierte JSON-RPC-2.0-Schleife (newline-delimited)
//! über stdin/stdout — das ist der Standard-MCP-stdio-Transport. Tool-Aufrufe
//! werden an die laufende App weitergeleitet (siehe ipc::client_request).
//!
//! Bewusste Abweichung von Spec §10 (rmcp): Da dieser Prozess nur ein dünner
//! Weiterleiter ist, ist eine eigene minimale Implementierung robuster und
//! abhängigkeitsärmer als das (inzwischen stark veränderte) rmcp-Crate.

use crate::{ipc, tools};
use serde_json::{json, Value};
use std::io::{self, BufRead, Write};

const PROTOCOL_VERSION: &str = "2025-06-18";

pub fn run() {
    let stdin = io::stdin();
    let mut stdout = io::stdout();

    for line in stdin.lock().lines() {
        let line = match line {
            Ok(l) => l,
            Err(_) => break,
        };
        if line.trim().is_empty() {
            continue;
        }
        let message: Value = match serde_json::from_str(&line) {
            Ok(v) => v,
            Err(_) => continue, // unparsbare Zeile ignorieren
        };

        let id = message.get("id").cloned();
        let method = message.get("method").and_then(|m| m.as_str()).unwrap_or("");
        let params = message.get("params").cloned().unwrap_or(json!({}));

        if let Some(response) = handle_message(method, &params, &id) {
            if writeln!(stdout, "{response}").is_err() {
                break;
            }
            let _ = stdout.flush();
        }
    }
}

fn result(id: &Option<Value>, value: Value) -> Value {
    json!({ "jsonrpc": "2.0", "id": id.clone().unwrap_or(Value::Null), "result": value })
}

fn error(id: &Option<Value>, code: i64, message: &str) -> Value {
    json!({ "jsonrpc": "2.0", "id": id.clone().unwrap_or(Value::Null), "error": { "code": code, "message": message } })
}

fn handle_message(method: &str, params: &Value, id: &Option<Value>) -> Option<Value> {
    match method {
        "initialize" => {
            let pv = params
                .get("protocolVersion")
                .and_then(|v| v.as_str())
                .unwrap_or(PROTOCOL_VERSION);
            Some(result(
                id,
                json!({
                    "protocolVersion": pv,
                    "capabilities": { "tools": {}, "prompts": {} },
                    "serverInfo": { "name": "slideo", "version": env!("CARGO_PKG_VERSION") },
                    "instructions": tools::server_instructions()
                }),
            ))
        }
        // Notifications brauchen keine Antwort.
        "notifications/initialized" | "notifications/cancelled" => None,
        "tools/list" => Some(result(id, json!({ "tools": tools::tool_schemas() }))),
        "tools/call" => Some(handle_tool_call(params, id)),
        "prompts/list" => Some(result(id, json!({ "prompts": tools::prompt_definitions() }))),
        "prompts/get" => Some(handle_prompt_get(params, id)),
        "ping" => Some(result(id, json!({}))),
        _ => {
            if id.is_some() {
                Some(error(id, -32601, "Method not found"))
            } else {
                None
            }
        }
    }
}

fn handle_prompt_get(params: &Value, id: &Option<Value>) -> Value {
    let name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
    if name != "slideo_guide" {
        return error(id, -32602, "Unknown prompt");
    }
    let topic = params
        .get("arguments")
        .and_then(|a| a.get("topic"))
        .and_then(|v| v.as_str());
    let text = tools::build_guide(topic);
    result(
        id,
        json!({
            "description": "Slideo guide",
            "messages": [
                { "role": "user", "content": { "type": "text", "text": text } }
            ]
        }),
    )
}

fn handle_tool_call(params: &Value, id: &Option<Value>) -> Value {
    let name = params.get("name").and_then(|v| v.as_str()).unwrap_or("");
    let arguments = params.get("arguments").cloned().unwrap_or(json!({}));

    match ipc::client_request(name, &arguments) {
        Ok(res) => result(
            id,
            json!({
                "content": [{ "type": "text", "text": serde_json::to_string_pretty(&res).unwrap_or_else(|_| res.to_string()) }]
            }),
        ),
        Err(e) => result(
            id,
            json!({
                "content": [{ "type": "text", "text": format!("Error: {e}") }],
                "isError": true
            }),
        ),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn initialize_handshake() {
        let resp = handle_message("initialize", &json!({ "protocolVersion": "2025-06-18" }), &Some(json!(1)))
            .expect("initialize hat eine Antwort");
        assert_eq!(resp["result"]["serverInfo"]["name"], "slideo");
        assert_eq!(resp["result"]["protocolVersion"], "2025-06-18");
        assert!(resp["result"]["capabilities"]["tools"].is_object());
    }

    #[test]
    fn tools_list_contains_all() {
        let resp = handle_message("tools/list", &json!({}), &Some(json!(2))).unwrap();
        let tools = resp["result"]["tools"].as_array().unwrap();
        assert_eq!(
            tools.len(),
            37,
            "Spec §5 + zone_css/notes/reveal + assets + presets + transition + components + Marke/Meta/Fonts + Layout-Heuristik (check_zone_overflow/validate_deck) erwartet"
        );
        assert!(tools.iter().any(|t| t["name"] == "check_zone_overflow"));
        assert!(tools.iter().any(|t| t["name"] == "validate_deck"));
        assert!(tools.iter().any(|t| t["name"] == "set_zone_reveal"));
        assert!(tools.iter().any(|t| t["name"] == "set_zone_content"));
        assert!(tools.iter().any(|t| t["name"] == "set_zone_css"));
        assert!(tools.iter().any(|t| t["name"] == "set_zone_notes"));
        assert!(tools.iter().any(|t| t["name"] == "list_assets"));
        assert!(tools.iter().any(|t| t["name"] == "list_presets"));
        assert!(tools.iter().any(|t| t["name"] == "apply_preset"));
        assert!(tools.iter().any(|t| t["name"] == "set_transition"));
        assert!(tools.iter().any(|t| t["name"] == "list_components"));
        assert!(tools.iter().any(|t| t["name"] == "insert_component"));
        // MCP-Parität (Marke/Meta/Schriften):
        assert!(tools.iter().any(|t| t["name"] == "set_logo"));
        assert!(tools.iter().any(|t| t["name"] == "clear_logo"));
        assert!(tools.iter().any(|t| t["name"] == "register_font"));
        assert!(tools.iter().any(|t| t["name"] == "set_presentation_title"));
        assert!(tools.iter().any(|t| t["name"] == "set_zone_label"));
    }

    #[test]
    fn notifications_have_no_response() {
        assert!(handle_message("notifications/initialized", &json!({}), &None).is_none());
    }

    #[test]
    fn initialize_advertises_prompts() {
        let resp = handle_message("initialize", &json!({}), &Some(json!(1))).unwrap();
        assert!(resp["result"]["capabilities"]["prompts"].is_object());
        assert!(resp["result"]["instructions"].as_str().unwrap().contains("Markdown"));
    }

    #[test]
    fn prompts_list_and_get() {
        let list = handle_message("prompts/list", &json!({}), &Some(json!(2))).unwrap();
        assert_eq!(list["result"]["prompts"][0]["name"], "slideo_guide");

        let got = handle_message(
            "prompts/get",
            &json!({ "name": "slideo_guide", "arguments": { "topic": "AI trends 2026" } }),
            &Some(json!(3)),
        )
        .unwrap();
        let text = got["result"]["messages"][0]["content"]["text"].as_str().unwrap();
        assert!(text.contains("AI trends 2026"));
        assert!(text.contains("set_tokens_bulk"));
    }
}
