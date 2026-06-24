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
3. **`docs/slideo-spec.md`** — die **maßgebliche Spezifikation**. Wichtig: §14 HTML-Zonen, §15 Assets, §16 Layouts/Agenten-Skill, §17 Custom-CSS, **§18 Roadmap** (umgesetzt) und **§19 Roadmap II** (Richtung „vollwertige Präsentationssoftware" — umgesetzt: §19.2 Charts, §19.7 A11y, §19.1 Builds, §19.4 Vorlagen/Marke, §19.9 Suchen&Ersetzen, §19.3 **teilweise** (Übersicht/Laser/Stift/Auto-Advance), §19.8 **teilweise** (Drag&Drop/Crop/Icon), §19.5 PPTX (native Rekonstruktion), §18.7 Komponenten-Palette (UI-Klick-Einfügen mit Formularen + Live-Vorschau), §19.9 Outline-Modus (editierbare Gliederung) + Versionshistorie (lokale `.slideo`-Snapshots), §19.1 Auto-Animate (Übergang `auto`: FLIP-Morph gleicher `data-id`-Elemente), §19.3 echtes Zweitfenster (Presenter-Modus auf zweitem Display), **MCP-Parität app-weit geprüft** (35 Tools); §19.8 Aufnahme/Narration + Video-Export **bewusst weggelassen** (out of scope). **Feature-Roadmap §18/§19 damit im Wesentlichen durch.** **Nächstes geplantes Feature: Direktmanipulation in der Vorschau** (Plan: `docs/direct-manipulation-plan.md`, wird beim Bau als §20 verankert). Sekundär offen: GUI-Verifikation + Distribution). Jeder Punkt nennt v1-Scope + Status. Bei Widersprüchen gewinnt die Spec; im Zweifel mich fragen.
4. `CLAUDE.md` (Projektwurzel) — Konventionen & Design-System in Kürze.
5. **`docs/direct-manipulation-plan.md`** — **der Bauplan für die nächste Session** (Direktmanipulation in der Vorschau). Hier steht *genau, was zu tun ist und wo* (Dateien, Datenfluss, Phasen). **Vor dem Loslegen komplett lesen.**

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

**Automatisiert grün:** `cargo test` (**27 Tests**), MCP-E2E-Test, `npm run typecheck`, `npx vite build`; viele Renderer-Details zusätzlich standalone per `tsx` geprüft. Jede neue Session wurde adversarial per Multi-Agent-Review gegengeprüft und die bestätigten Findings gefixt.
**Noch NICHT am echten GUI getestet:** die §18/§19-Features (Bild-Toolbar/Crop, Block-Drag/Resize, Transitions, Builds + normale Navigation, Export/PDF/**PPTX**, Fonts, Logo, Templates, Suchen&Ersetzen, **Presenter-Tools** Übersicht/Laser/Stift/Auto-Advance, **Drag&Drop-Import**, **Icon-Komponente**) sowie die Altlasten (Live-MCP-Eventfluss, `slideoasset://` im Iframe, Schließen-Dialog). → **Checklisten in `docs/next-steps.md` A1–A7.**

### Was wir als Nächstes machen (Plan für die nächste Session):

> **DER FOKUS DER NÄCHSTEN SESSION: Direktmanipulation in der Vorschau bauen.**
> Der **vollständige, im Code verankerte Implementationsplan** liegt in
> **[`docs/direct-manipulation-plan.md`](direct-manipulation-plan.md)** — **zuerst komplett lesen**, dort steht
> *genau, was zu tun ist und wo* (Dateien, Datenfluss, Phasen, offene Entscheidungen).

**Worum es geht:** Die KI baut über MCP oft HTML-Zonen (v.a. designlastige). Die per Hand im Code zu korrigieren
ist mühsam. Ziel: Elemente **direkt in der rechten Vorschau anfassen, verschieben, duplizieren, im Text bearbeiten
und löschen**. Das ist **kein** Schwenk zu PowerPoint, sondern ein **Korrektur-Layer über KI-Output** (KI baut,
Mensch justiert → on-thesis). **Neue Elemente entstehen durch Duplizieren + Bearbeiten** (kein From-Scratch-Zeichnen
in v1). Das **Flussbasierte bleibt unangetastet** (Folien, Reihenfolge, Notizen, Übergänge, Builds, Layouts) —
Direktmanipulation betrifft nur das Innenleben einer HTML-Zone.

**Konkreter Einstieg (laut Plan):**
1. **Phase 0 — Klick → Quelle** (klein, sofort nützlich): Klick auf ein Element in der Vorschau → Zone aktiv +
   passende Stelle im HTML-Editor (CodeMirror) markiert. Adressierung über **Kind-Index-Pfad** ab `.slideo-content`
   (kein ID-/Schema-Eingriff). Dateien: `dom-edit.ts` (neu), `ui.ts`, `HtmlEditor.tsx`, `PreviewPane.tsx`.
2. **Phase 1 — Auswählen + Löschen + Duplizieren** (Kern, höchster Nutzen): Auswahl-Layer/Mini-Toolbar im
   `editScript()` ([renderer.ts](../src/lib/renderer.ts)) **per Pointer-Events** (WKWebView-Regel!), Direktbearbeiten-
   Modus-Toggle in der Vorschau, Store-Action `applyZoneElementOp` (über `DOMParser` auf dem **rohen** `zone.html`,
   `recordHistory=true` → Cmd/Z), Re-Select nach dem 220-ms-Re-Render.
3. **Phase 2 — Inline-Text-Edit** (contenteditable-Round-Trip), **Phase 3 — Verschieben** (Drag → `%`-Position).

Je Phase wie gehabt: cargo/typecheck/vite grün → adversariales Multi-Agent-Review → bestätigte Findings fixen →
GUI-Check mit mir. Beim Umsetzen in **`slideo-spec.md` als §20** verankern + Docs aktualisieren.

**Ebenfalls offen (sekundär, nach/neben der Direktmanipulation):**
- **Vollständiger GUI-Test** der §18/§19-Features (Checklisten A1–A7 in `docs/next-steps.md`; bisher nur automatisch
  grün, noch nichts in der echten App durchgeklickt — v.a. Zweitfenster auf Multi-Display, neue MCP-Tools). Frischer
  `npm run tauri:dev`-Build + **Claude Desktop neu starten** (35 MCP-Tools).
- **Polish-Kandidaten** (Liste in `docs/next-steps.md`) und später **Distribution & Notarization** (Abschnitt C).

**Bewusst NICHT gebaut:** §19.8 **Aufnahme/Narration + Video-Export** (out of scope — off-thesis für eine
MCP/KI-Authoring-App; Medien-Bedarf via Einbettung gedeckt; schlimmste WKWebView-Hürden). Siehe Spec §19.8.

**Umgesetzte Roadmap (Kurzrecap):** §18 komplett; §19.1 Builds + **Auto-Animate**, §19.2 Charts, §19.3
Presenter-Tools **inkl. echtem Zweitfenster**, §19.4 Vorlagen/Marke, §19.5 PPTX (nativ), §19.7 A11y, §19.8 Medien
(Aufnahme out of scope), §19.9 Suchen&Ersetzen + **Outline-Modus** + **Versionshistorie**; §18.7
**Komponenten-Palette**; **MCP-Parität app-weit geprüft → 35 Tools**.

### Arbeitsweise:
- Verifiziere Änderungen: `cd src-tauri && cargo test` (Rust), `npm run typecheck && npx vite build` (Frontend). GUI-abhängige Dinge teste ich (der Mensch) — sag mir genau, was ich prüfen soll.
- Halte dich an die Spec; dokumentiere neue Architektur-Entscheidungen in der Spec und in `CLAUDE.md`.
- Stelle Rückfragen, wenn etwas unklar ist, bevor du größere Umbauten startest.

Bitte bestätige kurz, dass du die Dokumente gelesen hast (inkl. **`docs/direct-manipulation-plan.md`**), fasse den Stand in 3–4 Sätzen zusammen, und **lass uns dann die Direktmanipulation in der Vorschau bauen** — beginnend mit **Phase 0 (Klick → Quelle)** und **Phase 1 (Auswählen/Löschen/Duplizieren)** laut Plan. Kläre vorab kurz die „Offenen Entscheidungen" aus dem Plan (Auswahl-Granularität, Verschiebe-Semantik) mit mir. Implementiere phasenweise; nach jeder Phase Build grün + Review + GUI-Check mit mir. (Der vollständige GUI-Test der bestehenden §18/§19-Features bleibt parallel offen, falls wir zwischendurch testen wollen.)

## PROMPT ENDE

---

### Hinweis zur Nutzung
- Der Plan für die nächste(n) Session(en) ist gesetzt: **alle offenen Punkte abarbeiten, schnellster zuerst** (siehe Abschnitt „Was wir als Nächstes machen"). Falls du stattdessen einen Schwerpunkt willst (z.B. nur Testen oder nur Distribution), trag das dort ein.
- Wenn du den Build vorher frisch gemacht hast, erwähne es — dann weiß der nächste Claude, dass Claude Desktop schon das aktuelle Binary nutzt.
