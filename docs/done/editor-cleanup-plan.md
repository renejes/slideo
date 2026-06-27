# Slideo — Implementationsplan: Editor aufräumen + Direktmanipulation für Markdown

> ✅ **ABGESCHLOSSEN** (in `docs/done/`) — Punkt 1+2+3 umgesetzt, headless grün **und GUI-bestätigt**, auf `main`.
> Maßgeblich für den Ist-Stand: `CLAUDE.md`. Dieses Dokument ist der Implementations-Record (Referenz/Historie).
>
> **Status:** **Punkt 1 + 2 + 3 umgesetzt** (siehe „Umsetzungsstand" unten) — headless grün, **GUI-bestätigt**.
> Zusätzlich das Design-Overlay zum **Brand Kit** entschlackt (Produktentscheidung, web-recherchiert; in `CLAUDE.md` +
> Memory `ai-edit-over-workflow-thesis` verankert). Maßgeblich bleibt [slideo-spec.md](slideo-spec.md); Architektur-
> Entscheidungen sind in `CLAUDE.md` verankert. Hintergrund: Code-Analyse der Editor-Textbereich-Tools vs. der **real
> implementierten** Vorschau-Fähigkeiten.
>
> ## Umsetzungsstand (Punkt 1 + 2)
> Punkt 2 wurde mit dem Entwickler zu einem **größeren Shell-Umbau** erweitert (statt nur „Reorder konsolidieren"):
> - **P1.1** ✅ Layout/Ausrichtung-Dropdowns nur für Markdown (`!isHtml`) in [ZoneToolbar.tsx](../src/components/editor/ZoneToolbar.tsx).
> - **P1.2** ✅ Bild-„Größe"-Presets aus [ImageToolbar.tsx](../src/components/editor/ImageToolbar.tsx) **entfernt** (Entscheidung B) + toter `IMAGE_SIZES`-Export weg.
> - **P2** ✅ **Linke Sidebar komplett entfernt** (`Sidebar.tsx`/`ZoneList.tsx` gelöscht) → [EditorShell.tsx](../src/components/ui/EditorShell.tsx) 2-spaltig; [store/layout.ts](../src/store/layout.ts) auf 2 Panes (persist v1→v2 Migration). Reorder bleibt am **Karten-Drag-Handle** (eine Stelle). Design-Tab → **Overlay** ([DesignModal.tsx](../src/components/modals/DesignModal.tsx), Topbar-„Design"-Button). Topbar-„Komponente"-Button (redundant) entfernt.
> - Adversarial reviewt (4 Dimensionen, **0 bestätigte Findings**); typecheck + vite build grün. **GUI-Check ausstehend.**
>
> ## Umsetzungsstand (Punkt 3 — Markdown-Direktmanipulation)
> - **3a** ✅ Block in der Markdown-Vorschau auswählen/**duplizieren**/**löschen** (`.slideo-block`/`data-block-index`),
>   undoable. `editScript` trägt zwei Auswahl-Arten über `selKind`; Store `deleteZoneBlock`/`duplicateZoneBlock`.
> - **3b** ✅ **Inline-Text-Edit** einfacher Blöcke (p/h1–h3) → editiertes HTML via **transienter Tiptap-Instanz**
>   ([`htmlBlockToMarkdown`](../src/lib/tiptap-markdown.ts), Plan-Option A) zurück nach Markdown; Store `editZoneBlock`.
>   Kein Verschieben (Flussmodell); split-Zonen ausgenommen. Kein Schema-Eingriff.
> - **3c** (Klick→Quelle in den Tiptap-Editor) bewusst **nicht** umgesetzt (optionaler Folgeschritt).
> - **Abweichung von Plan 3.8:** das Projekt hat **keinen JS-Test-Runner** → die geplanten tsx-Round-Trip-Unit-Tests
>   konnten nicht laufen; der MD↔HTML-Round-Trip ist **per GUI** zu verifizieren (Risiko bewusst auf einfache p/h-Blöcke
>   begrenzt). Headless grün: typecheck + vite build.

## 0. Worum es geht (Leitidee)

Seit §20 (Direktmanipulation in der Vorschau) und §18.1 (Block-Drag/Bild-Resize) lassen sich Folien stark **in
der Vorschau** bearbeiten. Frage: Welche Tools im **Editor-Textbereich** (links/Mitte) sind dadurch redundant
oder fehl am Platz? Die Code-Analyse ergab: **§20 ist HTML-Zonen-/Element-Ebene**, die Toolbar dagegen
**Zonen-/Markdown-Ebene** — echte 1:1-Redundanz ist klein. Der Gewinn liegt in **Kontext-Sensitivität** (irrelevante
Tools je Zonentyp ausblenden), **Konsolidierung** (Reorder nur an einer Stelle) und — strategisch — dem
**Ausweiten der Direktmanipulation auf Markdown-Zonen**, damit auch dort weniger im Texteditor passieren muss.

**Scope-Disziplin (wie §20):** Korrektur-/Justier-Layer, kein From-Scratch-Canvas. Flussmodell bleibt
unangetastet (Folien/Reihenfolge/Übergänge/Builds/Layouts). Bei Markdown bleibt **Fluss** das Modell — kein
absolutes Verschieben (das ist HTML-Zonen vorbehalten).

### Verifizierter Ist-Stand (am Code, nicht an der Doku)

Vorschau-Fähigkeiten ([PreviewPane.tsx `onMessage`](../src/components/preview/PreviewPane.tsx) +
[`editScript`](../src/lib/renderer.ts) + [`renderZoneSection`](../src/lib/renderer.ts)). Render immer
`editable:true`, `directEdit` nur bei aktivem „Bearbeiten"-Toggle (`previewEdit`):

| Fähigkeit | Markdown-Zone | HTML-Zone |
|---|---|---|
| Blöcke umsortieren (Drag) | ✅ `slideo:reorder-blocks` (nicht bei `split`) | ❌ |
| Bild-Breite ziehen | ✅ `slideo:resize-image` | ❌ |
| Element anklicken→Quelle, Inline-Text, Verschieben (abs. %), Duplizieren, Löschen | ❌ | ✅ (nur „Bearbeiten" an), gated auf `.slideo-zone-html` |

Editor-Textbereich-Tools (Inventar): Karten-Drag-Handle (Zone-Reorder) · Label · **Layout-Dropdown** ·
**Ausrichtung-Dropdown** · Builds-Toggle (nur Markdown) · Medium · Komponente · MD↔HTML-Toggle · Folie löschen ·
Tiptap (Markdown) / CodeMirror (HTML) · **Bild-Toolbar** (Größe/Ausrichtung/Float/Alt/Crop) · Custom-CSS · Notizen.
Layout/Ausrichtung emittieren zwar auch bei HTML-Zonen CSS-Klassen ([SLIDE_CSS](../src/lib/renderer.ts) `.layout-*`/
`.align-*`), werden dort von selbst-gestaltetem HTML aber meist überschrieben → praktisch irrelevant/verwirrend.

---

## Punkt 1 — Kontext-sensitive Editor-Tools (klein, sicher) — ZUERST

**Ziel:** Pro Zonentyp nur die relevanten Tools zeigen. Heute zeigt die [ZoneToolbar](../src/components/editor/ZoneToolbar.tsx)
für **HTML-Zonen** Layout + Ausrichtung, die dort kaum wirken (siehe oben) — genau die Dropdowns aus dem Screenshot.

**Scope IN:**
1. **Layout- + Ausrichtungs-Dropdown nur für Markdown-Zonen** ([ZoneToolbar.tsx](../src/components/editor/ZoneToolbar.tsx)):
   in `!isHtml` wrappen (wie der Builds-Toggle schon). Für HTML-Zonen entfallen sie aus der Toolbar.
   - Bewusst akzeptiert: der seltene Fall „HTML-Snippet ohne eigenes Layout, das `.slideo-content`-Zentrierung/
     max-width nutzen will" geht dann nur noch über Custom-CSS. Dokumentieren.
2. **Bild-Toolbar „Größe" (S/M/L/Voll)** ([ImageToolbar.tsx](../src/components/editor/ImageToolbar.tsx)):
   überlappt mit dem stufenlosen Bild-Resize in der Vorschau. **Entscheidung (zu bestätigen):**
   - **Vorschlag A (behalten):** Presets sind ein anderer Kontext (Editor, ohne Maus-Drag) + schnell → lassen.
     Dann ist Punkt 1.2 ein No-Op/„bewusst behalten" mit Begründung.
   - Vorschlag B (entschlacken): „Größe"-Zeile entfernen, Breite nur noch per Vorschau-Resize.
   → Empfehlung: **A behalten** (geringer Nutzen vom Entfernen, Presets sind bequem); final mit Mensch klären.
3. **ZoneToolbar generell je Zonentyp prüfen:** Label/Medium/Komponente/MD↔HTML/Löschen wirken für beide →
   bleiben. (Builds ist schon markdown-only.)

**Scope OUT:** keine Funktionalität entfernen, die für irgendeinen Zonentyp nützlich ist.

**Dateien:** `ZoneToolbar.tsx` (Hauptänderung), evtl. `ImageToolbar.tsx` (nur falls B).
**Risiko:** minimal (reine UI-Sichtbarkeit, kein Datenmodell). **Aufwand:** ~klein (halbe Stunde + Review).
**Tests:** typecheck/build; GUI: HTML-Zone zeigt keine Layout/Align-Dropdowns mehr, Markdown unverändert; bestehende
Decks öffnen unverändert (Style-Werte bleiben im Modell erhalten, nur die UI blendet sie aus).

---

## Punkt 2 — Zone-Reorder konsolidieren (klein) — DANACH

**Ziel:** Folien-Umsortieren gibt es seit dieser Session an **zwei** Stellen:
- Karten-Drag-Handle in jeder ZoneCard ([EditorCanvas.tsx](../src/components/editor/EditorCanvas.tsx) DndContext +
  [ZoneCard.tsx](../src/components/editor/ZoneCard.tsx) `useSortable`/⠿) — der ältere Weg.
- **Neu:** Folienliste in der Sidebar ([ZoneList.tsx](../src/components/ui/ZoneList.tsx), dnd-kit).

**Entscheidung (Empfehlung):** Reorder **nur in der Folienliste** (Sidebar) — das ist der natürliche „Slide-Panel"-Ort
(wie in PowerPoint/Keynote), kompakt und Übersicht. Den **Karten-Drag-Handle im Editor entfernen** → entschlackt die
Karten und vereinfacht EditorCanvas (kein DndContext/SortableContext mehr) + ZoneCard (kein `useSortable`/Handle).

**Trade-off (dokumentieren):** Mit der jetzt **einklappbaren Sidebar** ist Reorder bei eingeklappter Sidebar nicht
verfügbar → zum Umsortieren Sidebar kurz aufklappen. Akzeptiert (Reorder ist eine Übersicht-/Sidebar-Aufgabe).

**Scope IN:**
- `EditorCanvas.tsx`: DndContext/SortableContext/PointerSensor entfernen, nur noch die Karten + „Slide hinzufügen"
  rendern (über stabile id-Liste).
- `ZoneCard.tsx`: `useSortable`/`attributes`/`listeners`/Transform + Drag-Handle (⠿) entfernen; Karte wird ein
  normaler Container. (Die `React.memo`-Optimierung bleibt.)
- `ZoneList.tsx`: bleibt (ist jetzt die einzige Reorder-Quelle).

**Alternative (falls der Mensch beide will):** Karten-Handle behalten — dann ist Punkt 2 hinfällig. Vor Umsetzung
bestätigen, welche Stelle bleibt.

**Dateien:** `EditorCanvas.tsx`, `ZoneCard.tsx`. **Risiko:** klein (Reorder bereits in der Sidebar verifiziert-bar).
**Aufwand:** ~klein. **Tests:** typecheck/build; GUI: Reorder in der Folienliste wirkt + übersteht Speichern/Öffnen;
Karten ohne Handle; Auswahl/Aktiv-Markierung der Karte unverändert.

---

## Punkt 3 — Direktmanipulation für Markdown-Zonen (strategisch, größer) — ZULETZT

**Ziel:** Auch in Markdown-Zonen Elemente in der Vorschau direkt **auswählen, inline im Text bearbeiten,
duplizieren, löschen** — analog zu §20 (HTML), damit man für schnelle Korrekturen nicht in den Tiptap-Editor
muss. **Verschieben (abs. %) bleibt OUT** (würde das Flussmodell brechen — Markdown bleibt flussbasiert).

### 3.1 Adressierung (vorhanden wiederverwenden)
Im Editier-Render umhüllt [`renderEditableBlocks`](../src/lib/renderer.ts) jeden Top-Level-Block als
`.slideo-block[data-block-index="i"]`, wobei `i` auf `splitMarkdownBlocks(markdown)[i]` mappt (genau das nutzt schon
`slideo:reorder-blocks`/`slideo:resize-image`). **→ Markdown-Direktmanipulation adressiert über `data-block-index`**
(Block-Ebene), NICHT über den HTML-Kind-Index-Pfad (der ist für rohes `zone.html`/§20). Damit bleibt der Eingriff auf
**ganze Blöcke** beschränkt (sauber, flussfreundlich).

### 3.2 Fähigkeiten v1 (Block-Ebene)
- **Auswählen** eines Blocks (Hover/Klick, Wiederverwendung des `editScript`-Auswahl-Layers — bisher `.slideo-zone-html`,
  jetzt auch `.slideo-block`).
- **Löschen** eines Blocks → Block aus `splitMarkdownBlocks` entfernen, neu zusammensetzen. **Trivial** (kein
  HTML→Markdown nötig).
- **Duplizieren** eines Blocks → Block-String klonen, dahinter einfügen. **Trivial.**
- **Inline-Text-Edit** eines Blocks (Doppelklick → `contenteditable` → Commit) → **der harte Teil:** das editierte
  Block-HTML muss zurück nach **Markdown** für genau diesen Block.

### 3.3 Der Knackpunkt: editiertes Block-HTML → Markdown
Markdown→HTML (markdown-it) ist transformierend; die Rückrichtung braucht Sorgfalt. Optionen:
- **Option A (empfohlen): über Tiptap serialisieren.** Das editierte Block-HTML mit `generateJSON(html, baseExtensions())`
  in ein ProseMirror-Doc parsen und mit der bestehenden Markdown-Serialisierung ([tiptap-markdown.ts](../src/lib/tiptap-markdown.ts)
  `editorToMarkdown`-Pfad) zu Markdown zurückwandeln. **Vorteil:** exakt dieselben MD↔HTML-Regeln wie der Editor →
  konsistenter Round-Trip, behandelt Inline-Marks (bold/italic/code/link) und Block-Struktur. Reaktiviert das
  (laut Audit aktuell tote) `markdownToTiptapJSON`/`generateJSON` in [markdown-tiptap.ts](../src/lib/tiptap-markdown.ts).
- Option B: kleiner bespoke HTML→Markdown-Inline-Konverter (strong→`**`, em→`*`, code→`` ` ``, a→`[]()`, br→`\n`).
  Leichter, aber Divergenz-Risiko zur Editor-Konvertierung. **Nicht** empfohlen.
→ **Empfehlung: Option A** (eine Quelle der Wahrheit für MD↔HTML).

### 3.4 Architektur (auf §20 aufsetzen)
- **editScript** ([renderer.ts](../src/lib/renderer.ts)): Auswahl-/Inline-Edit-Layer auch für `.slideo-block`
  aktivieren (bisher nur `.slideo-zone-html`). Neue Messages: `slideo:select-block`, `slideo:edit-block-text`,
  `slideo:delete-block`, `slideo:duplicate-block` mit `{zoneId, blockIndex, ...}`.
- **PreviewPane** ([PreviewPane.tsx](../src/components/preview/PreviewPane.tsx)) `onMessage`: neue Typen →
  neue Store-Actions. Re-Select-Handshake (`slideo:reselect`) sinngemäß für Block-Index wiederverwenden.
- **Store** ([presentation.ts](../src/store/presentation.ts)): `editZoneBlock(zoneId, blockIndex, markdown)`,
  `deleteZoneBlock`, `duplicateZoneBlock` — alle über `splitMarkdownBlocks` + Reassemble, `recordHistory=true`
  (Cmd/Z-fähig, wie `reorderZoneBlocks`).
- **dom-edit.ts** (oder neues `md-edit.ts`): reine, unit-testbare Helfer (Block aus Markdown lesen/ersetzen/löschen/
  duplizieren; HTML→Markdown via Tiptap). Tiptap braucht DOM → ggf. in einer Komponente statt im reinen Helfer
  serialisieren, oder `generateJSON` (geht headless mit ProseMirror). **Vor Bau klären:** läuft `generateJSON` +
  Markdown-Serializer ohne gemountete View? (Voraussichtlich ja — beides arbeitet auf Schema/Doc.)

### 3.5 Scope
**IN (v1):** Auswählen + Inline-Text-Edit + Duplizieren + Löschen von **Markdown-Blöcken** in der Vorschau.
**OUT (v1, bewusst):** Verschieben (abs. %) in Markdown (Flussmodell); Edit *innerhalb* eines Blocks unterhalb der
Block-Ebene (z.B. einzelnes Listenelement) — v1 ist Block-granular; `split`-Zonen (keine Block-Umhüllung → wie heute
ausgenommen oder später); Klick→Quelle in den Tiptap-Editor (anders als CodeMirror keine Offset-Ranges → optionaler
Folgeschritt: Block-Index → ProseMirror-Node-Position scrollen/markieren).

### 3.6 Phasen
- **3a — Auswählen + Löschen + Duplizieren von Blöcken** (~1 Session). Kein HTML→Markdown nötig → schnell, hoher Nutzen.
- **3b — Inline-Text-Edit von Blöcken** (~1 Session). HTML→Markdown via Tiptap (Option A) + Sanitisierung (sanitizeInline
  wiederverwenden) + Round-Trip-Tests.
- **3c (optional) — Klick→Quelle in den Tiptap-Editor** (Block-Index → Node-Position).

### 3.7 Risiken & Gegenmaßnahmen
- **HTML→Markdown-Divergenz** → Option A (Tiptap) nutzt dieselbe Konvertierung wie der Editor; Round-Trip-Tests.
- **Block-Index veraltet** (paralleler MCP-Edit) → vor Anwenden prüfen, dass `blockIndex < blocks.length`; sonst no-op.
- **Flussmodell brechen** → kein Move; nur Block-Ops, die wieder gültiges Markdown ergeben.
- **`generateJSON` ohne View** → vor 3b verifizieren (kleiner tsx-Spike); Fallback Option B nur als Notnagel.
- **Re-Render/Re-Select** → bestehender Handshake.

### 3.8 Tests
- **tsx-Unit** für die Block-Helfer (lesen/ersetzen/löschen/duplizieren Round-Trip; HTML→Markdown für repräsentative
  Blöcke inkl. Inline-Marks + Liste). **Idempotenz:** Markdown → HTML → (editiert ohne Änderung) → Markdown == Original.
- **GUI** (A7-Stil): Block in einer Markdown-Folie auswählen/inline bearbeiten/duplizieren/löschen wirkt live, übersteht
  Speichern/Öffnen, Cmd/Z; HTML-Zonen + Fluss unverändert.

---

## Reihenfolge, Aufwand, Querschnitt

1. **Punkt 1** (kontext-sensitive Tools) — klein, sofort, geringes Risiko.
2. **Punkt 2** (Reorder konsolidieren) — klein.
3. **Punkt 3** (Markdown-Direktmanipulation) — größer, phasen (3a → 3b → optional 3c).

**Querschnitt je Schritt:** `cargo test` (falls Rust berührt — hier v.a. Frontend) / `npm run typecheck` /
`npx vite build` grün; **adversariales Multi-Agent-Review**, bestätigte Findings fixen; GUI-Check durch den Menschen;
Architektur-Entscheidungen in `slideo-spec.md` + `CLAUDE.md` verankern. `version` bleibt **"1.0"** (kein Schema-Eingriff;
Punkt 1/2 reine UI; Punkt 3 ändert nur `zone.markdown`-Inhalt).

## Done-Kriterien
- **P1:** HTML-Zonen zeigen keine Layout/Ausrichtungs-Dropdowns mehr; Markdown-Zonen unverändert; Image-Größe-Entscheidung getroffen.
- **P2:** Zone-Reorder genau an einer Stelle (Empfehlung: Folienliste); Editor-Karten ohne Drag-Handle; übersteht Speichern/Öffnen.
- **P3:** In Markdown-Zonen lassen sich Blöcke in der Vorschau auswählen, inline bearbeiten, duplizieren, löschen — undoable,
  übersteht Speichern/Öffnen; Flussmodell + HTML-§20 unberührt; MD↔HTML-Round-Trip konsistent (Option A).
