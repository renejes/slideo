# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat. Damit ist der nächste Claude vollständig im Bild.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo** und machen am nächsten Meilenstein weiter. Lies dich zuerst ein, bevor du Code schreibst.

**Was Slideo ist:** Eine lokale, code-freie, **MCP-native** Desktop-App für Präsentationen (Tauri 2 + React/TypeScript + Vite). Eine Präsentation ist eine HTML-Page aus „Zones" (Slides). Kein AI-Layer in der App — die KI-Anbindung läuft ausschließlich über einen mitgelieferten **MCP-Server** (Claude Desktop). Läuft vollständig lokal.

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`

### Das Ziel dieser Session (Hauptaufgabe)
**Editor aufräumen + Direktmanipulation auf Markdown ausweiten** — der Plan steht in **`docs/editor-cleanup-plan.md`**. Drei Punkte, in dieser Reihenfolge:
1. **Kontext-sensitive Editor-Tools** (klein): Layout- + Ausrichtungs-Dropdown nur noch für Markdown-Zonen zeigen (bei HTML-Zonen sind sie praktisch wirkungslos/verwirrend); Bild-„Größe" vs. Vorschau-Resize entscheiden.
2. **Zone-Reorder konsolidieren** (klein): Umsortieren gibt es aktuell doppelt (Karten-Drag-Handle im Editor **und** neue Folienliste in der Sidebar) → Empfehlung: nur in der Folienliste, Karten-Handle entfernen.
3. **Direktmanipulation für Markdown-Zonen** (größer, phasen): Blöcke in der Vorschau auswählen / inline bearbeiten / duplizieren / löschen (kein Verschieben — Markdown bleibt flussbasiert). Adressierung über das vorhandene `data-block-index`. Der harte Teil: editiertes Block-HTML → Markdown (Empfehlung: über Tiptap serialisieren = eine Quelle der Wahrheit).

**`docs/editor-cleanup-plan.md` ist maßgeblich** für diese Aufgabe (Scope, Dateien, Phasen, Risiken, offene Entscheidungen). **Kläre die offenen Entscheidungen (Bild-„Größe" behalten/entfernen; Reorder welche Stelle) kurz mit mir, bevor du in dem jeweiligen Punkt baust.**

### Bitte zuerst lesen (in dieser Reihenfolge):
1. **`docs/editor-cleanup-plan.md`** — die Aufgabe dieser Session (Code-fundiert; enthält den verifizierten Ist-Stand von Editor-Tools vs. Vorschau-Fähigkeiten).
2. **`CLAUDE.md`** (Projektwurzel) — Konventionen, Design-System, Architektur-Entscheidungen (ist aktuell, inkl. Security-Härtung, Editor-Shell, Icon-Subset).
3. **`docs/slideo-spec.md`** — maßgebliche Spezifikation. Relevant: §14 HTML-Zonen, §16 Layouts, §17 Custom-CSS, **§20 Direktmanipulation** (HTML), **§21 feste 16:9-Bühne**, **§22 Security-Härtung**. (Outline-Modus §19.9 wurde wieder **entfernt** — siehe Spec-Notiz.)
4. **`docs/audit.md`** — der Performance-/Security-Audit dieser Session (Bedrohungsmodell + Befunde + Umsetzungsstand). **Wichtig:** Security ist durch; von der Performance sind nur P1/P4/P5 umgesetzt, **P2/P3/P6/P7/P8/P10/P12/P13 sind noch offen** (sekundär, siehe unten).
5. `docs/next-steps.md` — Gesamt-To-do (GUI-Test A1–A7, restliche Performance, Distribution C).
6. `docs/done/direct-manipulation-plan.md` — Referenz zu §20 (vollständig umgesetzt; nicht mehr bauen).

> `docs/project-status.md` ist **teilweise veraltet** (vor Audit + Editor-Shell geschrieben — nennt z.B. noch 27 Tests, Outline-Modus). Im Zweifel gelten CLAUDE.md + diese Übergabe + `docs/audit.md`.

### Wichtigster Kontext (sofort handlungsfähig):
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline, **subgesetzt**) · Zustand-Store. Dateiformat `.slideo` = ZIP (`presentation.json` + `assets/`).
- **Editor-Shell (NEU diese Session):** drei frei **skalierbare + einzeln einklappbare** Spalten (Folienliste · Editor · Vorschau) — [EditorShell.tsx](../src/components/ui/EditorShell.tsx) / [Splitter.tsx](../src/components/ui/Splitter.tsx) / [store/layout.ts](../src/store/layout.ts). Genau ein Bereich ist „elastisch" (Priorität Editor›Vorschau›Folienliste). **Folienliste hat Drag-Reorder** ([ZoneList.tsx](../src/components/ui/ZoneList.tsx)). **Outline-Modus wurde entfernt** (redundant). → relevant für Punkt 2 des Plans.
- **Direktmanipulation §20 (HTML-Zonen):** Klick→Quelle, Auswählen, Inline-Text, Verschieben (abs. %), Duplizieren, Löschen, Undo. Im Iframe per Pointer-Events ([renderer.ts](../src/lib/renderer.ts) `editScript`), Ops auf rohem `zone.html` via DOMParser ([dom-edit.ts](../src/lib/dom-edit.ts)), `previewEdit`-Toggle. **Markdown-Zonen** bekommen heute in der Vorschau nur **Block-Drag + Bild-Resize** (`renderEditableBlocks` → `data-block-index`) — Punkt 3 baut darauf auf.
- **MCP-Architektur:** Eine Binary, zwei Modi (`slideo` App, `slideo mcp` stdio). Laufende App hält den State, lokaler TCP-Socket (Port+**Token** in `<config>/slideo/ipc.json`, 0600), `slideo mcp` leitet Tool-Calls weiter (hand-gerolltes JSON-RPC). **35 MCP-Tools** + 10 Komponenten.
- **WKWebView-Faustregel:** HTML5-DnD + `window.print()` unzuverlässig → Pointer-Events; PDF via `open_print_view`. PPTX nativ rekonstruiert (Canvas-Taint). Datei-DnD braucht `dragDropEnabled:false`.
- **Assets:** Bilder → Data-URI inline; Video/Audio → `slideoasset://localhost/<name>` (Streaming).

