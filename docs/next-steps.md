# Slideo — Nächste Schritte

> **🎯 AKTUELLES ZIEL: Distribution & Notarisierung (Abschnitt C)** — signierte, notarisierte, auslieferbare Builds
> (macOS + Windows), damit Slideo an echte Nutzer verteilt werden kann (heute: `bundle.macOS`-Block/Entitlements/Signing
> **fehlen komplett** → Gatekeeper/SmartScreen blockt). Voraussetzung: Apple Developer Program ($99/J) + Developer-ID-
> Zertifikat (nur der Mensch kann das besorgen). **Vorgelagert (User-Entscheidung: Lizenzierung VOR Notarisierung):**
> Trial + Polar-Lizenz sind **im Code umgesetzt** (30-Tage-Demo → read-only, Einmalkauf/3 Geräte — [licensing.md](licensing.md));
> es fehlt nur die **Polar-Config** (`organization_id` + Checkout-Link in [license.rs](../src-tauri/src/license.rs)).
> Parallel/sekundär: voller GUI-Test (Abschnitt A) + optionaler `catch_unwind`-Hardening-Punkt.
>
> **Erledigt (alles auf `main`, committet + gepusht, headless grün — `cargo test` 42, typecheck, vite build):**
> Security-Härtung S1–S9 · Performance P1/P3/P4/P5/P7/P8/P9/P10/P13 · **P2/P6 Vorschau-In-Place-Patch (§25)** ·
> **§26 teilbares Folien-Fenster (Ein-Monitor-Remote) + gestapelte SpeakerView + WebKit-robuste Folien-Vorschauen** ·
> **Workflow-Optimierung (§24:** Onboarding, Asset-Verwaltung, Komponenten 11→17, KI-Layout-Check, **37 MCP-Tools**) ·
> **Editor-Cleanup** (2-spaltige Shell, Sidebar raus, Brand-Kit-Overlay) · **Markdown-Direktmanipulation** (§20) ·
> §21 feste 16:9-Bühne · §23 Zonen-Links. Records → [done/](done/). **Maßgeblich für den Ist-Stand: [../CLAUDE.md](../CLAUDE.md).**
>
> **Session 2026-07-15:** Pre-Release Bug-Review (13 Spuren, adversarial verifiziert → **10 Fixes, 0 Critical** —
> [bug-review-2026-07.md](done/bug-review-2026-07.md)) · **MCP-Texte auf Englisch lokalisiert** (server_instructions,
> slideo_guide, 37 Tool-Beschreibungen, `list_components`/`list_presets`-Katalog, Overflow-Hinweise, Fehler; `thema`→`topic`;
> Palette-Anzeige bleibt DE via `COMPONENT_CATALOG_DE`) · **Marketing-Konzept** ([marketing-strategy.md](marketing-strategy.md)) ·
> **Lizenzierung** (30-Tage-Trial + Polar-Einmalkauf/3 Geräte, MCP-Gate, read-only nach Ablauf — [licensing.md](licensing.md);
> Platzhalter-Config, Polar-Werte noch einzutragen). cargo test **42** · cargo build · typecheck · vite build grün.
>
> **Offen für den Release (Reihenfolge):** (1) **Lizenzierung scharfstellen** — Polar-Org anlegen + `organization_id`/
> Checkout-Link in [license.rs](../src-tauri/src/license.rs) eintragen, dann GUI-testen ([licensing.md](licensing.md)) ·
> (2) **Distribution/Notarization** (Abschnitt C) · (3) voller GUI-Test A1–A7 (Abschnitt A) · optional `catch_unwind`
> um `tools::handle` (Defense-in-Depth). Maßgebliche Spec: [slideo-spec.md](slideo-spec.md).

---

## 1. Performance- & Security-Audit + Optimierung — **DER NÄCHSTE FOKUS**

