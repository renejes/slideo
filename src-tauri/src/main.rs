// Verhindert ein zusätzliches Konsolenfenster unter Windows im Release-Build.
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

fn main() {
    // Zwei Modi in einer Binary:
    //   slideo        → startet die Desktop-App (inkl. lokalem MCP-Socket)
    //   slideo mcp    → startet den MCP-stdio-Server (von Claude Desktop gestartet)
    let mcp_mode = std::env::args().nth(1).as_deref() == Some("mcp");
    if mcp_mode {
        slideo_lib::run_mcp();
    } else {
        slideo_lib::run();
    }
}