### KRITISCHE Stolpersteine:
- **Icons sind subgesetzt** (Audit P1, ~42 KB): **neues Icon → Name in `scripts/icon-names.txt` eintragen + `npm run icons:subset`** ausführen. Sonst rendert das Icon als Klartext-Name (sichtbarer Hinweis). Codepoint-Rendering: [Icon.tsx](../src/components/ui/Icon.tsx) + [icon-codepoints.ts](../src/lib/icon-codepoints.ts).
- **CSP ist jetzt gesetzt** (war `null`): App-CSP in `tauri.conf.json` (`script-src 'self'`) + eine eigene strikte CSP in den In-App-Folien-Iframes (`connect-src 'none'`, [renderer.ts](../src/lib/renderer.ts) `SLIDE_CSP_META`). **In-App-Folien laden keine externen Netzressourcen mehr** (gewollt; Standalone-Export bleibt offen). Bei neuem Frontend-Code, der etwas lädt: an die CSP denken.
- **Nach JEDER Backend-Änderung an MCP-Tools/Instructions:** `cargo build`/`tauri:dev` neu **UND Claude Desktop neu starten** (sonst altes MCP-Binary).
- **Markdown ist das primäre Content-Format.** **State lebt im Zustand-Store**, nicht in lokalem React-State.

