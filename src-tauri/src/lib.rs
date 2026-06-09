mod claude_config;
mod commands;
mod file;
mod ipc;
mod mcp;
mod state;
mod tools;

use base64::Engine;
use state::AppState;
use tauri::Manager;

/// MCP-stdio-Modus (`slideo mcp`): dünner Client, der Tool-Calls an die laufende
/// App weiterleitet. Startet bewusst KEIN Tauri/WebView.
pub fn run_mcp() {
    mcp::run();
}

/// Normale Desktop-App.
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .manage(AppState::default())
        // Custom-Protocol: streamt Asset-Bytes aus dem AppState (z.B. für Video/Audio),
        // damit große Medien nicht als base64-Data-URI ins HTML inline müssen.
        // URL: slideoasset://localhost/<name>  (Windows: http://slideoasset.localhost/<name>)
        .register_uri_scheme_protocol("slideoasset", |ctx, request| {
            let name = request
                .uri()
                .path()
                .trim_start_matches('/')
                .to_string();
            let found = {
                let state = ctx.app_handle().state::<AppState>();
                let assets = state.assets.lock().unwrap();
                assets
                    .iter()
                    .find(|a| a.name == name)
                    .map(|a| (a.mime.clone(), a.data.clone()))
            };
            match found {
                Some((mime, data)) => {
                    let bytes = base64::engine::general_purpose::STANDARD
                        .decode(data.as_bytes())
                        .unwrap_or_default();
                    tauri::http::Response::builder()
                        .status(200)
                        .header(tauri::http::header::CONTENT_TYPE, mime)
                        .header("Access-Control-Allow-Origin", "*")
                        .body(bytes)
                        .unwrap()
                }
                None => tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .setup(|app| {
            // Lokalen IPC-Socket für den MCP-Server starten …
            ipc::start(app.handle().clone());
            // … und Slideo in der Claude-Desktop-Config registrieren.
            claude_config::ensure_registered();
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_presentation,
            commands::save_presentation,
            commands::sync_presentation,
            commands::sync_assets,
            commands::set_file_path,
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Slideo-App");
}
