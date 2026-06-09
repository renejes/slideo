# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat. Damit ist der nächste Claude vollständig im Bild.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo** und machen am nächsten Meilenstein weiter. Lies dich zuerst ein, bevor du Code schreibst.

**Was Slideo ist:** Eine lokale, code-freie, **MCP-native** Desktop-App für Präsentationen (Tauri 2 + React/TypeScript + Vite). Eine Präsentation ist eine HTML-Page aus „Zones" (Slides). Kein AI-Layer in der App — die KI-Anbindung läuft ausschließlich über einen mitgelieferten **MCP-Server** (Claude Desktop). Läuft vollständig lokal.

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`

### Bitte zuerst diese Dokumente lesen (in dieser Reihenfolge):
1. **`docs/project-status.md`** — was gebaut ist, Architektur, was getestet wurde, Stolpersteine.
2. **`docs/next-steps.md`** — was als Nächstes ansteht (A: Testen, B: Features, C: Distribution/Notarization).
3. **`docs/slideo-spec.md`** — die **maßgebliche Spezifikation**. Wichtig: §14 HTML-Zonen, §15 Assets, §16 Layouts/Agenten-Skill, §17 Custom-CSS und **§18 Roadmap** (umsetzungsreife Pläne pro Feature: Positionierung, Speaker-Notes, Transitions, Export/Teilen, Themes, Interaktivität/Komponenten). Bei Widersprüchen gewinnt die Spec; im Zweifel mich fragen.
4. `CLAUDE.md` (Projektwurzel) — Konventionen & Design-System in Kürze.

### Der wichtigste Kontext (damit du sofort handlungsfähig bist):
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline) · Zustand-Store. Dateiformat `.slideo` = ZIP (`presentation.json` + `assets/`).
- **MCP-Architektur (umgesetzt):** Eine Binary, zwei Modi — `slideo` (App) und `slideo mcp` (stdio-Server). Die laufende App hält den State, öffnet einen lokalen TCP-Socket (Port in `<config>/slideo/ipc.json`); `slideo mcp` leitet Tool-Calls dorthin weiter (hand-gerolltes JSON-RPC 2.0, **bewusste Abweichung von rmcp**). Mutationen → Tauri-Events → Frontend-Store live. **23 MCP-Tools.** Auto-Eintrag in `claude_desktop_config.json`.
- **Assets:** Bilder → Data-URI inline; Video/Audio → Custom-Protocol `slideoasset://localhost/<name>` (streamt aus dem AppState).
- **Design:** light/minimalistisch (an „Penwright" orientiert), WCAG AA.

### KRITISCHE Stolpersteine (bitte beachten):
- **Nach JEDER Backend-Änderung an Tools/Instructions:** App neu bauen (`npm run tauri:dev` oder `cargo build`) **UND Claude Desktop neu starten** — sonst läuft Claude Desktop gegen das alte MCP-Binary (häufigste Fehlerquelle bei „Tool fehlt").
- **Markdown ist das primäre Content-Format.** HTML-Zonen nur für Interaktives, und dann mit Token-CSS-Variablen stylen. Für gestylten, aber editierbaren Text: `set_zone_css` / Custom-CSS-Panel (gescoped auf die Zone).
- **State lebt im Zustand-Store**, nicht in lokalem React-State.

### Aktueller Stand:
Funktional weitgehend komplett: Editor (Zonen, Drag&Drop, Tiptap, HTML-Zonen, Custom-CSS, Layouts hero/split), Live-Preview, Präsentationsmodus + integrierte Speaker-View, MCP-Server (23 Tools, Live-Sync, Auto-Registrierung, `slideo_guide`-Prompt), Assets (Bild/Video/Audio inkl. `slideoasset://`-Streaming), Undo/Shortcuts/Toasts, Modals (Neu/Settings), 3-Knopf-Schließen-Dialog.

**Automatisiert grün:** `cargo test` (8 Tests), MCP-E2E-Test, `npm run typecheck`, `npx vite build`.
**Noch NICHT am echten GUI getestet** (war headless nicht möglich): Tauri-Fenster zur Laufzeit, Live-MCP-Eventfluss, ob `slideoasset://` im sandboxed Iframe lädt, der Schließen-Dialog, ob Claude Desktop die `instructions`/Prompts einblendet. → Details & Checkliste in `docs/next-steps.md` Abschnitt A.

### Was ich als Nächstes machen möchte:
[HIER EINTRAGEN. Optionen:
- „Erst Abschnitt A (Tests) durchgehen und gemeldete Bugs fixen."
- „Die geplanten Features aus **Spec §18** integrieren — in der Reihenfolge §18.8 (Speaker-Notes → Export/Teilen → Themes → Transitions → Asset-Positionierung Light+Medium → Interaktivität/Komponenten → PDF)."
- „Konkret mit Feature X aus §18 starten (z.B. Export self-contained HTML, §18.4)."
- „macOS-Notarization vorbereiten (next-steps.md C1)."]

### Arbeitsweise:
- Verifiziere Änderungen: `cd src-tauri && cargo test` (Rust), `npm run typecheck && npx vite build` (Frontend). GUI-abhängige Dinge teste ich (der Mensch) — sag mir genau, was ich prüfen soll.
- Halte dich an die Spec; dokumentiere neue Architektur-Entscheidungen in der Spec und in `CLAUDE.md`.
- Stelle Rückfragen, wenn etwas unklar ist, bevor du größere Umbauten startest.

Bitte bestätige kurz, dass du die vier Dokumente gelesen hast, fasse den Stand in 3–4 Sätzen in eigenen Worten zusammen, und schlage dann einen konkreten Plan für meinen oben genannten nächsten Schritt vor.

## PROMPT ENDE

---

### Hinweis zur Nutzung
- Trage vor dem Absenden bei **„Was ich als Nächstes machen möchte"** dein konkretes Ziel ein (Testen / Feature / Notarization).
- Wenn du den Build vorher frisch gemacht hast, erwähne es — dann weiß der nächste Claude, dass Claude Desktop schon das aktuelle Binary nutzt.
