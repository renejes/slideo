# Slideo — Projektstatus

> Stand-Dokument. Beschreibt, **was gebaut ist**, wie es zusammenhängt und was getestet wurde.
> Begleitdokumente: [slideo-spec.md](slideo-spec.md) (maßgebliche Spec), [next-steps.md](next-steps.md) (To-dos), [handover.md](handover.md) (Übergabe an neuen Chat).
> Version: 0.1.0

---

## 1. Was Slideo ist

Lokale, code-freie, **MCP-native** Desktop-App für Präsentationen. Eine Präsentation ist technisch *eine* HTML-Page, unterteilt in **Zones** (= Slides). Im Editor scrollt man durch alle Zones, im Präsentationsmodus springt die App von Zone zu Zone. Kein AI-Layer in der App selbst — die KI-Anbindung läuft ausschließlich über einen mitgelieferten **MCP-Server** (Claude Desktop o.ä.). Läuft vollständig lokal (DSGVO-konform).

## 2. Tech Stack

- **Tauri 2** (Rust-Backend) + **React 18** / TypeScript / **Vite** (WebView-Frontend)
- **Tiptap 2** (Markdown-WYSIWYG) · **CodeMirror 6** (HTML- & CSS-Editor) · **Tailwind 3** (App-Chrome)
- **Material Symbols** (selbst-gehostet, offline) · **Zustand** (State) · **markdown-it** (Render-Pipeline)
- Dateiformat **`.slideo`** = ZIP mit `presentation.json` + `assets/`

## 3. Architektur (Kurzform)

**Drei Render-Schichten:** Design-Tokens (CSS-Variablen) → Markdown/HTML pro Zone → Renderer wickelt das in ein Zone-Template (eigenes CSS, **kein** Tailwind im Iframe → offline & portabel).

**MCP „Live über lokalen Socket" (umgesetzt):**
- **Eine Binary, zwei Modi:** `slideo` startet die App, `slideo mcp` den MCP-stdio-Server.
- Die laufende App öffnet einen TCP-Socket (127.0.0.1) und schreibt den Port nach `<config>/slideo/ipc.json`. Sie hält den **autoritativen State**.
- `slideo mcp` (von Claude Desktop gestartet) liest die Datei, spricht **hand-gerolltes JSON-RPC 2.0** über stdio und leitet Tool-Calls an den Socket weiter.
- Die App mutiert ihren State und **emittiert Tauri-Events** (`mcp:presentation`, `mcp:active-slide`) → das Frontend spiegelt live in den Zustand-Store; das Frontend pusht Änderungen via `sync_presentation`/`sync_assets` zurück (kein Echo, da Sync-Commands keine Events feuern).
- **Auto-Registrierung** in `claude_desktop_config.json` beim App-Start (idempotent, nur wenn Claude installiert).

**Assets:** liegen als echte Dateien in `assets/` im ZIP. Beim Rendern: **Bilder → Data-URI** (inline), **Video/Audio → Custom-Protocol** `slideoasset://localhost/<name>` (streamt Bytes aus dem AppState; Bilder ohne Regressionsrisiko).

## 4. Was implementiert ist

### Editor & Kern
- Datenmodell + Zustand-Store ([src/store/presentation.ts](../src/store/presentation.ts)), `.slideo` Reader/Writer in Rust ([src-tauri/src/file/](../src-tauri/src/file/)).
- Zone-Cards mit Tiptap, **Drag&Drop**-Reordering (dnd-kit), Add/Delete, Token-Sidebar.
- **Interaktive HTML-Zonen** (`content_type: 'markdown' | 'html'`, CodeMirror) — Spec §14.
- **Custom CSS pro Zone** (`custom_css`, auf `#zone-<id>` gescoped, eigenes CSS-Panel) — Spec §17.
- **Reichere Layouts**: `hero` (Titel-Folie) + `split` (zwei Spalten, Markdown an `+++`-Zeile getrennt) — Spec §16.
- Live-Preview (isoliertes Iframe) · **Präsentationsmodus** mit Tastatur-Navigation · **integrierte Speaker-View** (aktuelle+nächste Folie, Timer, Notizen, Zähler; Taste `s`).
- **Interaktive Vorschau** (§18.1 Medium): Block-Umsortieren per Drag **in der Vorschau** + stufenloses **Bild-Resize** an der rechten Kante — beides **Pointer-Events** (WKWebView kann HTML5-DnD nicht zuverlässig); über `slideo:reorder-blocks`/`slideo:resize-image` → Store.
- **In-Folien-Builds** (§19.1): `reveal: 'steps'` blendet Top-Level-Blöcke im Präsentationsmodus schrittweise ein; **parent-autoritative Navigation** (PresentationMode hält Folie + Schritt, sendet `slideo:show {index, step}`).
- **Deck-weites Suchen & Ersetzen** (§19.9, Cmd/Ctrl+F) + Editor-`spellcheck`.

