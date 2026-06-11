# CLAUDE.md — Slideo

Arbeitsanweisungen für KI an diesem Projekt. **Maßgeblich ist [docs/slideo-spec.md](docs/slideo-spec.md)** (bei Widerspruch: Spec gewinnt, im Zweifel den Entwickler fragen).

## Kernkonventionen (aus Spec §13)

1. Spec-Doc ist die Wahrheit.
2. **Markdown ist primäres Content-Format.** Nie direkt Tiptap-JSON für Inhalte schreiben.
   Ausnahme: Zonen mit `content_type: 'html'` (Spec §14) — dann rohes HTML in `zone.html`.
3. **Kein AI-Layer in der App** (keine Anthropic/OpenAI/Ollama-Calls). Einzige AI-Schnittstelle ist der MCP-Server.
4. **State lebt im Zustand-Store** ([src/store/presentation.ts](src/store/presentation.ts)), kein lokaler React-State für Präsentationsdaten.
5. **Rust für I/O, React für UI.**
6. UUIDs für Zone-IDs (`crypto.randomUUID()` / `uuid::new_v4()`).
7. Keine Breaking Changes am Dateiformat ohne `version`-Bump.

## Architektur-Entscheidungen (dieser Session)

- **MCP-Sync (Phase 4, umgesetzt):** **Live über lokalen Socket**. Eine Binary, zwei Modi
  (`slideo` = App, `slideo mcp` = stdio-Server). Die App ([ipc.rs](src-tauri/src/ipc.rs))
  öffnet einen TCP-Socket (127.0.0.1, Port in `<config>/slideo/ipc.json`), hält den
  autoritativen State, mutiert via [tools.rs](src-tauri/src/tools.rs) und emittiert Tauri-Events
  (`mcp:presentation`, `mcp:active-slide`) → Frontend-Bridge
  ([mcp-bridge.ts](src/lib/mcp-bridge.ts)) spiegelt live in den Store; das Frontend pusht
  Änderungen via `sync_presentation` zurück (kein Echo, da der Sync-Command kein Event
  feuert). MCP-Protokoll ([mcp.rs](src-tauri/src/mcp.rs)) ist **hand-gerolltes JSON-RPC 2.0**
  (bewusste Abweichung von Spec §10/rmcp — rmcp ist 0.1→0.16 stark gewandert, der stdio-Teil
  ist nur ein dünner Weiterleiter).
- **MCP-Ziel-Registrierung mit Startauswahl ([mcp_registration.rs](src-tauri/src/mcp_registration.rs)):**
  Slideo meldet sich als MCP-Server bei **genau einem** von drei Zielen an, die anderen zwei
  werden dereginstriert (kein Doppel-Eintrag): `desktop` (Claude Desktop,
  `claude_desktop_config.json`), `meta` (Meta-MCP, lokaler Aggregator-Proxy auf
  `http://localhost:3663`), `claude` (Claude Code, `~/.claude.json`, User-Scope). Beim Start
  wird der Zustand **idempotent** hergestellt (Ziel registrieren, andere entfernen) —
  Reihenfolge: erst registrieren, nur bei Erfolg die anderen aufräumen (Meta-MCP down ⇒ Fehler
  melden, **nichts** still woanders eintragen). Ziel-Auflösung: CLI-Flag `--mcp-target=meta|claude|desktop`
  > persistiert (`<config>/slideo/mcp.json`) > Default (**Claude Desktop, sonst Meta-MCP falls
  erreichbar, sonst Claude Code**). **Erststart:** Ist noch nichts persistiert (und kein CLI-Flag),
  registriert der Start **nichts** — `status().configured == false` triggert das Erststart-Modal
  ([McpSetupModal.tsx](src/components/modals/McpSetupModal.tsx)) mit vorausgewähltem Default; erst
  „Aktivieren" (`mcp_set_target`) trägt den Server ein. Ziel-Karten geteilt zwischen Modal und
  Settings ([McpTargetCards.tsx](src/components/ui/McpTargetCards.tsx)). Meta-MCP: registrieren per `POST /register` (dedupe per name),
  deregistrieren per Datei-Edit der `com.metamcp.desktop/config.json` (`servers`, nur `name=="slideo"`,
  `profiles`/`active_profile` unangetastet). Claude Desktop/Code: direktes Editieren von `mcpServers`
  (nicht via `claude`-CLI — GUI-Apps erben den Shell-PATH nicht). HTTP gegen Meta-MCP ist
  hand-gerollt über std-TCP (kein HTTP-Crate). UI: Einstellungen → „KI-Verbindung (MCP)"
  ([SettingsModal.tsx](src/components/modals/SettingsModal.tsx)), Commands `mcp_status`/`mcp_set_target`.
- **Renderer ohne Tailwind im Iframe:** Slide-Inhalt wird über CSS-Custom-Properties
  (Tokens) + eigenes Stylesheet gerendert ([src/lib/renderer.ts](src/lib/renderer.ts)),
  damit die Page offline/self-contained bleibt. Tailwind ist nur App-Chrome.
- **`.slideo` Reader/Writer** arbeiten bewusst mit `serde_json::Value` (preserve_order),
  nicht mit typisierten Structs → Schema-Hoheit bleibt beim Frontend, saubere Git-Diffs.

## Design-System (App-Chrome)

Ästhetik: **light, minimalistisch, premium** — orientiert an Penwright (vswrite-desktop).
Gilt nur fürs App-Chrome; Slide-Inhalt/Tokens sind davon unabhängig.

