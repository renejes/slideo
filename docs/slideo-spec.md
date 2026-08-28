# Slideo — MVP Spec & Bauplan

> Dieses Dokument ist die maßgebliche Referenz für die Entwicklung von Slideo.
> Es richtet sich primär an eine KI (Claude Opus) die den Code schreibt.
> Lies dieses Dokument vollständig bevor du Code schreibst oder Entscheidungen triffst.

---

## 1. Was ist Slideo?

Slideo ist eine Desktop-Applikation für das Erstellen und Präsentieren von Präsentationen.

**Kernidee:** Eine Präsentation ist technisch eine einzelne HTML-Page. Diese Page ist in „Zones" unterteilt – jede Zone entspricht einem Slide. Im Editor bearbeitet man die gesamte Page als langen Scroll. Im Präsentationsmodus springt die App von Zone zu Zone.

**Was Slideo von Alternativen unterscheidet:**
- Kein Code sichtbar für den Nutzer – alles WYSIWYG
- Kein festes Layout-System – freies Design per Design Tokens + Tailwind
- AI-first: Ein MCP Server exposed alle App-Funktionen als Tools. Der Nutzer verbindet seinen eigenen Claude Desktop (oder ein anderes MCP-fähiges Tool). Die App selbst hat keine AI-Logik, keine API-Keys, keine Cloud-Abhängigkeit.
- DSGVO-konform by design: läuft vollständig lokal, kein externes API nötig
- Konkurrenz: Gamma.app, Beautiful.ai (beide Cloud-only, kein MCP). Slidev, Reveal.js (beide Code-first, für Entwickler). Slideo ist die einzige lokale, code-freie, MCP-native Alternative.

---

## 2. Tech Stack

### Desktop Shell
- **Tauri 2** (Rust Backend + WebView Frontend)
- Rust für: MCP Server, Datei-I/O, Prozess-Management
- WebView für: gesamte UI (React)

### Frontend (WebView)
- **React 18** mit TypeScript
- **Tiptap 2** als WYSIWYG Editor
- **Tailwind CSS 3** für UI-Styling der App selbst
- **Vite** als Build Tool

### MCP Server
- Läuft als nativer Rust-Prozess im Tauri Backend
- Kommuniziert über stdio (Standard MCP Transport)
- Wird in `~/.config/claude/claude_desktop_config.json` eingetragen

### Dateiformat
- `.slideo` Datei = umbenanntes ZIP
- Enthält: `presentation.json` + `assets/` Ordner
- Vollständig menschenlesbar, versionierbar per Git

---

## 3. Dateiformat: `presentation.json`

```json
{
  "version": "1.0",
  "meta": {
    "title": "Meine Präsentation",
    "created": "2026-01-01T00:00:00Z",
    "modified": "2026-01-01T00:00:00Z"
  },
  "tokens": {
    "color-primary": "#6366f1",
    "color-secondary": "#818cf8",
    "color-bg": "#0f0f0f",
    "color-surface": "#1a1a2e",
    "color-text": "#f1f5f9",
    "color-accent": "#e94560",
    "font-heading": "Cal Sans",
    "font-body": "Inter",
    "font-size-base": "1rem",
    "spacing-base": "1rem",
    "border-radius": "0.5rem"
  },
  "zones": [
    {
      "id": "zone-uuid-1",
      "label": "Slide 1",
      "order": 0,
      "content_type": "markdown",
      "markdown": "# Willkommen\n\nDas ist der erste Slide.",
      "html": null,
      "style": {
        "layout": "center",
        "padding": "4rem",
        "background": null
      },
      "notes": ""
    }
  ]
}
```

**Wichtige Designentscheidungen:**
- `markdown` ist das primäre Content-Format – nicht Tiptap-JSON. Die App konvertiert intern Markdown ↔ Tiptap-JSON. Die KI schreibt immer Markdown.
- `content_type` wählt zwischen `markdown` (Default) und `html`. Bei `html` wird `zone.html` direkt gerendert (volle Browser-Fähigkeiten, inkl. `<script>`). Siehe Abschnitt 14.
- `tokens` sind CSS Custom Properties. Der Renderer mappt sie zu `--color-primary` etc.
- `style` pro Zone erlaubt individuelle Overrides ohne das Token-System zu brechen.
- `id` ist immer eine UUID v4.

---

## 4. Projektstruktur

```
slideo/
├── src-tauri/                  # Rust Backend
│   ├── src/
│   │   ├── main.rs             # Tauri App Entry Point
│   │   ├── mcp/
│   │   │   ├── mod.rs          # MCP Server Entry
│   │   │   ├── server.rs       # stdio Transport, Tool Dispatch
│   │   │   └── tools/
│   │   │       ├── mod.rs
│   │   │       ├── presentation.rs   # create, open, save, get_meta
│   │   │       ├── zones.rs          # create, delete, reorder, get, get_all
│   │   │       ├── content.rs        # set_content, append, replace, get
│   │   │       ├── tokens.rs         # get, set, reset, apply_preset
│   │   │       ├── styles.rs         # set_zone_style, get_zone_style
│   │   │       └── presentation_mode.rs  # get_slide_count, set_active_slide
│   │   ├── file/
│   │   │   ├── mod.rs
│   │   │   ├── reader.rs       # .slideo ZIP lesen
│   │   │   └── writer.rs       # .slideo ZIP schreiben
│   │   └── state.rs            # AppState (aktuelle Presentation im Speicher)
│   └── Cargo.toml
│
├── src/                        # React Frontend
│   ├── main.tsx
│   ├── App.tsx                 # Root: Editor | Presentation Mode
│   ├── components/
│   │   ├── editor/
│   │   │   ├── EditorCanvas.tsx      # Scroll-Container für alle Zones
│   │   │   ├── ZoneCard.tsx          # Card mit Tiptap Editor + Handle
│   │   │   ├── ZoneToolbar.tsx       # Toolbar über jeder Zone
│   │   │   └── TiptapEditor.tsx      # Tiptap Instanz
│   │   ├── tokens/
│   │   │   └── TokenEditor.tsx       # Sidebar: Token bearbeiten
│   │   ├── presentation/
│   │   │   ├── PresentationMode.tsx  # Fullscreen Iframe Wrapper
│   │   │   ├── SlideFrame.tsx        # Einzelner Slide im Iframe
│   │   │   └── SpeakerView.tsx       # Vorschau-Fenster für Präsentator
│   │   └── ui/
│   │       ├── Sidebar.tsx
│   │       ├── Topbar.tsx
│   │       └── ZoneList.tsx          # Miniatur-Übersicht aller Zones
│   ├── lib/
│   │   ├── markdown-tiptap.ts  # Markdown → Tiptap JSON Konverter
│   │   ├── tiptap-markdown.ts  # Tiptap JSON → Markdown Konverter
│   │   ├── renderer.ts         # Tiptap JSON + Tokens → HTML String
│   │   └── tokens.ts           # Token-Utilities, CSS var injection
│   ├── store/
│   │   └── presentation.ts     # Zustand (Zustand library) Store
│   └── types/
│       └── index.ts            # Alle TypeScript Typen
│
├── package.json
├── vite.config.ts
└── tailwind.config.ts
```

---

## 5. MCP Server – alle Tools

Der MCP Server läuft als Tauri Sidecar oder direkt im Tauri Backend über stdio.
Claude Desktop verbindet sich beim Start der App automatisch.

### Gruppe: Presentation

#### `create_presentation`
```json
{
  "name": "create_presentation",
  "description": "Erstellt eine neue leere Präsentation und öffnet sie in der App.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "title": { "type": "string", "description": "Titel der Präsentation" }
    },
    "required": ["title"]
  }
}
```

#### `open_presentation`
```json
{
  "name": "open_presentation",
  "description": "Öffnet eine bestehende .slideo Datei.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Absoluter Pfad zur .slideo Datei" }
    },
    "required": ["path"]
  }
}
```

#### `save_presentation`
```json
{
  "name": "save_presentation",
  "description": "Speichert die aktuelle Präsentation. Ohne path wird am bestehenden Ort gespeichert.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "path": { "type": "string", "description": "Optionaler Speicherpfad (Save As)" }
    }
  }
}
```

