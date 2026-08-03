//! Fehlercodes für die Frontend-Grenze (Review 2026-08, i18n-Entscheidung E2).
//!
//! Ausgangslage: ~65 in Rust erzeugte Meldungen landen im App-Chrome — bis hierher
//! ausschließlich auf Deutsch. In einer englisch eingestellten Oberfläche stand damit
//! ausgerechnet die Meldung auf Deutsch, aus der der Nutzer eine Handlung ableiten
//! muss („Lizenzschlüssel nicht gefunden. Bitte den Schlüssel prüfen.").
//!
//! Umgesetzt ist bewusst ein Hybrid, kein Vollausbau:
//!
//! * **Handlungsrelevante** Fehler (Lizenz, MCP-Registrierung, Folien-Fenster) melden
//!   einen stabilen **Code** statt Prosa. Das Frontend übersetzt ihn über den Katalog
//!   (`error.<code>`, siehe `src/i18n/de/common.ts`) — `describeError()` in
//!   `src/lib/tauri.ts` ist die einzige Stelle, die das auswertet.
//! * Der **Diagnose-Schwanz** (Datei-I/O aus `file/reader.rs`/`writer.rs`, History,
//!   Config-Pfade) bleibt deutsche Prosa und wird vom Frontend als technisches Detail
//!   gerahmt. Diese Meldungen enden ohnehin überwiegend auf einem `std`/`reqwest`-Text,
//!   den niemand übersetzen kann; Codes hätten dort Aufwand ohne Gewinn bedeutet.
//!
//! Wire-Format: `slideo:<code>` bzw. `slideo:<code>|<detail>`. Das Detail ist
//! unübersetzt (Pfad, HTTP-Status, Fremdfehlertext) und wird angehängt dargestellt.
//! Ein Frontend, das einen Code nicht kennt, zeigt den Rohtext — ältere und neuere
//! Stände bleiben also gegenseitig benutzbar.

/// Reiner Fehlercode ohne Detail.
pub fn code(c: &str) -> String {
    format!("slideo:{c}")
}

/// Fehlercode mit unübersetztem Detail (Pfad, HTTP-Status, Fremdfehlertext).
pub fn code_with(c: &str, detail: impl std::fmt::Display) -> String {
    format!("slideo:{c}|{detail}")
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn wire_format_is_stable() {
        assert_eq!(code("license.notFound"), "slideo:license.notFound");
        assert_eq!(code_with("license.rejected", 403), "slideo:license.rejected|403");
    }

    #[test]
    fn detail_may_contain_the_separator() {
        // `describeError()` im Frontend trennt am ERSTEN `|`; alles danach bleibt
        // Detail. Ein Fremdfehlertext mit `|` darf den Code also nicht zerlegen.
        let s = code_with("mcp.metaSendFailed", "a|b");
        assert_eq!(s, "slideo:mcp.metaSendFailed|a|b");
        let body = s.strip_prefix("slideo:").unwrap();
        let (c, detail) = body.split_once('|').unwrap();
        assert_eq!(c, "mcp.metaSendFailed");
        assert_eq!(detail, "a|b");
    }
}
