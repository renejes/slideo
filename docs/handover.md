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
3. **`docs/slideo-spec.md`** — die **maßgebliche Spezifikation**. Wichtig: §14 HTML-Zonen, §15 Assets, §16 Layouts/Agenten-Skill, §17 Custom-CSS, **§18 Roadmap** (umgesetzt) und **§19 Roadmap II** (Richtung „vollwertige Präsentationssoftware" — umgesetzt: §19.2 Charts, §19.7 A11y, §19.1 Builds, §19.4 Vorlagen/Marke, §19.9 Suchen&Ersetzen, §19.3 **teilweise** (Übersicht/Laser/Stift/Auto-Advance), §19.8 **teilweise** (Drag&Drop/Crop/Icon), §19.5 PPTX (native Rekonstruktion). **Noch offen:** §19.3 echtes Zweitfenster, §19.1 Auto-Animate/Morph, §19.9 Outline-Modus + Versionshistorie, §19.8 Aufnahme/Narration + Video-Export, Komponenten-Palette (Polish)). Jeder Punkt nennt v1-Scope + Status. Bei Widersprüchen gewinnt die Spec; im Zweifel mich fragen.
4. `CLAUDE.md` (Projektwurzel) — Konventionen & Design-System in Kürze.

### Der wichtigste Kontext (damit du sofort handlungsfähig bist):
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline) · Zustand-Store. Dateiformat `.slideo` = ZIP (`presentation.json` + `assets/`).
- **MCP-Architektur (umgesetzt):** Eine Binary, zwei Modi — `slideo` (App) und `slideo mcp` (stdio-Server). Die laufende App hält den State, öffnet einen lokalen TCP-Socket (Port in `<config>/slideo/ipc.json`); `slideo mcp` leitet Tool-Calls dorthin weiter (hand-gerolltes JSON-RPC 2.0, **bewusste Abweichung von rmcp**). Mutationen → Tauri-Events → Frontend-Store live. **30 MCP-Tools** + **10 token-bewusste Komponenten** (`insert_component`, inkl. `icon`). MCP-Ziel-Registrierung mit Startauswahl (Claude Desktop / Meta-MCP / Claude Code).
- **WKWebView-Faustregel:** HTML5-DnD (Element-Verschieben) und `window.print()` sind in der macOS-WebView unzuverlässig → Block-Drag/Bild-Resize laufen über **Pointer-Events**; PDF via `open_print_view` (Temp-Datei → Standardbrowser). **Canvas-Taint:** HTML→Bild rastern (`foreignObject`→Canvas) verseucht das Canvas → deshalb ist **PPTX nativ rekonstruiert** (pptxgenjs), nicht bild-basiert. **Datei-Drag&Drop** in die WebView braucht `"dragDropEnabled": false` in `tauri.conf.json` (sonst fängt Tauri den OS-Drop ab).
- **Assets:** Bilder → Data-URI inline; Video/Audio → Custom-Protocol `slideoasset://localhost/<name>` (streamt aus dem AppState).
- **Design:** light/minimalistisch (an „Penwright" orientiert), WCAG AA.

### KRITISCHE Stolpersteine (bitte beachten):
- **Nach JEDER Backend-Änderung an Tools/Instructions:** App neu bauen (`npm run tauri:dev` oder `cargo build`) **UND Claude Desktop neu starten** — sonst läuft Claude Desktop gegen das alte MCP-Binary (häufigste Fehlerquelle bei „Tool fehlt").
- **Markdown ist das primäre Content-Format.** HTML-Zonen nur für Interaktives, und dann mit Token-CSS-Variablen stylen. Für gestylten, aber editierbaren Text: `set_zone_css` / Custom-CSS-Panel (gescoped auf die Zone).
- **State lebt im Zustand-Store**, nicht in lokalem React-State.

### Aktueller Stand:
MVP **plus** die komplette **Roadmap §18** und große Teile von **§19** sind umgesetzt:
- **§18:** Speaker-Notes, HTML- & PDF-Export + Teilen, Themes/Presets (5), Folien-Transitions, Bild-Positionierung Light **+ Medium** (Block-Drag & Bild-Resize **in der interaktiven Vorschau**, Pointer-Events), Komponenten-Bibliothek + erweiterter Agenten-Skill.
- **§19:** Daten-Diagramme (`line_chart`/`donut_chart`, **10 Komponenten** inkl. `icon`), Barrierefreiheit (Alt-Text + WCAG-Kontrast), **In-Folien-Builds** (`set_zone_reveal`; Präsentationsmodus ist **parent-autoritativ** — Folie+Schritt im PresentationMode, Audience-Iframe ohne eigene Tastatur), **Custom-Fonts** + **Logo/Brand** + **Starter-Templates**, **Suchen & Ersetzen** (Cmd/Ctrl+F) + Spellcheck, **Presenter-Tools** (§19.3 teilweise: Folien-Übersicht/Sprung-Grid `g`, Laser/Stift `l`/`p`/`c`, Auto-Advance/Loop `a` — reine Präsentationszeit-UI, lokaler State), **Medien** (§19.8 teilweise: Drag&Drop-Medienimport, Bild-Crop non-destruktiv, Icon-Inline-SVG), **PPTX-Export** (§19.5: native Rekonstruktion via pptxgenjs).
- **30 MCP-Tools**, `slideo_guide` + `instructions` auf Stand. Datenmodell additiv erweitert (`meta.transition`/`meta.logo`, `zone.reveal`, `presentation.fonts`, Bild-`width/align/float`), `version` weiter "1.0".

**Automatisiert grün:** `cargo test` (**19 Tests**), MCP-E2E-Test, `npm run typecheck`, `npx vite build`; viele Renderer-Details zusätzlich standalone per `tsx` geprüft. Jede neue Session wurde adversarial per Multi-Agent-Review gegengeprüft und die bestätigten Findings gefixt.
**Noch NICHT am echten GUI getestet:** die §18/§19-Features (Bild-Toolbar/Crop, Block-Drag/Resize, Transitions, Builds + normale Navigation, Export/PDF/**PPTX**, Fonts, Logo, Templates, Suchen&Ersetzen, **Presenter-Tools** Übersicht/Laser/Stift/Auto-Advance, **Drag&Drop-Import**, **Icon-Komponente**) sowie die Altlasten (Live-MCP-Eventfluss, `slideoasset://` im Iframe, Schließen-Dialog). → **Checklisten in `docs/next-steps.md` A1–A7.**

### Was wir als Nächstes machen (Plan für die nächste(n) Session(en)):
**Ziel: ALLE noch offenen Punkte abarbeiten.** Ob das in einer Session klappt oder mehrere
braucht, sehen wir unterwegs — wir **starten mit dem, was am schnellsten geht**, und arbeiten uns
zu den großen Brocken vor.

Offene Punkte (grobe Reihenfolge nach Aufwand, klein → groß):
1. **Komponenten-Palette** (Polish, §18.7-Rest) — die 10 Rust-Komponenten per UI-Klick in die aktive Zone einsetzen (Tauri-Command `render_component`, **derselbe Generator** wie MCP — keine TS-Duplikation), idealerweise mit Parameter-Formularen (z.B. Daten-Tabelle fürs Chart).
2. **Outline-Modus** (§19.9-Rest) — alle Folientexte als editierbare Gliederung.
3. **Versionshistorie** (§19.9-Rest) — lokale `.slideo`-Snapshots (Liste + Wiederherstellen).
4. **Auto-Animate/Morph** (§19.1-Rest) — gleiche `data-id`-Elemente zwischen benachbarten Folien per FLIP animieren.
5. **Echtes Zweitfenster** (§19.3-Rest) — Tauri Multi-Window auf separatem Display + Event-Sync (Speaker im Hauptfenster, Folien im zweiten). Größerer Umbau; vorab Design-Fragen klären (wie das zweite Fenster an die Präsentationsdaten kommt, Tastatur-/Steuerungs-Hoheit, Display-Wahl).
6. **§19.8 Aufnahme/Narration + Video-Export** (groß) — pro Folie aufnehmen (MediaRecorder/getUserMedia) + Video-Export.

Quer dazu (keine Roadmap-Features, aber ebenfalls offen):
- **GUI-Verifikation** aller §18/§19-Features durch den Menschen — Checklisten in `docs/next-steps.md` A1–A7.
- **Distribution & Notarization** (`docs/next-steps.md` Abschnitt C) — Signing, notarisierte/Cross-Platform-Builds.

> Empfehlung für den Einstieg: oben mit dem **schnellsten** Punkt beginnen (Komponenten-Palette) und
> sich vorarbeiten. Vor jedem größeren Umbau (v.a. Zweitfenster) kurz Design-Fragen klären. Details in
> **Spec §19**, GUI-Test-Checklisten in **next-steps.md A1–A7**.

### Arbeitsweise:
- Verifiziere Änderungen: `cd src-tauri && cargo test` (Rust), `npm run typecheck && npx vite build` (Frontend). GUI-abhängige Dinge teste ich (der Mensch) — sag mir genau, was ich prüfen soll.
- Halte dich an die Spec; dokumentiere neue Architektur-Entscheidungen in der Spec und in `CLAUDE.md`.
- Stelle Rückfragen, wenn etwas unklar ist, bevor du größere Umbauten startest.

Bitte bestätige kurz, dass du die vier Dokumente gelesen hast, fasse den Stand in 3–4 Sätzen in eigenen Worten zusammen, und schlage dann einen konkreten Plan für meinen oben genannten nächsten Schritt vor.

## PROMPT ENDE

---

### Hinweis zur Nutzung
- Der Plan für die nächste(n) Session(en) ist gesetzt: **alle offenen Punkte abarbeiten, schnellster zuerst** (siehe Abschnitt „Was wir als Nächstes machen"). Falls du stattdessen einen Schwerpunkt willst (z.B. nur Testen oder nur Distribution), trag das dort ein.
- Wenn du den Build vorher frisch gemacht hast, erwähne es — dann weiß der nächste Claude, dass Claude Desktop schon das aktuelle Binary nutzt.
