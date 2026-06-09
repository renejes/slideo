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
- 21 Tools (Spec §5): Presentation, Zones, Content, Tokens, Styles, Presentation-Mode.

> Voraussetzung: Die Slideo-App muss **laufen**, damit der MCP-Server sich verbinden kann.

## Status — MVP funktional komplett

- ✅ Datenmodell, Zustand-Store, `.slideo` Reader/Writer (Rust) + Round-Trip-Test
- ✅ Editor: Zone-Cards (Tiptap), Drag&Drop-Reordering, Add/Delete, Token-Sidebar
- ✅ **Interaktive HTML-Zonen** (`content_type: 'markdown' | 'html'`, CodeMirror) — Spec §14
- ✅ Live-Preview (isoliertes Iframe) + Vollbild-Präsentationsmodus mit Tastatur-Navigation
- ✅ **Integrierte Speaker-View** (aktuelle + nächste Folie, Timer, Notizen, Zähler; Taste `s`)
- ✅ Light/minimalistisches Design (Penwright-nah) + Material-Symbols-Icons
- ✅ **MCP-Server** (21 Tools, Live-Socket, Auto-Registrierung) — verifiziert per Unit- + E2E-Test
- ✅ Undo (Cmd/Ctrl+Z), Shortcuts (Cmd+S/N), Toast-Feedback, Unsaved-Changes-Guard
- ✅ **Neue-Präsentation-Modal** (Name + Speicherort) + **Settings-Menü** (Shell)
- ✅ **Bild-Import** über `assets/`-Ordner im ZIP — Referenz `assets/<name>`, im Renderer zu
  Data-URI aufgelöst; Asset-Roundtrip getestet. Bilder per URL/Data-URI gehen weiterhin direkt.

### Shortcuts
`Cmd/Ctrl+S` speichern · `Cmd/Ctrl+N` neu · `Cmd/Ctrl+Z` rückgängig ·
Präsentation: `←/→/Leertaste` navigieren · `s` Speaker-Ansicht · `Esc` verlassen

### Bewusst noch offen (nach dem MVP)

- Echtes Speaker-Zweitfenster auf separatem Display (aktuell integriert/umschaltbar)
- Bild-Import per **Drag&Drop** in den Editor (Button-Import ist da)
- Asset-Verwaltung-UI (ungenutzte Assets aufräumen, umbenennen)
- Plattformübergreifende Builds (Windows/Linux) verifizieren
- Material-Symbols-Font auf genutzte Icons subsetten (Bundle-Größe)
# slideo
