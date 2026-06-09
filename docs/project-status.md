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

### Design
- Light/minimalistisches App-Chrome (an Penwright orientiert), Material-Symbols-Icons, WCAG-AA-Kontraste, `prefers-reduced-motion`.

### MCP-Server (KI-Anbindung)
- **23 Tools** (Presentation, Zones, Content, Tokens, Styles, Presentation-Mode, `set_zone_css`, `list_assets`).
- **KI-Steuerung:** `instructions` im `initialize` (Markdown-first, token-bewusstes HTML) + MCP-Prompt **`slideo_guide`** (aufrufbarer Leitfaden mit `thema`-Argument).
- Auto-Registrierung in Claude Desktop.

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
  tools.rs          # alle 23 Tool-Implementierungen + Schemas + instructions + slideo_guide
  state.rs          # AppState (presentation, file_path, assets)
  claude_config.rs  # Auto-Eintrag in claude_desktop_config.json
  file/             # reader.rs, writer.rs (ZIP + Assets), mod.rs (Asset-Typ, guess_mime, Tests)

src/
  App.tsx           # Root: Editor | Präsentation, Shortcuts, Modals, CloseGuard
  store/            # presentation.ts (Hauptstore), ui.ts (Modals), settings.ts (persist), toast.ts
  lib/              # renderer.ts, tokens.ts, markdown-tiptap.ts, tiptap-markdown.ts,
                    # tiptap-extensions.ts, assets.ts, tauri.ts (Bridge+assetUrlBase), dialog.ts, mcp-bridge.ts
  components/
    editor/         # EditorCanvas, ZoneCard, ZoneToolbar, TiptapEditor, HtmlEditor, CssEditor
    presentation/   # PresentationMode, SpeakerView
    preview/        # PreviewPane
    tokens/         # TokenEditor
    modals/         # NewPresentationModal, SettingsModal
    ui/             # Topbar, Sidebar, ZoneList, Modal, Icon, Toaster
    CloseGuard.tsx
  types/index.ts    # alle TS-Typen + Defaults
```

## 6. Verifikationsstatus

**Automatisiert getestet (grün):**
- `cargo test` — **8 Tests**: `.slideo`-Roundtrip inkl. Assets, voller Tool-Flow (create→zones→html→css→tokens→reorder→delete), `set_zone_style/css`, MCP-Handshake, `tools/list` (23), Prompts.
- **MCP-E2E** (Python-Harness gegen Fake-Socket): echtes `slideo mcp`-Binary macht initialize → tools/list → tools/call-Forwarding korrekt.
- `npm run typecheck` + `npx vite build` + Dev-Server-Modul-Smoke — alles grün.

**NICHT verifiziert (kein GUI in der Entwicklungsumgebung) — siehe [next-steps.md](next-steps.md):**
- Das echte Tauri-Fenster zur Laufzeit (Editor, Drag&Drop, Modals, Speaker-View-Optik).
- Live-MCP-Eventfluss ins WebView (ob Folien live erscheinen).
- Ob `slideoasset://` im **sandboxed Iframe** lädt (Video/Audio) — neuester, ungetesteter Teil.
- Der 3-Knopf-Schließen-Dialog (Speicher-on-close).
- Ob Claude Desktop `instructions`/`slideo_guide` tatsächlich einblendet.

## 7. Wichtige Konventionen & Stolpersteine

1. **Spec ist die Wahrheit** ([slideo-spec.md](slideo-spec.md)); bei Widersprüchen Entwickler fragen.
2. **Markdown ist primäres Content-Format.** HTML-Zonen nur für Interaktives; dann **mit Token-CSS-Variablen** stylen, damit der Mensch global themen kann.
3. **Kein AI-Layer in der App** — nur der MCP-Server.
4. **State lebt im Zustand-Store** (kein lokaler React-State für Präsentationsdaten).
5. **Nach JEDER Backend-Änderung an Tools/Instructions: `tauri:dev`/`cargo build` neu UND Claude Desktop neu starten** — sonst läuft Claude Desktop gegen das alte MCP-Binary (häufige Fehlerquelle!).
6. **Bewusste Spec-Abweichung:** MCP ist hand-gerolltes JSON-RPC statt `rmcp` (Spec §10) — rmcp ist 0.1→0.16 stark gewandert; unser stdio-Teil ist nur ein dünner Weiterleiter.
7. Editoren spiegeln externe Inhaltsänderungen (Bild-Import, MCP-Edits) via geschütztem Sync; Cursor springt beim Tippen nicht.
8. Custom-CSS wird auf `#zone-<id>` gescoped (eigener Mini-Parser in renderer.ts).

## 8. Build- & Run-Befehle

```bash
npm install                         # Deps
npm run dev                         # Browser-only UI-Loop (kein Datei-I/O, kein MCP)
npm run tauri:dev                   # volle Desktop-App
npm run typecheck && npm run build  # TS-Check + Vite-Build
cd src-tauri && cargo check         # Rust kompilieren
cd src-tauri && cargo test          # Rust-Tests
```