### Design
- Light/minimalistisches App-Chrome (an Penwright orientiert), Material-Symbols-Icons, WCAG-AA-Kontraste, `prefers-reduced-motion`.

### MCP-Server (KI-Anbindung)
- **30 Tools** (Presentation, Zones, Content, Tokens, Styles, Presentation-Mode, `set_zone_css`, `list_assets` + `set_zone_notes`, `set_zone_reveal`, `list_presets`/`apply_preset`, `set_transition`, `list_components`/`insert_component`).
- **9 token-bewusste Komponenten** (`insert_component`): stat_cards, bar_chart, **line_chart**, **donut_chart**, progress, quote, timeline, comparison, callout.
- **KI-Steuerung:** `instructions` im `initialize` (Markdown-first, Presets/Komponenten/Charts, token-bewusstes HTML, Bild-Positionierung, Builds) + MCP-Prompt **`slideo_guide`** (aufrufbarer Leitfaden mit `thema`-Argument).
- Auto-Registrierung in Claude Desktop.

### Roadmap §18 (umgesetzt in dieser Session)
- **Speaker-Notes** (§18.2): Notizen-Panel pro Zone + `set_zone_notes`.
- **HTML- & PDF-Export + Teilen** (§18.4/18.5): self-contained `.html` (alle Assets inline, Klick-/Tastatur-Nav) via `export_html`-Command; PDF via print-optimiertem Renderer + WebView-Druck. Topbar „Teilen"/„PDF".
- **Themes/Presets** (§18.6): 5 Presets, Theme-Picker, `list_presets`/`apply_preset` (Single Source TS↔Rust).
- **Folien-Transitions** (§18.3): `meta.transition` (none/fade/slide/zoom), Renderer-Deck-Modus, `set_transition`, UI-Picker.
- **Bild-Positionierung „Light"** (§18.1): Tiptap-`SlideoImage` mit `width/align/float`, Bubble-Toolbar, round-trip-sichere Markdown-Serialisierung.
- **Komponenten-Bibliothek + Agenten-Skill** (§18.7): token-bewusste Komponenten (Rust-Generator), `list_components`/`insert_component`; `instructions`/`slideo_guide` erweitert.

### Roadmap §19 (umgesetzt in dieser Session)
- **Daten-Diagramme** (§19.2): `line_chart` + `donut_chart` Komponenten (zusätzlich `bar_chart`) — token-bewusste SVGs aus Daten.
- **Barrierefreiheit** (§19.7): Alt-Text-Feld an der Bild-Toolbar; WCAG-Kontrast-Check (Text/Bg, Accent/Bg) im Design-Tab.
- **In-Folien-Builds** (§19.1): `reveal: 'steps'` (Zone-Flag), `set_zone_reveal`, ZoneToolbar-Toggle, parent-autoritative Präsentations-Navigation (Folie + Schritt). Auto-Animate/Morph offen.
- **Custom-Fonts** (§19.4): Upload (woff2/woff/ttf/otf) → Asset + `presentation.fonts`, Renderer-`@font-face`, Auswahl-Datalist; Store `addFont`.
- **Logo/Brand** (§19.4): `meta.logo = { asset, position }`, auf jeder Folie (auch Export/PDF); Design-Tab-Upload + Position.
- **Starter-Templates** (§19.4): 4 Decks (Leer/Pitch/Vortrag/Editorial) mit Preset + Seed-Zonen; Auswahl im Neu-Dialog.
- **Suchen & Ersetzen** (§19.9): deck-weites Modal + `replaceAllInDeck`; Editor-`spellcheck`.

### Assets
- `assets/`-Ordner im ZIP (Rust Reader/Writer + base64), AppState-Spiegelung, `sync_assets`.
- Import per Bild-/Medium-Button pro Zone **und** in **Settings → Assets** (Library, Thumbnails, entfernen).
- **Bilder, Video, Audio** (MIME-Erkennung); Video/Audio via HTML-Zone + `slideoasset://`-Streaming.
- `list_assets`-Tool, damit die KI vorab hinterlegte Assets entdeckt.

