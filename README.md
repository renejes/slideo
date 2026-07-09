# Slideo

Lokale, code-freie, **MCP-native** Desktop-App für Präsentationen.
Eine Präsentation ist technisch eine einzige HTML-Page, unterteilt in **Zones** (= Slides).

> Maßgebliche Spezifikation: [docs/slideo-spec.md](docs/slideo-spec.md)

## Tech Stack

- **Tauri 2** (Rust-Backend) + **React 18** / TypeScript / **Vite** (WebView-Frontend)
- **Tiptap 2** (Markdown-WYSIWYG) · **CodeMirror 6** (HTML-Zonen) · **Tailwind 3** (App-Chrome)
- `.slideo`-Datei = ZIP mit `presentation.json` + `assets/`

## Voraussetzungen

- Node ≥ 20, npm
- Rust (stable) + Plattform-Toolchain für Tauri 2
  (macOS: Xcode CLT · Linux: webkit2gtk etc. · Windows: WebView2 + MSVC)

## Entwicklung

```bash
npm install

# Reiner Browser-Modus (schnellster UI-Loop, ohne Datei-I/O):
npm run dev            # http://localhost:1420

# Vollständige Desktop-App (mit Rust-Backend & Datei-Dialogen):
npm run tauri:dev
```

> Im reinen Browser-Modus sind „Öffnen"/„Speichern" deaktiviert (brauchen das Tauri-Backend).

## Build & Checks

```bash
npm run typecheck                 # TypeScript
npm run build                     # tsc + Vite Production-Build
npm run tauri:build               # native App bauen

cd src-tauri && cargo check       # Rust kompilieren
cd src-tauri && cargo test        # u.a. .slideo Round-Trip-Test
```

## MCP-Server (KI-Anbindung)

Slideo exponiert alle App-Funktionen als MCP-Tools für Claude Desktop o.ä.

- **Eine Binary, zwei Modi:** `slideo` startet die App; `slideo mcp` den MCP-stdio-Server.
- **Live über lokalen Socket:** Die laufende App öffnet einen TCP-Socket (127.0.0.1) und
  schreibt den Port in `<config>/slideo/ipc.json`. `slideo mcp` (von Claude Desktop gestartet)
  verbindet sich, leitet Tool-Calls weiter — die App mutiert ihren State und aktualisiert die
  UI **live** per Tauri-Event.
- **Auto-Registrierung:** Beim App-Start wird Slideo idempotent in die
  `claude_desktop_config.json` eingetragen (nur falls Claude Desktop installiert ist).
- **37 Tools:** Presentation, Zones, Content, Tokens, Styles, Presentation-Mode,
  Speaker-Notes (`set_zone_notes`), Builds (`set_zone_reveal`), Themes
  (`list_presets`/`apply_preset`), Transitions (`set_transition`), Komponenten
  (`list_components`/`insert_component`), Assets (`list_assets`), Custom-CSS (`set_zone_css`),
  Marke/Meta (`set_logo`/`clear_logo`, `register_font`, `set_presentation_title`, `set_zone_label`),
  KI-Layout-Check (`check_zone_overflow`/`validate_deck`).
- **MCP-Prompt `slideo_guide`:** aufrufbarer Leitfaden, wie eine KI Slideo hochwertig nutzt.

> Voraussetzung: Die Slideo-App muss **laufen**, damit der MCP-Server sich verbinden kann.

## Status — MVP funktional komplett

- ✅ Datenmodell, Zustand-Store, `.slideo` Reader/Writer (Rust) + Round-Trip-Test
- ✅ Editor: Zone-Cards (Tiptap), Drag&Drop-Reordering, Add/Delete, Design-Overlay (Brand-Kit-Tokens)
- ✅ **Interaktive HTML-Zonen** (`content_type: 'markdown' | 'html'`, CodeMirror) — Spec §14
- ✅ Live-Preview (isoliertes Iframe, **In-Place-Patch** statt Voll-Reload — §25) + Vollbild-Präsentationsmodus mit
  Tastatur-Navigation + **teilbares Folien-Fenster** für Ein-Monitor-Remote (Zoom/Meet, §26)
- ✅ **Integrierte Speaker-View** (gestapelt: aktuelle Folie oben 16:9, darunter Timer · nächste Folie · Notizen; Taste `s`)
- ✅ Light/minimalistisches Design (Penwright-nah) + Material-Symbols-Icons
- ✅ **MCP-Server** (37 Tools, Live-Socket, Auto-Registrierung) — verifiziert per Unit- + E2E-Test
- ✅ Undo (Cmd/Ctrl+Z), Shortcuts (Cmd+S/N), Toast-Feedback, Unsaved-Changes-Guard
- ✅ **Neue-Präsentation-Modal** (Name + Speicherort) + **Settings-Menü** (Shell)
- ✅ **Bild-Import** über `assets/`-Ordner im ZIP — Referenz `assets/<name>`, im Renderer zu
  Data-URI aufgelöst; Asset-Roundtrip getestet. Bilder per URL/Data-URI gehen weiterhin direkt.

### Roadmap §18/§19 — umgesetzt (siehe [docs/slideo-spec.md](docs/slideo-spec.md))

- ✅ **Speaker-Notes**, **HTML- & PDF-Export + Teilen**, **Themes/Presets** (5), **Folien-Transitions**
  (fade/slide/zoom), **Bild-Positionierung** Light (Toolbar) + Medium (Block-Drag/Resize **in der Vorschau**),
  **Komponenten-Bibliothek** (17, inkl. Charts, Tabellen, TOC) + erweiterter Agenten-Skill + Komponenten-Palette im Editor.
- ✅ **In-Folien-Builds** (schrittweises Einblenden), **Barrierefreiheit** (Alt-Text + WCAG-Kontrast),
  **Custom-Fonts** (Upload → `@font-face`), **Logo/Brand** auf jeder Folie, **Starter-Templates**
  (Pitch/Vortrag/Editorial), **Suchen & Ersetzen** + Rechtschreibung.

### Shortcuts
`Cmd/Ctrl+S` speichern · `Cmd/Ctrl+N` neu · `Cmd/Ctrl+Z` rückgängig · `Cmd/Ctrl+F` Suchen & Ersetzen ·
Präsentation: `←/→/Leertaste` navigieren (Builds Schritt für Schritt) · `s` Speaker-Ansicht · `Esc` verlassen

### Weiter umgesetzt (§19.1–§19.9 + §20–§26)

- ✅ **Presenter-Tools** (§19.3): Folien-Übersicht/Sprung, Laser/Stift, **echtes Zweitfenster** + **teilbares Folien-Fenster** (§26), Auto-Advance/Loop
- ✅ **Auto-Animate/Morph** (§19.1) · **Daten-Diagramme** (§19.2) · **PPTX-Export** (§19.5) · **Versionshistorie** (§19.9)
- ✅ **Medien** (§19.8): Drag&Drop-Bildimport, Crop · **Komponenten-Palette** im Editor (Aufnahme/Narration bewusst out-of-scope)
- ✅ **Direktmanipulation in der Vorschau** (§20) · **feste 16:9-Bühne** (§21) · **Security-Härtung** (§22) · **Zonen-Links** (§23) · **Workflow-Optimierung** (§24) · **Vorschau-In-Place-Patch** (§25)

### Offen (Release-Ready)

- Voller GUI-Test (Checklisten in [docs/next-steps.md](docs/next-steps.md) Abschnitt A) · **Distribution/Notarization**
  (Signing, notarisierte/Cross-Platform-Builds — Abschnitt C) · optional `catch_unwind`-Hardening um `tools::handle`.
