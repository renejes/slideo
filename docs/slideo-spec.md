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

3. **Kein AI-Layer in der App.** Die App hat keine Anthropic API, keinen OpenAI Client, keine Ollama-HTTP-Calls. Die einzige AI-Schnittstelle ist der MCP Server.

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

> *Status:* ✅ **(A) UMGESETZT** (Agenten-Skill: `server_instructions` + `slideo_guide` briefen jetzt Komponenten, volles Interaktivitäts-Repertoire, Bild-Positionierung, Notes, Presets, Transitions). ✅ **(B) UMGESETZT** als MCP + Rust-Generator: [components.rs](../src-tauri/src/components.rs) mit 9 Komponenten (stat_cards, bar_chart, line_chart, donut_chart, progress, quote, timeline, comparison, callout — Charts via §19.2), MCP `list_components`/`insert_component`. **OFFEN:** die **UI-Palette** im Editor (soll denselben Rust-Generator über einen Tauri-Command nutzen — keine Template-Duplikation).

**(A) Agenten-Skill erweitern** (`slideo_guide` + `instructions`):
- Die KI explizit über das **volle Interaktivitäts-Repertoire** briefen: Charts (SVG/JS), Animationen (CSS/JS), eingebettete Player, interaktive SVGs, Diagramme, Timelines, Vergleiche — und **wie**: in HTML-Zonen, **immer mit Token-CSS-Variablen**, klein/wartbar halten.
- Auf die Komponenten-Bibliothek (B) und `list_components`/`insert_component` verweisen.

**(B) Komponenten-Bibliothek** (token-bewusst, wieder-themebar):
- Set kuratierter HTML/SVG/CSS-Snippets, die Tokens nutzen: z.B. Balken-/Linien-/Kreis-Diagramm, Stat-Cards/KPIs, Fortschrittsbalken, Countdown/Timer, Toggle/Accordion, Bild-Carousel, Icon-Grid, Zitat-Block, Vergleich (zwei Spalten), Timeline, QR-Code, Video-Player mit Steuerung.
- *Datenfluss (eine Quelle der Wahrheit):* Templates an **einer** Stelle (Rust, z.B. `src-tauri/src/components.rs`) als Funktionen `(params) -> HTML`.
  - MCP: `list_components` (Namen + Parameter) und `insert_component(zone_id, type, params)` → generiert HTML (mit Token-Variablen) und setzt/fügt es als HTML-Zone ein.
  - UI (später): eine **„Komponenten"-Palette** im Editor, die **denselben** Rust-Generator über einen Tauri-Command nutzt (keine Template-Duplikation TS/Rust).
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
- Später: visueller Tabellen-/Daten-Editor (braucht §18.7-Komponenten-Palette-UI, damit Mensch ohne KI einsetzen kann).

### 19.7 Barrierefreiheit — ✅ UMGESETZT
- ✅ Alt-Text-Feld an der Bild-Toolbar ([ImageToolbar.tsx](../src/components/editor/ImageToolbar.tsx)) → schreibt `![alt](…)` bzw. `<img alt="…">` (round-trip über SlideoImage).
- ✅ WCAG-Kontrast-Check (Text/Bg, Accent/Bg) im Design-Tab ([contrast.ts](../src/lib/contrast.ts) + TokenEditor), Badge AA/AAA/zu-niedrig.

### 19.1 In-Folien-Animationen (Builds + Auto-Animate) — *Flagship*
- ✅ **Builds (Schritt-Einblenden) UMGESETZT:** Zone-Flag `reveal:'steps'` (additiv, optional). Renderer umhüllt Top-Level-Blöcke als `.slideo-fragment` (nur In-App-Präsentation, nicht Standalone/Vorschau). **Parent-autoritative Navigation:** PresentationMode hält `activeSlideIndex` + `activeStep`, sendet `slideo:show {index, step}` an das (nicht fokussierte) Audience-Iframe; das Iframe hat KEINE eigene Tastatur mehr (nur der Standalone-Export). Vorwärts = nächstes Fragment ODER nächste Folie; Speaker-View zeigt „Schritt s/n". MCP `set_zone_reveal`, UI-Toggle (⚡/animation) in der ZoneToolbar. (30 MCP-Tools.) Tsx-verifiziert; GUI-Prüfung steht aus.
- **Auto-Animate/Morph (OFFEN, Folgeschritt):** gleiche `data-id`-Elemente zwischen benachbarten Folien per FLIP animieren (reveal.js-Stil).
- **v1-Grenzen:** Builds nur in der In-App-Präsentation (Standalone-`.html` zeigt alles statisch); Speaker-Preview zeigt die Folie voll (Schritt nur als Zähler).

