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
- **Icons:** Google **Material Symbols** (Outlined), selbst-gehostet (offline, kein CDN) — Wrapper
  [src/components/ui/Icon.tsx](src/components/ui/Icon.tsx), Default wght 300. Keine Emoji/Unicode-Glyphen.
  **Auf die genutzten Icons subgesetzt** (Audit P1, ~42 KB statt ~3,63 MB; Variations-Achsen erhalten):
  gerendert per **Codepoint** ([icon-codepoints.ts](src/lib/icon-codepoints.ts) + [material-symbols.css](src/styles/material-symbols.css)),
  nicht per Ligatur. **Neues Icon → Name in [scripts/icon-names.txt](scripts/icon-names.txt) + `npm run icons:subset`**
  (sonst zeigt Icon.tsx den Klartext-Namen als sichtbaren Hinweis).
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
Komponenten-Bibliothek + erweiterter Agenten-Skill (§18.7) + **Komponenten-Palette im Editor**
(§18.7-Rest: UI-Klick-Einfügen mit Parameter-Formularen & Live-Vorschau).

**Roadmap §19 (umgesetzt):** Daten-Diagramme (§19.2: `line_chart`/`donut_chart`, **10 Komponenten**
gesamt inkl. `icon`), Barrierefreiheit (§19.7: Alt-Text + WCAG-Kontrast), **In-Folien-Builds + Auto-Animate**
(§19.1: `set_zone_reveal`, parent-autoritative Präsentations-Nav, **Übergang `auto`** = FLIP-Morph gleicher
`data-id`-Elemente), Vorlagen & Marke
(§19.4: **Custom-Fonts** + **Logo/Brand** + **Starter-Templates**), Suchen & Ersetzen + Spellcheck + **Versionshistorie** (§19.9; Outline-Modus später entfernt),
**Presenter-Tools** (§19.3: **Folien-Übersicht/Sprung-Grid**, **Laser-/Stift-Overlay**, **Auto-Advance/Loop**,
**echtes Zweitfenster** = randlos bildschirmfüllendes „projector"-Fenster auf gewähltem Monitor), **Medien**
(§19.8: **Drag&Drop-Import**, **Bild-Crop**, **Icon-Inline-SVG** — Aufnahme/Narration **bewusst weggelassen**, s.u.), **PPTX-Export**
(§19.5: native Rekonstruktion via pptxgenjs).
**MCP-Tools: 37** (war 23) — neu u.a. `set_zone_notes`, `set_zone_reveal`, `list_presets`/`apply_preset`, `check_zone_overflow`/`validate_deck`,
`set_transition`, `list_components`/`insert_component`, sowie (MCP-Parität) `set_logo`/`clear_logo`,
`register_font`, `set_presentation_title`, `set_zone_label`.

**Wichtig (Architektur):** Visuelles Umsortieren passiert in der **Vorschau** (`renderFullPage({editable:true})`
umhüllt Blöcke, Drag-Script → `slideo:reorder-blocks` → Store `reorderZoneBlocks`), NICHT im
Markdown-Editor — der zeigt das Folien-Design nicht. Slideo bleibt flussbasiert (Reihenfolge, kein x/y).

**Konventionen aus dieser Roadmap-Session:**
- **Single Source of Truth über die FFI-Grenze:** Presets in [src/lib/presets.ts](src/lib/presets.ts)
  **und** [src-tauri/src/presets.rs](src-tauri/src/presets.rs) gespiegelt halten (wie `DEFAULT_TOKENS`).
  Komponenten-**Generator** lebt **nur** in Rust ([src-tauri/src/components.rs](src-tauri/src/components.rs)).
- **Komponenten-Palette (§18.7-Rest, umgesetzt):** Editor-UI ([ComponentPaletteModal.tsx](src/components/modals/ComponentPaletteModal.tsx)),
  geöffnet aus ZoneToolbar/Topbar (`openModal('components')`). Nutzt **denselben** Rust-Generator über die
  Tauri-Commands `list_components`/`render_component` ([commands.rs](src-tauri/src/commands.rs)) — **keine
  TS-Duplikation der HTML-Templates**. Der **Katalog** kommt zur Laufzeit aus `list_components` (Rust =
  Single Source; eine künftige Rust-Komponente erscheint automatisch). In TS lebt nur das **Eingabe-Formular-
  Schema** ([component-forms.ts](src/lib/component-forms.ts)) — welche Felder die Palette pro Typ zeigt + wie
  daraus `params` gebaut wird (reine UI-Belange ohne Rust-Äquivalent; fehlt ein Typ → „mit Standardwerten
  einfügen"). **Live-Vorschau:** sandboxed `<iframe sandbox="" srcDoc>` mit Token-`:root`-Variablen, gedrosselt
  über `render_component`. **Einfügen** via Store-Action `insertComponent({targetZoneId, placement, html})`:
  `new` (neue HTML-Folie, Default & sicher), `append` (an HTML-Zone), `replace` (leere Zielzone) — eine
  nicht-leere **Markdown**-Folie wird nie überschrieben (dann nur „neue Folie"). Nur in der Desktop-App
  (Browser-Dev: Commands werfen → Palette degradiert mit Hinweis).
- **Token-Pflicht für Komponenten/HTML:** ausschließlich `var(--color-*)`/`var(--font-*)`/
  `var(--border-radius)` — nie hartkodierte Farben/Fonts, sonst nicht themebar.
- **Bild-Positionierung:** Default-Bilder bleiben Markdown `![]()`; mit Größe/Ausrichtung/Float
  werden sie als rohes `<img style="width:.." class="align-*|float-*">` serialisiert
  ([src/lib/tiptap-image.ts](src/lib/tiptap-image.ts)) — round-trip-sicher über markdown-it.
- **Transitions:** `meta.transition` (additiv, optional); Renderer-Deck-Modus nur bei `present`
  und `kind!=='none'` — Scroll-Snap-Default bleibt unangetastet & abwärtskompatibel.
- **WKWebView-Lücken → Pointer-Events / kein nativer Browser-Convenience-Call:** HTML5-DnD-Element-
  verschieben und `window.print()` sind unzuverlässig. Block-Drag/Bild-Resize laufen über Pointer-Events;
  PDF via `open_print_view` (Temp-Datei → Standardbrowser). **Canvas-Taint:** Rastern von HTML→Bild
  (`foreignObject` → Canvas) verseucht im WKWebView das Canvas → `toDataURL` schlägt fehl. Deshalb ist
  **PPTX bewusst nativ rekonstruiert** ([pptx.ts](src/lib/pptx.ts), pptxgenjs: Textboxen + Bilder +
  Token-Hintergründe, in PowerPoint editierbar) statt bild-basiert. Bild-**Crop** ([CropModal.tsx](src/components/modals/CropModal.tsx))
  ist erlaubt, weil das Crop eines *normalen Rasterbildes* (kein foreignObject) kein Canvas-Taint auslöst.
- **Drag&Drop-Medienimport (§19.8):** In der Desktop-App `"dragDropEnabled": false` in
  [tauri.conf.json](src-tauri/tauri.conf.json), sonst fängt Tauri den OS-Drop ab und die HTML5-DnD-Events
  der WebView (`dataTransfer.files`) feuern nicht. ZoneCard nutzt einen Enter/Leave-Tiefenzähler.
- **PPTX dynamisch importiert:** `import('pptxgenjs')` + `import('@/lib/pptx')` erst beim Export
  (eigener Vite-Chunk) — hält den Initial-Bundle klein. Schreiben über Rust `export_pptx` (base64→Bytes).
- **Builds parent-autoritativ:** PresentationMode hält Folie+Schritt, Audience-Iframe hat keine
  eigene Tastatur (nur Standalone-Export), reagiert nur auf `slideo:show {index, step}`.
  `activeSlideIndex` lebt im Store und kann **extern** wandern (MCP `set_active_slide`,
  `applyExternalPresentation`); damit der lokale `step` nicht veraltet, klemmt ihn ein Effekt
  in [PresentationMode.tsx](src/components/presentation/PresentationMode.tsx) auf den gültigen
  Bereich der aktiven Folie (`[activeSlideIndex, presentation]`).
- **Presenter-Tools (§19.3) sind reine Präsentationszeit-UI:** Übersicht/Laser/Stift/Auto-Advance
  leben als **lokaler State** in [PresentationMode.tsx](src/components/presentation/PresentationMode.tsx)
  (nicht im Store, nicht persistiert) — sie verändern keine Präsentationsdaten, nur die Anzeige.
  Bei offener Übersicht übernimmt [SlideOverview.tsx](src/components/presentation/SlideOverview.tsx)
  die Tastatur (Capture-Listener); PresentationMode steigt dann früh aus. Annotationen werden über
  einen `key`-Remount (Folienindex + Lösch-Nonce) geleert. Kein Datenmodell-/Rust-Eingriff.
- **Editor-Shell: skalierbare + einklappbare Spalten + Reorder in der Folienliste (UX-Überarbeitung):**
  Drei frei skalierbare, **einzeln einklappbare** Spalten (Folienliste · Editor · Vorschau) in
  [EditorShell.tsx](src/components/ui/EditorShell.tsx): hand-gerollte [Splitter](src/components/ui/Splitter.tsx)
  (Pointer-Events, mit `pointercancel`/blur-Cleanup + `touch-none`), je Spalte ein Einklapp-Button + schmale
  Wieder-öffnen-Leiste; Breiten + Einklapp-Zustand persistent ([store/layout.ts](src/store/layout.ts),
  localStorage, beim Rehydrieren re-geclamped). Genau ein offener Bereich ist **elastisch** (Priorität
  Editor › Vorschau › Folienliste); ein `ResizeObserver` hält dem elastischen Bereich seine Mindestbreite
  (feste Bereiche weichen zurück) statt Überlauf; **mind. ein Bereich bleibt offen** (Store-Guard). Die
  **Folienliste** ([ZoneList](src/components/ui/ZoneList.tsx)) hat jetzt **Drag-Reorder** (dnd-kit, dieselbe
  `reorderZones`-Action wie der Editor; Klick = Auswahl via `distance:6`-Sensor). **Outline-Modus entfernt**
  (OutlineView/outline.ts/`editorView`/Topbar-Segmented-Control): redundant, seit Reorder/Einfügen/Löschen/Edit
  im Editor + der Folienliste liegen (Reorder war sein einziger exklusiver Nutzen); behebt nebenbei den
  „Editor verschwindet in der Gliederung"-Effekt. Reine UI-/Store-Änderung, kein Datenmodell-Eingriff.
- **Editor-Cleanup (umgesetzt, ersetzt Teile des Obigen — [editor-cleanup-plan.md](docs/editor-cleanup-plan.md) Punkt 1+2):**
  Die **linke Spalte (Sidebar) ist entfallen** — `Sidebar.tsx`/`ZoneList.tsx` gelöscht; [EditorShell.tsx](src/components/ui/EditorShell.tsx)
  ist jetzt **2-spaltig** (Editor · Vorschau), [store/layout.ts](src/store/layout.ts) auf 2 Panes vereinfacht
  (persist `version` 1→2, `migrate` verwirft alte `sidebar*`-Keys, `merge` re-clampt + garantiert „mind. ein Bereich
  offen"). **Reorder + Folien-Überblick laufen jetzt allein über die Editor-Karten** (Karten-Drag-Handle bleibt;
  bewusster Trade-off: bei sehr großen Decks weniger flottes Springen als eine schmale Liste). Der **Design-Tab**
  (TokenEditor) lebt als **deck-weites Overlay** ([DesignModal.tsx](src/components/modals/DesignModal.tsx),
  `openModal('design')`, Topbar-Button „Design" / Icon `palette`) statt als Dauer-Spalte. **Kontext-sensitive
  ZoneToolbar:** Layout- + Ausrichtung-Dropdowns nur noch für **Markdown**-Zonen (`!isHtml`; bei HTML überschreibt
  selbst-gestaltetes HTML diese `.layout-*`/`.align-*`-Klassen ohnehin). Redundanten **Topbar-„Komponente"-Button
  entfernt** (jede ZoneCard hat ihn). **Bild-„Größe"-Presets** (S/M/L/Voll) aus [ImageToolbar.tsx](src/components/editor/ImageToolbar.tsx)
  entfernt (Breite nur noch per stufenlosem Vorschau-Resize) + toter `IMAGE_SIZES`-Export weg. Reine UI-/Store-Änderung,
  `version` "1.0". Adversarial reviewt (4 Dimensionen, 0 bestätigte Findings); typecheck + vite build grün. **GUI-Check ausstehend.**
- **Design-System als „Brand Kit" (Produktrichtung, umgesetzt):** Web-Recherche bestätigt — „KI baut Deck → Mensch editiert
  drüber" ist realer Markttrend (Gamma: $100M ARR / $2,1 Mrd. Bewertung, ganz auf dem „blank page problem" gebaut; +
  CHI-2024/HBS-BCG-Studien: Editieren über KI-Drafts ist häufig **und** nötig). Konsequenz: das **globale** Design-System
  **bleibt** (Konsistenz-Motor + KI-Vertrag — die häufigste Mensch-Korrektur ist global „mach's in Markenfarben", nicht
  pro Folie), wird aber als **Brand Kit** entschlackt: [TokenEditor.tsx](src/components/tokens/TokenEditor.tsx) gegliedert
  (Themes · Farben · Schriften+Upload · Logo · Übergang prominent; die abstrakten Größen `font-size-base`/`spacing-base`/
  `border-radius` + „Zurücksetzen" unter eingeklapptem **„Erweitert"** — für KI/MCP voll verfügbar). Per-Folie-Abweichung
  bleibt über das vorhandene `custom_css` (token-fähig). Markt-Leitplanken: Beautiful.ai (zu starr → Eintönigkeit), Tome
  (zu wenig Kontrolle → eingestellt). Rein UI, alle 11 Tokens editierbar, kein Schema-Eingriff. Siehe [[ai-edit-over-workflow-thesis]].
- **Markdown-Direktmanipulation in der Vorschau (editor-cleanup Punkt 3, umgesetzt):** §20 (HTML-Elemente, Kind-Index-Pfad)
  ausgeweitet auf **ganze Markdown-Blöcke** (`.slideo-block`/`data-block-index`). Der `editScript`-Auswahl-Layer
  ([renderer.ts](src/lib/renderer.ts)) trägt jetzt zwei Arten über `selKind` ('element' | 'block'): **(3a)** Block
  auswählen/**duplizieren**/**löschen** (kein Verschieben/keine Ebenen — Flussmodell), Re-Select per `slideo:reselect-block`;
  **(3b) Inline-Text-Edit** *einfacher* Blöcke (genau ein `p`/`h1`–`h3` mit reinem Inline-Inhalt → `blockEditable`;
  komplexe Blöcke = Markdown-Editor). Beim Commit schickt das Iframe das **OUTER-HTML** des Elements; der Parent
  ([PreviewPane.tsx](src/components/preview/PreviewPane.tsx)) konvertiert es via **transienter Tiptap-Instanz**
  ([`htmlBlockToMarkdown`](src/lib/tiptap-markdown.ts), Option A = gleiche MD↔HTML-Regeln wie der Editor; ProseMirror-Schema
  sanitisiert `<script>`/`on*` by construction, Audit S4). Store-Actions `deleteZoneBlock`/`duplicateZoneBlock`/`editZoneBlock`
  ([presentation.ts](src/store/presentation.ts)) über `splitMarkdownBlocks` + Reassemble, **undoable** (`mutate`), bounds-checked.
  **Bewusster Tradeoff** (Review): anders als §20 (`expectTag`) tragen die Block-Ops keinen Inhalts-Stale-Schutz, nur
  Index-Bounds — akzeptiert (single-user, undoable; ein paralleler MCP-Edit *derselben* Zone im Sub-Sekunden-Commit-Fenster
  ist selten). Leerer/No-op-Inline-Commit hält die Vorschau konsistent (Original wiederherstellen statt Block leeren).
  **Nur Nicht-Split-Markdown-Zonen** (Wrapper entstehen via `editable && !isSplit`); split ausgenommen. **Kein Schema-Eingriff**
  (`version` "1.0", nur `zone.markdown`). **Kein JS-Test-Runner im Projekt → Round-Trip ist GUI-zu-verifizieren** (Plan-Tests
  3.8 konnten headless nicht laufen). GUI-Check ausstehend.
- **Versionshistorie (§19.9-Rest, umgesetzt):** lokale `.slideo`-Snapshots in
  `<config>/slideo/history/<deck-key>/` ([history.rs](src-tauri/src/history.rs)) — je Snapshot eine **volle
  `.slideo`-Kopie** (Reuse von `file::write_presentation`/`read_presentation`) + `index.json` (neueste zuerst).
  `<deck-key>` = sanitisierter Dateistamm + `DefaultHasher`(Pfad) → Historie hängt am **Speicherort** (nicht
  portabel; Git-UI ist Spec §12). **Auto-Snapshot beim Speichern** ([savePresentation](src/store/presentation.ts),
  still + fire-and-forget, **dedupliziert**: kein Snapshot wenn `presentation.json` unverändert) **+ manuelle
  Schnappschüsse** mit Beschriftung. **Kappung 50**: bevorzugt älteste **Auto**-Snapshots, manuelle bleiben —
  der gerade erzeugte (Index 0) wird **nie** gekürzt. **Wiederherstellen** ist undoable (`pushHistory`) und
  lässt den Dateipfad unverändert (zum Übernehmen speichern). Tauri-Commands `list_snapshots`/`create_snapshot`/
  `restore_snapshot`/`delete_snapshot`; Snapshot-IDs path-traversal-validiert (`valid_id`), Index-Read-Modify-Write
  über prozessweiten `index_lock()` serialisiert. UI: [HistoryModal.tsx](src/components/modals/HistoryModal.tsx),
  Topbar-Uhr-Icon (`openModal('history')`).
- **Auto-Animate/Morph (§19.1-Rest, umgesetzt):** deck-weiter Übergangstyp **`auto`** (`meta.transition.kind`,
  additiv). Im Deck-Modus liegen alle Folien gestapelt im DOM → beim benachbarten Wechsel vermisst das Iframe-
  **Nav-Script** ([renderer.ts](src/lib/renderer.ts)) Quell-/Ziel-Rects gleicher **`data-id`**-Elemente und
  morpht sie per **FLIP** (Transform; im WKWebView zuverlässig). Aktive Folie erscheint sofort (Magic-Move,
  opaker Hintergrund deckt ab; `is-prev` fadet als Sicherheitsnetz für transparente Hintergründe). Morph nur
  bei **animierter** Navigation (`smooth`) — initiales Laden/View-Wechsel (`smooth:false`), nicht-benachbarte
  Sprünge und **`prefers-reduced-motion`** schalten hart um. Fragment-Sichtbarkeit der Zielfolie wird **vor**
  dem Morph gesetzt (kein Aufblitzen verdeckter Builds). Läuft in In-App-Präsentation **+ Standalone-Export**.
  `data-id` via HTML-Zone oder `insert_component(data_id)`/Palette → Rust [`components::with_data_id`](src-tauri/src/components.rs)
  **injiziert** das Attribut ins erste Tag (kein Wrapper-`<div>` → FLIP misst die echte Box), sanitisiert
  (`[A-Za-z0-9-_:]`, ≤64). Markdown-Zonen können kein `data-id` tragen (cross-faden nur). Kein Datenmodell-Bruch.
- **Echtes Zweitfenster / Presenter-Modus (§19.3-Rest, umgesetzt):** separates Tauri-Fenster `projector`
  ([present.rs](src-tauri/src/present.rs)) zeigt die Folien **randlos bildschirmfüllend** auf dem im Dropdown
  gewählten Monitor (`list_monitors`/`open_presentation_window`/`close_presentation_window`). Bewusst
  **kein natives Vollbild** (macOS landet sonst auf dem falschen Display) — stattdessen `set_position`+`set_size`
  auf den Monitor. Das Fenster lädt `index.html?role=projector` → [main.tsx](src/main.tsx) rendert
  [ProjectorView.tsx](src/components/presentation/ProjectorView.tsx) (nur Folien-Iframe, **kein** App/MCP-Bridge),
  holt das Deck aus dem `AppState` (`get_presentation`/`get_assets` — vom Hauptfenster gespiegelt). **Sync über
  Tauri-Events** (fensterübergreifend): Steuerfenster emittiert `slideo:nav {index,step}`; Projector meldet
  `slideo:projector-ready` (Controller antwortet mit aktuellem Stand) und folgt; vom Nutzer geschlossenes Fenster
  → `slideo:projector-closed`. **Deck-Frische:** `slideo:deck-changed` feuert die mcp-bridge **nach** dem
  (debounced) AppState-Sync → Projector lädt mit frischen Daten neu; `presentOnMonitor` erzwingt vorab einen Sync.
  Eigene minimale [Capability](src-tauri/capabilities/projector.json) (`core:default`+`core:event`). Ein-Fenster-
  Modus (`s`) bleibt. **v1-Grenzen:** Laser/Stift im Zwei-Bildschirm-Modus deaktiviert; Live-Edits laden das
  Folien-Fenster kurz neu; Multi-Display-Platzierung braucht GUI-Verifikation.
- **MCP-Parität (Prinzip Spec §13):** Audit ergab — alles Dokument-Authoring ist über MCP erreichbar; ergänzt
  wurden `set_logo`/`clear_logo`, `register_font`, `set_presentation_title`, `set_zone_label` (referenzieren
  vorhandene Assets — die KI lädt keine Binärdateien hoch). Bewusst **nur Mensch:** Asset-Binär-Upload/Crop,
  lokale Datei-Exporte, Undo/Snapshots, Laufzeit-/Display-Steuerung. Bei neuen menschlichen Dokument-Aktionen
  immer prüfen, ob ein MCP-Tool dafür existiert.
- **Additive Datenmodell-Felder** (optional, `version` bleibt "1.0"): `meta.transition` (kind inkl. `auto`),
  `meta.logo`, `zone.reveal`, `presentation.fonts`, Bild-`width/align/float`. (Snapshots sind separate
  `.slideo`-Dateien, kein Schema-Eingriff.)
- **Direktmanipulation in der Vorschau (§20, Phase 0–3 umgesetzt):** Korrektur-Layer über KI-erzeugtem HTML —
  Elemente **in der rechten Vorschau** anklicken (→ Quelle im HTML-Editor **sichtbar markiert**, „Klick → Quelle"),
  auswählen, **Text inline bearbeiten** (Doppelklick/✎), **verschieben** (Drag → absolute %-Position), **duplizieren**,
  **löschen**. **Nur HTML-Zonen**; Flussmodell unangetastet. Adressierung über **Kind-Index-Pfad ab
  `.slideo-content`** (kein Schema-/`data-*`-Eingriff; resolveAssetRefs ändert nur Attributwerte, nicht Struktur).
  Ops über `DOMParser` auf dem **rohen** `zone.html` ([dom-edit.ts](src/lib/dom-edit.ts) `applyElementOp`,
  `recordHistory=true` → Cmd/Z via Store-Action `applyZoneElementOp`), Auswahl-Layer **per Pointer-Events** im
  `editScript(directEdit)` ([renderer.ts](src/lib/renderer.ts), Overlays im Iframe, nur `postMessage`,
  Mini-Toolbar ▲/✎/⧉/🗑, Re-Select-Handshake `slideo:reselect` nach dem 220-ms-Re-Render), Toggle `previewEdit` +
  `htmlReveal` ([ui.ts](src/store/ui.ts)). HTML-Zonen tragen die Klasse `slideo-zone-html`. **„Klick → Quelle"**
  (`findSourceRange`) ist am **selben DOMParser-Parse** verankert wie die Ops (keine Divergenz bei implizitem
  `<tbody>`/Auto-Close) + **Zuverlässigkeits-Guard**: bei vom HTML5-Parser synthetisierten/verworfenen
  gleichnamigen Elementen (leeres `<p>` aus verirrtem `</p>`, Foster-Parenting) lieber **keine** Markierung als
  eine falsche. **Stale-Pfad-Schutz:** Ops führen den erwarteten `tag` mit (`expectTag`) → paralleler MCP-Edit
  trifft nicht das falsche Element (No-op). `Delete` löscht (Backspace bewusst nicht); Fokus bleibt im Iframe
  (`htmlReveal.focusEditor:false`) → „Klick → Quelle" markiert per **fokus-unabhängiger CodeMirror-Dekoration**
  (nicht via nativer Selektion), damit die Iframe-Tastatur-Ops laufen. **Undo:** das Iframe leitet `Cmd/Ctrl+Z`
  (außer in Eingabefeldern) per `slideo:undo` an den Parent-`undo()` (sonst greift der Fenster-Undo nicht, weil der
  Fokus im sandboxed Iframe liegt). **Phase 2 (Inline-Text):** Doppelklick/✎ → `contenteditable`, Enter/Blur committet,
  Esc verwirft (Restore via `editOrig`). Editierbar nur **Inline-Container** (`isInlineEditable` = alle direkten Kinder
  inline) → Commit schickt das **Inline-HTML**, `applyElementOp('editText')` setzt `el.innerHTML = sanitizeInline(html)`
  (behält span/a/strong/style/`data-id`, verwirft `<script>`-Tags+Inhalt, `on*`/`javascript:`/`url()`); Block-Container
  (Karten/Komponenten) sind gesperrt (kein Flatten), doppelt geguarded. **Phase 3 (Verschieben + „Folie einfrieren"):**
  Drag des ausgewählten Elements (Schwelle 4 px, live `transform` → kein Reflow während des Drags). **Freeze-on-first-
  move am Fluss-Eltern:** ist das gezogene Element im Fluss, werden dessen Fluss-Geschwister absolut an Ist-Position+
  Größe gepinnt und — bei verschachteltem Eltern P — P auf seine **Ist-Höhe** fixiert (**nur `height`, keine
  Positionsänderung → kein neuer Containing-Block**, sonst verspringen bereits-absolute Geschwister), damit P nicht
  kollabiert und `%`-positionierte Geschwister (z.B. `top:171%` rel. P) **nicht springen** (`slideo:freeze-zone` →
  `freezeZoneLayout`/`applyFreezeLayout`, `margin:0`+`box-sizing`+`width%`, je Item `expectTag`-Stale-Schutz); danach
  repositioniert `slideo:move-element`/`move` nur das einzelne Element. Bezugsrahmen = **bestehender, tatsächlicher**
  Containing-Block (`moveCb`/`createsCB`: nächster Vorfahre mit `position`/`transform`/`filter`/`perspective`, sonst
  `.slideo-content`-falls-positioniert, sonst Zone — **nicht** `offsetParent`). `margin:0` → pixelgenau;
  `suppressClick` nur bei echtem `pointerup`; `position:fixed` = no-op (viewport-gepinnt). (v1: ~100vh-Folien + ein
  Verschachtelungs-Level optimal; tiefere auto-height-Ketten / sehr lange Scroll-Zonen können driften; **Custom-CSS
  sollte `.slideo-content` nicht selbst positionieren** — nicht über `zone.html` pinnbar → Top-Level-Freeze könnte
  kollabieren.)
  **Kein Schema-Eingriff** (`version` "1.0"; nur HTML-Inhalt ändert sich — Live-DOM-Mutationen wie
  `cursor`/`contenteditable` landen NICHT in `zone.html`, da die Ops das rohe HTML via DOMParser bearbeiten)
  ([direct-manipulation-plan.md](docs/direct-manipulation-plan.md)).
- **Feste 16:9-Folien-Bühne + Scale-to-fit (§21):** Folien sind logisch **1280×720** (`.slideo-zone`,
  `overflow:hidden`=clip), gewickelt in `.slideo-frame` (Layout-/Nav-Einheit, `display:grid; place-items:center`);
  die Zone wird per `transform: scale(var(--slideo-scale))` eingepasst. Skalierung per JS im Iframe (`navScript`
  `sldFit()` → `--slideo-scale` + `window.__sldScale`, neu bei `resize`): **Vorschau** `present:false` = fit-width
  (`clientWidth/1280`, Frames `aspect-ratio:16/9` gestapelt+scroll); **Präsentation** `present:true` = fit-both
  (`min(innerW/1280,innerH/720)`, Letterbox); **Print** 1:1 (Frame=Seite, `transform:none`); **Thumbnail/Speaker**
  `renderSingleZonePage` = fit-both contained (SpeakerView rendert current+next je einzeln). Ersetzt das alte
  responsive `min-height:100vh`-Modell → behebt das §20-Out-of-bounds beim Resize (alles skaliert gemeinsam),
  vereinheitlicht Vorschau/Präsentation/Export/Print. **Skalierungs-Wechselwirkung:** `getBoundingClientRect` ist in
  der skalierten Zone Bildschirm-px, `clientWidth/Height/Left/Top` aber **unskalierte Layout-px** → ALLE px/Transform-
  Stellen durch `window.__sldScale` (`s`) korrigieren: **`pctFromRect`** (§20-%-Positionen) teilt die rect-Anteile +
  Maus-Delta durch `s` (die `client*` bleiben außerhalb `/s`) — **NICHT** von selbst scale-invariant (Zähler
  skaliert/Nenner `clientWidth` unskaliert)! Drag-`translate(d/s)`, Freeze-`heightPx=rect.h/s`,
  Auto-Animate-FLIP-`translate(d/SC)` (Morph-`scale` bleibt = echtes `rect/rect`-Verhältnis; nur Bild-Resize ist von
  Haus aus invariant). Nav/Transitions/Snap laufen auf
  `.slideo-frame` (nicht `.slideo-zone`). Reine Render-/CSS-Änderung, `version` "1.0". (v1: Überlauf wird geclippt,
  kein Auto-Verkleinern.) **KI lernt das Format:** die MCP-`instructions` (Regel 0 „FORMAT" + HTML-Regel 8) und
  `slideo_guide` ([tools.rs](src-tauri/src/tools.rs)) lehren das feste 1280×720 + **Safe-Area** (x 64–1216 / y 64–656),
  damit AI-Decks nicht überlaufen — Anweisung, keine harte Garantie (MCP-Server misst kein Layout). **Nach Änderung
  der instructions: cargo build + Claude Desktop neu starten** (sonst altes MCP-Binary).
- **Security-Härtung (Audit 2026-06-26, Spec §22, umgesetzt auf Branch `security-hardening`):** Multi-Agent-
  Performance-/Security-Audit der Gesamt-App (adversarial gegengeprüft) → **kein high/critical**, solide Kern-Isolation;
  Vollreport [docs/audit.md](docs/audit.md). Gehärtet: **(S1)** der lokale IPC-Steuer-Socket (App↔`slideo mcp`) verlangt
  jetzt ein beim Start erzeugtes **Shared-Secret-Token**, `ipc.json` wird **0600** angelegt, Anfragen ohne Token werden
  abgewiesen, 16-MiB-Cap je Verbindung ([ipc.rs](src-tauri/src/ipc.rs)); **(S2/S3) CSP** — App-CSP (`script-src 'self'`)
  in [tauri.conf.json](src-tauri/tauri.conf.json) statt `null` (+ `devCsp`, Vite-`modulePreload.polyfill=false`) **und**
  eine **eigene strikte CSP** (`default-src 'none'; connect-src 'none'`) in die **In-App**-Folien-Iframes
  ([renderer.ts](src/lib/renderer.ts) `SLIDE_CSP_META`, nur `!standalone` + `renderSingleZonePage`), weil `app.security.csp`
  **nicht** in die opaken Iframes propagiert; **(S5–S9)** print-Iframe `sandbox`, `mcp_registration::write_json` atomar +
  **rechtebewahrend** (kein 0600→0644-Downgrade von `~/.claude.json`), `.slideo`-Reader-Caps (Decompression-Bomb), zufälliger
  print-Temp-Name. **(S4)** Editor-`html:true` ist by-construction sicher (ProseMirror-Schema verwirft `<script>`/`onerror`).
  `cargo audit` **0 Vulns** (nur unmaintained-Warnungen, v.a. Linux-GTK).
  **Bewusste Verhaltensänderung (S3):** In-App-Folien laden **keine externen Netzressourcen** mehr (fetch/externe Bilder/
  `<script src>`/externe Embeds) — passt zur „läuft lokal"-Zusage; der **Standalone-Export bleibt offen** (geteilte Decks
  dürfen extern laden). **Restgrenze (S1):** ein Same-UID-Prozess kann `ipc.json` lesen (akzeptiert — gleicher Nutzer hat
  ohnehin Nutzer-Rechte). **GUI-Verifikation ausstehend:** beide CSP-Schichten sind laufzeitabhängig → vor Release auf echtem
  `tauri:dev`/`tauri build` (macOS **und** Windows) auf CSP-Verstöße prüfen (App lädt, MCP-IPC/Projector, Nav/§20/Auto-Animate,
  Video/Audio-Streaming). Headless grün: **cargo test 33** (+4 neue Tests), typecheck, vite build.
- **Zonen-Links / nicht-lineare Navigation (Spec §23, umgesetzt):** Folien können aufeinander verlinken
  (Inhaltsverzeichnis → Sprung → Rücksprung). **Sprung-Attribut `data-slideo-goto`** (Wert = **Zonen-UUID**
  umsortier-fest **oder** 1-basierte **Foliennummer**) auf jedem klickbaren Element. Alles läuft durch den **einen**
  Navigations-Trichter `go(i, smooth)` ([renderer.ts](src/lib/renderer.ts) `navScript`), **nie** nativer `#hash`-Scroll
  (scheitert im Deck-Modus stumm). Delegierter Klick-Handler + `resolveGoto` (UUID→Index-Map aus
  `<section id="zone-…">`): **Standalone** ruft `go()` direkt; **in-app** postet das anzeige-only-Iframe
  `slideo:goto-request {index}` → parent-autoritativ (PresentationMode → `doJump`, PreviewPane → `setActiveZone`,
  ProjectorView → Tauri `slideo:projector-goto` ans Steuerfenster). `hashchange`-Shim macht schlichte
  `href="#zone-<UUID>"`/Markdown-`#`-Links überall first-class (+ Browser-Zurück). **Zurückkommen = expliziter
  Rücksprung-Link** (kein History-Stack — bewusst, weil dokument-artig + in App/Standalone identisch). Im
  **Direktbearbeiten-Modus (§20)** unterdrückt `window.__sldDirectEdit` (gesetzt in `editScript`) die Sprung-Klicks
  (dort selektiert der Klick). **Authoring:** neue **Rust-`toc`-Komponente** ([components.rs](src-tauri/src/components.rs),
  token-gestylt, `items:[{label,target}]`, Ziel via `safe_goto` `[A-Za-z0-9-_:]`≤64 sanitisiert) → erscheint in
  `list_components`/Palette ([component-forms.ts](src/lib/component-forms.ts)); MCP-`instructions`+`slideo_guide`
  lehren es (Punkt 11). **Mensch zusätzlich per Direktmanipulation (§20):** Element in HTML-Zone auswählen →
  Toolbar-Knopf „Link" → Ziel-Folie aus Popover ([PreviewPane](src/components/preview/PreviewPane.tsx)); Element-Op
  **`setGoto`** ([dom-edit.ts](src/lib/dom-edit.ts), `safeGoto` spiegelt Rust, Ziel = Zonen-UUID, undobar, „Link
  entfernen") — im Direktbearbeiten-Modus selektiert ein Klick aufs verknüpfte Element es wieder (`window.__sldDirectEdit`).
  **Komponenten 10→11**, **kein Schema-Eingriff** (`version` "1.0"). Headless grün:
  **cargo test 34** (+1), typecheck, vite build; adversarial reviewt. **GUI-Check ausstehend** (Sprung in
  Präsentation/Standalone/Vorschau, Rücksprung, Markdown-`#` — der `hashchange`-Pfad ist about:srcdoc-WKWebView-
  abhängig, der `data-slideo-goto`-Pfad davon unabhängig & empfohlen; Projektor-Klick). **Nach den MCP-Instructions-
  Änderungen: `cargo build` + Claude Desktop neu starten** (sonst altes Binary).
- **Workflow-Optimierung (Spec §24, Branch `workflow-optimization`, umgesetzt):** Vier Bedien-/Authoring-
  Verbesserungen für Mensch + KI. **(1) Onboarding:** MCP-Setup erst nach dem ersten Deck (Kontext), EmptyState +
  Hilfe-Modal (Topbar-`?`) + einmaliger Banner mit **„Prompt kopieren"** ([onboarding.ts](src/lib/onboarding.ts) `samplePrompt`,
  [HelpModal.tsx](src/components/modals/HelpModal.tsx), [OnboardingNudge.tsx](src/components/ui/OnboardingNudge.tsx));
  Klartext statt Jargon, **KI-agnostisch** (MCP-Standard; Beispiele Claude Desktop, Codex CLI — nicht Claude-exklusiv). **(2) Asset-Verwaltung:** „Bild einfügen" → Asset-Manager (pick, Batch-Import) + eigener
  Topbar-Button „Medien" (manage) ([AssetManagerModal.tsx](src/components/modals/AssetManagerModal.tsx),
  [AssetLibrary.tsx](src/components/ui/AssetLibrary.tsx)); Store `insertAssetIntoZone` (Library-Asset ohne Re-Import),
  `addMediaToZone` delegiert. **(3) Komponenten 11→17:** `data_table`/`big_number`/`feature_grid`/`process_steps`/
  `pricing`/`gallery` (token-only, [components.rs](src-tauri/src/components.rs); 3 mit Palette-Formular). **(4) KI-
  Layout-Check:** read-only MCP-Tools `check_zone_overflow(id)` + `validate_deck()` (**35→37**) mit **reiner Rust-
  Heuristik** (kein Headless-Browser, [overflow.rs](src-tauri/src/overflow.rs)) → die KI prüft Overflow gegen die
  1280×720-Bühne vor dem Festschreiben; instructions/guide gelehrt. **Review-Fix:** Panic in `extract_styles`
  (nicht-quotiertes `style=` vor Multibyte) char-grenzen-sicher gemacht + Test; **offen (Defense-in-Depth):**
  `catch_unwind` um `tools::handle` ([ipc.rs](src-tauri/src/ipc.rs)) gegen Mutex-Vergiftung. **cargo test 42**,
  typecheck, vite build grün. **Für die MCP-Seite: `cargo build` + Claude Desktop neu starten.** GUI-Check ausstehend.
- **Vorschau In-Place-Patch (P2/P6, Spec §25, umgesetzt):** Die Vorschau lädt das Iframe **nicht mehr** bei jeder Änderung
  neu (`srcDoc`), sondern **klassifiziert** die Änderung ([preview-diff.ts](src/lib/preview-diff.ts) `classifyPreviewChange`
  → `full` | `patch{tokens,zoneIds}` | `none`) und **patcht in-place** per `postMessage`. **`patchScript`**
  ([renderer.ts](src/lib/renderer.ts), eigene IIFE, **nur bei `editable`** injiziert): `slideo:patch-tokens` setzt die
  `:root`-Variablen inline (+ stößt `resize` an → §20-Overlays neu vermessen), `slideo:patch-zone` **behält den
  `.slideo-frame`-Knoten** und tauscht nur dessen `innerHTML` → **navScripts `slides[]` + §23-`zoneIndex` bleiben gültig**
  (beide index-basiert, Section-`id` unverändert), Scroll/Auswahl der übrigen Zonen überleben; die gepatchte Zone wird
  über den bestehenden `slideo:reselect`(`-block`)-Handshake reselektiert. **Voll-Reload bleibt Fallback** (Struktur/
  Assets/Fonts/Logo/`previewEdit`-Toggle/entfernter Token-Key) und hängt eine **monotone Nonce** in den `<head>`, damit
  `onLoad` garantiert feuert (`readyRef` bleibt nie hängen). **State-Machine im Parent** ([PreviewPane.tsx](src/components/preview/PreviewPane.tsx)
  `syncPreview`, refs `lastRendered`/`readyRef`/`busyRef`/`deferredRef`/`reloadSeq`): während (Re)Load oder laufender
  Interaktion werden Patches **aufgeschoben** und beim nächsten sicheren Moment **einmal** reconciled. **Invariante:**
  DOM ≡ `renderFullPage(current)` nach jedem `syncPreview`. **Kritische §20-Wechselwirkung:** `editScript` meldet **jede**
  Interaktion (Block-Reorder/Bild-Resize/Verschieben/Inline-Edit) per `slideo:preview-busy {busy}` → der Parent
  unterdrückt Patches, solange busy (`busy:false` **nach** der Op-Nachricht via `try/finally`); gegen hängendes busy (=
  eingefrorene Vorschau): **`setPointerCapture`** an allen Drags + Fenster-**`blur`**-Fallbacks + `busyRef`-Reset in
  `handleLoad`/`previewEdit`-Toggle + Overlap-Guard am Block-Drag. `logoHtml` exportiert (Patch braucht es pro Zone).
  **Kein Schema-Eingriff** (`version` "1.0"; reine Render-/UI-Mechanik). Headless grün (typecheck/build/`node --check` der
  3 Iframe-Skripte); **zwei adversariale Review-Runden** (7 Findings gefixt). **GUI-Check ausstehend** (next-steps §1b P2/P6).
- **Remote-Präsentation auf EINEM Bildschirm (Spec §26, umgesetzt):** Der Presenter-Modus (§19.3) trennt Folie (Fenster
  `projector`) von Notizen/Tools (Hauptfenster [SpeakerView](src/components/presentation/SpeakerView.tsx)), war aber an
  einen zweiten Monitor gebunden. Neu: Command **`open_share_window`** ([present.rs](src-tauri/src/present.rs)) öffnet das
  Folien-Fenster als **normales, dekoriertes, verschiebbares, betiteltes 16:9-Fenster** auf dem **aktuellen** Display →
  in Zoom/Meet/Teams per **„Fenster teilen"** freigebbar (Window-Capture erfasst es auch verdeckt), Notizen bleiben
  privat. **Kein WebRTC/Server** (WKWebView kann kein `getDisplayMedia`; passt zur lokal-These). **Reuse:** selbes
  `projector`-Label + Event-Sync + [ProjectorView](src/components/presentation/ProjectorView.tsx) wie das Zweitfenster (nur
  EIN Folien-Fenster gleichzeitig); `sharingType` bleibt Default (`.readOnly` = capturable), Titel „Slideo — Präsentation".
  UI: Button **„Folie teilen"** (`screen_share`, ins Icon-Subset aufgenommen) in der Steuerleiste
  ([PresentationMode.tsx](src/components/presentation/PresentationMode.tsx)); `presentShareWindow` synct erst den AppState,
  öffnet das Fenster und **refokussiert das Hauptfenster** (Tastatur-Nav bleibt am Cockpit). v1-Grenzen wie Zweitfenster
  (Laser/Stift aus, Live-Edit-Reload). **Kein Schema-Eingriff.** typecheck/build/`cargo check` grün, fokussiertes
  adversariales Review clean. **GUI-bestätigt.**
- **SpeakerView gestapelt + Folien-Vorschau-Rendering (WebKit-Härtung, GUI-bestätigt):** Die [SpeakerView](src/components/presentation/SpeakerView.tsx)
  ist jetzt **gestapelt** (aktuelle Folie oben groß im 16:9, darunter Timer · nächste Folie · Notizen) statt zwei Spalten.
  **Gemeinsame [SlidePreview](src/components/presentation/SlidePreview.tsx)** für ALLE Folien-Thumbnails (SpeakerView +
  [SlideOverview](src/components/presentation/SlideOverview.tsx)). **Vier WebKit/WKWebView-Fallen, die kleine Folien-
  Vorschauen leer rendern ließen (hart erkämpft — bei künftigen Iframe-Thumbnails beachten):** (1) WKWebView dimensioniert
  ein Iframe nach seinem **Inhalt**, nicht der CSS-Größe → `renderSingleZonePage` rendert jetzt bei **fester nativer
  1280×720** (`--slideo-scale:1`, kein Fit-Script) statt `height:100%` (kollabierte zirkulär); der Aufrufer skaliert per
  CSS-`transform` ins Ziel. (2) **`transform` direkt auf einem Iframe** ist in Safari buggy → skaliert wird ein **Wrapper-
  `div`**, das Iframe bleibt plain 1280×720. (3) Ein **`backdrop-filter` auf einem Vorfahren** lässt verschachtelte Iframes
  leer rendern → das Übersicht-Overlay ist voll deckend **ohne** `backdrop-blur`. (4) Eine **`aspect-ratio`-Box mit nur
  absolut positionierten Kindern** bekommt in WebKit **keine Höhe** (kollabiert → „nur Titel") → der Übersicht-Kasten nutzt
  den **`padding-bottom:56.25%`-Trick**. **Kein Schema-Eingriff.** typecheck/build grün, GUI-bestätigt (Speaker-Vorschau +
  Übersicht-Thumbnails).

**Feature-Roadmap §18/§19 ist im Wesentlichen abgeschlossen** (Komponenten-Palette §18.7-Rest,
Versionshistorie §19.9-Rest, Auto-Animate §19.1-Rest, echtes Zweitfenster §19.3-Rest umgesetzt; MCP-Parität
app-weit geprüft → 37 Tools; **Outline-Modus §19.9 wieder entfernt** — redundant, Reorder liegt jetzt in der Folienliste). **§19.8 Aufnahme/Narration + Video-Export ist bewusst weggelassen** (out of scope —
off-thesis; Medien-Bedarf via Einbettung gedeckt; siehe [[scope-mcp-authoring-thesis]]). **Neu: §20
Direktmanipulation in der Vorschau — Phase 0–3 umgesetzt** (Klick→Quelle, Auswählen/Löschen/Duplizieren,
Inline-Text, Verschieben; s.o.) **+ §21 feste 16:9-Folien-Bühne + Scale-to-fit** (ersetzt responsive 100vh-Zonen;
behebt Out-of-bounds beim Resize) **+ §23 Zonen-Links / nicht-lineare Navigation** (`data-slideo-goto` + `toc`-Komponente,
Inhaltsverzeichnis→Sprung→Rücksprung; s.o.). GUI-Check aller drei steht aus.

Offen (kein neues Feature, sondern „verifizieren & ausliefern"): **GUI-Verifikation** aller §18/§19-Features
durch den Menschen (Checklisten next-steps.md A1–A7, inkl. Zweitfenster auf echter Multi-Display-Hardware) und
**Distribution & Notarization** (next-steps.md Abschnitt C: Signing, notarisierte/Cross-Platform-Builds).
Optionaler Polish (geparkt): bild-basierter PPTX-Export (Browser-Offload), Komponenten-Set erweitern,
Asset-Positionierung „Large", Font-Subset, Laser/Stift aufs Zweitfenster spiegeln, flackerfreies Projector-Update.
Siehe [README.md](README.md) und [docs/next-steps.md](docs/next-steps.md).
