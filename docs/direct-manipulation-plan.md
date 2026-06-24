# Slideo — Implementationsplan: Direktmanipulation in der Vorschau (v1)

> **Status:** geplant, noch nicht gebaut. Maßgeblich bleibt [slideo-spec.md](slideo-spec.md); dieser Plan wird
> beim Umsetzen dort als eigener Abschnitt (§20) verankert. Stand-Kontext: [project-status.md](project-status.md).

## 0. Worum es geht (Ziel & Leitidee)

Die KI baut über MCP oft **HTML-Zonen** (v.a. designlastige, wie die „Magazin"-Folien). Diese **per Hand im
Code zu korrigieren ist mühsam** (Text suchen, verschachteltes HTML editieren). Ziel: Elemente **direkt in der
rechten Vorschau anfassen, verschieben, duplizieren, im Text bearbeiten und löschen** — schneller als HTML
editieren oder Änderungen in Worten zu beschreiben.

**Leitidee / Scope-Disziplin (wichtig, damit es NICHT PowerPoint wird):** Das ist ein **Korrektur-Layer über
KI-Output**, kein From-Scratch-Design-Canvas. Man bearbeitet **vorhandene** Elemente. **Neue Elemente entstehen
durch Duplizieren + Bearbeiten** (bewusste Entscheidung — spart das „Element aus dem Nichts zeichnen" und hält
v1 klein). Das **Flussbasierte bleibt unangetastet**: Folien, Reihenfolge, Notizen, Übergänge, Builds, Layouts.
Direktmanipulation betrifft nur das **Innenleben einer Zone**. Bleibt damit on-thesis (KI baut, Mensch justiert).

## 1. Scope v1

**IN:**
- **Phase 0 — Klick → Quelle:** Klick auf ein Element in der Vorschau → Zone wird aktiv + die passende Stelle im
  HTML-Editor (CodeMirror) wird markiert/angesprungen. (Sofort-Hilfe, kleiner Bau, eigenständig nützlich.)
- **Auswählen** eines Elements (Hover-Highlight, Klick-Auswahl, „eine Ebene hoch" für verschachteltes HTML).
- **Text bearbeiten** inline (contenteditable im Iframe, Commit als reiner Text).
- **Verschieben** (Drag → absolute Position in %). v1: für bereits absolut positionierte Elemente; Fließ-Elemente
  optional per „aufs Canvas heben" (siehe Offene Entscheidung 2).
- **Duplizieren** (ersetzt „neues Element einfügen").
- **Löschen.**
- **Undo/Redo** über die bestehende Store-History (Cmd/Z).
- Gilt für **HTML-Zonen** (der Schmerzpunkt). Markdown-Zonen bleiben Fluss (Tiptap/Outline).

**OUT (v1, bewusst):**
- Neue Elemente/Formen/Textboxen **aus dem Nichts** zeichnen (Duplizieren+Bearbeiten deckt es ab).
- Freies Resize **beliebiger** Elemente (Bilder sind schon resizebar; generisches Resize = später).
- Multi-Select, Gruppieren, Ausrichten/Verteilen, Snapping/Hilfslinien, Rotation, z-Index-UI (späterer Polish).
- Direktmanipulation in **Markdown**-Zonen (bleiben flussbasiert).

## 2. Architektur — worauf wir aufsetzen (alles vorhanden)

| Baustein | Datei | Was er heute tut |
|---|---|---|
| Editier-Vorschau | [PreviewPane.tsx](../src/components/preview/PreviewPane.tsx) | rendert **alle** Zonen (Scroll) als `srcDoc`-Iframe, **debounced 220 ms**, `editable:true`; hört auf `slideo:reorder-blocks`/`slideo:resize-image` → Store. |
| Edit-Skript (im Iframe) | [renderer.ts](../src/lib/renderer.ts) `editScript()` (~Z.444) | **Pointer-Events** (kein HTML5-DnD!): Block-Drag + Bild-Resize; postet Messages an den Parent. Anfasser-UI per Overlay-Divs im Iframe (`rh`). |
| Zonen-Rendering | `renderZoneSection()` (~Z.665) | `<section id="zone-<uuid>" class="slideo-zone layout-… align-…">` → `customStyle?` + `<div class="slideo-content">{inner}</div>` + `logo?`. HTML-Zonen: `inner = zone.html` **roh** (danach `resolveAssetRefs` → `assets/x` zu Data-URI/`slideoasset://` **nur im Live-DOM**). |
| Store-Mutationen | [presentation.ts](../src/store/presentation.ts) | Muster: `mutate(fn, recordHistory)`; `updateZoneHtml(id, html)`; `reorderZoneBlocks`/`resizeZoneImage`. |
| HTML-Editor | [HtmlEditor.tsx](../src/components/editor/HtmlEditor.tsx) | CodeMirror 6 pro HTML-Zone (in [ZoneCard.tsx](../src/components/editor/ZoneCard.tsx)); `viewRef` (EditorView); externe Änderungen über den `initialHtml`-Effekt. |
| UI-Store | [ui.ts](../src/store/ui.ts) | Modal-/View-State (Zustand). |

**WKWebView-Regeln gelten:** Pointer-Events statt HTML5-DnD; Transforms sind zuverlässig; Iframe ist
`sandbox="allow-scripts"` → Kommunikation **nur** per `postMessage`; Auswahl/Anfasser-Overlays werden **im Iframe**
gezeichnet (Parent kann nicht pixelgenau drüberlegen) — exakt wie der bestehende Resize-Anfasser `rh`.

## 3. Der Kern-Trick: Elemente adressieren ohne ID-Injektion (Kind-Index-Pfad)

Der Renderer gibt `zone.html` **strukturell 1:1** aus (der Browser parst es ohne Umsortieren). Daher ist ein
**Pfad aus Kind-Element-Indizes**, verankert an `.slideo-content`, eine **stabile, bidirektionale Adresse**:

- Im Iframe: vom angeklickten Element nach oben laufen bis `.slideo-content`, dabei je Ebene `el`s Index in
  `parent.children` (nur **Element**-Kinder, Whitespace egal) sammeln → z.B. `[2, 0, 3]`.
- In der App: `zone.html` mit `DOMParser` (`text/html`) parsen; `body.children` == die Top-Level-Elemente, die
  im Live-DOM die **Kinder von `.slideo-content`** sind. Denselben Pfad absteigen → dasselbe Element.

**Zwei Fallstricke (im Code beachtet):**
1. **Anker ist `.slideo-content`, nicht `<section>`** — denn das `<style>` (custom_css) und das Logo-`<img>` sind
   **Geschwister** von `.slideo-content`. Pfade starten an `.slideo-content`.
2. **Operationen laufen auf dem ROHEN `zone.html`** (mit `assets/x`-Refs), **nicht** auf dem asset-aufgelösten
   Live-DOM. `resolveAssetRefs` ändert nur Attribut-*Werte* (`src`), nicht die Element-*Struktur* → der im
   Live-DOM berechnete Pfad passt auf das geparste rohe Quell-DOM. Beim Re-Serialisieren bleiben `assets/x` erhalten.

(Robustheits-Upgrade für später, falls Pfade je zu fragil werden: pro Element ein `data-slideo-id` injizieren und
darüber adressieren. Für v1 **nicht** nötig — der Pfad reicht, kein Schema-/Quelltext-Eingriff.)

## 4. Neue/zu ändernde Dateien

### 4.1 `src/lib/dom-edit.ts` (NEU, rein & unit-testbar)
Reine Helfer ohne React/DOM-Globals-Abhängigkeit (nutzt `DOMParser`, in Vite/jsdom/tsx verfügbar):
- `applyElementOp(html: string, path: number[], op: Op, payload): string`
  - parst `html`, navigiert per `path` (Body-Top-Level → absteigen), wendet an, gibt `body.innerHTML` zurück.
  - **op `move`**: `el.style.position` auf `absolute` sicherstellen + `left`/`top` als `%` setzen.
  - **op `editText`**: setzt den Text des Elements (für Leaf-Text-Elemente: `el.textContent = text`; mehrzeilig
    → `\n`→`<br>` oder als-ist, siehe Offene Entscheidung 4). Sanitisiert (kein fremdes Markup übernehmen).
  - **op `duplicate`**: `el.cloneNode(true)` direkt nach `el` einfügen; bei absoluten Elementen Position leicht versetzen.
  - **op `delete`**: `el.remove()`.
- `findSourceRange(html: string, path: number[]): {from: number, to: number} | null`
  - **positionsbewusster** HTML-Scan (kleiner Tokenizer, der Start-Offsets der öffnenden Tags je Kind-Index-Pfad
    mitschreibt) → exakte Quell-Range für Phase 0 (CodeMirror-Markierung). DOMParser liefert **keine** Offsets,
    daher ein eigener ~80-Zeilen-Walk (oder Mini-Dep `htmlparser2` mit `startIndex`). **Fallback** für einen
    ersten Wurf: `el.outerHTML` als Suchstring im Quelltext (näherungsweise „in die Nähe springen").
- Typ `Op = 'move' | 'editText' | 'duplicate' | 'delete'` + Payload-Typen.

### 4.2 `src/store/presentation.ts`
Eine generische Action (oder vier dünne):
- `applyZoneElementOp(zoneId: string, path: number[], op: Op, payload): void`
  - Zone holen, **nur HTML-Zonen** (sonst no-op), `applyElementOp(zone.html, …)`, dann
    `mutate(... { ...z, html: newHtml }, recordHistory=true)` → **Cmd/Z fähig** (strukturelle Edits).
  - `setActiveZone(zoneId)` am Ende (wie reorder/insert).
- Hinweis: `updateZoneHtml` nutzt `recordHistory=false` (laufendes Tippen). Für diskrete Direktmanipulations-Ops
  wollen wir **History** → eigener Pfad mit `recordHistory=true` (wie `insertComponent`).

### 4.3 `src/lib/renderer.ts` → `editScript()` erweitern
Neuer **Auswahl-/Manipulations-Layer** (zusätzlich zum Block-Drag/Resize), aktiv nur im **Direktbearbeiten-Modus**
(siehe 4.5). Alles per Pointer-Events, Overlays im Iframe gezeichnet:
- **Hover:** Element unter dem Cursor (innerhalb `.slideo-content` einer Zone) dezent umranden.
- **Klick:** Element auswählen → Auswahl-Box + **Mini-Toolbar** (Buttons: ✎ Text, ⤧ Verschieben, ⧉ Duplizieren,
  🗑 Löschen, ▲ Ebene hoch). `slideo:select-element {zoneId, path}` posten.
- **Drag (Verschieben):** pointerdown auf der Auswahl/Move-Button → live `transform: translate(dx,dy)` →
  pointerup: neue Position als `%` der **Folien-Box** berechnen → `slideo:move-element {zoneId, path, leftPct, topPct}`.
- **Text bearbeiten:** Doppelklick / ✎ → Element kurz `contenteditable=true`, fokussieren; bei Blur/Enter →
  `slideo:edit-text {zoneId, path, text}` (`textContent`).
- **Duplizieren:** ⧉ → `slideo:duplicate-element {zoneId, path}`.
- **Löschen:** 🗑 / Entf-Taste → `slideo:delete-element {zoneId, path}`.
- **Ebene hoch:** ▲ / Esc → Auswahl auf das Eltern-Element (für verschachteltes Magazin-HTML).
- Pfad-Helfer im Skript: `pathOf(el)` (hoch bis `.slideo-content`, `children`-Indizes), `zoneId = section.id.replace(/^zone-/,'')`.
- CSS für Auswahl-Box/Toolbar (zur Edit-CSS bzw. `SLIDE_CSS` hinzufügen).

### 4.4 `src/components/preview/PreviewPane.tsx`
- `onMessage` um die neuen Typen erweitern → jeweilige Store-Action.
- `slideo:select-element` → `setActiveZone(zoneId)` **+** Phase-0-Reveal (4.6).
- **Re-Select nach Re-Render:** Nach einer Op rendert das Iframe (debounced) neu → Auswahl ginge verloren. Lösung:
  zuletzt gewählten `{zoneId, path}` im PreviewPane merken und nach `onLoad`/Re-Render per `postMessage`
  (`slideo:reselect {zoneId, path}`) zurückschicken, damit das Iframe die Auswahl wieder setzt. (Bei `delete`:
  Auswahl auf das vorige Geschwister/Eltern fallen lassen.)

### 4.5 Direktbearbeiten-Modus (Toggle)
Ein **expliziter Modus** in der Vorschau-Kopfzeile (Icon-Toggle „Bearbeiten", z.B. `arrow_selector_tool`/`edit`),
damit Hover/Auswahl nicht das normale Durchscrollen/Navigieren stört. State im UI-Store
(`previewEdit: boolean`), an `renderFullPage({ editable, directEdit })` durchreichen → `editScript` schaltet den
Auswahl-Layer nur bei `directEdit` ein. Block-Drag/Resize bleiben wie gehabt.

### 4.6 Phase 0 — Klick → Quelle (CodeMirror)
- UI-Store: `htmlReveal: { zoneId: string; from: number; to: number; nonce: number } | null` + Setter.
- PreviewPane bei `slideo:select-element`: `setActiveZone(zoneId)`; `findSourceRange(zone.html, path)` → falls
  Range, `setHtmlReveal({ zoneId, from, to, nonce: ++ })`.
- [ZoneCard.tsx](../src/components/editor/ZoneCard.tsx): aktive Zone bei Reveal in den Sichtbereich scrollen +
  **HTML-Zonen-Editor sicher sichtbar** (HTML-Zonen zeigen den Editor ohnehin; ggf. Card fokussieren).
- [HtmlEditor.tsx](../src/components/editor/HtmlEditor.tsx): `htmlReveal` beobachten (nur wenn `zoneId` == eigene
  Zone) → `view.dispatch({ selection: {anchor:from, head:to}, scrollIntoView:true })` + `view.focus()`.
  Den `nonce` als Trigger nutzen (auch bei gleicher Range erneut springen).

## 5. Datenfluss je Operation (End-to-End)

```
Iframe (editScript, Pointer)  ──postMessage──▶  PreviewPane.onMessage  ──▶  Store-Action
   pathOf(el) + Op                              validiert {zoneId,path}      applyElementOp(zone.html,path,op)
   live transform (Feedback)                                                 → updateZoneHtml(recordHistory=true)
        ▲                                                                          │
        └────────── slideo:reselect {zoneId,path} ◀── PreviewPane (nach Re-Render) ◀┘  (Store → debounced render)
```
- **Verschieben**: live im Iframe (transform) sofort sichtbar; Commit bei pointerup; nach 220 ms Re-Render bäckt die
  `%`-Position ins HTML, Auswahl wird re-set.
- **Text/Duplizieren/Löschen**: optimistisch im Iframe anzeigen ODER auf den Re-Render warten; Re-Select danach.

## 6. Phasen & Aufwand (jede Phase: cargo/typecheck/vite grün + adversariales Review + GUI-Check)

- **Phase 0 — Klick → Quelle** (~halbe Session). `dom-edit.findSourceRange` + UI-Store-Reveal + HtmlEditor-Reveal +
  PreviewPane `slideo:select-element`. Liefert sofort spürbaren Wert, unabhängig vom Rest.
- **Phase 1 — Auswahl + Löschen + Duplizieren** (~1 Session). Auswahl-Layer/Toolbar im `editScript`, Modus-Toggle,
  `applyElementOp` (delete/duplicate) + Store-Action + Re-Select. Höchster Nutzen, einfachste Ops.
- **Phase 2 — Inline-Text-Edit** (~1 Session). contenteditable-Round-Trip + Sanitisierung.
- **Phase 3 — Verschieben** (~1 Session). Drag → `%`-Position; „aufs Canvas heben" je nach Offener Entscheidung 2.
- **Optionaler Polish (später):** generisches Resize, Multi-Select, Ausrichten/Snapping, z-Index/Rotation.

## 7. Offene Entscheidungen (vor/zu Beginn klären)

1. **Auswahl-Granularität:** Klick wählt das kleinste sinnvoll umschließende Element; ▲/Esc = Eltern. Reicht das, oder
   wollen wir „erst Block, Doppelklick steigt tiefer" (Figma-Stil)? → **Vorschlag:** kleinstes Element + ▲ hoch.
2. **Verschiebe-Semantik für Fließ-Elemente:** v1 nur Elemente bewegen, die schon `position:absolute` sind; Fließ-
   Elemente zeigen Aktion „aufs Canvas heben" (setzt `position:absolute`). → **Vorschlag:** Heben **anbieten**, klar
   gekennzeichnet (es kann das responsive Fluss-Layout brechen).
3. **Re-Serialisierung formatiert das `zone.html` einmalig neu** (Attribut-Reihenfolge/Whitespace) → im CodeMirror
   sieht der Quelltext nach der ersten Op anders aus. Akzeptabel? → **Vorschlag:** ja, dokumentieren.
4. **Mehrzeiliger Inline-Text:** `textContent` (einfach) vs. `\n`→`<br>`. → **Vorschlag:** `\n`→`<br>`, sonst reiner Text.
5. **Position in `%`** relativ zur Folien-Box (responsiv) — bestätigen (vs. px). → **Vorschlag:** `%`.

## 8. Risiken & Gegenmaßnahmen

- **Pfad veraltet durch parallelen MCP-Edit** (Live-Bridge mutiert die Zone): Op trifft falsches/fehlendes Element.
  → Vor Anwenden prüfen, dass der Pfad existiert; sonst no-op + Auswahl löschen. Risiko gering (Ops sind kurz).
- **Auswahl-Verlust beim 220-ms-Re-Render** → Re-Select-Handshake (4.4).
- **contenteditable bringt schmutziges Markup** → beim Commit nur Text/`<br>` übernehmen.
- **Verschachtelte Magazin-Folien** → ▲-Navigation + Hover-Pfad-Anzeige (Breadcrumb optional).
- **Iframe-Sandbox** → alles über `postMessage`, Overlays im Iframe (bewährt).
- **Markdown-Zonen** versehentlich treffen → Direktmanipulations-Layer **nur** für HTML-Zonen aktivieren
  (Markdown behält Block-Drag).

## 9. Tests

- **tsx-Unit** für `dom-edit.ts`: `applyElementOp` (move/editText/duplicate/delete) Round-Trip auf Beispiel-HTML
  **inkl. einer echten Magazin-Folie**; `assets/x`-Refs bleiben erhalten; Pfad-Navigation korrekt.
- **Pfad-Äquivalenz:** Live-DOM-Pfad == Quell-DOM-Pfad auf repräsentativem HTML (strukturelle Gleichheit).
- **`findSourceRange`** trifft die richtige Quell-Range (mehrere gleiche Tags).
- **GUI-Checkliste** (A7-Stil) je Phase: Auswählen/Verschieben/Duplizieren/Bearbeiten/Löschen wirkt live, übersteht
  Speichern/Öffnen, Cmd/Z macht rückgängig, Markdown-Zonen unberührt.

## 10. Done-Kriterien v1

- In einer HTML-Zone lässt sich ein Element **anklicken → auswählen**, **inline im Text bearbeiten**, **verschieben**
  (absolut), **duplizieren** und **löschen** — direkt in der Vorschau, ohne HTML anzufassen.
- Ergebnis landet im `zone.html`, übersteht Speichern/Öffnen, ist **undoable** (Cmd/Z).
- **Klick → Quelle** markiert die Stelle im HTML-Editor.
- Flussbasiertes Modell (Folien/Reihenfolge/Notizen/Übergänge/Builds) **unverändert**; Markdown-Zonen unberührt.
- `version` bleibt "1.0" (kein Schema-Eingriff; nur HTML-Inhalt der Zone ändert sich).
- cargo/typecheck/vite grün; je Phase adversariales Review + bestätigte Findings gefixt; in `slideo-spec.md` als §20
  verankert, `project-status.md`/`next-steps.md`/`CLAUDE.md` aktualisiert.
