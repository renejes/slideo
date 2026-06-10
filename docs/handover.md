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
3. **`docs/slideo-spec.md`** — die **maßgebliche Spezifikation**. Wichtig: §14 HTML-Zonen, §15 Assets, §16 Layouts/Agenten-Skill, §17 Custom-CSS, **§18 Roadmap** (umgesetzt) und **§19 Roadmap II** (Richtung „vollwertige Präsentationssoftware" — §19.2/19.7/19.1/19.4/19.9 umgesetzt; offen: 19.3 Presenter-Tools, 19.8 Medien, 19.5 PPTX, Auto-Animate, Outline/Versionshistorie). Jeder Punkt nennt v1-Scope + Status. Bei Widersprüchen gewinnt die Spec; im Zweifel mich fragen.
4. `CLAUDE.md` (Projektwurzel) — Konventionen & Design-System in Kürze.

### Der wichtigste Kontext (damit du sofort handlungsfähig bist):
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline) · Zustand-Store. Dateiformat `.slideo` = ZIP (`presentation.json` + `assets/`).
- **MCP-Architektur (umgesetzt):** Eine Binary, zwei Modi — `slideo` (App) und `slideo mcp` (stdio-Server). Die laufende App hält den State, öffnet einen lokalen TCP-Socket (Port in `<config>/slideo/ipc.json`); `slideo mcp` leitet Tool-Calls dorthin weiter (hand-gerolltes JSON-RPC 2.0, **bewusste Abweichung von rmcp**). Mutationen → Tauri-Events → Frontend-Store live. **30 MCP-Tools** + 9 token-bewusste Komponenten (`insert_component`). Auto-Eintrag in `claude_desktop_config.json`.
- **WKWebView-Faustregel:** HTML5-DnD und `window.print()` sind in der macOS-WebView unzuverlässig → alle Interaktionen (Block-Drag, Bild-Resize) laufen über **Pointer-Events**; PDF via `open_print_view` (Temp-Datei → Standardbrowser).
- **Assets:** Bilder → Data-URI inline; Video/Audio → Custom-Protocol `slideoasset://localhost/<name>` (streamt aus dem AppState).
- **Design:** light/minimalistisch (an „Penwright" orientiert), WCAG AA.

### KRITISCHE Stolpersteine (bitte beachten):
- **Nach JEDER Backend-Änderung an Tools/Instructions:** App neu bauen (`npm run tauri:dev` oder `cargo build`) **UND Claude Desktop neu starten** — sonst läuft Claude Desktop gegen das alte MCP-Binary (häufigste Fehlerquelle bei „Tool fehlt").
- **Markdown ist das primäre Content-Format.** HTML-Zonen nur für Interaktives, und dann mit Token-CSS-Variablen stylen. Für gestylten, aber editierbaren Text: `set_zone_css` / Custom-CSS-Panel (gescoped auf die Zone).
- **State lebt im Zustand-Store**, nicht in lokalem React-State.

### Aktueller Stand:
MVP **plus** die komplette **Roadmap §18** und große Teile von **§19** sind umgesetzt:
- **§18:** Speaker-Notes, HTML- & PDF-Export + Teilen, Themes/Presets (5), Folien-Transitions, Bild-Positionierung Light **+ Medium** (Block-Drag & Bild-Resize **in der interaktiven Vorschau**, Pointer-Events), Komponenten-Bibliothek + erweiterter Agenten-Skill.
- **§19:** Daten-Diagramme (`line_chart`/`donut_chart`, 9 Komponenten), Barrierefreiheit (Alt-Text + WCAG-Kontrast), **In-Folien-Builds** (`set_zone_reveal`; Präsentationsmodus ist jetzt **parent-autoritativ** — Folie+Schritt im PresentationMode, Audience-Iframe ohne eigene Tastatur), **Custom-Fonts** + **Logo/Brand** + **Starter-Templates** (Neu-Dialog), **Suchen & Ersetzen** (Cmd/Ctrl+F) + Spellcheck.
- **30 MCP-Tools**, `slideo_guide` + `instructions` auf Stand. Datenmodell additiv erweitert (`meta.transition`/`meta.logo`, `zone.reveal`, `presentation.fonts`, Bild-`width/align/float`), `version` weiter "1.0".

**Automatisiert grün:** `cargo test` (**14 Tests**), MCP-E2E-Test, `npm run typecheck`, `npx vite build`; viele Renderer-Details zusätzlich standalone per `tsx` geprüft.
**Noch NICHT am echten GUI getestet:** die §18/§19-Features (Bild-Toolbar, Block-Drag/Resize, Transitions, Builds **+ die umgebaute normale Navigation**, Export/PDF, Fonts laden, Logo, Templates, Suchen&Ersetzen) sowie die Altlasten (Live-MCP-Eventfluss, `slideoasset://` im Iframe, Schließen-Dialog). → **Checkliste in `docs/next-steps.md` Abschnitt A7.**

### Was ich als Nächstes machen möchte:
Die noch offenen §19-Punkte umsetzen (Reihenfolge nach Sinn/Verifizierbarkeit):
1. **§19.3 Presenter-Tools** — Folien-Übersicht/Sprung-Grid (zuerst, baut auf der parent-autoritativen Nav auf), Laser/Stift-Overlay (Canvas + Pointer-Events), **echtes Zweitfenster** (Tauri Multi-Window + Event-Sync — der größte Brocken), Auto-Advance/Loop.
2. **§19.8 Medien** — Drag&Drop-Bildimport (klein), Bild-Crop, Icon-/Stock-Einfügen, (groß) Aufnahme/Narration + Video-Export.
3. **§19.5 PPTX-Export** — v1 bild-basiert (Folien → PNG → `pptxgenjs`, eine Folie/Bild).
4. **Auto-Animate/Morph** — zweite Hälfte von §19.1 (gleiche `data-id`-Elemente zwischen Folien per FLIP).
5. **Outline-Modus + Versionshistorie** (§19.9 Rest) — Gliederungsansicht; lokale `.slideo`-Snapshots.
6. **Komponenten-Palette** (Polish) — manuelles Einfügen der 9 Komponenten via Tauri-Command (`render_component`), idealerweise mit Parameter-Formularen (z.B. Daten-Tabelle fürs Chart).

> Empfehlung für den Einstieg: **§19.3 mit der Folien-Übersicht/Sprung** beginnen. Details/Pläne in **Spec §19**, GUI-Test-Checkliste in **next-steps.md A7**.

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
