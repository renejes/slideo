// Die Tool-Schema-Liste (tools.rs) ist ein großes `json!([...])` — die Default-
// Makro-Rekursionsgrenze (128) reicht dafür nicht mehr.
#![recursion_limit = "512"]

mod commands;
mod components;
mod file;
mod history;
mod ipc;
mod mcp;
mod mcp_registration;
mod overflow;
mod present;
mod presets;
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
            let state = ctx.app_handle().state::<AppState>();
            // Decode-Cache (Audit P7): erst nachschlagen — vermeidet das base64-Dekodieren
            // pro Request (großer Hebel beim wiederholten Anfragen desselben Videos). Cache
            // wird bei jeder Asset-Änderung über AppState::set_assets geleert.
            let cached = {
                let cache = state.asset_cache.lock().unwrap();
                cache.get(&name).cloned()
            };
            let entry = match cached {
                Some(arc) => Some(arc),
                None => {
                    // Miss: finden + dekodieren + cachen UNTER demselben assets-Lock. Weil
                    // set_assets den assets-Lock ZUERST nimmt (und erst danach den Cache
                    // leert), kann zwischen diesem Read und dem Insert kein Asset-Tausch
                    // dazwischenfunken → der Cache erhält nie veraltete Bytes (Review-Fix der
                    // TOCTOU-Race). Lock-Reihenfolge assets→cache ist konsistent (kein
                    // Deadlock); der Decode läuft einmalig pro Asset, danach Cache-Treffer.
                    let assets = state.assets.lock().unwrap();
                    assets.iter().find(|a| a.name == name).map(|a| {
                        let bytes = base64::engine::general_purpose::STANDARD
                            .decode(a.data.as_bytes())
                            .unwrap_or_default();
                        let arc = std::sync::Arc::new((a.mime.clone(), bytes));
                        state
                            .asset_cache
                            .lock()
                            .unwrap()
                            .insert(name.clone(), arc.clone());
                        arc
                    })
                }
            };
            match entry {
                Some(arc) => tauri::http::Response::builder()
                    .status(200)
                    .header(tauri::http::header::CONTENT_TYPE, arc.0.clone())
                    .header("Access-Control-Allow-Origin", "*")
                    .body(arc.1.clone())
                    .unwrap(),
                None => tauri::http::Response::builder()
                    .status(404)
                    .body(Vec::new())
                    .unwrap(),
            }
        })
        .setup(|app| {
            // Lokalen IPC-Socket für den MCP-Server starten …
            ipc::start(app.handle().clone());
            // … und das gewählte MCP-Ziel (Meta-MCP / Claude Code / Claude Desktop)
            // idempotent herstellen. Im Hintergrund-Thread, da es Netz-Probe (Meta-MCP)
            // und Datei-I/O macht und den App-Start nicht blockieren soll.
            std::thread::spawn(mcp_registration::reconcile_on_startup);
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::load_presentation,
            commands::save_presentation,
            commands::sync_presentation,
            commands::sync_assets,
            commands::set_file_path,
            commands::export_html,
            commands::open_print_view,
            commands::export_pptx,
            commands::list_components,
            commands::render_component,
            commands::get_presentation,
            commands::get_assets,
            present::list_monitors,
            present::open_presentation_window,
            present::close_presentation_window,
            commands::list_snapshots,
            commands::create_snapshot,
            commands::restore_snapshot,
            commands::delete_snapshot,
            commands::mcp_status,
            commands::mcp_set_target,
        ])
        .run(tauri::generate_context!())
        .expect("Fehler beim Starten der Slideo-App");
}