### 19.3 Präsentier-Werkzeuge — *medium; Zweitfenster medium–groß*
- Folien-Übersicht / Sprung-Grid (Taste → Raster aller Folien, Klick springt).
- Laser/Stift-Overlay (Canvas über der Folie, Pointer-Events; Farbe aus Tokens).
- Echtes **Zweitfenster** auf separatem Display (Tauri Multi-Window + Event-Sync; Speaker im Hauptfenster, Folien im zweiten).
- Auto-Advance / Kiosk-Loop (Timings pro Folie, selbstlaufend).

### 19.4 Vorlagen & Marke — *medium*
- ✅ **Custom-Fonts-Upload UMGESETZT:** Font-Datei (woff2/woff/ttf/otf) → Asset in `assets/` + `presentation.fonts` ({family, asset}); Renderer injiziert `@font-face` (Vorschau/Präsentation/Export); im Design-Tab „Schriften"-Upload + Auswahl-Datalist für die Font-Felder ([fonts in renderer.ts](../src/lib/renderer.ts), Store `addFont`). guess_mime kennt Font-Endungen.
- ✅ **Logo/Brand UMGESETZT:** `meta.logo = { asset, position }` (additiv); Renderer zeigt das Logo absolut in der gewählten Ecke **jeder** Folie (auch Export/PDF). Upload + Position + Entfernen im Design-Tab „Logo" (Store `setLogo`/`setLogoPosition`/`clearLogo`).
- ✅ **Starter-Templates UMGESETZT:** [templates.ts](../src/lib/templates.ts) — 4 Decks (Leer, Pitch, Vortrag, Editorial) mit Token-Preset + Seed-Zonen (inkl. Layouts + Builds); auswählbar im Neu-Dialog (`newPresentation(title, template)`).
- *Polish:* Font-/Logo-Assets erscheinen aktuell auch in der Settings-Asset-Library als „kaputtes" Thumbnail (eigene Kachel später).

### 19.5 PPTX-Export — *medium (v1)*
- v1 **bild-basiert:** jede Folie als PNG rendern (Canvas/headless) → `pptxgenjs` legt je ein Vollbild-Bild pro Folie an. Editierbares OOXML (Text/Shapes) ist deutlich größer, später.

### 19.8 Medien & Assets — *klein–groß*
- Bild-**Drag&Drop-Import** (in Editor/Vorschau). Bild-**Crop**. **Icon-/Stock**-Einfügen (Inline-SVG-Komponenten).
- (groß) **Aufnahme/Narration** pro Folie + Video-Export (MediaRecorder).

### 19.9 Produktivität — *klein–medium*
- ✅ **Suchen & Ersetzen UMGESETZT:** deck-weites Modal ([FindReplaceModal.tsx](../src/components/modals/FindReplaceModal.tsx)), Live-Trefferzahl, Store `replaceAllInDeck` (Markdown + HTML aller Zonen). Öffnen per Cmd/Ctrl+F oder Topbar-Lupe.
- ✅ **Rechtschreibung UMGESETZT:** `spellcheck` am Tiptap-Editor.
- **Outline-Modus (OFFEN):** alle Folientexte als editierbare Gliederung.
- **Versionshistorie (OFFEN):** lokale Snapshots der `.slideo`.

### 19.10 Empfohlene Reihenfolge
19.2 (Charts, sofort) → 19.7 (A11y, klein) → 19.1 Builds (Flagship) → 19.3 (Presenter-Tools) → 19.4 (Vorlagen/Fonts) → 19.9 (Produktivität) → 19.8 (Medien) → 19.5 (PPTX) → 19.1 Auto-Animate.
