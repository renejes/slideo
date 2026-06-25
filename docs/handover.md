# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat. Damit ist der nächste Claude vollständig im Bild.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo** und machen am nächsten Meilenstein weiter. Lies dich zuerst ein, bevor du Code schreibst.

**Was Slideo ist:** Eine lokale, code-freie, **MCP-native** Desktop-App für Präsentationen (Tauri 2 + React/TypeScript + Vite). Eine Präsentation ist eine HTML-Page aus „Zones" (Slides). Kein AI-Layer in der App — die KI-Anbindung läuft ausschließlich über einen mitgelieferten **MCP-Server** (Claude Desktop). Läuft vollständig lokal.

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`

### Bitte zuerst diese Dokumente lesen (in dieser Reihenfolge):
1. **`docs/project-status.md`** — was gebaut ist, Architektur, was getestet wurde, Stolpersteine.
2. **`docs/next-steps.md`** — was als Nächstes ansteht: **Abschnitt 1 = Performance- & Security-Audit + Optimierung (neuer Fokus)**, dazu Layout-Validierung; parallel GUI-Test (A) + Distribution (C). §20/§21 stehen dort unter „0." als erledigt.
3. **`docs/slideo-spec.md`** — die **maßgebliche Spezifikation**. Wichtig: §14 HTML-Zonen, §15 Assets, §16 Layouts/Agenten-Skill, §17 Custom-CSS, **§18 Roadmap** (umgesetzt) und **§19 Roadmap II** (Richtung „vollwertige Präsentationssoftware" — umgesetzt: §19.2 Charts, §19.7 A11y, §19.1 Builds, §19.4 Vorlagen/Marke, §19.9 Suchen&Ersetzen, §19.3 **teilweise** (Übersicht/Laser/Stift/Auto-Advance), §19.8 **teilweise** (Drag&Drop/Crop/Icon), §19.5 PPTX (native Rekonstruktion), §18.7 Komponenten-Palette (UI-Klick-Einfügen mit Formularen + Live-Vorschau), §19.9 Outline-Modus (editierbare Gliederung) + Versionshistorie (lokale `.slideo`-Snapshots), §19.1 Auto-Animate (Übergang `auto`: FLIP-Morph gleicher `data-id`-Elemente), §19.3 echtes Zweitfenster (Presenter-Modus auf zweitem Display), **MCP-Parität app-weit geprüft** (35 Tools); §19.8 Aufnahme/Narration + Video-Export **bewusst weggelassen** (out of scope). **Feature-Roadmap §18/§19 durch.** **NEU UMGESETZT & im GUI bestätigt: §20 Direktmanipulation in der Vorschau** (Elemente direkt anfassen: Klick→Quelle, Auswählen, Inline-Text, Verschieben, Duplizieren, Löschen, Undo) **+ §21 feste 16:9-Folien-Bühne (1280×720) + Scale-to-fit**. **Damit ist die Feature-Roadmap abgeschlossen.** **Nächster Fokus: Performance- & Security-Audit der GESAMTEN App + eine Optimierungs-/Überarbeitungs-Runde** (Workflow/Architektur nochmal durchdenken), dazu die optionale **Layout-Validierung** (harte 1280×720-Garantie). Sekundär weiter offen: vollständiger GUI-Test der §18/§19-Features + Distribution. Jeder Punkt nennt v1-Scope + Status. Bei Widersprüchen gewinnt die Spec; im Zweifel mich fragen.
4. `CLAUDE.md` (Projektwurzel) — Konventionen & Design-System in Kürze.
5. **`docs/direct-manipulation-plan.md`** — **Referenz** (der inzwischen UMGESETZTE Plan zu §20). Nur zum Nachschlagen, **nicht mehr zu bauen** — §20 ist fertig (siehe Spec §20/§21).

### Der wichtigste Kontext (damit du sofort handlungsfähig bist):
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline) · Zustand-Store. Dateiformat `.slideo` = ZIP (`presentation.json` + `assets/`).
- **MCP-Architektur (umgesetzt):** Eine Binary, zwei Modi — `slideo` (App) und `slideo mcp` (stdio-Server). Die laufende App hält den State, öffnet einen lokalen TCP-Socket (Port in `<config>/slideo/ipc.json`); `slideo mcp` leitet Tool-Calls dorthin weiter (hand-gerolltes JSON-RPC 2.0, **bewusste Abweichung von rmcp**). Mutationen → Tauri-Events → Frontend-Store live. **35 MCP-Tools** (app-weite Parität geprüft: alles Dokument-Authoring ist MCP-erreichbar) + **10 token-bewusste Komponenten** (`insert_component`, inkl. `icon`). MCP-Ziel-Registrierung mit Startauswahl (Claude Desktop / Meta-MCP / Claude Code).
- **WKWebView-Faustregel:** HTML5-DnD (Element-Verschieben) und `window.print()` sind in der macOS-WebView unzuverlässig → Block-Drag/Bild-Resize laufen über **Pointer-Events**; PDF via `open_print_view` (Temp-Datei → Standardbrowser). **Canvas-Taint:** HTML→Bild rastern (`foreignObject`→Canvas) verseucht das Canvas → deshalb ist **PPTX nativ rekonstruiert** (pptxgenjs), nicht bild-basiert. **Datei-Drag&Drop** in die WebView braucht `"dragDropEnabled": false` in `tauri.conf.json` (sonst fängt Tauri den OS-Drop ab).
- **Assets:** Bilder → Data-URI inline; Video/Audio → Custom-Protocol `slideoasset://localhost/<name>` (streamt aus dem AppState).
- **Design:** light/minimalistisch (an „Penwright" orientiert), WCAG AA.

### KRITISCHE Stolpersteine (bitte beachten):
- **Nach JEDER Backend-Änderung an Tools/Instructions:** App neu bauen (`npm run tauri:dev` oder `cargo build`) **UND Claude Desktop neu starten** — sonst läuft Claude Desktop gegen das alte MCP-Binary (häufigste Fehlerquelle bei „Tool fehlt").
- **Markdown ist das primäre Content-Format.** HTML-Zonen nur für Interaktives, und dann mit Token-CSS-Variablen stylen. Für gestylten, aber editierbaren Text: `set_zone_css` / Custom-CSS-Panel (gescoped auf die Zone).
- **State lebt im Zustand-Store**, nicht in lokalem React-State.

### Aktueller Stand:
MVP **plus** die komplette **Roadmap §18** und große Teile von **§19** sind umgesetzt:
- **§18:** Speaker-Notes, HTML- & PDF-Export + Teilen, Themes/Presets (5), Folien-Transitions, Bild-Positionierung Light **+ Medium** (Block-Drag & Bild-Resize **in der interaktiven Vorschau**, Pointer-Events), Komponenten-Bibliothek + erweiterter Agenten-Skill **+ Komponenten-Palette im Editor** (UI-Klick-Einfügen mit Parameter-Formularen + Live-Vorschau; derselbe Rust-Generator via Tauri-Commands `list_components`/`render_component`).
- **§19:** Daten-Diagramme (`line_chart`/`donut_chart`, **10 Komponenten** inkl. `icon`), Barrierefreiheit (Alt-Text + WCAG-Kontrast), **In-Folien-Builds + Auto-Animate** (`set_zone_reveal`; Präsentationsmodus **parent-autoritativ** — Folie+Schritt im PresentationMode, Audience-Iframe ohne eigene Tastatur; **Übergang `auto`** = FLIP-Morph gleicher `data-id`-Elemente, **§19.1 komplett**), **Custom-Fonts** + **Logo/Brand** + **Starter-Templates**, **Suchen & Ersetzen** (Cmd/Ctrl+F) + Spellcheck + **Outline-Modus** (editierbare Gliederung) + **Versionshistorie** (lokale `.slideo`-Snapshots: Auto beim Speichern + manuell, Wiederherstellen) — **§19.9 komplett**, **Presenter-Tools** (§19.3 **komplett**: Folien-Übersicht/Sprung-Grid `g`, Laser/Stift `l`/`p`/`c`, Auto-Advance/Loop `a` + **echtes Zweitfenster** = randlos bildschirmfüllendes `projector`-Fenster auf gewähltem Monitor, Event-Sync), **Medien** (§19.8: Drag&Drop-Medienimport, Bild-Crop non-destruktiv, Icon-Inline-SVG; **Aufnahme/Narration bewusst weggelassen** — out of scope), **PPTX-Export** (§19.5: native Rekonstruktion via pptxgenjs), **Komponenten-Palette** (§18.7: UI-Klick-Einfügen mit Parameter-Formularen + Live-Vorschau), **MCP-Parität** (Logo/Fonts/Titel/Label-Tools → 35 Tools).
- **35 MCP-Tools**, `slideo_guide` + `instructions` auf Stand. **MCP-Parität app-weit auditiert** → neu: `set_logo`/`clear_logo`, `register_font`, `set_presentation_title`, `set_zone_label` (referenzieren vorhandene Assets; KI lädt keine Binärdateien hoch). Datenmodell additiv erweitert (`meta.transition`/`meta.logo`, `zone.reveal`, `presentation.fonts`, Bild-`width/align/float`), `version` weiter "1.0".
- **§20 Direktmanipulation in der Vorschau (umgesetzt, GUI-bestätigt):** Elemente von HTML-Zonen direkt in der rechten Vorschau anfassen — **Klick→Quelle** (markiert die Stelle im HTML-Editor), **Auswählen** (▲/Esc), **Inline-Text** (Doppelklick/✎), **Verschieben** (Drag → absolute %-Position; „Folie einfrieren" beim ersten Move, damit nichts nachrückt), **Duplizieren/Löschen**, **Undo (Cmd/Z)**. Adressierung über **Kind-Index-Pfad ab `.slideo-content`** (kein Schema-Eingriff); Ops via `DOMParser` auf rohem `zone.html` ([dom-edit.ts](../src/lib/dom-edit.ts)), Auswahl-Layer **per Pointer-Events** im `editScript` ([renderer.ts](../src/lib/renderer.ts)), Toggle `previewEdit`. Nur HTML-Zonen; Flussmodell unangetastet. Spec **§20**.
- **§21 feste 16:9-Folien-Bühne + Scale-to-fit (umgesetzt, GUI-bestätigt):** Folien sind logisch **1280×720** (clip), gewickelt in `.slideo-frame`; per `transform: scale(var(--slideo-scale))` ins Fenster eingepasst (Vorschau fit-width, Präsentation fit-both, Letterbox). Behebt Out-of-bounds beim Fenster-Resize (alles skaliert gemeinsam), vereinheitlicht Vorschau/Präsentation/Export/Print. **MCP-`instructions` + `slideo_guide` lehren das 1280×720-Format** (Regel 0 „FORMAT" + Safe-Area x 64–1216 / y 64–656), damit AI-Decks nicht überlaufen. Spec **§21**. (Skalierungs-Detail: %-Positionen via `pctFromRect` werden per `/scale` korrigiert — `getBoundingClientRect` ist in der skalierten Zone Bildschirm-px, `clientWidth` aber Layout-px.)

**Automatisiert grün:** `cargo test` (**27 Tests**), MCP-E2E-Test, `npm run typecheck`, `npx vite build`; viele Renderer-Details zusätzlich standalone per `tsx` geprüft. Jede neue Session wurde adversarial per Multi-Agent-Review gegengeprüft und die bestätigten Findings gefixt.
**Noch NICHT am echten GUI getestet:** die §18/§19-Features (Bild-Toolbar/Crop, Block-Drag/Resize, Transitions, Builds + normale Navigation, Export/PDF/**PPTX**, Fonts, Logo, Templates, Suchen&Ersetzen, **Presenter-Tools** Übersicht/Laser/Stift/Auto-Advance, **Drag&Drop-Import**, **Icon-Komponente**) sowie die Altlasten (Live-MCP-Eventfluss, `slideoasset://` im Iframe, Schließen-Dialog). → **Checklisten in `docs/next-steps.md` A1–A7.**

### Was wir als Nächstes machen (Plan für die nächste Session):

> **Die Feature-Roadmap ist durch (inkl. §20 Direktmanipulation + §21 feste Bühne, beide im GUI bestätigt). Der
> nächste Schwerpunkt ist NICHT mehr „Features bauen", sondern QUALITÄT & REIFE der Gesamt-App:
> Performance- & Security-Audit → Optimierung/Überarbeitung → (optional) Layout-Validierung.**

**1) Performance- & Security-Check der GESAMTEN App (zuerst — Bestandsaufnahme, dann gemeinsam priorisieren).**
- **Security:** HTML-Zonen führen beliebiges JS im sandboxed Iframe aus (gewollt) — Isolationsgrenzen prüfen
  (Iframe-`sandbox="allow-scripts"`, KEINE Tauri-APIs im Iframe), eine bewusste **CSP** setzen (in `tauri.conf.json`
  aktuell `null`), die Pfade `slideoasset://` (Custom-Protocol) und `open_print_view`, die **MCP-Registrierung**
  (`mcp_registration.rs` schreibt in die Claude-/Meta-/Code-Config — Schreibpfade/Idempotenz), Path-Traversal
  (Snapshots: `valid_id` schon geschützt — gegenprüfen), **`.slideo`-Import** (untrusted ZIP/JSON), Asset-Handling.
  Ziel: kurze Bedrohungsmodell-Notiz + Härtung vor Release (vgl. next-steps.md C0).
- **Performance:** Initial-Bundle (Material-Symbols-Variable-Font ~3,6 MB → **subsetten**; `index`-Chunk ~1,3 MB →
  Code-Splitting prüfen), Vorschau-Re-Render (debounced `srcDoc`-Reload — Double-Buffer/In-Place?), Skalierungs-/
  Reposition-Pfade (rAF, §20/§21), große Decks/viele Assets (Data-URI-Inlining vs. Streaming), MCP-Sync-Last. Erst
  **messen**, dann gezielt optimieren.

**2) Optimierungs-/Überarbeitungs-Runde (alles nochmal durchdenken).**
- Workflow/UX end-to-end überarbeiten (Onboarding, Editor-Fluss, MCP-Setup-Erststart), Architektur-Schulden
  aufräumen, Renderer/State vereinfachen wo möglich, Konsistenz Vorschau ↔ Präsentation ↔ Export. Bewusst
  „Refactor + Politur" statt neuer Features.

**3) Layout-Validierung (harte 1280×720-Garantie) — optionales Feature.**
- §21 + die MCP-`instructions` (Regel 0 „FORMAT" + Safe-Area) steuern AI-Decks Richtung „passt", aber der
  MCP-Server misst **kein** Layout → keine harte Garantie. Vorschlag: eine **Headless-Browser-Validierung**
  (Element-Grenzen vs. 1280×720 — wie in der Diagnose dieser Session mit Chrome/`puppeteer-core` gemacht) als
  Dev-/CI-Check ODER als Tool, das überlaufende Folien meldet/zurückweist. Siehe Spec §21 „KI-Anbindung".

**Weiter offen (sekundär, parallel):**
- **Vollständiger GUI-Test der §18/§19-Features** (Checklisten A1–A7 in `docs/next-steps.md`; v.a. Zweitfenster auf
  Multi-Display, neue MCP-Tools, Export/PDF/PPTX). Frischer `npm run tauri:dev` + **Claude Desktop neu starten**
  (35 Tools, **neue 1280×720-`instructions`** seit dieser Session).
- **Distribution & Notarization** (next-steps.md Abschnitt C) und Polish-Kandidaten.
- **Committen:** §20/§21 + das „Langsamkeit"-Test-Deck (`~/Desktop/langsamkeit.slideo`) sind noch **nicht committet**
  (auf `main`, working tree dirty). Beim Start ggf. zuerst sauber committen/branchen.

**Bewusst NICHT gebaut:** §19.8 **Aufnahme/Narration + Video-Export** (out of scope — off-thesis für eine
MCP/KI-Authoring-App; Medien-Bedarf via Einbettung gedeckt; schlimmste WKWebView-Hürden). Siehe Spec §19.8.

**Umgesetzte Roadmap (Kurzrecap):** §18 komplett; §19.1 Builds + **Auto-Animate**, §19.2 Charts, §19.3
Presenter-Tools **inkl. echtem Zweitfenster**, §19.4 Vorlagen/Marke, §19.5 PPTX (nativ), §19.7 A11y, §19.8 Medien
(Aufnahme out of scope), §19.9 Suchen&Ersetzen + **Outline-Modus** + **Versionshistorie**; §18.7
**Komponenten-Palette**; **MCP-Parität app-weit geprüft → 35 Tools**; **§20 Direktmanipulation**; **§21 feste
16:9-Bühne + Scale-to-fit**.

### Arbeitsweise:
- Verifiziere Änderungen: `cd src-tauri && cargo test` (Rust), `npm run typecheck && npx vite build` (Frontend). GUI-abhängige Dinge teste ich (der Mensch) — sag mir genau, was ich prüfen soll.
- Halte dich an die Spec; dokumentiere neue Architektur-Entscheidungen in der Spec und in `CLAUDE.md`.
- **Adversariales Multi-Agent-Review je größerem Schritt**, bestätigte Findings fixen (so lief diese Session — sehr effektiv, hat reale Bugs gefangen).
- Stelle Rückfragen, wenn etwas unklar ist, bevor du größere Umbauten startest.

Bitte bestätige kurz, dass du die Dokumente gelesen hast, fasse den Stand in 3–4 Sätzen zusammen, und **lass uns mit dem Performance- & Security-Check der Gesamt-App beginnen (Punkt 1)** — erst eine kurze Bestandsaufnahme/Audit (Bedrohungsmodell + Performance-Messung), dann gemeinsam priorisieren, was wir optimieren (Punkt 2) und ob/wie wir die Layout-Validierung (Punkt 3) bauen. Kläre vorab Scope/Reihenfolge mit mir, falls unklar. (Der vollständige GUI-Test der §18/§19-Features bleibt parallel offen.)

## PROMPT ENDE

---

### Hinweis zur Nutzung
- Der nächste Schwerpunkt ist **Qualität & Reife** (Performance- & Security-Audit → Optimierung → optionale Layout-Validierung), nicht mehr Features. Falls du einen anderen Schwerpunkt willst (z.B. zuerst Distribution oder nur den GUI-Test), trag das im Abschnitt „Was wir als Nächstes machen" ein.
- **Wichtig:** §20/§21 + das Test-Deck sind noch **nicht committet** (working tree dirty auf `main`). Außerdem hat sich das **MCP-`instructions`** geändert (1280×720-Format) → vor echter KI-Nutzung **`cargo build`/`tauri:dev` neu + Claude Desktop neu starten**.
- Wenn du den Build vorher frisch gemacht hast, erwähne es — dann weiß der nächste Claude, dass Claude Desktop schon das aktuelle Binary nutzt.
