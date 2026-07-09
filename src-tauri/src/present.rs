//! Presenter-Zweitfenster (Spec §19.3): ein separates Vollbild-Fenster („projector")
//! auf dem gewählten Monitor zeigt die Folien; das Hauptfenster bleibt Steuerpult
//! (SpeakerView). Sync läuft über Tauri-Events (`slideo:nav` / `slideo:deck-changed`);
//! das Projector-Fenster lädt dieselbe App mit `?role=projector` und liest das Deck
//! aus dem `AppState` (vom Hauptfenster gespiegelt). Vollbild/Platzierung passieren
//! hier in Rust (zuverlässiger als über die JS-Window-API).

use serde::Serialize;
use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

const PROJECTOR_LABEL: &str = "projector";

#[derive(Serialize)]
pub struct MonitorInfo {
    pub index: usize,
    pub name: String,
    pub width: u32,
    pub height: u32,
    pub primary: bool,
}

/// Listet die verfügbaren Monitore (für das Routing-Dropdown der Steuerleiste).
#[tauri::command]
pub fn list_monitors(window: tauri::Window) -> Result<Vec<MonitorInfo>, String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    // Primärmonitor über Geometrie bestimmen (Name ist oft leer/doppelt bei
    // baugleichen Displays → würde mehrere oder das falsche als „primär" markieren).
    let primary_pos = window.primary_monitor().ok().flatten().map(|m| *m.position());
    Ok(monitors
        .iter()
        .enumerate()
        .map(|(i, m)| MonitorInfo {
            index: i,
            name: m
                .name()
                .cloned()
                .filter(|s| !s.is_empty())
                .unwrap_or_else(|| format!("Display {}", i + 1)),
            width: m.size().width,
            height: m.size().height,
            primary: primary_pos == Some(*m.position()),
        })
        .collect())
}

/// Öffnet das Folien-Fenster „bildschirmfüllend" auf dem gewählten Monitor.
/// Das Hauptfenster (`window`) dient zum Auflisten der Monitore.
///
/// Bewusst **randloses Fenster exakt über dem Monitor** statt nativem Vollbild:
/// macOS' native Vollbild-Umschaltung greift den Bildschirm, auf dem das Fenster
/// gerade liegt, und kann (Timing) auf dem falschen/primären Monitor landen.
/// Positionieren + Größe = robust auf dem gewählten Display.
#[tauri::command]
pub fn open_presentation_window(
    app: AppHandle,
    window: tauri::Window,
    monitor_index: usize,
) -> Result<(), String> {
    let monitors = window.available_monitors().map_err(|e| e.to_string())?;
    let target = monitors
        .get(monitor_index)
        .ok_or_else(|| format!("Monitor {monitor_index} nicht gefunden"))?;
    let pos = *target.position();
    let size = *target.size();

    // Existiert das Fenster schon (z.B. anderer Monitor gewählt): nur umsetzen —
    // kein Schließen/Neubauen (vermeidet Flackern + das Destroyed-Event-Rennen).
    if let Some(win) = app.get_webview_window(PROJECTOR_LABEL) {
        win.set_position(PhysicalPosition::new(pos.x, pos.y)).map_err(|e| e.to_string())?;
        win.set_size(PhysicalSize::new(size.width, size.height)).map_err(|e| e.to_string())?;
        let _ = win.set_focus();
        return Ok(());
    }

    let win = WebviewWindowBuilder::new(
        &app,
        PROJECTOR_LABEL,
        WebviewUrl::App("index.html?role=projector".into()),
    )
    .title("Slideo — Präsentation")
    .decorations(false)
    .resizable(false)
    .build()
    .map_err(|e| e.to_string())?;

    win.set_position(PhysicalPosition::new(pos.x, pos.y)).map_err(|e| e.to_string())?;
    win.set_size(PhysicalSize::new(size.width, size.height)).map_err(|e| e.to_string())?;
    let _ = win.set_focus();

    // Schließt der Nutzer das Fenster selbst, das Hauptfenster benachrichtigen.
    let app_handle = app.clone();
    win.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            let _ = app_handle.emit("slideo:projector-closed", ());
        }
    });

    Ok(())
}

/// Öffnet das Folien-Fenster als **normales, teilbares 16:9-Fenster** auf dem aktuellen
/// Bildschirm (Spec §26 — Remote-Präsentation auf EINEM Monitor). Anders als
/// `open_presentation_window` (randlos-Vollbild auf Monitor 2) ist es dekoriert,
/// verschieb-/skalierbar und betitelt → in Zoom/Meet/Teams per **„Fenster teilen"**
/// freigebbar (Window-Capture erfasst es auch verdeckt), während die Presenter-View
/// (Hauptfenster, SpeakerView) mit Notizen/Tools **privat** bleibt.
///
/// Nutzt dasselbe `projector`-Label + dieselbe Event-Sync wie das Vollbild-Zweitfenster;
/// es ist immer nur EIN Folien-Fenster gleichzeitig offen. sharingType bleibt Default
/// (macOS `.readOnly` = capturable) — kein natives Fenster-Handle nötig.
#[tauri::command]
pub fn open_share_window(app: AppHandle) -> Result<(), String> {
    // Logische 16:9-Startgröße (der Nutzer kann frei skalieren; das Seitenverhältnis der
    // Bühne bleibt via Scale-to-fit erhalten, Spec §21).
    const W: f64 = 1280.0;
    const H: f64 = 720.0;

    // Existiert schon (z.B. zuvor als Vollbild-Projektor geöffnet) → auf teilbares
    // Fenster umstellen statt neu bauen (kein Flackern / Destroyed-Event-Rennen).
    if let Some(win) = app.get_webview_window(PROJECTOR_LABEL) {
        let _ = win.set_fullscreen(false);
        let _ = win.set_decorations(true);
        let _ = win.set_resizable(true);
        win.set_size(LogicalSize::new(W, H)).map_err(|e| e.to_string())?;
        let _ = win.center();
        let _ = win.set_focus();
        return Ok(());
    }

    let win = WebviewWindowBuilder::new(
        &app,
        PROJECTOR_LABEL,
        WebviewUrl::App("index.html?role=projector".into()),
    )
    .title("Slideo — Präsentation")
    .inner_size(W, H)
    .resizable(true)
    .decorations(true)
    .build()
    .map_err(|e| e.to_string())?;

    let _ = win.center();
    let _ = win.set_focus();

    // Schließt der Nutzer das Fenster selbst, das Hauptfenster benachrichtigen.
    let app_handle = app.clone();
    win.on_window_event(move |event| {
        if matches!(event, WindowEvent::Destroyed) {
            let _ = app_handle.emit("slideo:projector-closed", ());
        }
    });

    Ok(())
}

/// Schließt das Folien-Fenster (falls offen).
#[tauri::command]
pub fn close_presentation_window(app: AppHandle) -> Result<(), String> {
    if let Some(win) = app.get_webview_window(PROJECTOR_LABEL) {
        win.close().map_err(|e| e.to_string())?;
    }
    Ok(())
}