- **Farben** (Tailwind `chrome.*` in [tailwind.config.ts](tailwind.config.ts)): bg `#fafafa`,
  surface `#ffffff`, border `#ececec`, text `#1a1a1a`, ein ruhiger Blau-Akzent
  (`accent #4f7df9`, für Text/Buttons auf Weiß `accent-600 #2f63e6` wegen WCAG AA),
  Custom-HTML-Zonen = gedämpfte Terrakotta (`warn`).
- **Icons:** Google **Material Symbols** (Outlined), selbst-gehostet via npm `material-symbols`
  (offline, kein CDN) — Wrapper [src/components/ui/Icon.tsx](src/components/ui/Icon.tsx), Default wght 300.
  Keine Emoji/Unicode-Glyphen.
- **Prinzipien:** Hierarchie über Typo + dünne 1px-Borders statt Schatten; Hover sehr subtil
  (bg ODER text, nicht beides); Tabs als Unterstrich-Indikator; sichtbare Focus-Rings;
  `prefers-reduced-motion` respektiert. Restraint > Dekoration.

## Befehle

```bash
npm run dev          # Browser-only UI-Loop (kein Datei-I/O)
npm run tauri:dev    # volle Desktop-App
npm run typecheck && npm run build
cd src-tauri && cargo check && cargo test
```

## Stand

MVP funktional komplett (Phasen 1–5): Editor, HTML-Zonen, Live-Preview, Präsentationsmodus +
integrierte Speaker-View, MCP-Server, Undo/Shortcuts/Toasts/Close-Guard.

**Roadmap §18 (umgesetzt):** Speaker-Notes (§18.2), HTML- & PDF-Export + Teilen (§18.4/18.5),
Themes/Presets (§18.6), Folien-Transitions (§18.3), Bild-Positionierung „Light" **und „Medium"**
(§18.1: Bild-Toolbar + **Block-Drag in der interaktiven Vorschau** + automatische `+++`-Spalten),
Komponenten-Bibliothek + erweiterter Agenten-Skill (§18.7).

**Roadmap §19 (umgesetzt):** Daten-Diagramme (§19.2: `line_chart`/`donut_chart`, 9 Komponenten
gesamt), Barrierefreiheit (§19.7: Alt-Text + WCAG-Kontrast), **In-Folien-Builds** (§19.1:
`set_zone_reveal`, parent-autoritative Präsentations-Nav — Auto-Animate offen), Vorlagen & Marke
(§19.4: **Custom-Fonts** + **Logo/Brand** + **Starter-Templates**), Suchen & Ersetzen + Spellcheck (§19.9).
**MCP-Tools: 30** (war 23) — neu u.a. `set_zone_notes`, `set_zone_reveal`, `list_presets`/`apply_preset`,
`set_transition`, `list_components`/`insert_component`.

**Wichtig (Architektur):** Visuelles Umsortieren passiert in der **Vorschau** (`renderFullPage({editable:true})`
umhüllt Blöcke, Drag-Script → `slideo:reorder-blocks` → Store `reorderZoneBlocks`), NICHT im
Markdown-Editor — der zeigt das Folien-Design nicht. Slideo bleibt flussbasiert (Reihenfolge, kein x/y).

**Konventionen aus dieser Roadmap-Session:**
- **Single Source of Truth über die FFI-Grenze:** Presets in [src/lib/presets.ts](src/lib/presets.ts)
  **und** [src-tauri/src/presets.rs](src-tauri/src/presets.rs) gespiegelt halten (wie `DEFAULT_TOKENS`).
  Komponenten leben **nur** in Rust ([src-tauri/src/components.rs](src-tauri/src/components.rs)) — eine
  künftige UI-Palette soll denselben Generator via Tauri-Command nutzen (keine TS-Duplikation).
- **Token-Pflicht für Komponenten/HTML:** ausschließlich `var(--color-*)`/`var(--font-*)`/
  `var(--border-radius)` — nie hartkodierte Farben/Fonts, sonst nicht themebar.
- **Bild-Positionierung:** Default-Bilder bleiben Markdown `![]()`; mit Größe/Ausrichtung/Float
  werden sie als rohes `<img style="width:.." class="align-*|float-*">` serialisiert
  ([src/lib/tiptap-image.ts](src/lib/tiptap-image.ts)) — round-trip-sicher über markdown-it.
- **Transitions:** `meta.transition` (additiv, optional); Renderer-Deck-Modus nur bei `present`
  und `kind!=='none'` — Scroll-Snap-Default bleibt unangetastet & abwärtskompatibel.
- **WKWebView-Lücken → Pointer-Events / kein nativer Browser-Convenience-Call:** HTML5-DnD und
  `window.print()` sind unzuverlässig. Block-Drag/Bild-Resize laufen über Pointer-Events;
  PDF via `open_print_view` (Temp-Datei → Standardbrowser).
- **Builds parent-autoritativ:** PresentationMode hält Folie+Schritt, Audience-Iframe hat keine
  eigene Tastatur (nur Standalone-Export), reagiert nur auf `slideo:show {index, step}`.
- **Additive Datenmodell-Felder** (optional, `version` bleibt "1.0"): `meta.transition`, `meta.logo`,
  `zone.reveal`, `presentation.fonts`, Bild-`width/align/float`.

Offen (Post-MVP): GUI-Verifikation der §18/§19-Features; **§19.3 Presenter-Tools** (Übersicht/Sprung,
Laser/Stift, echtes Zweitfenster, Auto-Advance), **Auto-Animate/Morph**, **§19.5 PPTX-Export**,
**Outline-Modus + Versionshistorie**, **§19.8 Medien** (Drag&Drop-Import, Crop, Aufnahme),
**Komponenten-Palette** (Polish), Asset-Positionierung „Large", Cross-Platform-Builds + Signing,
Font-Subset. Siehe [README.md](README.md) und [docs/next-steps.md](docs/next-steps.md).