### Polish
- Undo (Cmd/Ctrl+Z, History für strukturelle Änderungen), Shortcuts (Cmd+S/N), **Toast**-Feedback.
- **Neue-Präsentation-Modal** (Name + Speicherort), **Settings-Menü** (Standard-Speicherort, Assets, Über).
- **Unsaved-Changes-Guard** beim Schließen mit 3-Knopf-Dialog (Speichern / Nicht speichern / Abbrechen).

## 5. Projektstruktur (Quellcode)

```
src-tauri/src/
  main.rs           # Modus-Branch: App vs. `mcp`
  lib.rs            # Tauri-Setup, Socket-Start, Claude-Config, slideoasset:// Protocol, Commands
  commands.rs       # load/save_presentation, sync_presentation, sync_assets, set_file_path
  ipc.rs            # lokaler TCP-Socket-Server + Discovery + Event-Emit + Client (für mcp-Modus)
  mcp.rs            # MCP stdio JSON-RPC (initialize/tools/prompts/...), leitet an Socket weiter
  tools.rs          # alle 30 Tool-Implementierungen + Schemas + instructions + slideo_guide
  presets.rs        # Theme-Presets (Spiegel von src/lib/presets.ts)
  components.rs     # token-bewusste HTML/SVG-Komponenten-Generatoren (§18.7/§19.2)
  state.rs          # AppState (presentation, file_path, assets)
  mcp_registration.rs # MCP-Ziel-Registrierung mit Startauswahl (Claude Desktop / Meta-MCP / Claude Code), genau eines aktiv
  file/             # reader.rs, writer.rs (ZIP + Assets), mod.rs (Asset-Typ, guess_mime inkl. Fonts, Tests)
  commands.rs       # …, export_html, open_print_view (PDF im Browser)

src/
  App.tsx           # Root: Editor | Präsentation, Shortcuts (inkl. Cmd+F), Modals, CloseGuard
  store/            # presentation.ts (Hauptstore), ui.ts (Modals), settings.ts (persist), toast.ts
  lib/              # renderer.ts, tokens.ts, markdown-tiptap.ts (+ splitMarkdownBlocks, setBlockImageWidth),
                    # tiptap-markdown.ts, tiptap-extensions.ts, tiptap-image.ts (SlideoImage), asset-resolver.ts,
                    # assets.ts, tauri.ts, dialog.ts, mcp-bridge.ts, presets.ts, templates.ts, contrast.ts, print.ts
  components/
    editor/         # EditorCanvas, ZoneCard, ZoneToolbar, TiptapEditor, HtmlEditor, CssEditor, ImageToolbar
    presentation/   # PresentationMode (parent-autoritativ), SpeakerView
    preview/        # PreviewPane (editable: Drag/Resize)
    tokens/         # TokenEditor (Tokens, Themes, Fonts, Logo, Kontrast, Transition)
    modals/         # NewPresentationModal (+ Vorlagen), SettingsModal, FindReplaceModal
    ui/             # Topbar, Sidebar, ZoneList, Modal, Icon, Toaster
    CloseGuard.tsx
  types/index.ts    # alle TS-Typen + Defaults (Transition, RevealMode, FontFace, BrandLogo …)
```

## 6. Verifikationsstatus

**Automatisiert getestet (grün):**
- `cargo test` — **14 Tests**: `.slideo`-Roundtrip inkl. Assets, voller Tool-Flow (create→zones→html→css→notes→transition→component→tokens→reorder→delete), `set_zone_style/css`, `apply_preset`, Komponenten-Generator (Token-Nutzung/Escaping/Skalierung, inkl. Charts), MCP-Handshake, `tools/list` (**30**), Prompts.
- **Standalone via `tsx` geprüft:** Bild-Positionierungs-Round-Trip (`![]()` vs. `<img>`), Markdown-Block-Splitter, editable-Block-/Resize-Rendering, Builds-Fragmente + parent-autoritative Nav, `@font-face`-Generierung, Logo-Rendering, Template-Aufbau.
- **MCP-E2E** (Python-Harness gegen Fake-Socket): echtes `slideo mcp`-Binary macht initialize → tools/list → tools/call-Forwarding korrekt.
- `npm run typecheck` + `npx vite build` — alles grün.