#### `get_presentation_meta`
```json
{
  "name": "get_presentation_meta",
  "description": "Gibt Metadaten der aktuellen Präsentation zurück: Titel, Anzahl Zones, Token-Übersicht.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

---

### Gruppe: Zones

#### `create_zone`
```json
{
  "name": "create_zone",
  "description": "Erstellt eine neue Zone (Slide) am Ende oder an einer bestimmten Position.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "label": { "type": "string", "description": "Anzeigename z.B. 'Slide 3'" },
      "after_id": { "type": "string", "description": "UUID der Zone nach der eingefügt wird. Ohne Angabe: ans Ende." },
      "markdown": { "type": "string", "description": "Optionaler initialer Inhalt als Markdown" }
    },
    "required": ["label"]
  }
}
```

#### `delete_zone`
```json
{
  "name": "delete_zone",
  "description": "Löscht eine Zone permanent.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string", "description": "UUID der Zone" }
    },
    "required": ["id"]
  }
}
```

#### `reorder_zones`
```json
{
  "name": "reorder_zones",
  "description": "Ändert die Reihenfolge aller Zones.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "ordered_ids": {
        "type": "array",
        "items": { "type": "string" },
        "description": "Alle Zone-UUIDs in der gewünschten neuen Reihenfolge"
      }
    },
    "required": ["ordered_ids"]
  }
}
```

#### `get_zone`
```json
{
  "name": "get_zone",
  "description": "Gibt eine einzelne Zone zurück (id, label, markdown, style, notes).",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" }
    },
    "required": ["id"]
  }
}
```

#### `get_all_zones`
```json
{
  "name": "get_all_zones",
  "description": "Gibt alle Zones in ihrer aktuellen Reihenfolge zurück.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

---

### Gruppe: Content

#### `set_zone_content`
```json
{
  "name": "set_zone_content",
  "description": "Ersetzt den Inhalt einer Zone. Bei content_type 'markdown' wird Markdown übergeben. Bei content_type 'html' wird vollständiges HTML übergeben – inklusive Script-Tags, SVG, Alpine.js etc. Die KI wählt den Typ selbst basierend auf dem was die Zone leisten soll.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "content_type": {
        "type": "string",
        "enum": ["markdown", "html"],
        "description": "markdown für Text-Slides, html für interaktive oder animierte Inhalte"
      },
      "content": {
        "type": "string",
        "description": "Inhalt als Markdown-String oder als HTML-String je nach content_type"
      }
    },
    "required": ["id", "content_type", "content"]
  }
}
```

> Alle anderen Content-Tools (`append_to_zone`, `replace_in_zone`, `get_zone_content`) arbeiten weiterhin primär mit Markdown. Bei einer HTML-Zone gibt `get_zone_content` den rohen HTML-String zurück.

#### `append_to_zone`
```json
{
  "name": "append_to_zone",
  "description": "Fügt Markdown-Inhalt am Ende einer Zone hinzu.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "markdown": { "type": "string" }
    },
    "required": ["id", "markdown"]
  }
}
```

#### `replace_in_zone`
```json
{
  "name": "replace_in_zone",
  "description": "Ersetzt einen bestimmten Text in einer Zone durch neuen Text.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "search": { "type": "string", "description": "Zu ersetzender Text" },
      "replace": { "type": "string", "description": "Neuer Text" }
    },
    "required": ["id", "search", "replace"]
  }
}
```

#### `get_zone_content`
```json
{
  "name": "get_zone_content",
  "description": "Gibt den Inhalt einer Zone als Markdown zurück.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" }
    },
    "required": ["id"]
  }
}
```

---

### Gruppe: Tokens

#### `get_tokens`
```json
{
  "name": "get_tokens",
  "description": "Gibt alle aktuellen Design Tokens zurück.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

#### `set_token`
```json
{
  "name": "set_token",
  "description": "Setzt einen einzelnen Design Token.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "key": { "type": "string", "description": "Token-Name z.B. 'color-primary'" },
      "value": { "type": "string", "description": "Token-Wert z.B. '#6366f1'" }
    },
    "required": ["key", "value"]
  }
}
```

#### `set_tokens_bulk`
```json
{
  "name": "set_tokens_bulk",
  "description": "Setzt mehrere Design Tokens auf einmal. Ideal zum Erstellen eines kompletten Design Systems.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "tokens": {
        "type": "object",
        "description": "Key-Value Paare aller zu setzenden Tokens",
        "additionalProperties": { "type": "string" }
      }
    },
    "required": ["tokens"]
  }
}
```

#### `reset_tokens`
```json
{
  "name": "reset_tokens",
  "description": "Setzt alle Design Tokens auf die Standard-Werte zurück.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

---

### Gruppe: Styles

#### `set_zone_style`
```json
{
  "name": "set_zone_style",
  "description": "Setzt Style-Properties einer Zone: layout/padding/background/text_align (im 'style'-Objekt) und/oder zonen-gescoptes 'custom_css'. Mindestens eines von 'style'/'custom_css'.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" },
      "style": {
        "type": "object",
        "properties": {
          "layout": {
            "type": "string",
            "enum": ["center", "hero", "top", "split", "full"],
            "description": "Layout: center, hero (große Titel-Folie), top, split (zwei Spalten – Markdown an einer '+++'-Zeile trennen), full"
          },
          "padding": { "type": "string", "description": "CSS padding z.B. '4rem'" },
          "background": { "type": "string", "description": "CSS background, überschreibt Token. z.B. '#1a1a2e' oder 'linear-gradient(...)'" },
          "text_align": { "type": "string", "enum": ["left", "center", "right"] }
        }
      },
      "custom_css": { "type": "string", "description": "Zonen-gescoptes CSS (siehe §17). Stylt eine Markdown-Folie ohne HTML; Text bleibt editierbar." }
    },
    "required": ["id"]
  }
}
```

> Alternativ gibt es das dedizierte Tool `set_zone_css(id, css)` für genau dieses Feld.

#### `get_zone_style`
```json
{
  "name": "get_zone_style",
  "description": "Gibt die Style-Properties einer Zone zurück.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "id": { "type": "string" }
    },
    "required": ["id"]
  }
}
```

---

### Gruppe: Presentation Mode

#### `get_slide_count`
```json
{
  "name": "get_slide_count",
  "description": "Gibt die Anzahl der Zones (Slides) zurück.",
  "inputSchema": { "type": "object", "properties": {} }
}
```

#### `set_active_slide`
```json
{
  "name": "set_active_slide",
  "description": "Springt im Präsentationsmodus zu einem bestimmten Slide.",
  "inputSchema": {
    "type": "object",
    "properties": {
      "index": { "type": "number", "description": "0-basierter Index des Slides" }
    },
    "required": ["index"]
  }
}
```

---

## 6. Renderer: Markdown + Tokens → HTML

Der Renderer erzeugt aus einer Zone den finalen HTML-String der im Iframe angezeigt wird.

**Pipeline:**
```
Zone (content_type prüfen)
  ├─ markdown → HTML String (via markdown-tiptap.ts / markdown-it)
  └─ html     → zone.html direkt (keine Konvertierung, Scripts erlaubt)
  → Wrapping in Zone-Template mit Layout-Klassen
  → CSS Custom Properties aus Tokens injiziert
```

**Zone-Template Beispiel:**
```html
<section
  id="zone-{id}"
  class="slideo-zone min-h-screen flex {layout-classes} p-{padding}"
  style="
    background: {zone.style.background ?? 'var(--color-bg)'};
    --color-primary: {tokens['color-primary']};
    --color-bg: {tokens['color-bg']};
    ... alle tokens als css vars
  "
>
  <div class="slideo-content max-w-4xl w-full">
    {tiptap html output}
  </div>
</section>
```

**Tailwind Klassen für Content-Elemente:**
```
h1 → text-5xl font-bold leading-tight (font: var(--font-heading))
h2 → text-3xl font-semibold
h3 → text-2xl font-medium
p  → text-lg leading-relaxed (font: var(--font-body))
ul → list-disc list-inside space-y-2
strong → font-bold color: var(--color-accent)
```

---

## 7. App State (Zustand Store)

```typescript
interface PresentationStore {
  // Daten
  presentation: Presentation | null
  filePath: string | null
  isDirty: boolean

  // UI State
  activeZoneId: string | null
  mode: 'editor' | 'presentation'
  activeSlideIndex: number

  // Actions
  loadPresentation: (path: string) => Promise<void>
  savePresentation: (path?: string) => Promise<void>
  createZone: (after?: string) => void
  deleteZone: (id: string) => void
  updateZoneMarkdown: (id: string, markdown: string) => void
  updateZoneStyle: (id: string, style: Partial<ZoneStyle>) => void
  setToken: (key: string, value: string) => void
  reorderZones: (orderedIds: string[]) => void
  setActiveZone: (id: string | null) => void
  setMode: (mode: 'editor' | 'presentation') => void
  setActiveSlide: (index: number) => void
}
```

---

## 8. TypeScript Typen

```typescript
// types/index.ts

export interface Presentation {
  version: string
  meta: PresentationMeta
  tokens: DesignTokens
  zones: Zone[]
}

export interface PresentationMeta {
  title: string
  created: string
  modified: string
}

export interface DesignTokens {
  'color-primary': string
  'color-secondary': string
  'color-bg': string
  'color-surface': string
  'color-text': string
  'color-accent': string
  'font-heading': string
  'font-body': string
  'font-size-base': string
  'spacing-base': string
  'border-radius': string
  [key: string]: string  // erweiterbar
}

export interface Zone {
  id: string                          // UUID v4
  label: string                       // "Slide 1"
  order: number                       // 0-basiert
  content_type: 'markdown' | 'html'   // Default: 'markdown'
  markdown: string                    // genutzt wenn content_type === 'markdown'
  html: string | null                 // genutzt wenn content_type === 'html'
  custom_css: string                  // optionales, auf diese Zone gescoptes CSS (siehe §17)
  style: ZoneStyle
  notes: string                       // Speaker Notes (MVP: leer)
}

export interface ZoneStyle {
  layout: 'center' | 'hero' | 'top' | 'split' | 'full'
  padding: string
  background: string | null
  text_align: 'left' | 'center' | 'right'
}

export const DEFAULT_TOKENS: DesignTokens = {
  'color-primary': '#6366f1',
  'color-secondary': '#818cf8',
  'color-bg': '#0f0f0f',
  'color-surface': '#1a1a2e',
  'color-text': '#f1f5f9',
  'color-accent': '#e94560',
  'font-heading': 'Cal Sans',
  'font-body': 'Inter',
  'font-size-base': '1rem',
  'spacing-base': '1rem',
  'border-radius': '0.5rem',
}

export const DEFAULT_ZONE_STYLE: ZoneStyle = {
  layout: 'center',
  padding: '4rem',
  background: null,
  text_align: 'left',
}
```

---

## 9. Tiptap Extensions

Folgende Tiptap Extensions werden verwendet:

```typescript
// Standard
import StarterKit from '@tiptap/starter-kit'
// Markdown Import/Export
import { Markdown } from 'tiptap-markdown'
// Zusatz
import Placeholder from '@tiptap/extension-placeholder'
import Typography from '@tiptap/extension-typography'
```

**Wichtig:** `tiptap-markdown` übernimmt die Markdown ↔ Tiptap-JSON Konvertierung. Kein custom Parser nötig.

**HTML-Zonen (siehe Abschnitt 14):** Für Zones mit `content_type: 'html'` wird statt Tiptap ein CodeMirror-6-Editor genutzt.

```typescript
import { EditorView, basicSetup } from 'codemirror'
import { html } from '@codemirror/lang-html'   // bringt eingebettetes CSS + JS Highlighting mit
```

---

## 10. MCP Server Setup (Rust)

Der MCP Server nutzt das `rmcp` Crate (offizielles Rust MCP SDK).

```toml
# Cargo.toml relevante Dependencies
[dependencies]
tauri = { version = "2", features = ["shell-open"] }
rmcp = { version = "0.1", features = ["server", "transport-io"] }
serde = { version = "1", features = ["derive"] }
serde_json = "1"
uuid = { version = "1", features = ["v4"] }
zip = "0.6"
tokio = { version = "1", features = ["full"] }
```

**Claude Desktop Config** (wird beim App-Start automatisch eingetragen):
```json
{
  "mcpServers": {
    "slideo": {
      "command": "/Applications/Slideo.app/Contents/MacOS/slideo-mcp",
      "args": []
    }
  }
}
```

---

## 11. Build-Reihenfolge (MVP)

Baue in dieser Reihenfolge. Jeder Schritt ist eigenständig testbar bevor der nächste beginnt.

### Phase 1 – Foundation (Woche 1)
1. Tauri 2 Projekt scaffolden (`create-tauri-app`)
2. React + TypeScript + Vite + Tailwind einrichten
3. TypeScript Typen anlegen (`types/index.ts`)
4. Zustand Store anlegen (ohne Tauri-Integration, nur in-memory)
5. `.slideo` Dateiformat: Reader + Writer in Rust implementieren
6. Einfacher Test: Datei schreiben, lesen, wieder schreiben

### Phase 2 – Editor (Woche 1-2)
7. Tiptap mit `tiptap-markdown` einrichten
8. `ZoneCard` Komponente: Card-Wrapper + Tiptap Editor
9. `EditorCanvas`: alle ZoneCards in einem Scroll-Container
10. Drag & Drop Reordering der ZoneCards (dnd-kit)
11. Zone hinzufügen / löschen via UI
12. Token Editor Sidebar: einfache Input-Felder für alle Tokens
13. Live-Preview: HTML-Renderer implementieren, Vorschau neben Editor

### Phase 3 – Präsentationsmodus (Woche 2)
14. Vollständige HTML-Page aus allen Zones rendern
15. `PresentationMode`: Fullscreen Iframe der die HTML-Page zeigt
16. Navigation zwischen Slides (Tastatur: Pfeiltasten, Leertaste)
17. Speaker View: zweites Fenster mit Vorschau + Slide-Nummer

### Phase 4 – MCP Server (Woche 3)
18. MCP Server Grundstruktur in Rust (`rmcp`)
19. AppState zwischen Tauri Backend und MCP Server teilen
20. Tools implementieren in dieser Reihenfolge:
    - `get_all_zones`, `get_zone`, `get_zone_content`
    - `create_zone`, `set_zone_content`, `delete_zone`
    - `get_tokens`, `set_token`, `set_tokens_bulk`
    - `save_presentation`, `get_presentation_meta`
    - Restliche Tools
21. Claude Desktop Config automatisch eintragen
22. End-to-End Test: Claude Desktop baut eine komplette Präsentation via MCP

### Phase 5 – Polish (Woche 4)
23. Onboarding: leere State wenn keine Datei offen
24. Unsaved Changes Warning
25. Keyboard Shortcuts (Cmd+S, Cmd+Z, Cmd+N)
26. Basis-Fehlerbehandlung im MCP Server
27. App Icon + Name
28. Build für macOS, Windows, Linux testen

---

## 12. Was explizit NICHT im MVP ist

> **Hinweis:** Der MVP ist abgeschlossen. Mehrere der ursprünglichen „Nicht-MVP"-Punkte sind inzwischen umgesetzt (HTML-Zonen §14, Assets inkl. Video/Audio §15, Layouts §16, Custom-CSS §17) oder konkret **für die nächste Session geplant** (Speaker-Notes-UI, Export, Transitions, Themes, Asset-Positionierung, Komponenten — siehe **§18 Roadmap**). Aktueller Gesamtstand: `docs/project-status.md`, To-dos: `docs/next-steps.md`.

Weiterhin bewusst zurückgestellt (nach §18):

- Kollaboratives Editing
- Versionsverlauf / Git-Integration UI
- Custom Fonts Upload
- PPTX-Export (HTML- und PDF-Export sind in §18.4 geplant)
- Visueller WYSIWYG-Editor für HTML-Zones (HTML-Zones nutzen bewusst nur den CodeMirror-Editor, siehe §14)
- Free-Canvas-Positionierung „Large" (§18.1) — nur bei echtem Bedarf

---

## 13. Konventionen für KI-gestützte Entwicklung

Wenn du (die KI) an diesem Projekt arbeitest, halte dich an folgende Regeln:

1. **Dieses Dokument ist die Wahrheit.** Bei Widersprüchen zwischen diesem Dokument und dem bestehenden Code, frage den Entwickler bevor du entscheidest.

2. **Markdown ist das primäre Content-Format.** Schreibe niemals direkt Tiptap-JSON wenn du Slide-Inhalt erstellst. Immer Markdown → `tiptap-markdown` konvertiert.

3. **Kein Provider-SDK im Frontend, Schreiben nur über MCP.** Die App hat keine Anthropic-/OpenAI-/Ollama-Calls. Deck-Mutationen laufen ausschließlich über den MCP-Server. **Ausnahme (2026-08, §27):** der optionale In-App-Chat nutzt `@cursor/sdk` in einem **Node-Sidecar** (nicht im WebView). Der Agent darf nur MCP + Lesen (`read`/`grep`/`glob`/`ls`), nicht `shell`/`edit`/`write`. Abrechnung über das Cursor-Konto der nutzenden Person.

4. **State lebt im Zustand Store.** Kein lokaler React-State für Präsentations-Daten. Alles durch den Store.

5. **Rust für I/O, React für UI.** Datei-Operationen, MCP Server, Prozess-Management → Rust. Alles was der Nutzer sieht → React.

6. **UUIDs für Zone-IDs.** Immer `uuid::Uuid::new_v4()` in Rust bzw. `crypto.randomUUID()` in TypeScript.

7. **Keine Breaking Changes am Dateiformat ohne Versionierung.** Das `version` Feld in `presentation.json` existiert für diesen Zweck.

---

## 14. Erweiterung: Interaktive Zonen / Custom HTML Content Type

**Hintergrund und Entscheidung:**
Das ursprüngliche Konzept sieht `markdown` als einziges Content-Format pro Zone vor. Das reicht für Text-Slides, deckt aber einen zentralen Vorteil von Slideo nicht ab: weil Zones am Ende gerenderte HTML sind, kann eine Zone prinzipiell alles was ein Browser kann – SVG-Animationen, interaktive Charts, Dropdowns, JavaScript-gesteuerte Visualisierungen, eingebettete Demos. PowerPoint kann das nicht. Um diesen Vorteil nutzbar zu machen ohne das Markdown-System zu brechen, wird ein zweiter Content-Typ eingeführt.

**Änderung am Datenmodell (`types/index.ts` und `presentation.json`):**

Das `Zone`-Interface bekommt ein `content_type`-Feld:

```typescript
export interface Zone {
  id: string
  label: string
  order: number
  content_type: 'markdown' | 'html'  // NEU
  markdown: string                    // genutzt wenn content_type === 'markdown'
  html: string | null                 // NEU: genutzt wenn content_type === 'html'
  style: ZoneStyle
  notes: string
}
```

Default bei neuen Zones ist immer `content_type: 'markdown'`, `html: null`.

**Änderung am Renderer:**
Der Renderer prüft `content_type` bevor er rendert. Bei `markdown` läuft die bestehende Pipeline (Markdown → HTML). Bei `html` wird `zone.html` direkt ohne Konvertierung in das Zone-Template eingesetzt. `<script>`-Tags werden **nicht** gefiltert – volle Browser-Fähigkeiten sind gewünscht.

**Änderung am Editor (`ZoneCard.tsx`):**
Eine Zone mit `content_type: 'html'` zeigt statt Tiptap einen CodeMirror-Editor (HTML/CSS/JS Syntax-Highlighting). Die Card bekommt ein visuell klar unterscheidbares Styling – z.B. einen farbigen Rahmen oder ein „Custom HTML"-Badge – damit der Nutzer sofort erkennt dass er sich in einem anderen Modus befindet. Ein Toggle-Button in der `ZoneToolbar` erlaubt das Umschalten zwischen den beiden Typen. Beim Umschalten von `markdown` auf `html` wird der aktuelle Markdown-Inhalt als einfaches HTML vorkonvertiert und in `html` geschrieben, damit nichts verloren geht. Beim Umschalten zurück auf `markdown` wird gewarnt dass der HTML-Inhalt nicht vollständig rückkonvertiert werden kann.

**Änderung am MCP Server (`set_zone_content`):**
Siehe das aktualisierte Tool-Schema in Abschnitt 5. `content_type` + `content` ersetzen das alleinige `markdown`-Feld; die KI wählt den Typ selbst.

**Neue Dependency für den Editor:**
CodeMirror 6 (`codemirror`, `@codemirror/lang-html` – bringt eingebettetes CSS- und JS-Highlighting mit) für den HTML-Zone-Editor.

**Nicht im MVP:**
Ein visueller WYSIWYG-Editor für HTML-Zones. HTML-Zones sind bewusst für die KI oder technisch versierte Nutzer gedacht. Der CodeMirror-Editor ist die UI dafür.

**Sicherheitshinweis (bewusste Entscheidung):**
HTML-Zonen führen beliebiges JavaScript im Präsentations-Iframe aus. Das ist gewollt (lokale App, Inhalte stammen vom Nutzer bzw. dessen eigener KI). Der Iframe bleibt aber vom App-Chrome isoliert; die App selbst exponiert keine Tauri-APIs in den Iframe.

---

## 15. Assets (Bilder)

**Entscheidung:** Bilder werden als echte Dateien im `assets/`-Ordner des `.slideo`-ZIP gespeichert (nicht als base64 in `presentation.json`). Das hält die Datei kompakt und git-freundlich.

**Datenfluss:**
- **Import:** Datei wird im Frontend als Data-URI gelesen (`FileReader`), unter einem eindeutigen Namen (`img-<id>.<ext>`) in die Laufzeit-Asset-Map aufgenommen; in den Zone-Inhalt wird eine Referenz `assets/<name>` eingefügt (Markdown `![](assets/…)` bzw. HTML `<img src="assets/…">`).
- **Rendern:** Der Renderer ersetzt `assets/<name>` durch die Data-URI, da der isolierte Iframe keinen Dateizugriff hat.
- **Speichern/Laden:** Rust schreibt die Assets als Binärdateien ins ZIP bzw. liest sie (base64-kodiert) zurück. Der MCP-Server hält die Asset-Map gespiegelt, damit MCP-Saves Bilder nicht verlieren.

**Datenmodell:** Assets sind NICHT Teil von `presentation.json` — sie leben als separate ZIP-Einträge und werden über das Frontend (Asset-Map) bzw. den AppState verwaltet. Die `.slideo`-Datei ist ein ZIP (eine Datei, kein Ordner) — Assets kommen also über die App hinein (per-Zone-Import oder Settings → Assets), nicht durch manuelles Ablegen in einem Ordner.

**KI-Zugriff:** Die KI entdeckt vorhandene Assets über das MCP-Tool `list_assets` (liefert Name + MIME) und referenziert sie als `assets/<name>`. So kann der Mensch Assets vorab in der App hinterlegen, die die KI dann einbaut.

**Medientypen:** Assets können Bilder, Video und Audio sein (MIME-Erkennung in `file::guess_mime`). Bilder gehen per Markdown `![](assets/x)` ODER HTML. Video/Audio brauchen HTML-Tags (`<video controls src="assets/x.mp4">`, `<audio controls src="assets/x.mp3">`) und funktionieren daher nur in HTML-Zonen — in Markdown-Zonen würde Tiptap rohes Medien-HTML beim Bearbeiten verwerfen.

**Auflösung der Asset-Referenzen beim Rendern (gemischt):**
- **Bilder** → Data-URI (inline; klein und zuverlässig, auch im sandboxed Iframe).
- **Video/Audio** → **Custom-Protocol-URL** `slideoasset://localhost/<name>` (Windows: `http://slideoasset.localhost/<name>`). Ein in `lib.rs` registrierter URI-Scheme-Handler streamt die Bytes on-demand aus dem AppState — so müssen große Medien NICHT als base64 ins HTML inline. Im reinen Browser-Dev (kein Tauri) Fallback auf Data-URI.

**Noch offen (Post-MVP):** Drag&Drop-Import in den Editor, Umbenennen von Assets, automatisches Aufräumen ungenutzter Assets.

---

## 16. Markdown-Layouts & integrierte „Agenten-Skill"

**Reiche Layouts (bleiben editierbares Markdown).** `set_zone_style.layout` kennt zusätzlich:
- `hero` — große, zentrierte Titel-Folie (Auftakt).
- `split` — zwei Spalten. Der Markdown der Zone wird an einer eigenen Zeile `+++` getrennt; jede Seite wird in eine Spalte gerendert. Eine Spalte kann ein Bild sein (`![](assets/…)`). Deckt „Zwei-Spalten" und „Bild+Text" mit editierbarem Markdown ab — ohne HTML.

**KI-Steuerung über MCP.** Der MCP-Server steuert die KI Richtung Markdown-first und token-bewusstes HTML — auf zwei Wegen:
1. **`instructions`** im `initialize`-Response (automatischer Nutzungshinweis): bevorzuge Markdown + Tokens + Layouts; HTML nur für Interaktives; und WENN HTML, dann ausschließlich über die Token-CSS-Variablen, damit der Mensch auch HTML-Folien global umgestalten kann.
2. **MCP-Prompt `slideo_guide`** (`prompts/list` + `prompts/get`): ein aufrufbarer Leitfaden (mit optionalem `thema`-Argument), den der Nutzer in Claude Desktop als Prompt/Slash-Command starten kann, um die KI vollständig zu briefen. Das ist die in Slideo integrierte „Agenten-Skill".

**Editierbarkeits-Prinzip:** Struktur darf KI-generiert sein, das Look & Feel bleibt menschlich steuerbar — solange HTML die Design-Tokens (CSS-Variablen) nutzt, wirkt die Token-Sidebar weiterhin global, auch auf HTML-Folien.

---

## 17. Zonen-Custom-CSS (gestylter, aber editierbarer Text)

**Problem:** Custom-Styling drängt sonst zu HTML-Zonen, deren Text für Menschen schwer editierbar ist.

**Lösung:** Jede Zone hat ein Feld `custom_css` (separat vom Inhalt). Der Markdown-Text bleibt sauber lesbar/editierbar; das CSS lebt daneben (eigenes CSS-Panel in der ZoneCard, einklappbar).

**Scoping:** Der Renderer scoped das CSS automatisch auf die jeweilige Zone (`#zone-<id> <selector>`), damit es nicht auf andere Folien überläuft. `@media`/`@supports`/`@container`/`@layer` werden rekursiv gescoped; `@keyframes`/`@font-face` bleiben global. Selektoren beziehen sich auf den Folieninhalt (z.B. `h1 { … }`, `.slideo-content p { … }`). Da der Scope eine ID enthält, schlägt Custom-CSS die Token-Default-Styles.

**MCP:** `set_zone_css(id, css)`. Empfehlung an die KI (in `instructions`): für gestylten, aber editierbaren Text **Markdown + set_zone_css** statt HTML — und CSS möglichst mit Token-Variablen (`var(--color-accent)` …), damit es themebar bleibt.

---

## 18. Roadmap: geplante Features (nächste Session)

> Diese Features sind **geplant** und sollen in der nächsten Session integriert werden. Jeder Punkt nennt **Status**, **konkreten Plan** (Datenmodell / Store / Renderer / MCP / UI) und **Aufwand**. Empfohlene Reihenfolge in §18.8. Datenmodell-Erweiterungen additiv halten und `version` ggf. auf "1.1" anheben (abwärtskompatibel laden, §13.7).
>
> **STAND (umgesetzt in dieser Session):** §18.2 Speaker-Notes ✅ · §18.3 Transitions ✅ · §18.4 HTML-Export ✅ + PDF-Export ✅ · §18.5 Teilen ✅ (= HTML-Export) · §18.6 Themes/Presets ✅ · §18.1 **Light** (Bild-Positionierung) ✅ (Medium/Large offen) · §18.7 (A) Agenten-Skill ✅ + (B) Komponenten-Bibliothek ✅ (MCP + Rust-Generator; UI-Palette offen). MCP-Tools jetzt **29** (war 23). Datenmodell additiv erweitert (`meta.transition`, Bild-Attribute `width/align/float` via rohes `<img>`); `version` bewusst bei "1.0" belassen (alles optional & Value-basiert, abwärtskompatibel). Quelle-der-Wahrheit-Spiegel: Presets ([src/lib/presets.ts](../src/lib/presets.ts) ↔ [src-tauri/src/presets.rs](../src-tauri/src/presets.rs)); Komponenten nur in Rust ([src-tauri/src/components.rs](../src-tauri/src/components.rs)). **GUI-Verifikation steht aus** (Bubble-Toolbar, Transition-Animationen, PDF-Druck im WKWebView) — siehe [next-steps.md](next-steps.md).

### 18.1 Asset-/Element-Positionierung

**Philosophie (wichtig):** Slideo ist bewusst **fluss-basiert** (Markdown/HTML-Fluss + Layouts/Tokens), nicht **frei-positioniert** (absolute x/y wie PowerPoint/Canva). Das ist **kein Versäumnis**: Gamma (Marktführer) macht es absichtlich genauso — sauberer, responsiver, KI-freundlicher. Preis: kein pixelgenaues Schieben. Wir bauen **Light + Medium**; der Full-Canvas (Large) bleibt vorerst zurückgestellt.

**Drei Ausbaustufen:**

- **Bild-Resize (stufenlos) — ✅ UMGESETZT:** Anfasser an der rechten Bildkante **in der Vorschau** (Pointer-Events) setzt die Breite stufenlos in `%` (`slideo:resize-image` → Store `resizeZoneImage` → `setBlockImageWidth` schreibt `<img style="width:NN%">`). Bleibt flussbasiert. Ergänzt die S/M/L/Voll-Presets der Bubble-Toolbar.
- **Light (klein) — ✅ UMGESETZT:** Ausrichtungs-/Größen-Helfer für Bilder (links / zentriert / rechts, Float mit Textumfluss, Größe S/M/L/voll). Bleibt im Fluss, deckt ~80 %.
  - *Umsetzung:* Tiptap-`Image`-Extension um Attribute `width` (z.B. `"50%"`) und `align`/`float` erweitern. Floating-Toolbar erscheint bei selektiertem Bild. **Persistenz:** Bilder mit Nicht-Default-Attributen werden als `<img src="…" style="width:50%" class="align-right">` (statt `![]()`) serialisiert — markdown-it (`html:true`) rendert das, Tiptap parst `width`/`align` zurück (round-trip-sicher). Default-Bilder bleiben `![]()`.
  - *Renderer:* Klassen `.align-left/center/right`, `.float-left/right` + `img`-Größen ins SLIDE_CSS.

- **Medium — ✅ UMGESETZT (Block-Drag in der Vorschau + Spalten-UI):** Blöcke per **Drag in der interaktiven Vorschau** umsortieren — dort, wo das echte Design sichtbar ist (bewusste Entscheidung: der Editor-Markdown-Fluss zeigt das Layout nicht, ein erster Editor-Handle-Ansatz via `tiptap-extension-global-drag-handle` wurde deshalb wieder entfernt). Mechanik: `renderFullPage({editable:true})` umhüllt jeden Top-Level-Block (`splitMarkdownBlocks` über markdown-it-Token-Grenzen) mit Drag-Handle + Index; das injizierte Drag-Script (**Pointer-Events**, NICHT HTML5-DnD — WKWebView unterstützt natives `draggable`/`drop` nicht zuverlässig) meldet die neue Reihenfolge an den Parent (`slideo:reorder-blocks`) → Store `reorderZoneBlocks` schreibt das Markdown neu ([PreviewPane.tsx](../src/components/preview/PreviewPane.tsx)). Plus Spalten-Slots über das `split`-Layout: der Layout-Dropdown verwaltet den `+++`-Trenner automatisch (Store `setZoneLayout`). **Noch offen (Richtung Large):** Drag *zwischen* den Spalten; nicht-`split`-Markdown-Zonen only (HTML/split-Zonen ohne Block-Drag).
  - *Umsetzung (in-flow, ohne neues Datenmodell):* Tiptap-Block-Drag-Handles (Reihenfolge von Absätzen/Bildern/Listen per Drag). Plus „Slot"-Platzierung über das bestehende `split`-Layout (zwei Spalten via `+++`) — als **UI-Buttons** statt manueller `+++`-Zeile, mit Drag zwischen den Spalten. Snap = Spalten/Grid.
  - *Datenmodell-Hinweis:* Bleibt zunächst im Markdown-Fluss (**kein** x/y). Erst wenn echtes Grid-Placement gewünscht ist, kommt ein optionales `blocks`-Array (Grid-Koordinaten col/row/span) — bewusst als **eigener Schritt** (Migration!).

- **Large (zurückgestellt):** Echter **Free-Canvas-Modus** als eigener Zonen-Typ: `blocks` mit absolutem `{x,y,w,h,z}`, Drag/Resize/Snap/Z-Order/Selektion. Substanzielles Feature, ändert das Datenmodell deutlich. **Nur bauen**, wenn die Speaker/Creator-Zielgruppe es wirklich verlangt.

*Aufwand:* Light klein · Medium medium · Large groß.

### 18.2 Speaker Notes — fertigstellen
- *Status:* ✅ **UMGESETZT.** Notizen-Panel pro Zone (ZoneCard, analog Custom-CSS), `updateZoneNotes`, MCP-Tool `set_zone_notes`.
- *Plan:* Editier-UI als **einklappbares „Notizen"-Panel pro Zone** (analog zum Custom-CSS-Panel; einfaches Textarea). Store: `updateZoneNotes(id, notes)`. MCP: `set_zone_notes(id, notes)` (das `notes`-Feld ist in `get_zone` bereits enthalten).
- *Aufwand:* klein.

### 18.3 Folien-Transitions
- *Status:* ✅ **UMGESETZT.** `meta.transition = { kind: none|fade|slide|zoom, duration_ms }`. Renderer schaltet im Präsentations-/Standalone-Modus von Scroll-Snap auf „Aktiv-Folie-Deck" (gestapelte Folien, `is-active`/`is-prev`, richtungsabhängiges `data-dir` für slide). MCP `set_transition`. UI-Picker im Design-Tab.
- *Plan:* Präsentations-weiter Übergang `none|fade|slide|zoom` (+ Dauer) in `meta` (z.B. `meta.transition`). Im Präsentationsmodus von reinem Scroll-Snap auf „eine Folie aktiv + CSS-Transition beim Wechsel" umstellen (oder Snap beibehalten + Cross-Fade-Overlay). In-Folien-Element-Animationen vorerst über HTML-Zonen (CSS `@keyframes` funktioniert schon). MCP: `set_transition(kind, duration_ms)`.
- *Aufwand:* klein–medium (ändert das Navigationsmodell von `PresentationMode`).

### 18.4 Export (PDF / self-contained HTML)
- *Status:* ✅ **UMGESETZT.** HTML: `renderStandalonePage` (alle Assets inline, Klick-/Tastatur-Nav) → Tauri-Command `export_html`. PDF: `renderPrintPage` (jede Zone = 16:9-Seite via `@page`/`page-break`). **Wichtig:** WKWebView kann `window.print()` nicht zuverlässig — daher schreibt der Tauri-Command `open_print_view` die print-Page in eine Temp-Datei und öffnet sie im **Standardbrowser** (dort Cmd/Strg+P → „Als PDF sichern"); im reinen Browser-Dev wird direkt per Iframe gedruckt. Beide im Topbar („Teilen", „PDF").
- *Plan:*
  - **HTML-Export:** `renderFullPage` erzeugt schon die volle Page. Für den Export **alle Assets als Data-URI inlinen** (auch Video — standalone-tauglich) + Navigations-Script → **eine einzige `.html`-Datei**, die in jedem Browser läuft. Frontend generiert den String, Tauri-Command schreibt die Datei.
  - **PDF-Export:** Print-Variante des Renderers (jede Zone = eine Seite via `@page`/`page-break`, 16:9), dann WebView-Druck → „Als PDF sichern" bzw. headless print-to-pdf.
  - MCP (optional): `export_html(path)`, `export_pdf(path)`.
- *Aufwand:* HTML klein–medium · PDF medium.

### 18.5 Teilen
- *Status:* keiner.
- *Plan:* Fällt zunächst mit dem **HTML-Export** zusammen — die self-contained `.html` **ist** das teilbare Artefakt (verschicken oder hosten). Späterer Ausbau: optionaler Hosted-Link-Dienst (außerhalb des Local-Ethos, separat zu entscheiden).
- *Aufwand:* kommt mit Export.

### 18.6 Themes / Presets
- *Status:* ✅ **UMGESETZT.** 5 Presets (editorial, dark-tech, warm, minimal, corporate) als Token-Bündel; Theme-Picker in der Token-Sidebar; Store `applyPreset`; MCP `list_presets`/`apply_preset`. Quelle-der-Wahrheit-Spiegel TS ([presets.ts](../src/lib/presets.ts)) ↔ Rust ([presets.rs](../src-tauri/src/presets.rs)).
- *Plan:* Set **vordefinierter Token-Bündel** (z.B. „Editorial", „Dark Tech", „Warm", „Minimal", „Corporate") als JSON, optional inkl. passender Default-Fonts/Layouts. UI: Theme-Picker in der Token-Sidebar → Preset anwenden (`setTokensBulk`). Store: `applyPreset(name)`. MCP: `list_presets`, `apply_preset(name)`.
- *Aufwand:* klein–medium.

### 18.7 Interaktivität: Agenten-Skill erweitern + fertige Komponenten

**Ziel:** Die *Fähigkeit* ist da (HTML-Zonen können alles, was ein Browser kann); was fehlt, ist **Zugänglichkeit** — die KI soll die Möglichkeiten *kennen*, und es soll **fertige, token-bewusste Komponenten** geben, die KI und Mensch per Aufruf einsetzen.

> *Status:* ✅ **(A) UMGESETZT** (Agenten-Skill: `server_instructions` + `slideo_guide` briefen jetzt Komponenten, volles Interaktivitäts-Repertoire, Bild-Positionierung, Notes, Presets, Transitions). ✅ **(B) UMGESETZT** als MCP + Rust-Generator: [components.rs](../src-tauri/src/components.rs) mit 10 Komponenten (stat_cards, bar_chart, line_chart, donut_chart, progress, quote, timeline, comparison, callout, icon — Charts via §19.2), MCP `list_components`/`insert_component`. ✅ **UI-Palette UMGESETZT** ([ComponentPaletteModal.tsx](../src/components/modals/ComponentPaletteModal.tsx)): nutzt **denselben** Rust-Generator über die Tauri-Commands `list_components`/`render_component` ([commands.rs](../src-tauri/src/commands.rs)) — **keine** Template-Duplikation. Katalog kommt zur Laufzeit aus Rust (neue Komponenten erscheinen automatisch); in TS lebt nur das **Eingabe-Formular-Schema** ([component-forms.ts](../src/lib/component-forms.ts)). Parameter-Formulare (inkl. Daten-Tabelle für Charts) + **Live-Vorschau** (sandboxed Iframe, token-gefärbt). Geöffnet aus ZoneToolbar/Topbar; Einfügen als neue Folie / anhängen / ersetzen (nicht-leere Markdown-Folie wird nie überschrieben).

**(A) Agenten-Skill erweitern** (`slideo_guide` + `instructions`):
- Die KI explizit über das **volle Interaktivitäts-Repertoire** briefen: Charts (SVG/JS), Animationen (CSS/JS), eingebettete Player, interaktive SVGs, Diagramme, Timelines, Vergleiche — und **wie**: in HTML-Zonen, **immer mit Token-CSS-Variablen**, klein/wartbar halten.
- Auf die Komponenten-Bibliothek (B) und `list_components`/`insert_component` verweisen.

**(B) Komponenten-Bibliothek** (token-bewusst, wieder-themebar):
- Set kuratierter HTML/SVG/CSS-Snippets, die Tokens nutzen: z.B. Balken-/Linien-/Kreis-Diagramm, Stat-Cards/KPIs, Fortschrittsbalken, Countdown/Timer, Toggle/Accordion, Bild-Carousel, Icon-Grid, Zitat-Block, Vergleich (zwei Spalten), Timeline, QR-Code, Video-Player mit Steuerung.
- *Datenfluss (eine Quelle der Wahrheit):* Templates an **einer** Stelle (Rust, z.B. `src-tauri/src/components.rs`) als Funktionen `(params) -> HTML`.
  - MCP: `list_components` (Namen + Parameter) und `insert_component(zone_id, type, params)` → generiert HTML (mit Token-Variablen) und setzt/fügt es als HTML-Zone ein.
  - UI (✅ umgesetzt): eine **„Komponenten"-Palette** im Editor, die **denselben** Rust-Generator über die Tauri-Commands `list_components`/`render_component` nutzt (keine Template-Duplikation TS/Rust) — mit Parameter-Formularen + Live-Vorschau.
- *Prinzip:* Jede Komponente nutzt ausschließlich `var(--color-*)`/`var(--font-*)` → bleibt über die Token-Sidebar global themebar.
- *Aufwand:* medium–groß (das Kuratieren guter, token-bewusster Komponenten ist die eigentliche Arbeit).

### 18.8 Empfohlene Reihenfolge (nächste Session)
1. **Speaker-Notes-Editor** + `set_zone_notes` (klein, rundet ab).
2. **Export self-contained HTML** + **Teilen** (macht es benutzbar/teilbar).
3. **Themes/Presets** (schneller „Wow"-Effekt, klein).
4. **Folien-Transitions** (viel Wirkung, mittel).
5. **Asset-Positionierung Light** (Bild-Toolbar), dann **Medium** (Block-Drag).
6. **Interaktivität:** Agenten-Skill erweitern + **Komponenten-Bibliothek** (iterativ wachsen lassen).
7. **PDF-Export** (medium).

## 19. Roadmap II — Richtung „vollwertige Präsentationssoftware"

> Nächstes Programm nach §18 (Markt-Lückenanalyse vs. PowerPoint/Keynote/Slides, Gamma/Pitch/Beautiful.ai, reveal.js). Sequenziell umsetzen, v1-Scope je Punkt, additive Datenmodell-Erweiterungen. Interaktionslastige Teile brauchen GUI-Verifikation durch den Menschen.

### 19.2 Daten-Diagramme (echte Charts) — ✅ UMGESETZT (v1)
- ✅ Komponenten-Bibliothek ([components.rs](../src-tauri/src/components.rs)) um `line_chart` + `donut_chart` erweitert (zusätzlich zum `bar_chart`) — token-bewusste SVGs aus Daten `[{label, value}]`, eingesetzt via `insert_component`. 9 Komponenten gesamt, cargo-getestet.
- ✅ Visueller Daten-Editor: Die Komponenten-Palette (§18.7) hat ein Tabellen-Formular für Chart-Daten `[{label, value}]` — der Mensch kann Diagramme ohne KI einsetzen und live justieren.

### 19.7 Barrierefreiheit — ✅ UMGESETZT
- ✅ Alt-Text-Feld an der Bild-Toolbar ([ImageToolbar.tsx](../src/components/editor/ImageToolbar.tsx)) → schreibt `![alt](…)` bzw. `<img alt="…">` (round-trip über SlideoImage).
- ✅ WCAG-Kontrast-Check (Text/Bg, Accent/Bg) im Design-Tab ([contrast.ts](../src/lib/contrast.ts) + TokenEditor), Badge AA/AAA/zu-niedrig.

### 19.1 In-Folien-Animationen (Builds + Auto-Animate) — *Flagship*
- ✅ **Builds (Schritt-Einblenden) UMGESETZT:** Zone-Flag `reveal:'steps'` (additiv, optional). Renderer umhüllt Top-Level-Blöcke als `.slideo-fragment` (nur In-App-Präsentation, nicht Standalone/Vorschau). **Parent-autoritative Navigation:** PresentationMode hält `activeSlideIndex` + `activeStep`, sendet `slideo:show {index, step}` an das (nicht fokussierte) Audience-Iframe; das Iframe hat KEINE eigene Tastatur mehr (nur der Standalone-Export). Vorwärts = nächstes Fragment ODER nächste Folie; Speaker-View zeigt „Schritt s/n". MCP `set_zone_reveal`, UI-Toggle (⚡/animation) in der ZoneToolbar. (MCP-Tools inzwischen 35.) Tsx-verifiziert; GUI-Prüfung steht aus.
- ✅ **Auto-Animate/Morph UMGESETZT (v1):** neuer deck-weiter Übergangstyp `auto` (`meta.transition.kind`, additiv). Elemente mit **gleichem `data-id`** auf benachbarten Folien morphen per **FLIP** (Position/Größe) ineinander; Matching ausschließlich über explizites `data-id` (keine Heuristik). Die aktive Folie wird sofort sichtbar (Magic-Move-Stil, am besten bei gleichem Hintergrund); nicht-benachbarte Sprünge schalten hart um. **`data-id` vergeben:** in HTML-Zonen direkt oder via `insert_component(data_id)` / Palette-Feld (Wrapping single-source in Rust `components::with_data_id`, sanitisiert). Läuft im geteilten Nav-Script → **In-App-Präsentation + Standalone-Export** (Vorschau bleibt statisch). Reines JS+CSS im Iframe (FLIP-Transforms sind im WKWebView zuverlässig). MCP `set_transition(kind:'auto')`. **v1-Grenzen:** Markdown-Zonen können kein `data-id` tragen (cross-faden nur — für Morph per „HTML"-Toggle umschalten); Elemente in noch nicht eingeblendeten Builds morphen nicht.
- **v1-Grenzen:** Builds nur in der In-App-Präsentation (Standalone-`.html` zeigt alles statisch); Speaker-Preview zeigt die Folie voll (Schritt nur als Zähler).

### 19.3 Präsentier-Werkzeuge — *medium; Zweitfenster medium–groß*
- ✅ **Folien-Übersicht / Sprung-Grid UMGESETZT:** Taste `g` (oder Steuerleisten-Button) → Raster aller Folien über der Präsentation ([SlideOverview.tsx](../src/components/presentation/SlideOverview.tsx)); Klick/Enter springt zur Folie (Schritt 0), Pfeiltasten bewegen die Auswahl, `g`/`Esc` schließt. Thumbnails sind statische Single-Zone-Pages (`renderSingleZonePage`, kein Nav-Script) → leichtgewichtig; Iframe `pointer-events:none`, der umschließende Button fängt den Klick.
- ✅ **Laser-/Stift-Overlay UMGESETZT:** Canvas über der Audience-Folie ([AnnotationLayer.tsx](../src/components/presentation/AnnotationLayer.tsx)), **Pointer-Events**; Laser = flüchtiger Leucht-Komet (rAF-Schweif), Stift = bleibende Striche; Farbe aus `--color-accent`. Tasten `l`/`p` (toggeln), `c` löscht; Annotationen werden bei Folienwechsel/Löschen via Remount (`key`) geleert. Overlay nur über der Audience-Folie (nicht Speaker-View).
- ✅ **Auto-Advance / Kiosk-Loop UMGESETZT:** Taste `a` startet/stoppt; Sekunden pro Schritt wählbar (Steuerleiste, 3–20 s); am Ende → Schleife (Loop-Toggle) oder Stopp. Advanced wird über `doStep(1)` (build-bewusst), pausiert bei offener Übersicht. **v1:** globales Intervall (Präsentationszeit-State, nicht persistiert) statt per-Folie-Timings.
- ✅ **Echtes Zweitfenster UMGESETZT (v1; ÖFFNEN/VOLLBILD später [§26](#26-remote-präsentation-auf-einem-bildschirm-teilbares-folien-fenster) vereinheitlicht — Monitor-Dropdown + `list_monitors`/`open_presentation_window` entfernt, jetzt `open_share_window` + `set_projector_fullscreen`; ProjectorView/Event-Sync gelten weiter):** separates Tauri-Fenster „projector" zeigt die Folien **randlos bildschirmfüllend** auf dem gewählten Monitor; das Hauptfenster bleibt Steuerpult (SpeakerView + Tastatur). [present.rs](../src-tauri/src/present.rs) (`list_monitors`/`open_presentation_window`/`close_presentation_window`), [ProjectorView.tsx](../src/components/presentation/ProjectorView.tsx) (Folien-Iframe, Deck aus `AppState` via `get_presentation`/`get_assets`), Sync über Tauri-Events (`slideo:nav`/`slideo:deck-changed`/`slideo:projector-ready`/`slideo:projector-closed`); eigene [Capability](../src-tauri/capabilities/projector.json). Bewusst **randloses Fenster statt nativem Vollbild** (macOS-Vollbild landet sonst auf dem falschen Display). Ein-Fenster-Modus (`s`) bleibt. **v1-Grenzen:** Laser/Stift im Zwei-Bildschirm-Modus deaktiviert (Overlay läge nur über der Speaker-Ansicht); Live-Deck-Edits laden das Folien-Fenster kurz neu; Multi-Display-Vollbild/Platzierung braucht GUI-Verifikation auf echter Hardware.

### 19.4 Vorlagen & Marke — *medium*
- ✅ **Custom-Fonts-Upload UMGESETZT:** Font-Datei (woff2/woff/ttf/otf) → Asset in `assets/` + `presentation.fonts` ({family, asset}); Renderer injiziert `@font-face` (Vorschau/Präsentation/Export); im Design-Tab „Schriften"-Upload + Auswahl-Datalist für die Font-Felder ([fonts in renderer.ts](../src/lib/renderer.ts), Store `addFont`). guess_mime kennt Font-Endungen.
- ✅ **Logo/Brand UMGESETZT:** `meta.logo = { asset, position }` (additiv); Renderer zeigt das Logo absolut in der gewählten Ecke **jeder** Folie (auch Export/PDF). Upload + Position + Entfernen im Design-Tab „Logo" (Store `setLogo`/`setLogoPosition`/`clearLogo`). **MCP-Parität:** `set_logo(asset, position?)`/`clear_logo` (asset = vorhandenes Asset aus `list_assets`).
- ✅ **MCP-Parität (Marke/Meta/Schriften):** ein Multi-Agent-Audit (Mensch-Fähigkeiten ↔ MCP-Tools) bestätigte, dass nur Dokument-Felder für Marke/Meta fehlten; ergänzt: `set_presentation_title`, `set_zone_label`, `set_logo`/`clear_logo`, `register_font(family, asset)` (registriert ein vorhandenes Font-Asset als `presentation.fonts`-Eintrag → via `set_token` aktivierbar). **35 MCP-Tools** (mit dem späteren §24-Layout-Check `check_zone_overflow`/`validate_deck` → **37**). Bewusst **nur Mensch:** Binär-Upload/Crop von Assets, lokale Datei-Exporte, Undo/Snapshots, Laufzeit-/Display-Steuerung (Präsentieren, Laser/Stift, Zweitfenster-Routing).
- ✅ **Starter-Templates UMGESETZT:** [templates.ts](../src/lib/templates.ts) — 4 Decks (Leer, Pitch, Vortrag, Editorial) mit Token-Preset + Seed-Zonen (inkl. Layouts + Builds); auswählbar im Neu-Dialog (`newPresentation(title, template)`).
- *Polish:* Font-/Logo-Assets erscheinen aktuell auch in der Settings-Asset-Library als „kaputtes" Thumbnail (eigene Kachel später).

### 19.5 PPTX-Export — ✅ UMGESETZT (v1, native Rekonstruktion)
- ✅ **Native Rekonstruktion** mit `pptxgenjs` ([pptx.ts](../src/lib/pptx.ts)), Topbar „PPTX". **Bewusste Abweichung vom ursprünglich geplanten bild-basierten v1:** WKWebView „verseucht" (taint) das Canvas beim Rastern von HTML (`foreignObject`) → ein In-App-„Folie→PNG" ist auf macOS unzuverlässig (gleiche Klasse wie `window.print()`). Daher bauen wir **echte PPTX-Objekte**: Token-Hintergründe, Textboxen (Überschriften/Listen/Zitate + Bold/Italic/Code-Inline, Spalten-Layout) und Bilder; 16:9 (`LAYOUT_WIDE`). Zuverlässig auf jeder Plattform, voll offline, in PowerPoint **editierbar**. Schreiben: `pptx.write({outputType:'base64'})` → Rust `export_pptx` (base64→Bytes); Browser-Dev lädt per Blob herunter. pptxgenjs ist dynamisch importiert (eigener Chunk, nur beim Export geladen).
- **Grenzen (v1, dokumentiert):** HTML-Zonen werden zu Text vereinfacht (Tags entfernt) + Hinweis; Komponenten/Charts (SVG in HTML-Zonen) und Custom-CSS werden NICHT originalgetreu übernommen; nur `#RGB`/`#RRGGBB`-Token-Farben werden erkannt. Bild-basierter Export (1:1) als optionaler Browser-Offload bleibt ein möglicher Folgeschritt.

### 19.8 Medien & Assets — ✅ TEILWEISE UMGESETZT (v1)
- ✅ **Drag&Drop-Medienimport:** Bild/Video/Audio direkt auf eine Folien-Card ziehen ([ZoneCard.tsx](../src/components/editor/ZoneCard.tsx), HTML5-File-DnD → `addMediaToZone`). In der Desktop-App via `"dragDropEnabled": false` ([tauri.conf.json](../src-tauri/tauri.conf.json)) aktiviert (sonst fängt Tauri den OS-Drop ab und die WebView-Events feuern nicht).
- ✅ **Bild-Crop (non-destruktiv):** Crop-Modal ([CropModal.tsx](../src/components/modals/CropModal.tsx)) mit zieh-/skalierbarem Rechteck (Pointer-Events) → Canvas-Ausschnitt in voller Auflösung → **neues** Asset (Original bleibt). Button in der Bild-Toolbar. Canvas-Crop eines normalen Rasterbildes ist im WKWebView ok (kein foreignObject-Taint).
- ✅ **Icon-Einfügen (Inline-SVG):** Komponente `icon` ([components.rs](../src-tauri/src/components.rs)) — token-gefärbtes Symbol (15 Namen) optional mit Beschriftung, via `insert_component`. Fügt sich ins bestehende Komponenten-System (Single-Source Rust, cargo-getestet).
- ❌ **Aufnahme/Narration + Video-Export — BEWUSST WEGGELASSEN (out of scope):** off-thesis für eine MCP/KI-native App (die KI baut die Präsentation; Aufnahme ist ein Mensch-am-Mikro-Studio-Feature) und der Medien-Bedarf ist bereits gedeckt (Drag&Drop-Import + Audio/Video in HTML-Zonen + `slideoasset://`-Streaming). Zudem die schlimmsten WKWebView-Hürden (getUserMedia-Entitlements, MediaRecorder-Codec-Limits, dieselbe Canvas-Taint-Wand wie beim PPTX-Export). Wird nicht gebaut. „Stock"-Bilder bleiben ebenfalls weg (kein externer Netz-Call; nur lokale Inline-SVG-Icons).

### 19.9 Produktivität — *klein–medium*
- ✅ **Suchen & Ersetzen UMGESETZT:** deck-weites Modal ([FindReplaceModal.tsx](../src/components/modals/FindReplaceModal.tsx)), Live-Trefferzahl, Store `replaceAllInDeck` (Markdown + HTML aller Zonen). Öffnen per Cmd/Ctrl+F oder Topbar-Lupe.
- ✅ **Rechtschreibung UMGESETZT:** `spellcheck` am Tiptap-Editor.
- ❌ **Outline-Modus — wieder ENTFERNT** (war zwischenzeitlich umgesetzt): Der „Folien ⇄ Gliederung"-Modus wurde nach GUI-Feedback entfernt, weil er redundant war — Reorder/Einfügen/Löschen/Edit liegen im Editor, und die **Folienliste** (Sidebar, [ZoneList.tsx](../src/components/ui/ZoneList.tsx)) hat jetzt **Drag-Reorder** (dnd-kit). Reorder war der einzige exklusive Nutzen der Gliederung. Mit der Entfernung verschwand auch der „Editor verschwindet in der Gliederung"-Effekt. Siehe Editor-Shell-Überarbeitung (skalierbare/einklappbare Spalten) in CLAUDE.md.
- ✅ **Versionshistorie UMGESETZT:** lokale Snapshots der `.slideo` unter `<config>/slideo/history/<deck-key>/` ([history.rs](../src-tauri/src/history.rs): je Snapshot eine volle `.slideo`-Kopie + `index.json`). **Auto-Snapshot beim Speichern** (dedupliziert: kein Snapshot, wenn unverändert) **+ manuelle Schnappschüsse** mit Beschriftung; Kappung auf 50 (ältere **Auto**-Snapshots zuerst, manuelle bleiben). [HistoryModal.tsx](../src/components/modals/HistoryModal.tsx): Liste, Wiederherstellen (undoable, Dateipfad bleibt → zum Übernehmen speichern), Löschen. Tauri-Commands `list_snapshots`/`create_snapshot`/`restore_snapshot`/`delete_snapshot` (Snapshot-ID path-traversal-sicher validiert).

### 19.10 Empfohlene Reihenfolge
19.2 (Charts, sofort) → 19.7 (A11y, klein) → 19.1 Builds (Flagship) → 19.3 (Presenter-Tools) → 19.4 (Vorlagen/Fonts) → 19.9 (Produktivität) → 19.8 (Medien) → 19.5 (PPTX) → 19.1 Auto-Animate.

## 20. Direktmanipulation in der Vorschau — *Korrektur-Layer über KI-Output*

> **Leitidee:** Die KI baut über MCP oft **HTML-Zonen** (designlastig). Diese per Hand im Code zu korrigieren
> ist mühsam. Ziel: vorhandene Elemente **direkt in der rechten Vorschau** anfassen — auswählen, im Text
> bearbeiten, verschieben, duplizieren, löschen. Das ist **kein** From-Scratch-Design-Canvas (kein PowerPoint):
> man bearbeitet **bestehende** Elemente, **neue entstehen durch Duplizieren + Bearbeiten**. Das **flussbasierte
> Modell bleibt unangetastet** (Folien, Reihenfolge, Notizen, Übergänge, Builds, Layouts) — Direktmanipulation
> betrifft nur das **Innenleben einer HTML-Zone**. Bleibt on-thesis (KI baut, Mensch justiert). Plan:
> [direct-manipulation-plan.md](direct-manipulation-plan.md). Nur **HTML-Zonen** (Markdown bleibt Fluss/Tiptap).

**Kern-Mechanik — Adressierung ohne ID-Injektion:** Elemente werden über einen **Kind-Index-Pfad** ab
`.slideo-content` (= oberstes Level von `zone.html`) adressiert. Der Renderer gibt `zone.html` strukturell 1:1 aus,
daher ist der Pfad eine stabile, bidirektionale Adresse. **Kein Schema-/Quelltext-Eingriff** (kein `data-*`).
`resolveAssetRefs` ändert nur Attribut-*Werte* (`src`), nicht die *Struktur* → der im Live-DOM berechnete Pfad
passt auf das geparste rohe Quell-DOM; `assets/x`-Refs überleben das Re-Serialisieren.

- ✅ **Phase 0 — „Klick → Quelle" UMGESETZT:** Klick auf ein Element in der Vorschau → Zone aktiv + passende
  Stelle (öffnendes Tag) im HTML-Editor (CodeMirror) markiert + dorthin gescrollt. `findSourceRange`
  ([dom-edit.ts](../src/lib/dom-edit.ts)) ist **am selben DOMParser-Parse verankert** wie die Ops (kein eigenes
  Tree-Construction-Modell → keine Divergenz bei implizitem `<tbody>`/Auto-Close): Zielelement via Pfad auflösen,
  Dokument-Index unter gleichnamigen Elementen bestimmen, das gleichrangige öffnende Tag-Literal im Quelltext
  nehmen. **Zuverlässigkeits-Guard:** stimmt die Zahl der Quell-Literale nicht mit der Zahl gleichnamiger
  Elemente überein (HTML5 synthetisiert/verwirft Elemente — z.B. leeres `<p>` aus verirrtem `</p>`,
  Foster-Parenting), gibt es **null** (keine Markierung) statt einer **falschen**. UI-Store `htmlReveal`
  (`focusEditor:false` im Direktbearbeiten-Modus → Fokus bleibt im Iframe).
- ✅ **Phase 1 — Auswählen / Löschen / Duplizieren UMGESETZT:** Direktbearbeiten-Toggle in der Vorschau-Kopfzeile
  (`previewEdit` im UI-Store) schaltet einen Auswahl-Layer **im `editScript()`** ([renderer.ts](../src/lib/renderer.ts))
  **per Pointer-Events** zu (WKWebView-Regel; Overlays im Iframe gezeichnet, Kommunikation nur via `postMessage`):
  Hover-Umrandung, Klick-Auswahl (Auswahl-Box + Mini-Toolbar **▲ Ebene hoch / ⧉ Duplizieren / 🗑 Löschen**),
  `Esc` = Ebene hoch/deselektieren, `Delete` = löschen (Fokus-/Viewport-Guard; **Backspace bewusst nicht**, weil
  reflexhaft „zurück"). Auswahl-Granularität: **kleinstes Element + ▲/Esc hoch**. HTML-Zonen tragen die
  Markierungsklasse `slideo-zone-html`. Ops über Store-Action `applyZoneElementOp` → `applyElementOp`
  (DOMParser auf dem rohen `zone.html`, `recordHistory=true` → **Cmd/Z**). **Re-Select-Handshake:** nach dem
  220-ms-Re-Render schickt PreviewPane die (ggf. angepasste) Adresse via `slideo:reselect` zurück (delete → Eltern,
  duplicate → Klon). **Stale-Pfad-Schutz:** Ops führen den erwarteten `tag` mit; passt das per Pfad aufgelöste
  Element nicht (paralleler MCP-Edit hat die Zone umgebaut), ist die Op ein **No-op** (kein falsches Element).
- ✅ **Phase 2 — Inline-Text-Edit UMGESETZT:** **Doppelklick** auf ein Element (oder Toolbar-**✎**) → `contenteditable`,
  Text wird selektiert; **Enter** committet (Shift+Enter = Umbruch), **Blur** committet, **Esc** verwirft (stellt das
  ursprüngliche `innerHTML` wieder her). Editierbar sind nur Elemente mit **reinem Inline-Inhalt** (`isInlineEditable`:
  alle direkten Kinder in einer Inline-Whitelist span/a/strong/em/`<br>`/…) — **Block-Container** (Karten, Komponenten,
  `data-id`-Wrapper) sind gesperrt, damit der Commit ihre Struktur nicht plattmacht (doppelt geguarded, auch in
  `applyElementOp`). Commit schickt das bearbeitete **Inline-HTML** (`slideo:edit-text` mit `html`) → `applyElementOp('editText')`
  setzt `el.innerHTML = sanitizeInline(html)` (behält erlaubtes Inline-Markup + `class/style/data-id/href`, verwirft
  `<script>`/`<style>`-Tags inkl. Inhalt, entfernt `on*`/`javascript:`/`url()`, „unwrapped" unbekannte Tags). Während
  des Edits bailen Hover/Klick/keydown des Auswahl-Layers + `reposition` (Overlays bleiben aus).
- ✅ **Phase 3 — Verschieben + „Folie einfrieren" UMGESETZT:** Drag auf dem **ausgewählten** Element (Schwelle 4 px) →
  live `transform` (das Element bleibt während des Drags im Fluss → andere Elemente springen nicht). Position als **%**
  relativ zur **Padding-Box des Containing Blocks** (nächster positionierter Vorfahre bzw. der Top-Level-Block via
  `getComputedStyle`, Fallback `.slideo-zone`; **nicht** `offsetParent`, das auch statische `<td>` liefert).
  **Freeze-on-first-move (Fluss-Kontext):** Ist das gezogene Element noch im Fluss, wird sein **Fluss-Eltern** (P)
  eingefroren: alle Fluss-Geschwister von P werden absolut an ihre **Ist-Position+Größe** gepinnt (`margin:0`+
  `box-sizing`+`width%`) und — wenn P verschachtelt ist — P selbst auf seine **Ist-Höhe** fixiert (nur `height`,
  **keine** Positionsänderung → es entsteht **kein neuer Containing-Block**, damit bereits-absolute Geschwister nicht
  verspringen), damit P nicht kollabiert und **%-positionierte** Geschwister (z.B. `top:171%` relativ zu P) stehen
  bleiben; der gezogene Block bekommt die Drop-Position (`slideo:freeze-zone` → `freezeZoneLayout` → `applyFreezeLayout`,
  je Item ein `expectTag`-Stale-Pfad-Schutz). Danach (Kontext „eingefroren") bewegt `slideo:move-element` →
  `applyElementOp('move')` nur noch das einzelne Element. Der **Bezugsrahmen** ist stets der *bestehende, tatsächliche*
  Containing-Block (`moveCb`/`createsCB`: nächster Vorfahre mit `position`/`transform`/`filter`/`perspective`, sonst
  `.slideo-content`-falls-positioniert, sonst Zone — **nicht** `offsetParent`, das auch statische `<td>` liefert).
  `margin:0` macht die Platzierung **pixelgenau**. Cursor `move` als Affordance; `suppressClick` nur bei echtem
  `pointerup`; `position:fixed`-Elemente sind viewport-gepinnt → kein Canvas-Move. **v1-Grenzen:** P-Höhe in px gepinnt
  → optimal für Folien in ~100vh und ein Verschachtelungs-Level (tiefere auto-height-Ketten / sehr lange Scroll-Zonen
  können driften); positioniert man **`.slideo-content` selbst** via Custom-CSS (`position`/`transform`), kann es beim
  Top-Level-Freeze kollabieren (nicht über `zone.html` pinnbar) → dann verspringen Top-Level-Elemente; Custom-CSS sollte
  `.slideo-content` nicht positionieren, wenn Direktmanipulation genutzt wird.
- ✅ **Undo (Cmd/Z) auch bei Fokus im Iframe:** Da Direktmanipulationen den Fokus im sandboxed Vorschau-Iframe lassen,
  greift der Fenster-`Cmd/Z` nicht. Das Iframe leitet `Cmd/Ctrl+Z` (außerhalb von Eingabefeldern) per
  `slideo:undo` an den Parent → Store-`undo()` (jede Op ist `recordHistory=true`).

**Offene Entscheidungen (geklärt):** Auswahl = kleinstes Element + ▲/Esc hoch · Verschieben hebt Fließ-Elemente
aufs Canvas (gekennzeichnet) · Re-Serialisierung durch die Ops formatiert `zone.html` einmalig neu
(Attribut-Reihenfolge/Whitespace) — **akzeptiert & dokumentiert** · Inline-Text-Edit behält erlaubtes Inline-Markup
(sanitisiert), mehrzeilig per `<br>` (contenteditable) · Position in `%` der Containing-Block-Padding-Box.

**v1-Grenzen / bewusst OUT:** kein From-Scratch-Zeichnen (Duplizieren+Bearbeiten deckt es ab); kein generisches
Resize (Bilder sind schon resizebar), kein Multi-Select/Gruppieren/Ausrichten/Snapping/Rotation/z-Index-UI; keine
Direktmanipulation in Markdown-Zonen. **Phase-0-Highlight** degradiert bei vom HTML5-Parser synthetisierten/
verworfenen gleichnamigen Elementen (malformed `<p>`-mit-Blockinhalt, verirrte End-Tags) zu **keiner** Markierung
(nie zu einer falschen); die destruktiven Ops sind davon **nicht** betroffen (sie laufen über DOMParser = Live-DOM).
Theoretische Fragment-Parsing-Divergenz (`.slideo-content`-innerHTML vs DOMParser-`body`) bei rohen Tabellen-/
Listenfragmenten ist v1-akzeptabel; Robustheits-Upgrade (pro Element `data-slideo-id`) bleibt für später.

**Additive Felder:** keine im `.slideo`-Schema — nur der **HTML-Inhalt** einer Zone ändert sich; `version`
bleibt "1.0". Neuer UI-State: `previewEdit`, `htmlReveal` (nicht persistiert).

## 21. Feste Folien-Bühne (16:9) + Scale-to-fit

> **Problem (aus §20-Praxis):** Folien waren responsiv (`.slideo-zone { width:100%; min-height:100vh }`, Inhalt
> floss, Seitenverhältnis = Fenster). Direktmanipulations-Positionen sind **%** (skalieren mit dem Container), die
> Element-**Größen** im KI-HTML aber `rem`/px (fix). Beim Fenster-Resize divergierten beide → Elemente liefen
> **out of bounds**. **Standardlösung (PowerPoint/Keynote/Google Slides/reveal.js):** feste logische Foliengröße +
> **gleichmäßiges Skalieren** der ganzen Folie ins Fenster. Vom Menschen so gewählt.

**Modell:** Jede Folie ist logisch **1280×720 (16:9)**. Der Renderer wickelt jede Zone in ein `.slideo-frame`
(Layout-/Navigations-Einheit); die `.slideo-zone` ist die feste 1280×720-Bühne und wird per
`transform: scale(var(--slideo-scale))` (transform-origin center, im Frame über `display:grid; place-items:center`
zentriert) eingepasst. Überlauf wird **abgeschnitten** (`overflow:hidden`, PPT/Keynote-Standard — Inhalt wird so
gestaltet, dass er passt). Der Skalierungsfaktor wird **im Iframe per JS** gesetzt (`navScript` `sldFit()` →
`--slideo-scale` + `window.__sldScale`, neu berechnet bei `resize`):
- **Vorschau** (`present:false`, editierbar): `SCALE_FIT='width'` → `s = clientWidth/1280`; Frames `width:100%;
  aspect-ratio:16/9`, vertikal gestapelt + Scroll.
- **Präsentation** (`present:true`: In-App-Audience, Standalone-Export, Projector): `SCALE_FIT='both'` →
  `s = min(innerW/1280, innerH/720)`, Letterbox; `deck` (Transition) = Frame `is-active`/`is-prev` absolut `inset:0`,
  sonst Scroll-Snap (`.slideo-frame` 100vh).
- **Print/PDF** (`renderPrintPage`): Frame = 1280×720-Seite (`page-break`), Zone `transform:none` (1:1, deckt sich
  jetzt mit dem Editor-Maßstab).
- **Thumbnail/Speaker-Vorschau:** SpeakerView (seit §26 **gestapelt**: aktuelle Folie oben groß im 16:9, darunter Timer/
  nächste Folie/Notizen) **und** SlideOverview rendern jede Folien-Vorschau über die gemeinsame Komponente
  [SlidePreview.tsx](../src/components/presentation/SlidePreview.tsx): `renderSingleZonePage` rendert bei **fester nativer
  1280×720** (`--slideo-scale:1`), die Anzeigegröße macht ein per CSS-`transform` skaliertes Wrapper-`div` (WebKit-Härtung,
  siehe §26).

**Wechselwirkung mit Skalierung (kritisch):** `getBoundingClientRect` liefert in einer skalierten Zone
**Bildschirm-px** (skaliert), `clientWidth/Height/Left/Top` dagegen **unskalierte Layout-px** (CSS-Transform berührt
`client*` nicht). Alle px/Transform-Stellen in der Zone werden daher durch `window.__sldScale` (`s`) korrigiert:
`pctFromRect` (§20-Positionen) teilt die `getBoundingClientRect`-Anteile **und** das Maus-Delta durch `s`, die
`client*` bleiben außerhalb `/s` — **nicht** von selbst scale-invariant (Zähler skaliert ÷ Nenner `clientWidth`
unskaliert wäre um `s` falsch); Verschiebe-Live-`translate(dx/s,dy/s)`; Freeze-`heightPx = rect.height/s`;
**Auto-Animate-FLIP** `translate(dx/SC,dy/SC)` (die Morph-`scale(sx,sy)` bleibt — **echtes** `rect/rect`-Verhältnis).
*Nur* das Bild-Resize (`rect/rect`) ist von Haus aus scale-invariant. Die §20-Auswahl-Overlays sind `position:fixed`
(Bildschirm-Koords) → unberührt korrekt.

**Effekt:** Beim Fenster-Resize skaliert die ganze Folie (Positionen **und** Größen) gemeinsam → **WYSIWYG bei jeder
Fenstergröße, nichts läuft mehr raus**; Vorschau/Präsentation/Export/Print sind im selben festen Koordinatensystem
vereinheitlicht.

**Additive Felder:** keine im `.slideo`-Schema; `version` bleibt "1.0" (reine Render-/CSS-Änderung). **v1-Grenzen:**
Überlauf wird geclippt (kein Auto-Verkleinern); kurzer Skalierungs-„Flash" bis das Iframe-Skript den Faktor setzt
(Skript läuft am Body-Ende, i.d.R. vor dem ersten Paint).

**KI-Anbindung (wichtig):** Damit über MCP generierte Decks von vornherein passen (keine zu großen Folien /
Out-of-bounds-Elemente), lehren die MCP-`instructions` (Regel 0 „FORMAT" + HTML-Regel 8) **und** der `slideo_guide`
das feste **1280×720**-Format: alles in die **Safe-Area** (x 64–1216 / y 64–656), Schriftgrößen prüfen, lieber mehr
Folien als eine überfüllte; nur rein dekorative Formen dürfen über den Rand hinausragen, niemals Text/Inhalt
([tools.rs](../src-tauri/src/tools.rs) `server_instructions`/`build_guide`). Da der MCP-Server kein Layout misst,
ist das eine **Anweisung** (sehr wirksam), keine harte Garantie; eine optionale Layout-Validierung (Headless-Browser,
Element-Grenzen vs. 1280×720) bleibt ein möglicher Folgeschritt.

## 22. Security-Härtung (Audit 2026-06-26)

Ein Performance- & Security-Audit der Gesamt-App (Multi-Agent, adversarial gegengeprüft) ergab eine **solide
Kern-Isolation** (untrusted Inhalt rendert in `<iframe sandbox="allow-scripts">` **ohne** `allow-same-origin` →
opaker Origin, kein Tauri-Zugriff; kein Zip-Slip; Generatoren escaped/allowlisted) und **kein high/critical-Risiko**.
Vollreport + Bedrohungsmodell: [audit.md](audit.md). Umgesetzte Härtungen (Branch `security-hardening`):

- **IPC-Steuer-Socket authentifiziert (S1/S8):** Der lokale TCP-Socket (App ↔ `slideo mcp`) verlangt jetzt ein beim
  Start erzeugtes **Shared-Secret-Token**; `ipc.json` (Port + Token) wird mit **0600** angelegt. Anfragen ohne
  gültiges Token werden abgewiesen → die bloße Kenntnis des Ports reicht einem fremden lokalen Prozess nicht mehr,
  die MCP-Tools aufzurufen. Eingehende Bytes pro Verbindung sind auf 16 MiB begrenzt. **Restgrenze:** ein
  Same-UID-Prozess kann `ipc.json` lesen (gleicher Nutzer = gleiche Dateirechte) — das ist akzeptiert (er hat ohnehin
  die Rechte des Nutzers). 0600 schützt zusätzlich auf Multi-User-Hosts ([ipc.rs](../src-tauri/src/ipc.rs)).
- **Content-Security-Policy gesetzt (S2/S3):** Die App-CSP in [tauri.conf.json](../src-tauri/tauri.conf.json) ist von
  `null` auf eine strikte Policy (`script-src 'self'`, kein externes Laden) umgestellt (+ lockerere `devCsp` für Vite/HMR;
  Vite-`modulePreload.polyfill=false`, damit kein Inline-Script die CSP verletzt). Da `app.security.csp` **nicht** in
  die opaken Folien-Iframes propagiert, injiziert der Renderer zusätzlich eine **eigene strikte CSP** in die In-App-
  Folien (`renderFullPage` bei `!standalone`, `renderSingleZonePage`): `connect-src 'none'` + `default-src 'none'`
  unterbinden jede Netzwerk-Exfiltration durch bösartige HTML-Zonen. **Bewusste Verhaltensänderung:** In-App-Folien
  laden **keine externen Netzressourcen** mehr (fetch/externe Bilder/`<script src>`/externe Embeds) — passt zur
  „läuft vollständig lokal"-Zusage. Der **Standalone-Export bleibt bewusst offen** (geteilte Decks dürfen externe
  Ressourcen laden) ([renderer.ts](../src/lib/renderer.ts)).
- **Robustheit (S5–S9):** Print-Iframe (nur Browser-Dev) erhält `sandbox` (Druck-Trigger ins Iframe verlagert);
  `mcp_registration::write_json` schreibt **atomar** (temp + rename) und **bewahrt die Rechte** fremder Config-Dateien
  (`~/.claude.json`, `claude_desktop_config.json` bleiben 0600), RMW serialisiert; `.slideo`-Reader cappt Größen/Anzahl
  (Decompression-Bomb-Schutz, gegen tatsächlich gelesene Bytes); `open_print_view` nutzt einen zufälligen Temp-Namen.
- **`html:true` im Editor (S4) ist sicher** by construction: ProseMirror parst Markdown→HTML im detached Dokument
  (kein Script-Lauf), `SlideoImage` whitelistet nur `src/alt/title/width/align/float` → `<script>`/`onerror`/`<iframe>`
  fallen aus dem Schema. Bleibt unverändert; die App-CSP ist der zusätzliche Backstop.
- **Abhängigkeiten:** `npm audit` (Production) **clean**; `cargo audit` **0 Vulnerabilities** (nur
  unmaintained/unsound-Warnungen, überwiegend der Linux-GTK-Stack, der auf macOS nicht kompiliert wird).

**GUI-Verifikation ausstehend (Mensch):** Die beiden CSP-Schichten (S2/S3) sind laufzeitabhängig — vor Release auf
einem echten `tauri:dev`/`tauri build` (macOS **und** Windows/WebView2) gegenprüfen: App lädt, MCP-IPC + Projector-
Fenster laufen, Folien-Navigation/§20/Auto-Animate funktionieren, gestreamte Videos/Audios laden, **keine**
CSP-Verstöße in der DevTools-Konsole.

## 23. Zonen-Links (nicht-lineare Navigation)

Decks dürfen **nicht-linear** sein: ein Inhaltsverzeichnis auf Folie 1, dessen Einträge direkt zur jeweiligen Folie
springen, und ein Rücksprung-Link zurück zum Verzeichnis. Mechanismus: das **Sprung-Attribut `data-slideo-goto`**.

- **Adressierung.** Jede Folie rendert ohnehin als `<section id="zone-<UUID>">` (§6). Ein Element mit
  `data-slideo-goto="<Wert>"` springt zu der Folie; `<Wert>` ist **die Zonen-UUID** (umsortier-fest) **oder** eine
  **1-basierte Foliennummer** (am einfachsten für die KI). Das `navScript` baut beim Init eine `UUID→Index`-Map und
  löst beides über `resolveGoto()` auf.
- **Ein Navigations-Trichter.** Jeder Sprung läuft durch das vorhandene `go(i, smooth)` ([renderer.ts](../src/lib/renderer.ts)) —
  **nie** nativer `#hash`-Scroll (der im Deck-/Übergangsmodus stumm scheitert, weil dort `is-active`/`is-prev` statt
  Scroll-Snap regiert). Ein delegierter Klick-Handler liest `data-slideo-goto`, `preventDefault`, und navigiert:
  **Standalone** ruft `go()` direkt im Iframe; **in-app** postet das (anzeige-only) Iframe `slideo:goto-request {index}`
  an den **parent-autoritativen** Steuerstand (PresentationMode → `doJump`, PreviewPane → `setActiveZone`). Damit
  funktioniert es einheitlich in **Präsentation, Standalone-Export und Vorschau**.
- **Schlichte Hash-Links.** Ein `hashchange`-Shim macht zusätzlich nackte `<a href="#zone-<UUID>">` und Markdown-Links
  `[Text](#zone-<UUID>)` first-class (auch im Deck-Modus) und liefert den **Browser-Zurück-Button** gratis.
- **Zurückkommen** = **expliziter Rücksprung-Link** (`data-slideo-goto` auf die Inhalts-Folie). Dokument-artig,
  in App und Standalone identisch, kein zusätzlicher History-State. (Ein automatischer Verlaufs-Stack wurde bewusst
  **nicht** gebaut — der explizite Link ist klarer und überall gleich.)
- **Authoring.** KI über MCP: das Attribut + eine **`toc`-Komponente** (Rust-Generator [components.rs](../src-tauri/src/components.rs),
  token-gestylte Liste, `items: [{label, target}]`) — in `list_components`/`insert_component` **und** der Komponenten-
  Palette. Mensch: `toc` aus der Palette, Markdown-`#`-Links, rohes `<a data-slideo-goto>` in HTML-Zonen — **oder per
  Direktmanipulation (§20):** ein Element in einer HTML-Zone auswählen → Toolbar-Knopf „Link" → Ziel-Folie aus einem
  Popover wählen ([PreviewPane](../src/components/preview/PreviewPane.tsx); Element-Op **`setGoto`** in
  [dom-edit.ts](../src/lib/dom-edit.ts), Ziel = Zonen-UUID, undobar, „Link entfernen" möglich; im Direktbearbeiten-Modus
  selektiert ein Klick aufs verknüpfte Element es wieder, statt zu springen). Die MCP-`instructions`/`slideo_guide`
  lehren es (Punkt 11).
- **Sicherheit/Robustheit.** Ziele werden in der `toc`-Komponente streng sanitisiert (`safe_goto`: `[A-Za-z0-9-_:]`,
  ≤64 → kein Attribut-Ausbruch); `resolveGoto` nutzt das Ziel **nur** als geclampten Array-Index (keine Navigation zu
  URLs). `slideo:goto-request` trägt nur einen Index und reiht sich in das bestehende Iframe→Parent-Nachrichtenmodell
  ein (kein neuer Vertrauens-Vektor gegenüber den §20-Ops). Im **Direktbearbeiten-Modus** (§20) unterdrückt
  `window.__sldDirectEdit` die Sprung-Klicks (dort selektiert der Klick Elemente). **Zweitfenster:** ein Klick auf dem
  Projektor wird via Tauri-Event `slideo:projector-goto` ans Steuerfenster weitergereicht (Steuerhoheit bleibt dort).
- **Kein Schema-Eingriff** (`version` "1.0"; rein Render-/UI-/Komponenten-Änderung).

**GUI-Verifikation ausstehend (Mensch):** Inhaltsverzeichnis-Klick springt in Präsentation, Standalone-Export
(+ Browser-Zurück) und Vorschau; Rücksprung-Link; Markdown-`#`-Link (der `hashchange`-Pfad hängt am
about:srcdoc-Verhalten der WKWebView — der `data-slideo-goto`-Pfad ist davon **unabhängig** und der empfohlene);
Projektor-Klick auf echter Multi-Display-Hardware.

## 24. Workflow-Optimierung (Onboarding · Assets · Komponenten · KI-Layout-Check)

Eine Runde Bedien-/Authoring-Verbesserungen für Mensch **und** KI-über-MCP. Vier Bereiche (Branch
`workflow-optimization`):

- **Onboarding (Erststart).** Die Kern-These „die KI baut die Folien, du editierst drüber" wird jetzt im UI
  vermittelt: Das MCP-Setup-Modal erscheint **erst nach dem ersten Deck** (mit Kontext, nicht auf dem kalten Start,
  [App.tsx](../src/App.tsx)); EmptyState + ein **Hilfe-Modal** ([HelpModal.tsx](../src/components/modals/HelpModal.tsx),
  Topbar-`?`) erklären den Ablauf in 4 Schritten; ein einmaliger **Onboarding-Banner**
  ([OnboardingNudge.tsx](../src/components/ui/OnboardingNudge.tsx)) bietet einen **fertigen Beispiel-Prompt zum Kopieren**
  ([onboarding.ts](../src/lib/onboarding.ts), `samplePrompt`). Die Texte sind **KI-agnostisch** (MCP-Standard — Beispiele
  Claude Desktop, Codex CLI, …), nicht Claude-exklusiv. McpSetupModal/Settings auf Klartext umgestellt. Reines Frontend.
- **Asset-Verwaltung.** „Bild einfügen" (Zonen-Button) öffnet jetzt zuerst die **Asset-Verwaltung im „pick"-Modus**
  → Batch-Import → Thumbnail-Klick fügt ein; dazu ein **eigener Topbar-Button „Medien"** („manage"-Modus, alle Typen)
  ([AssetManagerModal.tsx](../src/components/modals/AssetManagerModal.tsx) + wiederverwendbare
  [AssetLibrary.tsx](../src/components/ui/AssetLibrary.tsx), aus den Settings ausgelagert). Store:
  `insertAssetIntoZone(zoneId, assetName)` fügt ein Library-Asset **ohne Re-Import** ein; `addMediaToZone`
  (Drag&Drop) delegiert darauf. Reines Frontend, kein Schema-Eingriff.
- **Komponenten-Set 11 → 17.** Sechs neue token-bewusste Generatoren in
  [components.rs](../src-tauri/src/components.rs): `data_table`, `big_number`, `feature_grid`, `process_steps`,
  `pricing`, `gallery` (Bilder via `assets/<name>`, `safe_asset`-sanitisiert). Erscheinen automatisch in
  `list_components` (MCP) **und** der Palette; Formulare für die 3 einfachen (die 3 komplexen fügen mit Defaults ein
  + werden per §20 verfeinert). Token-only, escaped, Fallbacks → rendern auch ohne Params.
- **KI-Layout-Check (gegen die blinde Authoring-Schleife).** Der MCP-Server misst **kein** echtes Layout — bisher
  erfuhr die KI nie, ob eine Folie aus der festen 1280×720-Bühne (§21) läuft. Zwei neue **read-only** MCP-Tools
  ([tools.rs](../src-tauri/src/tools.rs), **35 → 37**): `check_zone_overflow(id)` und `validate_deck()` liefern eine
  **reine Rust-Heuristik** (KEIN Headless-Browser, [overflow.rs](../src-tauri/src/overflow.rs)): Markdown aus
  Zeilen/Schriftgröße geschätzt, HTML aus inline-px (left/top/width/height/font-size) gegen Bühne + Safe-Area
  (x 64–1216 / y 64–656). Approximativ, aber handlungsleitend — die KI kann **vor** dem Festschreiben prüfen und
  Inhalt teilen/straffen. Die `instructions`/`slideo_guide` lehren den Check (Punkt 12 / Schritt 7). **Härtungs-
  Vermerk:** ein Panic in `tools::handle` würde die IPC-Mutexes vergiften (App-Datenebene bricht bis Neustart); der
  konkrete Heuristik-Panic (nicht-quotiertes `style=` vor Multibyte-Zeichen) ist gefixt + Regressionstest — ein
  generelles `catch_unwind` um `handle` ([ipc.rs](../src-tauri/src/ipc.rs)) bleibt als Defense-in-Depth offen.

**Nach den MCP-Änderungen (Komponenten + Tools + instructions): `cargo build` + Claude Desktop neu starten.**
Headless grün: **cargo test 42**, typecheck, vite build; adversarial reviewt (Komponenten/Heuristik/MCP). **GUI-Check
ausstehend** (Onboarding-Fluss, Asset-pick/manage, neue Komponenten in der Palette, MCP-Tools in Claude Desktop).

## 25. Vorschau In-Place-Patch (P2/P6 — `srcDoc`-Reload → `postMessage`)

**Problem.** Die Vorschau ([PreviewPane.tsx](../src/components/preview/PreviewPane.tsx)) rendert bislang bei **jeder**
Änderung (debounced) die **ganze** Präsentation via `renderFullPage` und setzt das Ergebnis als **`srcDoc`** → **kompletter
Iframe-Reload**: Flackern, alle Folien-Skripte (nav/edit) laufen neu, Scroll- und §20-Auswahl-Zustand gehen verloren.
Beim Tippen und beim Design-Justieren spürbar.

**Lösung.** Änderungen werden gegen den zuletzt gerenderten Stand **klassifiziert** und die günstigste **sichere**
Strategie gewählt; der **Voll-Reload bleibt immer der Fallback**. Reine Render-/UI-Mechanik — **kein Schema-Eingriff**
(`version` bleibt "1.0").

- **Klassifikator** ([preview-diff.ts](../src/lib/preview-diff.ts), rein, testbar): `classifyPreviewChange(prev, next, prevAssets, nextAssets, prevEdit, nextEdit)` → 
  - **`full`** (Iframe-Reload): erster Render, `previewEdit`-Toggle (ändert die injizierten Skripte), geänderte
    **Assets**/`fonts`/`meta.logo` (betreffen `<head>` bzw. jede Folie), strukturell (Zonenzahl bzw. -Reihenfolge/-IDs
    geändert), **entfernter Token-Key** (Inline-Patch kann eine CSS-Variable nicht sicher löschen).
  - **`patch`**: `tokens` geändert (Wert/Hinzufügen) → `slideo:patch-tokens`; je Zone mit geändertem
    `markdown`/`html`/`custom_css`/`style`/`content_type` → `slideo:patch-zone`. (`reveal`/`notes`/`label` wirken in der
    Vorschau nicht → ignoriert.)
  - **`none`**: nichts render-relevant (z.B. nur `meta.modified`) → nur Vergleichs-Snapshot nachziehen.
- **Patch-Handler im Iframe** (`patchScript`, [renderer.ts](../src/lib/renderer.ts), eigene IIFE, **nur bei `editable`**
  = nur die Vorschau): `patch-tokens` setzt die `:root`-Variablen per `root.style.setProperty` (Inline schlägt den
  `<style>`-Block, gleiche Mechanik wie `--slideo-scale`) und stößt ein `resize` an (→ §20-Overlays neu vermessen);
  `patch-zone` findet `#zone-<uuid>`, **behält den `.slideo-frame`-Knoten** und tauscht nur dessen `innerHTML` →
  navScripts `slides[]`-Array und der §23-`zoneIndex` (beide **index**- statt knotenbasiert, Section-id unverändert)
  **bleiben gültig**; Scroll/Auswahl der ANDEREN Zonen überleben. Die §20-Auswahl der gepatchten Zone stellt der Parent
  über den bestehenden `slideo:reselect`/`slideo:reselect-block`-Handshake wieder her.
- **State-Machine im Parent** (`syncPreview`, refs `lastRendered`/`lastAssets`/`lastEdit`/`readyRef`/`busyRef`/
  `deferredRef`/`reloadSeq`): Voll-Reloads hängen eine **monotone Nonce** in den `<head>` (`<!--sld:N-->`) → das `srcDoc`
  unterscheidet sich garantiert, `onLoad` feuert zuverlässig, `readyRef` bleibt nie hängen. Während des (Re)Loads
  (`!readyRef`) oder einer laufenden Iframe-Interaktion (`busyRef`) werden Patches **aufgeschoben** und beim nächsten
  sicheren Moment (`onLoad` bzw. `busy:false`) **einmal** nachgezogen. **Invariante:** nach jedem `syncPreview` ist das
  Iframe-DOM visuell äquivalent zu `renderFullPage(current)`.
- **Drag-/Edit-Schutz (kritisch).** Ein Patch darf einen laufenden §20-Drag/Freeze **nicht zerreißen** (Freeze schreibt
  `zone.html` mitten im Drag → löst sonst sofort einen Patch aus). Das `editScript` meldet **jede** Interaktion
  (Block-Reorder, Bild-Resize, §20-Verschieben, Inline-Text-Edit) per `slideo:preview-busy {busy}`; der Parent
  unterdrückt Patches, solange busy. `busy:false` feuert **nach** der jeweiligen Op-Nachricht (freeze/move/edit) über ein
  `try/finally`, damit der Store zuerst geschrieben und dann **einmal** reconciled wird. Robustheit gegen ein hängendes
  `busy` (→ Vorschau fröre ein): **`setPointerCapture`** an allen Drags (pointerup wird dem Iframe auch außerhalb
  zugestellt), Fenster-**`blur`**-Fallbacks, `busyRef`-Reset in `handleLoad` **und** beim `previewEdit`-Toggle; der
  Block-Drag ist gegen Überlappung mit aktivem Edit/Move/Resize geguardet.
- **Wechselwirkungen bewusst geprüft:** §20 (dokument-delegierte Handler überleben den innerHTML-Austausch; gepatchte
  Zone wird reselektiert), §21 (Scale-to-fit unberührt — Folie bleibt 1280×720), §23 (`zoneIndex` index-basiert →
  gültig), CSP (Patch ist reine DOM-Mutation, kein Netz). `content_type`-Toggle ist ein Zonen-Patch (renderZoneSection
  rendert beide Typen; editScript adaptiert über live `closest('.slideo-zone-html')`).

**Verifikation:** headless `typecheck` + `vite build` + `node --check` der drei emittierten Iframe-Skripte (nav/edit/patch)
grün; **zwei adversariale Multi-Agent-Review-Runden** (6 Dimensionen → 5 bestätigte Findings gefixt; fokussiertes
Fix-Re-Review → 2 weitere gefixt). **GUI-bestätigt** (In-Place-Patch verifiziert: Token-/Zonen-Patch statt Voll-Reload,
Voll-Reload nur strukturell).

## 26. Remote-Präsentation auf EINEM Bildschirm (teilbares Folien-Fenster)

**Problem.** Der Presenter-Modus (§19.3) trennt Folien (randloses Vollbild-Fenster `projector`) von der Presenter-View
(Hauptfenster: [SpeakerView](../src/components/presentation/SpeakerView.tsx) mit Notizen/nächster Folie/Timer/Tools) —
funktioniert aber nur mit **zwei Monitoren**. Beim Remote-Präsentieren (Zoom/Meet/Teams) hat man oft nur **einen**
Bildschirm und will trotzdem **nur die Folie** an die Zuschauer geben, Notizen/Tools **privat** behalten.

**Erkenntnis (Recherche).** Genau das ist der Industrie-Standard für Ein-Monitor-Präsentieren (Google Slides,
PowerPoint): **nicht den Bildschirm, sondern ein Fenster teilen** — die Presenter-View bleibt vorne, das Folien-Fenster
liegt dahinter; im Meeting-Tool wählt man „Fenster teilen → das Folien-Fenster". Window-Capture erfasst das Fenster
**auch verdeckt**. Kein WebRTC/Server nötig (auf macOS unterstützt WKWebView ohnehin kein `getDisplayMedia`); nichts
verlässt die Maschine außer über das ohnehin genutzte Meeting-Tool → passt zur „läuft lokal"-Zusage.

**Lösung — EIN vereinheitlichtes Folien-Fenster.** Command **`open_share_window`** ([present.rs](../src-tauri/src/present.rs))
öffnet das Folien-Fenster als **normales, dekoriertes, verschieb-/skalierbares, betiteltes 16:9-Fenster** auf dem
**aktuellen** Display. Command **`set_projector_fullscreen(bool)`** schaltet dasselbe Fenster zwischen **randlos-Vollbild
auf dem Monitor, auf dem es GERADE liegt** (`win.current_monitor()` → Position/Größe, `decorations:false`) und dem
dekorierten 16:9-Fenster um. So deckt **ein** Fenster beide Fälle ab:
- **Remote (Zoom/Meet):** dekoriert lassen → per „Fenster teilen" freigeben; Notizen/Tools bleiben im Hauptfenster privat.
- **Physischer Beamer/TV:** Fenster auf das zweite Display ziehen → **„Vollbild"** → randlose Vollfläche auf genau diesem
  Monitor (kein Fensterrahmen). Bewusst randlos-über-dem-Monitor statt nativem Vollbild (macOS-Vollbild landet sonst evtl.
  auf dem falschen Display).

Das **ersetzt den früheren separaten Zwei-Bildschirm-Modus** (Monitor-Dropdown + `list_monitors`/`open_presentation_window`
— entfernt), der redundant war. Nutzt **dasselbe `projector`-Label** + dieselbe Event-Sync (`slideo:nav`/`projector-ready`/
`goto`/`closed`) und dieselbe [ProjectorView](../src/components/presentation/ProjectorView.tsx) (`role=projector`); nur EIN
Folien-Fenster gleichzeitig. `sharingType` bleibt Default (macOS `.readOnly` = capturable); der Titel „Slideo — Präsentation"
macht es im Fenster-Picker eindeutig. UI ([PresentationMode](../src/components/presentation/PresentationMode.tsx)): Button
**„Folie teilen"** (`screen_share`) öffnet das Fenster (synct erst den `AppState`, dann **refokussiert das Hauptfenster** →
Cockpit behält die Tastatur-Navigation); bei offenem Fenster ein **Vollbild-Umschalter** (`fullscreen`/`fullscreen_exit`) +
Schließen. **v1-Grenzen:** Laser/Stift im Zwei-Fenster-Modus aus; Live-Edits laden das Folien-Fenster kurz neu. Reines
Frontend + zwei Tauri-Commands, **kein Schema-Eingriff**. Ambitioniertere Wege (lokaler LAN-Viewer; echtes WebRTC-Remote)
bewusst nicht gebaut — Bedarf ist gedeckt.

**SpeakerView + Folien-Vorschau (Teil derselben §26-Runde).** Die [SpeakerView](../src/components/presentation/SpeakerView.tsx)
ist **gestapelt** (aktuelle Folie oben groß im 16:9, darunter Timer · nächste Folie · Notizen) statt zweispaltig. Alle
Folien-Thumbnails (SpeakerView + [SlideOverview](../src/components/presentation/SlideOverview.tsx)) laufen über die
gemeinsame [SlidePreview](../src/components/presentation/SlidePreview.tsx). Dabei mussten **vier WKWebView/WebKit-Fallen**
entschärft werden, die kleine Folien-Vorschauen leer rendern ließen (für künftige Iframe-Thumbnails merken): (1) WKWebView
dimensioniert ein Iframe nach seinem **Inhalt** statt der CSS-Größe → `renderSingleZonePage` rendert nun bei **fester nativer
1280×720** (`--slideo-scale:1`, kein Fit-Script) statt `height:100%` (kollabierte zirkulär); (2) **`transform` direkt aufs
Iframe** ist in Safari fehlerhaft → skaliert wird ein **Wrapper-`div`**; (3) ein **`backdrop-filter` auf einem Vorfahren**
lässt verschachtelte Iframes leer rendern → das Übersicht-Overlay ist voll deckend **ohne** Blur; (4) eine **`aspect-ratio`-
Box mit nur absolut positionierten Kindern** bekommt in WebKit **keine Höhe** → der Übersicht-Kasten nutzt den
**`padding-bottom:56.25%`-Trick**.

**Verifikation:** cargo check/test 42, typecheck, vite build grün; fokussiertes adversariales Review (Rust-Fenster-Semantik +
FE-State/UX) clean. **GUI-bestätigt** (Fenster-Teilen in Zoom/Meet listet „Slideo — Präsentation", nur Folie sichtbar,
Navigation vom Cockpit, Schließen/Erneut-Öffnen; **Vollbild-Toggle auf zweitem Monitor + zurück** auf echter Multi-Display-
Hardware; gestapelte SpeakerView + Übersicht-Thumbnails rendern).

---

## 27. In-App-Cursor-Chat (optionaler zweiter Einstieg)

**Produkt:** Dieselbe Authoring-Schleife wie über Claude Desktop / Codex, aber **in der App**. Chat-Fenster unter dem Editor (Cmd/Ctrl+J), Anmeldung unter Einstellungen → Cursor. Der Agent schreibt nicht an `.slideo` vorbei — nur MCP-Tools; die UI folgt über `mcp:presentation` wie bei jedem anderen Client.

**Technik:** `@cursor/sdk` ist Node-only → Sidecar (`src-agent/` → `npm run agent:build` → `host.mjs`), Rust proxyt JSON-RPC ([chat.rs](../src-tauri/src/chat.rs)). Details: [done/cursor-sdk-chat.md](done/cursor-sdk-chat.md).

**Nicht betroffen:** Dateiformat (`version` bleibt "1.0"), MCP-Tool-Satz (37), externe Client-Registrierung.