### Aktueller Stand (diese Session, Branch `security-hardening`, NICHT auf main gemergt):
6 Commits, working tree clean, alles headless grün (`cargo test` **33**, `npm run typecheck`, `npx vite build`).
- **Security-Audit + Härtung (S1–S9) umgesetzt** (Commit `bb73056`): IPC-Socket-Token + `ipc.json` 0600, App-CSP + Folien-CSP, print-Iframe sandbox, atomare+rechtebewahrende Config-Writes, `.slideo`-Größen-/Anzahl-Caps (Decompression-Bomb), randomisierter print-Temp-Name. `cargo audit` **0 Vulns**. Adversarial reviewt; 2 Review-Regressionen gefixt. Vollreport: `docs/audit.md`, Spec §22.
- **Performance Quick Wins P1/P4/P5** (Commit `e49e6ff`): **Font-Subset 3,63 MB → 42 KB** (`dist/assets` 5,2 → 1,8 MB, alle Variations-Achsen erhalten, Codepoint-Rendering), `resolveAssetRefs` header-only + nicht-referenzierte überspringen, `React.memo(ZoneCard)`. (P11 bewusst übersprungen: Safari-Kompat.)
- **Editor-Shell-Überarbeitung** (Commits `3cf4eaf`+`6565fa1`): skalierbare/einklappbare 3-Spalten, Folienlisten-Reorder, Outline-Modus entfernt. Review-Fixes in `8b8c346`.

### GUI-Verifikation OFFEN (bitte am Anfang den Menschen bitten, das zu prüfen):
Diese Session hat viel UI/Render/CSP geändert, aber nur headless verifiziert. Vor/parallel zur neuen Aufgabe einmal `npm run tauri:dev`:
- **Editor-Shell:** alle 3 Splitter ziehen; jede Spalte (auch Editor) ein-/ausklappen; nach App-Neustart bleiben Breiten/Zustand; 14"-Fall (Editor bleibt nutzbar). Folienliste-Reorder per Drag; Klick wählt weiter aus.
- **CSP/Font:** DevTools-Konsole frei von `Refused to …`; **alle Icons rendern als Symbole** (nicht als Wörter); eingebettetes Video/Audio lädt.
- (Älter offen: §18/§19-GUI-Test A1–A7, Multi-Display-Zweitfenster.)

### Sekundär offen (parallel/danach, nicht das Hauptziel):
- **Restliche Performance** aus dem Audit: P2/P6 (srcDoc-In-Place-Patch statt Voll-Reload), P3/P7 (Bilder über `slideoasset://` + Handler-Cache — die CSP ist dafür schon vorbereitet), P8 (Code-Splitting), P10/P12/P13 (Sync-Debounce, Asset-Speicher, ZIP-`Stored`). Details: `docs/audit.md` Abschnitt 0 + `docs/next-steps.md` 1b.
- **Distribution & Notarization** (`docs/next-steps.md` C).
- **Merge-Entscheidung:** Branch `security-hardening` → main, wenn die GUI-Verifikation durch ist.

### Arbeitsweise:
- Verifiziere: `cd src-tauri && cargo test` (falls Rust), `npm run typecheck && npx vite build` (Frontend). GUI-abhängiges teste ich (der Mensch) — sag genau, was ich prüfen soll.
- **Adversariales Multi-Agent-Review je größerem Schritt**, bestätigte Findings fixen (lief diese Session sehr gut — fing echte Bugs).
- Architektur-Entscheidungen in `slideo-spec.md` + `CLAUDE.md` verankern. `version` bleibt "1.0" (kein Schema-Eingriff).
- Stelle Rückfragen, bevor du größere Umbauten startest; kläre die offenen Entscheidungen im Plan vorab mit mir.

Bitte bestätige kurz, dass du die Dokumente gelesen hast, fasse den Stand in 3–4 Sätzen zusammen, und **lass uns mit Punkt 1 aus `docs/editor-cleanup-plan.md` beginnen** (kontext-sensitive Tools — kläre vorher die Bild-„Größe"-Entscheidung mit mir). Danach Punkt 2, dann Punkt 3 (phasen).

## PROMPT ENDE

---

### Hinweis zur Nutzung
- **Hauptziel der nächsten Session:** die 3 Punkte aus `docs/editor-cleanup-plan.md` (Editor aufräumen + Markdown-Direktmanipulation).
- Stand: Branch `security-hardening` (6 Commits, nicht auf main), headless grün; GUI-Verifikation (Shell + CSP/Font) steht aus.
- `docs/done/` enthält nur vollständig abgeschlossene Pläne: `direct-manipulation-plan.md` (§20). Der Audit-Record liegt **aktiv** in `docs/audit.md` — Security komplett, **Performance erst teilweise** (P1/P4/P5 umgesetzt; P2/P3/P6/P7/P8/P10/P12/P13 offen).
