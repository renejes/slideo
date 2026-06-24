# Slideo — Nächste Schritte

> To-do-Dokument. **Die Feature-Roadmap §18/§19 ist im Wesentlichen abgeschlossen.** Reihenfolge jetzt:
> **(0) Direktmanipulation in der Vorschau bauen** (DER nächste Fokus — Plan: [direct-manipulation-plan.md](direct-manipulation-plan.md)) →
> **(1) vollständiger GUI-Test** (A, parallel/sekundär) → **(2) Polish** („Polish-Kandidaten") →
> **(3) Distribution/Notarization** (C).
> Stand-Kontext: [project-status.md](project-status.md). Maßgebliche Spec: [slideo-spec.md](slideo-spec.md).

---

## 0. Direktmanipulation in der Vorschau — **DER PLAN DER NÄCHSTEN SESSION**

> **Vollständiger, im Code verankerter Implementationsplan: [direct-manipulation-plan.md](direct-manipulation-plan.md)** — vor dem Loslegen lesen.

**Ziel:** Elemente **direkt in der rechten Vorschau anfassen, verschieben, duplizieren, im Text bearbeiten und
löschen** — schneller als KI-erzeugtes HTML per Hand zu korrigieren. **Korrektur-Layer über KI-Output**, kein
PowerPoint-Canvas; neue Elemente entstehen per **Duplizieren + Bearbeiten**. Flussbasiertes Modell (Folien,
Reihenfolge, Notizen, Übergänge) bleibt unangetastet; betrifft nur das Innenleben von **HTML-Zonen**.

Phasen (Details + Dateien im Plan): **Phase 0** Klick → Quelle (HTML-Editor-Stelle markieren) · **Phase 1**
Auswählen + Löschen + Duplizieren · **Phase 2** Inline-Text-Edit · **Phase 3** Verschieben (abs. `%`-Position).
Adressierung über **Kind-Index-Pfad ab `.slideo-content`** (kein Schema-Eingriff), Ops über `DOMParser` auf dem
**rohen** `zone.html`, **per Pointer-Events** (WKWebView), undoable. Beim Bau in **Spec §20** verankern.

- [ ] **Phase 0** — Klick → Quelle (`dom-edit.ts` neu, `ui.ts`, `HtmlEditor.tsx`, `PreviewPane.tsx`).
- [ ] **Phase 1** — Auswahl-Layer/Toolbar im `editScript()`, Modus-Toggle, `applyZoneElementOp` (delete/duplicate), Re-Select.
- [ ] **Phase 2** — Inline-Text-Edit (contenteditable-Round-Trip).
- [ ] **Phase 3** — Verschieben (Drag → `%`-Position).

---

## A. Testen (sekundär/parallel — vollständiger Durchlauf A1–A7)

Bisher ist alles nur automatisch grün (`cargo test` 27, `typecheck`, `vite build` + Multi-Agent-Reviews je
Feature), aber **noch nichts in der echten App durchgeklickt**. **A1–A7 Punkt für Punkt** — der
**Mensch testet**, die **KI fixt bestätigte Findings**.

Vorbereitung: `npm run tauri:dev` **frisch** starten. Nach jeder Backend-Änderung zusätzlich **Claude Desktop neu starten** (sonst altes MCP-Binary! — jetzt **35 MCP-Tools**).

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

### A4. MCP / KI (Claude Desktop)
- [ ] Claude Desktop neu starten → Slideo-Tools erscheinen (sollten **23** sein, inkl. `set_zone_css`, `list_assets`).
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
> 2. ✅ **Outline-Modus** (umgesetzt) — Folientexte als editierbare Gliederung ([OutlineView.tsx](../src/components/editor/OutlineView.tsx), verlustfrei über [outline.ts](../src/lib/outline.ts)).
> 3. ✅ **Versionshistorie** (umgesetzt) — lokale `.slideo`-Snapshots (Auto + manuell, Wiederherstellen) — [history.rs](../src-tauri/src/history.rs) / [HistoryModal.tsx](../src/components/modals/HistoryModal.tsx).
> 4. ✅ **Auto-Animate/Morph** (umgesetzt) — Übergang `auto`: gleiche `data-id`-Elemente zwischen Folien per FLIP ([renderer.ts](../src/lib/renderer.ts), `data-id` via HTML-Zone / `insert_component`).
> 5. ✅ **Echtes Zweitfenster** (umgesetzt) — `projector`-Fenster (randlos bildschirmfüllend) + Monitor-Dropdown + Event-Sync; Ein-Fenster-Modus bleibt.
> 6. ❌ **§19.8 Aufnahme/Narration + Video-Export** — **bewusst weggelassen (out of scope):** off-thesis für eine MCP/KI-Authoring-App; Medien-Bedarf ist via Einbettung gedeckt; schlimmste WKWebView-Hürden. Wird nicht gebaut.
>
> Quer dazu **erledigt**: MCP-Paritäts-Audit → 5 neue Tools (`set_logo`/`clear_logo`/`register_font`/`set_presentation_title`/`set_zone_label`), **35 MCP-Tools**.
>
> **Damit ist die Feature-Roadmap §18/§19 im Wesentlichen durch.** Nächste Session: **(1) vollständiger GUI-Test A1–A7**, **(2) Polish auswählen** (siehe „Polish-Kandidaten" unten), später **(3) Distribution/Notarization** (C). Keine neuen großen Features geplant.
>
> Quer dazu offen: **GUI-Verifikation** aller §18/§19-Features (Abschnitt A1–A7) und **Distribution/Notarization** (Abschnitt C).

- ✅ **19.2 Daten-Diagramme** — `line_chart` + `donut_chart` (10 Komponenten gesamt inkl. `icon`).
- ✅ **19.7 Barrierefreiheit** — Alt-Text-Feld + WCAG-Kontrast-Check.
- ✅ **19.1 In-Folien-Builds + Auto-Animate** — `set_zone_reveal`, parent-autoritative Nav; **Übergang `auto`** = FLIP-Morph gleicher `data-id`-Elemente zwischen benachbarten Folien (In-App + Export). **§19.1 komplett.**
- ✅ **19.4 Vorlagen & Marke** — Custom-Fonts + Logo/Brand + Starter-Templates.
- ✅ **19.9 Suchen & Ersetzen** + Spellcheck + **Outline-Modus** (Ansichtswechsel „Folien ⇄ Gliederung", verlustfreie Titel/Rumpf-Bearbeitung über [outline.ts](../src/lib/outline.ts)) + **Versionshistorie** (lokale `.slideo`-Snapshots, Auto beim Speichern + manuell, Wiederherstellen — [history.rs](../src-tauri/src/history.rs) / [HistoryModal.tsx](../src/components/modals/HistoryModal.tsx)). **§19.9 komplett.**
- ✅ **19.3 Presenter-Tools** — Folien-Übersicht/Sprung-Grid, Laser-/Stift-Overlay, Auto-Advance/Loop + **echtes Zweitfenster** (randlos bildschirmfüllendes `projector`-Fenster auf gewähltem Monitor, Event-Sync; [present.rs](../src-tauri/src/present.rs)/[ProjectorView.tsx](../src/components/presentation/ProjectorView.tsx)). **§19.3 komplett** (Multi-Display-GUI-Test steht aus).
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
- [ ] **MCP-Tools 35:** Claude Desktop neu starten → `set_zone_notes`, `set_zone_reveal`, `apply_preset`, `set_transition`, `list_components`/`insert_component` (inkl. `line_chart`/`donut_chart`) sowie die Paritäts-Tools `set_logo`/`clear_logo`, `register_font`, `set_presentation_title`, `set_zone_label` vorhanden.
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
- [ ] **Outline-Modus (§19.9):** Topbar-Umschalter „Gliederung" → alle Folien als Liste; Titel (erste Überschrift) + Inhalt (Markdown) editierbar → Änderungen wirken in den Folien (zurück auf „Folien" prüfen); Cursor springt beim Tippen nicht. ↑/↓ sortieren, „+" fügt Folie ein, Papierkorb löscht, Stift öffnet die Folie im Editor. Nach Reorder/Einfügen/Löschen macht **Cmd/Z** die Aktion rückgängig (auch wenn vorher ein Textfeld fokussiert war). HTML-Folien sind read-only (Öffnen-Link). Eine Überschrift, die oben ins Inhalt-Feld getippt wird, wandert beim Wechsel ins Titel-Feld (gleiche Ausgabe).
- [ ] **Auto-Animate (§19.1):** Zwei benachbarte HTML-Zonen mit einem Element gleichen `data-id` (z.B. `<div data-id="box" style="...">` an verschiedenen Positionen/Größen) — oder Komponente via Palette mit gesetztem `data-id`. Design-Tab → Übergang **„Auto-Animate"** → Präsentieren → Vor/Zurück blättern: das `data-id`-Element **gleitet/skaliert** weich von der einen zur anderen Lage; nicht gematchte Inhalte schalten um. Übersicht-Sprung/erstes Anzeigen morpht NICHT. Mit OS-„Bewegung reduzieren" gibt es harte Umschaltung statt Morph. Im HTML-Export (Teilen) ebenfalls morphend. (data-id geht nur in HTML-Zonen/Komponenten, nicht in Markdown.)
- [ ] **Echtes Zweitfenster (§19.3, Multi-Display):** Mit zweitem Bildschirm → Präsentieren → Steuerleiste „Auf zweitem Bildschirm präsentieren" (present_to_all) → Monitor wählen → **Folien randlos bildschirmfüllend auf dem gewählten Display**, Hauptfenster zeigt die **SpeakerView**. Pfeil/Leertaste am Laptop blättert **beide** synchron (inkl. Builds/Auto-Animate). MCP-Edit während offen → Folien-Fenster aktualisiert. „Zweites Fenster schließen"/Esc/Verlassen schließt es; Fenster manuell schließen → Steuerfenster merkt es. Monitor-Menü: Klick daneben/Esc schließt nur das Menü. (Laser/Stift im Zwei-Bildschirm-Modus ausgeblendet — v1.)
- [ ] **Versionshistorie (§19.9):** Deck speichern (Cmd/Strg+S) → Topbar-Uhr-Icon → „Versionsverlauf": ein **Auto**-Snapshot ist da. Etwas ändern + speichern → neuer Auto-Snapshot; ohne Änderung speichern → **kein** neuer (Dedupe). „Schnappschuss" mit Beschriftung → **Manuell**-Eintrag. „Wiederherstellen" (mit Bestätigung) → alter Stand erscheint im Editor, Datei-Dirty-Punkt an, **Cmd/Z** macht das Wiederherstellen rückgängig; danach speichern übernimmt. „Löschen" entfernt einen Snapshot. (Snapshots liegen unter `<config>/slideo/history/`; max. 50, manuelle bleiben länger.) Nur Desktop-App; ohne gespeicherte Datei zeigt das Modal einen Hinweis.

## Polish-Kandidaten (Schritt 2 — nach dem GUI-Test gemeinsam auswählen)

> Keine neuen großen Features mehr; das hier ist die Auswahl-Liste für „was lohnt sich noch zu verbessern".
> Priorisieren wir nach dem GUI-Test (Findings dort können die Reihenfolge ändern).

- [ ] **Laser/Stift aufs Zweitfenster spiegeln** (§19.3): aktuell im Zwei-Bildschirm-Modus deaktiviert — Annotationen per Tauri-Event (normalisierte Koordinaten) an das `projector`-Fenster mit display-only `AnnotationLayer`.
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

## C. Distribution & Notarization

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