**NICHT verifiziert (kein GUI in der Entwicklungsumgebung) — siehe [next-steps.md](next-steps.md):**
- Das echte Tauri-Fenster zur Laufzeit (Editor, Drag&Drop, Modals, Speaker-View-Optik).
- Live-MCP-Eventfluss ins WebView; ob `slideoasset://` im sandboxed Iframe lädt; 3-Knopf-Schließen-Dialog; ob Claude Desktop `instructions`/`slideo_guide` einblendet.
- **Roadmap §18:** Bild-Bubble-Toolbar, Transition-Animationen, HTML-Export, **PDF-Druck** (öffnet jetzt im Standardbrowser via `open_print_view`), Notizen, Theme-Picker, Komponenten via MCP.
- **Roadmap §19:** interaktive Vorschau (Block-Drag + Bild-Resize via Pointer-Events), **Builds** (schrittweises Einblenden + die umgebaute parent-autoritative Navigation — auch normale Navigation gegentesten!), Charts via MCP, Alt-Text/Kontrast, **Custom-Fonts** (laden/Export), **Logo**, **Templates**, **Suchen & Ersetzen**.

## 7. Wichtige Konventionen & Stolpersteine

1. **Spec ist die Wahrheit** ([slideo-spec.md](slideo-spec.md)); bei Widersprüchen Entwickler fragen.
2. **Markdown ist primäres Content-Format.** HTML-Zonen nur für Interaktives; dann **mit Token-CSS-Variablen** stylen, damit der Mensch global themen kann.
3. **Kein AI-Layer in der App** — nur der MCP-Server.
4. **State lebt im Zustand-Store** (kein lokaler React-State für Präsentationsdaten).
5. **Nach JEDER Backend-Änderung an Tools/Instructions: `tauri:dev`/`cargo build` neu UND Claude Desktop neu starten** — sonst läuft Claude Desktop gegen das alte MCP-Binary (häufige Fehlerquelle!).
6. **Bewusste Spec-Abweichung:** MCP ist hand-gerolltes JSON-RPC statt `rmcp` (Spec §10) — rmcp ist 0.1→0.16 stark gewandert; unser stdio-Teil ist nur ein dünner Weiterleiter.
7. Editoren spiegeln externe Inhaltsänderungen (Bild-Import, MCP-Edits) via geschütztem Sync; Cursor springt beim Tippen nicht.
8. Custom-CSS wird auf `#zone-<id>` gescoped (eigener Mini-Parser in renderer.ts).
9. **WKWebView-Lücken → Pointer-Events + eigene Logik, keine nativen Browser-APIs:** HTML5-Drag&Drop und `window.print()` sind in der macOS-WebView unzuverlässig. Daher: Block-Drag/Bild-Resize über Pointer-Events; PDF über `open_print_view` (Temp-Datei → Standardbrowser) statt `window.print()`.
10. **Single Source über die FFI-Grenze:** Presets in [presets.ts](../src/lib/presets.ts) **und** [presets.rs](../src-tauri/src/presets.rs) spiegeln; Komponenten leben nur in Rust ([components.rs](../src-tauri/src/components.rs)).
11. **Komponenten/HTML nur mit Token-Variablen** (`var(--color-*)`/`var(--font-*)`), nie hartkodiert — sonst nicht themebar.
12. **Bild-Positionierung:** Default-Bilder bleiben `![]()`; mit Größe/Ausrichtung/Float → rohes `<img style class>` ([tiptap-image.ts](../src/lib/tiptap-image.ts)), round-trip-sicher.
13. **Builds = parent-autoritativ:** PresentationMode hält Folie+Schritt; das Audience-Iframe hat **keine** eigene Tastatur (nur der Standalone-Export), reagiert nur auf `slideo:show {index, step}`.
14. **Additive Datenmodell-Felder** (optional): `meta.transition`, `meta.logo`, `zone.reveal`, `presentation.fonts`, Bild-`width/align/float`. `version` bewusst bei "1.0" (alles optional & Value-basiert).

## 8. Build- & Run-Befehle

```bash
npm install                         # Deps
npm run dev                         # Browser-only UI-Loop (kein Datei-I/O, kein MCP)
npm run tauri:dev                   # volle Desktop-App
npm run typecheck && npm run build  # TS-Check + Vite-Build
cd src-tauri && cargo check         # Rust kompilieren
cd src-tauri && cargo test          # Rust-Tests
```
