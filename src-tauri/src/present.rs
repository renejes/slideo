//! Presenter-Folien-Fenster („projector"): ein separates Fenster zeigt die Folien, das
//! Hauptfenster bleibt Steuerpult (SpeakerView). EIN Fenster deckt beide Fälle ab (Spec §26):
//! **dekoriertes 16:9-Fenster** (Remote/Zoom teilen bzw. frei platzieren) ODER **randlos-
//! Vollbild auf seinem aktuellen Monitor** (auf den Beamer/TV ziehen → Vollbild). Sync läuft
//! über Tauri-Events (`slideo:nav` / `slideo:deck-changed`); das Fenster lädt dieselbe App mit
//! `?role=projector` und liest das Deck aus dem `AppState` (vom Hauptfenster gespiegelt).
//! Platzierung/Größe passieren hier in Rust (zuverlässiger als über die JS-Window-API).

use tauri::{
    AppHandle, Emitter, LogicalSize, Manager, PhysicalPosition, PhysicalSize, WebviewUrl,
    WebviewWindowBuilder, WindowEvent,
};

const PROJECTOR_LABEL: &str = "projector";

/// Logische 16:9-Startgröße des Folien-Fensters (die Bühne bleibt via Scale-to-fit erhalten,
/// Spec §21; der Nutzer kann frei skalieren).
const WIN_W: f64 = 1280.0;
const WIN_H: f64 = 720.0;

/// Öffnet das Folien-Fenster als **normales, dekoriertes, teilbares 16:9-Fenster** auf dem
/// aktuellen Bildschirm (Spec §26). In Zoom/Meet/Teams per **„Fenster teilen"** freigebbar
/// (Window-Capture erfasst es auch verdeckt) — die Presenter-View (Hauptfenster, SpeakerView)
/// mit Notizen/Tools bleibt privat. Für einen physischen Beamer zieht man das Fenster auf den
/// Zielbildschirm und schaltet per [`set_projector_fullscreen`] auf randlos-Vollbild.
///
/// Nutzt das `projector`-Label + die Event-Sync des Folien-Fensters; es ist immer nur EIN
/// Folien-Fenster offen. sharingType bleibt Default (macOS `.readOnly` = capturable).
#[tauri::command]
pub fn open_share_window(app: AppHandle) -> Result<(), String> {
    // Existiert schon → auf dekoriertes 16:9-Fenster zurückstellen (kein Neubau → kein
    // Flackern / Destroyed-Event-Rennen).
    if let Some(win) = app.get_webview_window(PROJECTOR_LABEL) {
        let _ = win.set_fullscreen(false);
        let _ = win.set_decorations(true);
        let _ = win.set_resizable(true);
        win.set_size(LogicalSize::new(WIN_W, WIN_H)).map_err(|e| e.to_string())?;
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
    .inner_size(WIN_W, WIN_H)
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

/// Schaltet das Folien-Fenster zwischen **randlos-Vollbild auf seinem AKTUELLEN Monitor**
/// (für Beamer/TV: aufs Zieldisplay ziehen → Vollbild = saubere, randlose Ausgabe) und
/// **dekoriertem 16:9-Fenster** (Remote/Zoom bzw. freies Platzieren). Ersetzt den früheren
/// „auf zweitem Bildschirm präsentieren"-Modus (Monitor-Menü) — EIN Fenster deckt beide Fälle
/// ab (Spec §26). Bewusst randlos-über-dem-Monitor statt nativem Vollbild: macOS' native
/// Vollbild-Umschaltung kann (Timing) auf dem falschen Display landen.
#[tauri::command]
pub fn set_projector_fullscreen(app: AppHandle, fullscreen: bool) -> Result<(), String> {
    let win = app
        .get_webview_window(PROJECTOR_LABEL)
        .ok_or("Kein Folien-Fenster offen")?;
    if fullscreen {
        // Monitor bestimmen, auf dem das Fenster GERADE liegt (nach dem Ziehen).
        let mon = win
            .current_monitor()
            .map_err(|e| e.to_string())?
            .ok_or("Kein Monitor für das Folien-Fenster gefunden")?;
        let pos = *mon.position();
        let size = *mon.size();
        let _ = win.set_decorations(false);
        let _ = win.set_resizable(false);
        win.set_position(PhysicalPosition::new(pos.x, pos.y)).map_err(|e| e.to_string())?;
        win.set_size(PhysicalSize::new(size.width, size.height)).map_err(|e| e.to_string())?;
        let _ = win.set_focus();
    } else {
        let _ = win.set_decorations(true);
        let _ = win.set_resizable(true);
        win.set_size(LogicalSize::new(WIN_W, WIN_H)).map_err(|e| e.to_string())?;
        let _ = win.center();
        let _ = win.set_focus();
    }
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