> Schwerpunkt-Wechsel: nicht mehr „Features bauen", sondern **Qualität & Reife der Gesamt-App**. Erst messen/
> auditieren, dann gezielt optimieren. (Aus Session-Feedback: „einmal Performance- und Security-Check der ganzen
> App, dann optimieren — Workflow überarbeiten etc.")

### 1a. Security-Check (Bestandsaufnahme + Härtung) — ✅ AUDIT + HÄRTUNG UMGESETZT (2026-06-26)

> Multi-Agent-Audit (adversarial gegengeprüft) → **kein high/critical**, solide Kern-Isolation. Vollreport +
> Bedrohungsmodell: **[audit.md](done/audit.md)**; Architektur in **Spec §22** / CLAUDE.md. Umgesetzt auf Branch
> `security-hardening` (cargo test 33, typecheck, vite build grün; `cargo audit` 0 Vulns).

- [x] **Iframe-Isolation** bestätigt: alle Folien-Iframes `sandbox="allow-scripts"` ohne `allow-same-origin`, keine Tauri-APIs.
- [x] **CSP gesetzt** (S2/S3): App-CSP statt `null` **+** eigene strikte CSP in den In-App-Folien-Iframes
      (`connect-src 'none'`, weil App-CSP nicht in opake Iframes propagiert). — **GUI-Verifikation offen** (macOS+Windows).
- [x] **IPC-Socket authentifiziert** (S1): Shared-Secret-Token + `ipc.json` 0600 (war: unauth., world-readable Port).
- [x] **Schreibpfade gehärtet** (S6/S9): `write_json` atomar + rechtebewahrend (kein 0600→0644 von `~/.claude.json`),
      randomisierter print-Temp-Name; `history.rs valid_id` als sicher bestätigt.
- [x] **Untrusted Input** (S7): `.slideo`-Größen-/Anzahl-Caps (Decompression-Bomb); kein Zip-Slip; `html:true` by-construction sicher.
- [x] **Ergebnis:** Bedrohungsmodell-Notiz + priorisierte Härtungsliste → **[audit.md](done/audit.md)**.
- [ ] **OFFEN (Mensch):** CSP-GUI-Smoke-Test auf echtem `tauri:dev`/`tauri build` (macOS **und** Windows) — DevTools-Konsole auf CSP-Verstöße.

### 1b. Performance-Check (gemessen → optimiert) — Quick Wins umgesetzt (Audit [audit.md](done/audit.md), Commit `e49e6ff`)
- [x] **Bundle (P1):** Material-Symbols-Font auf die ~70 genutzten Icons **subgesetzt** → 3,63 MB → 42 KB (`dist/assets`
      5,2 → 1,8 MB), Codepoint-Rendering + `npm run icons:subset`. — **GUI: Icons sichtprüfen.**
- [x] **Asset-Refs (P4):** `resolveAssetRefs` header-only MIME + nicht-referenzierte Assets überspringen.
- [x] **React-Re-Render (P5):** `React.memo(ZoneCard)` — Tippen re-rendert nicht mehr alle Folien.
- [x] **`index`-Chunk (P8):** Code-Splitting — CodeMirror-Editoren (`HtmlEditor`/`CssEditor`) via `React.lazy`; Haupt-Chunk 1,31 MB → 864 kB (CodeMirror 122 kB lädt nur bei HTML-Zone/CSS-Panel).
- [x] **Bilder (P3/P7):** in-app über `slideoasset://` statt inline-base64 + Rust-Decode-Cache (`AppState::set_assets` invalidiert; TOCTOU-Race im Review gefixt). Standalone/Print bleiben inline. — **GUI: Bilder in-app + Export prüfen.**
- [x] **Polish (P10/P13):** Sync-Debounce 120→400 ms; ZIP-`Stored` für Assets (kein Deflate auf schon-komprimierten Medien). + **P9** Hover-Overlay rAF-koalesziert.
- [x] **Vorschau-Re-Render (P2/P6):** `srcDoc`-Voll-Reload → In-Place-`postMessage`-Patch — **UMGESETZT** (Spec §25).
      Klassifikator [preview-diff.ts](../src/lib/preview-diff.ts) → `patch-tokens`/`patch-zone` (Frame-Knoten bleibt,
      nur `innerHTML`-Swap → nav/§23 gültig) statt Reload; Voll-Reload bleibt Fallback (Nonce erzwingt `onLoad`).
      Laufende §20-Interaktion via `slideo:preview-busy` geschützt (Pointer-Capture + blur + busyRef-Reset). Headless grün
      (typecheck/build/`node --check` der 3 Iframe-Skripte); 2 adversariale Review-Runden (7 Findings gefixt).
      **— GUI-bestätigt (auf `main` gemerged, Commit `adea83b`).**
  - **P2/P6-GUI-Checkliste (bestätigt):** Tippen patcht ohne Reload/Flackern (Scroll bleibt) · Design/Token sofort ·
    §20 (Auswahl/Inline/Duplizieren/Löschen/Verschieben+Freeze) überlebt Patches, Maus-außerhalb friert nicht ein ·
    Struktur (add/del/reorder, `content_type`) → sauberer Voll-Reload · §23-Links + Bild/Video weiter korrekt ·
    Reset/`reset_tokens` ohne stale Token · MCP-Live-Edit patcht nur die eine Folie.
- [ ] **P12 (`Vec<u8>` intern):** **bewusst übersprungen** — hohes Risiko (MCP-Save load-bearing), geringer Wert (Speicher), im Konflikt mit dem P7-Cache.

### 1c. Optimierungs-/Überarbeitungs-Runde
- [x] **Editor-Shell überarbeitet** (aus GUI-Feedback): drei frei **skalierbare + einzeln einklappbare** Spalten
      (Folienliste · Editor · Vorschau, persistente Breiten/Zustände; [EditorShell.tsx](../src/components/ui/EditorShell.tsx)/[Splitter.tsx](../src/components/ui/Splitter.tsx)/[layout.ts](../src/store/layout.ts)),
      **Drag-Reorder in der Folienliste** ([ZoneList.tsx](../src/components/ui/ZoneList.tsx)), **Outline-Modus entfernt** (redundant). — **GUI-Test offen.**
- [x] **Workflow-Optimierung (Spec §24, Branch `workflow-optimization`):** Onboarding (Erststart-These + Claude-Prompt-
      Helfer), Asset-Verwaltung (Manager-Modal pick/manage + Topbar-Button), Komponenten 11→17, KI-Layout-Check
      (`check_zone_overflow`/`validate_deck`, MCP 35→37). cargo test 42 / typecheck / vite build grün, adversarial reviewt.
      **— GUI-Test offen; MCP-Seite: `cargo build` + Claude Desktop neu starten.**
- [ ] Weiter: Architektur-Schulden, Renderer/State vereinfachen, Konsistenz Vorschau ↔ Präsentation ↔ Export.
      Bewusst Refactor + Politur statt neuer Features.

### 1d. Layout-Validierung (harte 1280×720-Garantie) — optional
- [ ] §21 + MCP-`instructions` steuern AI-Decks Richtung „passt", aber der MCP-Server misst **kein** Layout. Vorschlag:
      **Headless-Browser-Validierung** (Chrome/`puppeteer-core`, Element-Grenzen vs. 1280×720 — Methode in dieser
      Session erprobt) als Dev-/CI-Check ODER Tool, das überlaufende Folien meldet/zurückweist. Siehe Spec §21
      „KI-Anbindung".

---

## 0. ✅ Direktmanipulation (§20) + feste 16:9-Bühne (§21) — UMGESETZT & GUI-BESTÄTIGT

> Referenz/Historie. Plan: [direct-manipulation-plan.md](direct-manipulation-plan.md); Details: Spec §20/§21.

- [x] **§20 Direktmanipulation in der Vorschau** — Klick → Quelle, Auswählen (▲/Esc), Inline-Text (Doppelklick/✎),
      Verschieben (Drag → abs. %, „Folie einfrieren" beim 1. Move), Duplizieren/Löschen, Undo (Cmd/Z). Kind-Index-Pfad
      ab `.slideo-content`, Ops via `DOMParser` auf rohem `zone.html` ([dom-edit.ts](../src/lib/dom-edit.ts)),
      Pointer-Events im `editScript` ([renderer.ts](../src/lib/renderer.ts)). Nur HTML-Zonen; Flussmodell unangetastet.
- [x] **§21 feste 16:9-Bühne + Scale-to-fit** — Folien logisch 1280×720 (clip), `.slideo-frame` + `transform:scale`
      (Vorschau fit-width, Präsentation fit-both). Behebt Out-of-bounds beim Resize; vereinheitlicht Vorschau/
      Präsentation/Export/Print. MCP-`instructions`/`slideo_guide` lehren das 1280×720-Format + Safe-Area.
- 11 adversariale Multi-Agent-Reviews über alle Iterationen; alle bestätigten Findings gefixt. Headless grün
      (cargo 27, typecheck, vite build, tsx-Unit für `dom-edit`, Chrome-Messung der Folien-Fits).

---

## A. Testen (sekundär/parallel — vollständiger Durchlauf A1–A7)

Bisher ist alles nur automatisch grün (`cargo test` 27, `typecheck`, `vite build` + Multi-Agent-Reviews je
Feature), aber **noch nichts in der echten App durchgeklickt**. **A1–A7 Punkt für Punkt** — der
**Mensch testet**, die **KI fixt bestätigte Findings**.

Vorbereitung: `npm run tauri:dev` **frisch** starten. Nach jeder Backend-Änderung zusätzlich **Claude Desktop neu starten** (sonst altes MCP-Binary! — jetzt **37 MCP-Tools**).

### A1. Editor-Grundfunktionen
- [ ] Neue Präsentation: „Neu" → Modal (Name + Speicherort) → speichert direkt als `.slideo`.
- [ ] Zonen: hinzufügen, löschen, per Drag&Drop sortieren; Tiptap-Tippen, Token-Sidebar live in der Vorschau.
- [ ] Markdown ⇄ HTML-Zone togglen (Warn-Dialog beim Rückweg).
- [ ] Custom CSS pro Zone (Panel unter der Zone) → wirkt nur auf diese Folie in der Vorschau.
- [ ] Layouts: `hero`, `split` (Markdown mit `+++`-Trennzeile → zwei Spalten).

### A2. Speichern & Schließen (kritischer Fix — bitte gezielt prüfen)
- [ ] Speichern via Button (Cmd+S) → Datei landet am Ort, Toast „Gespeichert".
- [ ] **Schließen mit ungespeicherten Änderungen** → 3-Knopf-Dialog (Speichern / Nicht speichern / Abbrechen). „Speichern" darf nichts verlieren; „Abbrechen" lässt offen.
- [ ] `.slideo` schließen und wieder öffnen → alles (inkl. Custom CSS, Assets) ist da.

### A3. Präsentation & Speaker-View
- [ ] Präsentieren → Pfeiltasten/Leertaste navigieren (vor UND zurück), `Esc` raus.
- [ ] Taste `s` → Speaker-View (aktuelle + nächste Folie, Timer, Zähler, Notizen). Navigation muss in beide Richtungen funktionieren (war ein Bug, jetzt gefixt — verifizieren).
- [ ] **Zonen-Links (§23):** `toc`-Komponente (Palette) oder HTML-Zone mit `<a data-slideo-goto="2">…</a>` einfügen → in der **Präsentation** auf einen Eintrag klicken springt zur Zielfolie; **Rücksprung-Link** zurück zum Inhalt. Auch mit aktiver **Transition** (Deck-Modus) testen. **Standalone-Export** (.html im Browser): Klick springt + Browser-Zurück. **Vorschau** (Nicht-Edit): Klick scrollt zur Zone. Markdown-`#`-Link `[x](#zone-<ID>)` testen (about:srcdoc-abhängig). Zweitfenster/Projektor: Klick auf der Beamer-Folie springt.

### A4. MCP / KI (Claude Desktop)
- [ ] Claude Desktop neu starten → Slideo-Tools erscheinen (sollten **37** sein, inkl. `set_zone_css`, `list_assets`).
- [ ] Generierung: „Baue eine Präsentation über X mit dunklem Theme" → Folien erscheinen **live** im Editor.
- [ ] Prüfen, ob Claude **Markdown-first** baut (Tokens/Layouts statt Inline-HTML) und HTML nur token-basiert nutzt.
- [ ] MCP-Prompt `slideo_guide` in Claude Desktop aufrufbar?
- [ ] `set_zone_css` / `set_zone_style(custom_css)` funktionieren und erscheinen live.

### A5. Assets (Bild / Video / Audio)
- [ ] Bild via Zone-Button einfügen → in Vorschau sichtbar; nach Speichern/Öffnen persistent (liegt im ZIP unter `assets/`).
- [ ] Settings → Assets: Bild/Video/Audio hinterlegen, Thumbnails, entfernen.
- [ ] `list_assets` in Claude Desktop → KI findet vorab hinterlegte Assets und baut sie ein.
- [ ] **`slideoasset://`-Streaming (neu, unsicher):** kurzes mp4 in eine HTML-Zone (`<video controls src="assets/x.mp4">`). Lädt es? **DevTools → Network** auf `slideoasset://…`-Requests prüfen; **Konsole** auf Block-Meldungen (CSP/Sandbox). Falls blockiert → siehe B1.

### A6. Cross-Platform (falls verfügbar)
- [ ] Windows: `http://slideoasset.localhost/`-Variante; Dialoge; Claude-Config-Pfad (`%APPDATA%/Claude`).
- [ ] Linux: webkit2gtk-Abhängigkeiten; Claude-Config-Pfad.

---

## B. Feature-Roadmap §18/§19 — **umgesetzt** (Historie/Referenz; keine neuen großen Features mehr)

> Vollständige Roadmap aus **Spec §18/§19**. **Alle Punkte umgesetzt** (außer §19.8 Aufnahme = bewusst weggelassen). Hier als Referenz/Statusliste; nächste Schritte sind GUI-Test (A) → Polish-Kandidaten → Distribution (C).

1. ✅ **Speaker-Notes-Editor** + `set_zone_notes` — §18.2.
2. ✅ **Export self-contained HTML** + **Teilen** — §18.4 / §18.5.
3. ✅ **Themes / Presets** — §18.6.
4. ✅ **Folien-Transitions** — §18.3.
5. **Asset-Positionierung** — §18.1: ✅ **Light** (Bild-Toolbar) + ✅ **Medium** (Block-Drag **in der interaktiven Vorschau** — `editable`-Render + `reorderZoneBlocks`; Spalten-Slots über automatische `+++`-Verwaltung im Layout-Dropdown). **OFFEN (Richtung Large):** Drag *zwischen* Spalten, Block-Drag auch für split/HTML-Zonen, Free-Canvas.
6. **Interaktivität** — §18.7: ✅ Agenten-Skill erweitert + ✅ Komponenten-Bibliothek (MCP `list_components`/`insert_component`, Rust-Generator) + ✅ **UI-Komponenten-Palette** im Editor ([ComponentPaletteModal.tsx](../src/components/modals/ComponentPaletteModal.tsx)): nutzt denselben Rust-Generator via Tauri-Commands `list_components`/`render_component` (keine Template-Duplikation), Parameter-Formulare + Live-Vorschau. **OFFEN:** Set iterativ erweitern. Komponenten-Set iterativ erweitern.
7. ✅ **PDF-Export** — §18.4.

### B2. Programm §19 — „Richtung vollwertige Präsentationssoftware" (Spec §19)

> **Plan für die nächste(n) Session(en): ALLE noch offenen Punkte abarbeiten.** Wir starten mit dem,
> was am schnellsten geht, und arbeiten uns zu den großen Brocken vor — ob das eine Session schafft
> oder mehrere, zeigt sich unterwegs. Grobe Reihenfolge nach Aufwand (klein → groß):
> 1. ✅ **Komponenten-Palette** (umgesetzt) — 10 Rust-Komponenten per UI-Klick einsetzen (Tauri-Commands `list_components`/`render_component`, derselbe Generator wie MCP), mit Parameter-Formularen + Live-Vorschau.
> 2. ~~**Outline-Modus**~~ — zunächst umgesetzt, dann **wieder entfernt** (redundant; Reorder liegt jetzt in der Folienliste/den Editor-Karten). `OutlineView.tsx`/`outline.ts` existieren nicht mehr.
> 3. ✅ **Versionshistorie** (umgesetzt) — lokale `.slideo`-Snapshots (Auto + manuell, Wiederherstellen) — [history.rs](../src-tauri/src/history.rs) / [HistoryModal.tsx](../src/components/modals/HistoryModal.tsx).
> 4. ✅ **Auto-Animate/Morph** (umgesetzt) — Übergang `auto`: gleiche `data-id`-Elemente zwischen Folien per FLIP ([renderer.ts](../src/lib/renderer.ts), `data-id` via HTML-Zone / `insert_component`).
> 5. ✅ **Folien-Fenster** (umgesetzt; §26 **vereinheitlicht**) — EIN `projector`-Fenster: dekoriert-teilbar (Zoom/Meet) ODER randlos-Vollbild auf seinem Monitor (`set_projector_fullscreen`, Beamer); Event-Sync; Ein-Fenster-Modus bleibt. Monitor-Dropdown (`list_monitors`/`open_presentation_window`) entfernt.
> 6. ❌ **§19.8 Aufnahme/Narration + Video-Export** — **bewusst weggelassen (out of scope):** off-thesis für eine MCP/KI-Authoring-App; Medien-Bedarf ist via Einbettung gedeckt; schlimmste WKWebView-Hürden. Wird nicht gebaut.
>
> Quer dazu **erledigt**: MCP-Paritäts-Audit → 5 neue Tools (`set_logo`/`clear_logo`/`register_font`/`set_presentation_title`/`set_zone_label`); mit dem §24-Layout-Check (`check_zone_overflow`/`validate_deck`) **37 MCP-Tools**.
>
> **Damit ist die Feature-Roadmap §18/§19 im Wesentlichen durch.** Nächste Session: **(1) vollständiger GUI-Test A1–A7**, **(2) Polish auswählen** (siehe „Polish-Kandidaten" unten), später **(3) Distribution/Notarization** (C). Keine neuen großen Features geplant.
>
> Quer dazu offen: **GUI-Verifikation** aller §18/§19-Features (Abschnitt A1–A7) und **Distribution/Notarization** (Abschnitt C).

- ✅ **19.2 Daten-Diagramme** — `line_chart` + `donut_chart` (10 Komponenten gesamt inkl. `icon`).
- ✅ **19.7 Barrierefreiheit** — Alt-Text-Feld + WCAG-Kontrast-Check.
- ✅ **19.1 In-Folien-Builds + Auto-Animate** — `set_zone_reveal`, parent-autoritative Nav; **Übergang `auto`** = FLIP-Morph gleicher `data-id`-Elemente zwischen benachbarten Folien (In-App + Export). **§19.1 komplett.**
- ✅ **19.4 Vorlagen & Marke** — Custom-Fonts + Logo/Brand + Starter-Templates.
- ✅ **19.9 Suchen & Ersetzen** + Spellcheck + **Versionshistorie** (lokale `.slideo`-Snapshots, Auto beim Speichern + manuell, Wiederherstellen — [history.rs](../src-tauri/src/history.rs) / [HistoryModal.tsx](../src/components/modals/HistoryModal.tsx)). **§19.9 komplett.**
- ✅ **19.3 Presenter-Tools** — Folien-Übersicht/Sprung-Grid, Laser-/Stift-Overlay, Auto-Advance/Loop + **Folien-Fenster** (§26 vereinheitlicht: ein `projector`-Fenster, teilbar ODER randlos-Vollbild auf seinem Monitor; Event-Sync; [present.rs](../src-tauri/src/present.rs)/[ProjectorView.tsx](../src/components/presentation/ProjectorView.tsx)). **§19.3 komplett, GUI-bestätigt.**
- ✅ **19.8 Medien** — Drag&Drop-Medienimport, Bild-Crop (non-destruktiv), Icon-Inline-SVG-Komponente. **Aufnahme/Narration + Video-Export: bewusst weggelassen** (out of scope — off-thesis; Einbettung deckt den Bedarf). → §19.8 abgeschlossen.
- ✅ **19.5 PPTX-Export (v1)** — **native Rekonstruktion** via pptxgenjs (Text/Bilder/Token-Hintergründe, in PowerPoint editierbar). Bild-basiert (1:1) entfällt in-app wegen WKWebView-Canvas-Taint; optional später via Browser-Offload.
- ✅ **Komponenten-Palette** (manuelles Einfügen) — UI mit Parameter-Formularen + Live-Vorschau, derselbe Rust-Generator wie MCP.

### A7. GUI-Tests der neuen §18/§19-Features (zuerst! headless nicht verifiziert)
- [ ] **Bild-Positionierung:** Bild in eine Markdown-Zone, anklicken → Bubble-Toolbar erscheint → Größe (S/M/L/Voll), Ausrichtung, Umfluss wirken in Vorschau; speichern/öffnen → Attribute bleiben (im Markdown stehen `<img style/class>`).
- [ ] **Transitions:** Design-Tab → Übergang fade/slide/zoom + Dauer → Präsentationsmodus blättern → Animation greift (slide richtungsabhängig); `none` = unverändertes Verhalten.
- [ ] **HTML-Export („Teilen"):** speichert `.html`; im Browser öffnen → Folien + Tastatur/Klick-Nav + Bilder/Video inline funktionieren.
- [ ] **PDF („PDF"):** öffnet die print-Page im **Standardbrowser** (Tauri-Command `open_print_view` → Temp-Datei). Dort Cmd/Strg+P → „Als PDF sichern", Seitenformat 16:9, eine Folie pro Seite. (WKWebView-`window.print()` wird bewusst nicht genutzt — siehe Spec §18.4.)
- [ ] **Notizen:** Notizen-Panel pro Zone → Text erscheint in der Speaker-View.
- [ ] **Themes:** Theme-Picker im Design-Tab → Preset wendet Farben/Fonts live an.
- [ ] **Komponenten (MCP):** „füge ein Balkendiagramm/eine Timeline ein" → `insert_component` erzeugt token-bewusste HTML-Zone, live sichtbar, über Token-Sidebar umfärbbar.
- [ ] **MCP-Tools 37:** Claude Desktop neu starten → `set_zone_notes`, `set_zone_reveal`, `apply_preset`, `set_transition`, `list_components`/`insert_component` (inkl. `line_chart`/`donut_chart`) sowie die Paritäts-Tools `set_logo`/`clear_logo`, `register_font`, `set_presentation_title`, `set_zone_label` und der §24-Layout-Check `check_zone_overflow`/`validate_deck` vorhanden.
- [ ] **MCP-Parität (neu):** „Setz das Logo auf <vorhandenes Asset>", „Benenn die Präsentation in X um", „Nenn Folie 2 ‚Intro'", „Registrier die Schrift Y aus Asset Z" → Logo erscheint auf jeder Folie / Titel + Folien-Label ändern sich / Font in den Token-Auswahllisten nutzbar. (Asset-Referenzen via `list_assets`; die KI lädt keine Dateien hoch.)
- [ ] **Block-Drag (Medium, in der VORSCHAU):** in der rechten Vorschau über einen Block fahren → Drag-Handle (⠿) links erscheint → Block per Drag umsortieren; die Reihenfolge wird ins Markdown übernommen, nach Speichern/Öffnen erhalten. (Nur Markdown-Zonen ohne `split`; HTML/Spalten-Zonen ohne Handle.) **Pointer-Events** — nicht natives DnD.
- [ ] **Bild-Resize (in der VORSCHAU):** über ein Bild fahren → blauer Anfasser an der rechten Kante → ziehen skaliert die Breite stufenlos (5–100 %); beim Loslassen als `<img style="width:NN%">` gespeichert, im Editor/Export erhalten.
- [ ] **Spalten-UI (Medium):** Layout „Zwei Spalten" wählen → `+++`-Trenner wird automatisch eingefügt, Vorschau zeigt zwei Spalten; zurück auf „Zentriert" → Trenner weg, Inhalte zusammengeführt.
- [ ] **Builds (§19.1):** an einer Markdown-Folie das ⚡/„animation"-Icon in der ZoneToolbar aktivieren → Präsentieren → Pfeil/Leertaste blendet die Blöcke nacheinander ein (vor UND zurück), dann nächste Folie; Speaker-View zeigt „Schritt s/n"; `none` = altes Verhalten. KI: „blende die Punkte schrittweise ein" → `set_zone_reveal`.
- [ ] **Custom-Fonts (§19.4):** Design-Tab → „Schriften" → Hochladen (woff2/ttf) → Schrift in „Überschrift-/Fließtext-Font" wählen → wirkt in Vorschau/Präsentation; nach Speichern/Öffnen + im HTML-Export erhalten (Font ist eingebettet).
- [ ] **Suchen & Ersetzen (§19.9):** Cmd/Ctrl+F oder Topbar-Lupe → Begriff eingeben (Trefferzahl live) → „Alle ersetzen" wirkt über alle Folien; Undo (Cmd+Z) macht es rückgängig.
- [ ] **Logo (§19.4):** Design-Tab → „Logo" → Hochladen + Position → erscheint in der Ecke jeder Folie (auch Export/PDF); Entfernen funktioniert.
- [ ] **Templates (§19.4):** „Neu" → Vorlage wählen (Pitch/Vortrag/Editorial/Leer) → Deck wird mit Preset-Theme + Seed-Folien (inkl. Builds) angelegt.
- [ ] **Folien-Übersicht (§19.3):** Präsentieren → Taste `g` (oder Raster-Button) → Grid aller Folien; aktuelle Folie ist markiert; Pfeiltasten bewegen die Auswahl, Enter/Klick springt zur Folie und schließt; `g`/`Esc` schließt ohne Sprung. Bei offener Übersicht navigieren die Pfeile das Grid (nicht die Folien).
- [ ] **Laser/Stift (§19.3):** `l` → Laserpointer (Leucht-Komet folgt der Maus, Schweif blendet aus); `p` → Stift (Striche bleiben stehen, Farbe = Akzent-Token); `c` löscht; Folienwechsel löscht Annotationen automatisch; `Esc` schaltet zuerst das Werkzeug aus, dann verlässt es. In der Speaker-View kein Overlay. Klicks/Navigation bleiben möglich, wenn kein Werkzeug aktiv ist.
- [ ] **Auto-Advance/Loop (§19.3):** `a` (oder Play-Button) startet selbstlaufendes Blättern; Sekunden-Dropdown wirkt; build-bewusst (Schritte vor Folienwechsel); am Ende stoppt es bzw. springt mit aktivem Loop zurück auf Folie 1; manuelles Blättern setzt den Timer neu; offene Übersicht pausiert.
- [ ] **Drag&Drop-Import (§19.8):** Bild/Video/Audio aus dem Finder auf eine Folien-Card ziehen → „Medium hier ablegen"-Overlay → Datei wird importiert/eingefügt (Bild in Markdown- & HTML-Zonen, Video/Audio nur in HTML-Zonen; sonst Hinweis-Toast). Mehrere Dateien gleichzeitig. **Wichtig:** braucht den frischen Build mit `dragDropEnabled:false` (sonst fängt Tauri den Drop ab).
- [ ] **Bild-Crop (§19.8):** Bild in einer Markdown-Zone anklicken → Bild-Toolbar → „Zuschneiden" → Modal mit zieh-/skalierbarem Rahmen → „Zuschneiden" erzeugt ein neues, zugeschnittenes Bild (Original-Asset bleibt); im Editor/Export sichtbar; speichern/öffnen → erhalten.
- [ ] **Icon-Komponente (§19.8, MCP):** „füge ein Häkchen-Icon mit Beschriftung ein" → `insert_component(type:'icon', {name:'check', label:'…'})` → token-gefärbtes Inline-SVG, über die Token-Sidebar umfärbbar.
- [ ] **PPTX-Export (§19.5):** Topbar „PPTX" → Speichern-Dialog → `.pptx` öffnet in PowerPoint/Keynote/LibreOffice: Token-Hintergründe, Überschriften/Listen/Text (Bold/Italic), Bilder, Logo, 16:9. Erwartete v1-Grenzen: HTML-Zonen vereinfacht (Text + Hinweis), Charts/Custom-CSS nicht 1:1, nur #RGB/#RRGGBB-Farben.
- [ ] **Komponenten-Palette (§18.7):** ZoneToolbar-Icon „widgets" (oder Topbar „Komponente") → Modal → links Komponente wählen (z.B. Balkendiagramm), rechts Felder/Daten-Tabelle ausfüllen → **Live-Vorschau** rendert token-gefärbt mit. Platzierung wählen (leere Folie → „einsetzen", HTML-Folie → „anhängen", sonst „neue Folie") → „Einfügen" → erscheint live in der Vorschau, über Token-Sidebar umfärbbar. Eine nicht-leere Markdown-Folie wird nie überschrieben (kommt als neue Folie). Undo (Cmd+Z) nimmt das Einfügen zurück. (Nur Desktop-App — im Browser-Dev zeigt das Modal einen Hinweis.)
- [ ] **Auto-Animate (§19.1):** Zwei benachbarte HTML-Zonen mit einem Element gleichen `data-id` (z.B. `<div data-id="box" style="...">` an verschiedenen Positionen/Größen) — oder Komponente via Palette mit gesetztem `data-id`. Design-Tab → Übergang **„Auto-Animate"** → Präsentieren → Vor/Zurück blättern: das `data-id`-Element **gleitet/skaliert** weich von der einen zur anderen Lage; nicht gematchte Inhalte schalten um. Übersicht-Sprung/erstes Anzeigen morpht NICHT. Mit OS-„Bewegung reduzieren" gibt es harte Umschaltung statt Morph. Im HTML-Export (Teilen) ebenfalls morphend. (data-id geht nur in HTML-Zonen/Komponenten, nicht in Markdown.)
- [x] **Folien-Fenster (§26, vereinheitlicht — GUI-bestätigt):** Präsentieren → **„Folie teilen"** → dekoriertes 16:9-Fenster, Cockpit behält die Tastatur. **Zoom/Meet:** „Fenster teilen" → „Slideo — Präsentation" (nur Folie, Notizen privat). **Beamer:** Fenster aufs 2. Display ziehen → **„Vollbild"** → randlos-füllend auf **genau diesem** Monitor; nochmal → zurück zum Fenster. Pfeil/Leertaste am Cockpit blättert synchron (Builds/Auto-Animate). MCP-Edit während offen → Fenster aktualisiert. Schließen/Esc/Verlassen schließt; Fenster manuell schließen → Cockpit merkt es. (Laser/Stift im Zwei-Fenster-Modus aus — v1.)
- [ ] **Versionshistorie (§19.9):** Deck speichern (Cmd/Strg+S) → Topbar-Uhr-Icon → „Versionsverlauf": ein **Auto**-Snapshot ist da. Etwas ändern + speichern → neuer Auto-Snapshot; ohne Änderung speichern → **kein** neuer (Dedupe). „Schnappschuss" mit Beschriftung → **Manuell**-Eintrag. „Wiederherstellen" (mit Bestätigung) → alter Stand erscheint im Editor, Datei-Dirty-Punkt an, **Cmd/Z** macht das Wiederherstellen rückgängig; danach speichern übernimmt. „Löschen" entfernt einen Snapshot. (Snapshots liegen unter `<config>/slideo/history/`; max. 50, manuelle bleiben länger.) Nur Desktop-App; ohne gespeicherte Datei zeigt das Modal einen Hinweis.

## Polish-Kandidaten (Schritt 2 — nach dem GUI-Test gemeinsam auswählen)

> Keine neuen großen Features mehr; das hier ist die Auswahl-Liste für „was lohnt sich noch zu verbessern".
> Priorisieren wir nach dem GUI-Test (Findings dort können die Reihenfolge ändern).

- [ ] **Laser/Stift aufs Folien-Fenster spiegeln** (§19.3/§26): aktuell im Zwei-Fenster-Modus deaktiviert — Annotationen per Tauri-Event (normalisierte Koordinaten) an das `projector`-Fenster mit display-only `AnnotationLayer`.
- [ ] **Flackerfreies Projector-Update** (§19.3): Live-Deck-Edit lädt das Folien-Iframe aktuell kurz neu (kurzes Re-Render) — Double-Buffer (zweites Iframe, Swap nach Load) oder In-Place-Update statt `srcDoc`-Reload.
- [ ] **Bild-basierter PPTX-/Video-Export via Browser-Offload** (§19.5/§19.8): 1:1-Pixeltreue umgeht die WKWebView-Canvas-Taint-Wand, indem das Rastern im Standardbrowser passiert (Offload), nicht in-app.
- [ ] **Komponenten-Set erweitern** (§18.7): Countdown/Timer, Accordion, Carousel, QR-Code, Icon-Grid … (Rust-Generator, automatisch in Palette + MCP).
- [ ] **Asset-Library-Politur** (§19.4/§15): Font-/Logo-Assets erscheinen als „kaputtes" Thumbnail; eigene Kachel; Assets umbenennen / ungenutzte aufräumen.
- [ ] **Asset-Positionierung „Large"** (§18.1): Drag zwischen Spalten, Block-Drag auch für split/HTML-Zonen, Richtung Free-Canvas.
- [ ] **Bundle-Größe** — Material-Symbols-Variable-Font (~3,6 MB) auf genutzte Icons subsetten.
- [ ] **`slideoasset://`-CSP/Range-Requests** (falls A5 das nahelegt): gezielte CSP + Range-Requests im Protocol-Handler für flüssiges Video-Spulen.

### Polish / erledigt
- ✅ **Komponenten-Palette (manuell einfügen):** UI ([ComponentPaletteModal.tsx](../src/components/modals/ComponentPaletteModal.tsx)), die die 10 Rust-Komponenten (inkl. Charts) per Klick einsetzt — über die Tauri-Commands `list_components`/`render_component` (derselbe Generator wie MCP, keine Template-Duplikation), **mit Parameter-Formularen** (inkl. Daten-Tabelle fürs Chart) **+ Live-Vorschau**. Katalog kommt aus Rust (neue Komponenten erscheinen automatisch); TS hält nur das Formular-Schema ([component-forms.ts](../src/lib/component-forms.ts)). **Noch offen (optional):** Komponenten-**Set iterativ erweitern** (Countdown/Timer, Accordion, Carousel, QR-Code …).

### Kleinere technische To-dos (unabhängig, bei Gelegenheit)
- **`slideoasset://` im Iframe absichern** (falls A5 fehlschlägt): Iframe-`sandbox` um benötigte Tokens erweitern oder gezielte CSP setzen (`media-src slideoasset: data:` etc.). Bilder bleiben Data-URI → kein Risiko.
- **Range-Requests** im Protocol-Handler ([src-tauri/src/lib.rs](../src-tauri/src/lib.rs)) für flüssiges Spulen großer Videos.
- ✅ **Editor-Bild-Vorschau** (erledigt): `SlideoImage.renderHTML` löst `assets/<name>` über [asset-resolver.ts](../src/lib/asset-resolver.ts) zur Data-URI auf (nur Anzeige; Markdown bleibt `assets/<name>`). Resolver wird im Store registriert.
- **Asset-Verwaltung**: umbenennen, ungenutzte aufräumen · **Drag&Drop**-Import.
- **Bundle-Größe:** Material-Symbols-Variable-Font (~3,6 MB) auf genutzte Icons subsetten.

### Größer / später (Spec §12)
- PPTX-Export ✅, Custom-Fonts-Upload ✅, Versionshistorie (lokale Snapshots) ✅ — **offen: Git-UI/echte Versionsverwaltung**, Kollaboration, echtes Speaker-Zweitfenster auf separatem Display.

---

## C. Distribution & Notarization — 🎯 AKTUELLES ZIEL (Fokus nach dieser Session)

Ziel: signierte, notarisierte Builds, die ohne Gatekeeper-Warnung laufen.

### C0. Vorbereitung (alle Plattformen)
- App-Metadaten final: Name „Slideo", Identifier `app.slideo.desktop` ([src-tauri/tauri.conf.json](../src-tauri/tauri.conf.json)), Icon vorhanden.
- **Sicherheits-Review vor Release:** HTML-Zonen führen beliebiges JS im Iframe aus (gewollt), aber der Iframe ist isoliert (`sandbox="allow-scripts"`, keine Tauri-APIs im Iframe). CSP in `tauri.conf.json` ist aktuell `null` — vor Release **bewusst eine CSP setzen**, die Iframe-Funktion (Data-URI, `slideoasset:`, Inline-Styles/Scripts der Slides) erlaubt, aber Sonstiges einschränkt.
- MCP-Auto-Registrierung schreibt in die Claude-Config — im notarisierten `.app` zeigt `current_exe()` auf `/Applications/Slideo.app/Contents/MacOS/slideo`, das passt automatisch.

### C1. macOS — Signing & Notarization
**Voraussetzungen:** Apple Developer Program ($99/J), **Developer ID Application**-Zertifikat (Distribution außerhalb App Store), **kein** App-Sandbox nötig (nur für MAS), Hardened Runtime (von Tauri automatisch).

**Signing** (eine der Varianten):
- Zertifikat im Keychain → `APPLE_SIGNING_IDENTITY="Developer ID Application: <Name> (<TEAMID>)"`.
- Oder CI-tauglich: `APPLE_CERTIFICATE` (base64 der `.p12`) + `APPLE_CERTIFICATE_PASSWORD`.

**Notarization** (Tauri ruft `notarytool` automatisch bei `tauri build`, wenn gesetzt):
```bash
export APPLE_ID="dein@apple.id"
export APPLE_PASSWORD="app-spezifisches-passwort"   # appleid.apple.com → App-spezifische Passwörter
export APPLE_TEAM_ID="DEINE_TEAM_ID"
export APPLE_SIGNING_IDENTITY="Developer ID Application: … (TEAMID)"
npm run tauri build                                  # signiert + notarisiert + stapelt
```
- Ergebnis: `.dmg`/`.app` notarisiert; mit `xcrun stapler validate` prüfen.
- Bei WebView-/JIT-Problemen ggf. **Entitlements**-Datei setzen (`tauri.conf.json` → `bundle.macOS.entitlements`).
- Universal-Binary (arm64 + x86_64) erwägen: `tauri build --target universal-apple-darwin`.

### C2. Windows — Code Signing
- OV-/EV-Zertifikat (EV vermeidet SmartScreen-Reputation-Aufbau). Tauri-Signing via `bundle.windows.signCommand` oder Standard-Signtool-Env.
- WebView2 muss vorhanden sein (Evergreen-Runtime; Tauri kann Bootstrapper bündeln).
- Custom-Protocol-Variante `http://slideoasset.localhost/` testen.

### C3. Linux
- Keine Notarization. **AppImage** und/oder **.deb**/**.rpm** via `tauri build`.
- Laufzeitabhängigkeit: `webkit2gtk`.

### C4. Release-Hygiene
- Versionsschema/Changelog, ggf. Auto-Update (`tauri-plugin-updater`) mit Signaturschlüssel.
- Test der frischen Installation auf einem **sauberen** System (Gatekeeper-Verhalten, Claude-Config-Eintrag, MCP-Verbindung).
