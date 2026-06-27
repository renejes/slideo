# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat. Damit ist der nächste Claude vollständig im Bild.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo**. Die App ist **im Prinzip funktional fertig und release-reif** — bevor wir sie tatsächlich release-ready machen, will ich zwei Dinge: **(1)** den Aufbau der Codebase verstehen und **(2)** schauen, ob wir am **Workflow** noch etwas optimieren können. Lies dich zuerst ein, bevor du Code schreibst.

**Was Slideo ist:** Eine lokale, code-freie, **MCP-native** Desktop-App für Präsentationen (Tauri 2 + React/TypeScript + Vite). Eine Präsentation ist eine HTML-Page aus „Zones" (Slides). Kein AI-Layer in der App — die KI-Anbindung läuft ausschließlich über einen mitgelieferten **MCP-Server** (Claude Desktop). Läuft vollständig lokal. **Produktthese:** KI baut das Deck, der Mensch editiert drüber (siehe Memory `ai-edit-over-workflow-thesis`).

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`

### Das Ziel dieser Session (in dieser Reihenfolge)
1. **Codebase grafisch darstellen.** Erstelle eine Datei, die mir **visuell** zeigt, **wie die Codebase aufgebaut ist, was sie kann und an welcher Stelle** (Module/Schichten: Rust-Backend ↔ MCP ↔ Frontend-Store ↔ Renderer/Iframe ↔ Editor/Vorschau/Präsentation; Datenfluss; wo welches Feature lebt). Es gibt bereits eine (vermutlich **veraltete**) [docs/slideo_architecture.svg](slideo_architecture.svg) — prüfen, ob aktualisieren oder neu/besser machen (z.B. SVG oder Mermaid-Diagramm, gern mit kurzer Begleit-Legende). Das ist die **Hauptaufgabe** — erst gemeinsam Format/Detailgrad klären.
2. **Workflow-Optimierung überlegen.** Mit dem Überblick aus (1): **wo lässt sich der Bedien-/Authoring-Workflow noch verbessern** (Mensch *und* KI-über-MCP)? Erst **analysieren + mit mir besprechen**, nicht sofort bauen. (Beispiele zum Nachdenken, nicht als Auftrag: Onboarding/Erststart, Komponenten-Set, Asset-Verwaltung, die noch offene Perf-Politur P2/P6 = Vorschau-In-Place-Patch.)
3. **Wenn das passt → Slideo release-ready machen.** Distribution & Notarization (signierte/notarisierte Builds), voller GUI-Test A1–A7. Details: `docs/next-steps.md` (Abschnitt „Release-Ready" + C).

### Bitte zuerst lesen (in dieser Reihenfolge):
1. **`CLAUDE.md`** (Projektwurzel) — **maßgeblich für den Ist-Stand**: alle Architektur-Entscheidungen, Konventionen, Design-System, Security-Härtung, Editor-Cleanup, Brand Kit, Markdown-Direktmanipulation, feste 16:9-Bühne, Performance. Ist aktuell.
2. **`docs/slideo-spec.md`** — maßgebliche Spezifikation. Relevant: §14 HTML-Zonen, §16 Layouts, §17 Custom-CSS, **§20 Direktmanipulation**, **§21 feste 16:9-Bühne**, **§22 Security-Härtung**.
3. **`docs/project-status.md`** — Stand-Dokument (was gebaut ist, wie es zusammenhängt). Auf aktuellen Stand gebracht.
4. **`docs/next-steps.md`** — Gesamt-To-do (Release-Ready-Fokus, Workflow-Optimierung, GUI-Test A1–A7, Distribution C).
5. **`docs/done/`** — abgeschlossene Pläne/Records (nicht mehr bauen, nur Referenz): `direct-manipulation-plan.md` (§20), `editor-cleanup-plan.md` (Editor-Cleanup + Brand Kit + Markdown-Direktmanipulation), `audit.md` (Performance-/Security-Audit, vollständig abgearbeitet bzw. dokumentiert vertagt).
6. **Memory** (`ai-edit-over-workflow-thesis`, `scope-mcp-authoring-thesis`) — Produktrichtung.

### Wichtigster Kontext (sofort handlungsfähig):
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS, **lazy geladen**) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline, **subgesetzt**) · Zustand-Store. Dateiformat `.slideo` = ZIP (`presentation.json` + `assets/`).
- **Editor-Shell (aktuell):** **2-spaltig** (Editor · Vorschau) — die linke Sidebar/Folienliste ist **entfallen**; Reorder + Überblick laufen über die **Editor-Karten** (Drag-Handle). Design-System lebt als **Brand-Kit-Overlay** ([DesignModal.tsx](../src/components/modals/DesignModal.tsx), Topbar-Button „Design"). [EditorShell.tsx](../src/components/ui/EditorShell.tsx) / [store/layout.ts](../src/store/layout.ts) (2 Panes, persist v2).
- **Direktmanipulation in der Vorschau:** **HTML-Zonen** (§20) — Klick→Quelle, Auswählen, Inline-Text, Verschieben (abs. %), Duplizieren, Löschen, **Bild-Resize**; **Markdown-Zonen** (Punkt 3) — Block auswählen/duplizieren/löschen + Inline-Text-Edit einfacher Blöcke (HTML→Markdown via transienter Tiptap-Instanz). Im Iframe per Pointer-Events ([renderer.ts](../src/lib/renderer.ts) `editScript`, `selKind` 'element'|'block'), Ops via DOMParser ([dom-edit.ts](../src/lib/dom-edit.ts)) bzw. `splitMarkdownBlocks`-Reassemble, `previewEdit`-Toggle, undoable.
- **Medien/Komponenten in HTML-Zonen** werden **absolut & sichtbar** eingefügt (nicht ans rohe Ende → sonst von der 1280×720-Bühne abgeschnitten), per §20-Drag verschiebbar.
- **MCP-Architektur:** Eine Binary, zwei Modi (`slideo` App, `slideo mcp` stdio). Laufende App hält den State, lokaler TCP-Socket (Port+**Token** in `<config>/slideo/ipc.json`, 0600), hand-gerolltes JSON-RPC. **35 MCP-Tools** + 10 Komponenten.
- **Assets:** in-app über `slideoasset://localhost/<name>` (Bilder, Video, Audio — gestreamt, Rust-Decode-Cache); **Standalone-Export + Print bleiben inline** (self-contained).

### KRITISCHE Stolpersteine:
- **Icons sind subgesetzt:** **neues Icon → Name in `scripts/icon-names.txt` + `npm run icons:subset`** (sonst rendert das Icon als Klartext-Name).
- **CSP ist gesetzt:** App-CSP (`script-src 'self'`) + strikte Folien-Iframe-CSP (`connect-src 'none'`, [renderer.ts](../src/lib/renderer.ts) `SLIDE_CSP_META`). In-App-Folien laden **keine** externen Netzressourcen (gewollt; Standalone-Export offen).
- **Nach JEDER Backend-Änderung an MCP-Tools/Instructions:** `cargo build`/`tauri:dev` neu **UND Claude Desktop neu starten** (sonst altes MCP-Binary).
- **WKWebView:** HTML5-DnD + `window.print()` unzuverlässig → Pointer-Events; PDF via `open_print_view`; PPTX nativ; Datei-DnD braucht `dragDropEnabled:false`. **Markdown ist primäres Content-Format; State lebt im Zustand-Store.**

### Aktueller Stand (Branch `main`, alles committet + gepusht):
**Funktional komplett + release-reif** (Phasen 1–5, Roadmap §18/§19, §20 Direktmanipulation, §21 16:9-Bühne, §22 Security-Härtung, Editor-Cleanup + Brand Kit + Markdown-Direktmanipulation, Performance-Audit-Items). **Headless grün:** `cargo test` **33**, `npm run typecheck`, `npx vite build`. Jeder größere Schritt **adversarial multi-agent-reviewt**, bestätigte Findings gefixt.
- **GUI vom Menschen bestätigt:** Editor-Shell/CSP/Font, Brand Kit, Markdown-Direktmanipulation, Bilder/Komponenten-Einfügen + HTML-Bild-Resize.
- **Performance:** P1/P3/P4/P5/P7/P8/P9/P10/P13 umgesetzt. **Bewusst vertagt:** P2/P6 (Vorschau-Voll-Reload → In-Place-`postMessage`-Patch — der eine größere, riskante Perf-Refactor; guter Kandidat für die Workflow-Optimierung). Übersprungen: P11/P12.
- **Offen für echten Release:** voller GUI-Test A1–A7 (`docs/next-steps.md` A) + **Distribution/Notarization** (Abschnitt C) + die Workflow-Optimierungs-Runde (Ziel dieser Session).

### Arbeitsweise:
- Verifiziere: `cd src-tauri && cargo test` (falls Rust), `npm run typecheck && npx vite build` (Frontend). GUI-abhängiges teste ich (der Mensch) — sag genau, was ich prüfen soll.
- **Adversariales Multi-Agent-Review je größerem Schritt** (Workflow-Tool), bestätigte Findings fixen — fing diese Sessions konsequent echte Bugs.
- Architektur-Entscheidungen in `slideo-spec.md` + `CLAUDE.md` verankern. `version` bleibt "1.0" (kein Schema-Eingriff). Memory pflegen.
- **Stelle Rückfragen + kläre Format/Scope vorab**, bevor du größere Dinge baust (gilt hier v.a. für die Codebase-Visualisierung + die Workflow-Optimierungen).
- **Commit/Push nur auf mein Wort.**

Bitte bestätige kurz, dass du die Dokumente gelesen hast, fasse den Stand in 3–4 Sätzen zusammen, und **lass uns mit Aufgabe 1 beginnen: die Codebase-Visualisierung** — kläre vorher kurz mit mir Format (SVG/Mermaid/…) und Detailgrad.

## PROMPT ENDE

---

### Hinweis zur Nutzung
- **Hauptziel der nächsten Session:** (1) Codebase grafisch darstellen → (2) Workflow-Optimierungen überlegen/besprechen → (3) Release-Ready machen (Distribution/Notarization). Slideo ist im Prinzip fertig.
- Stand: Branch `main`, alles committet + gepusht, headless grün (`cargo test` 33, typecheck, vite build); die zuletzt gebauten Features sind GUI-bestätigt.
- `docs/done/` enthält die abgeschlossenen Pläne/Records: `direct-manipulation-plan.md` (§20), `editor-cleanup-plan.md` (Editor-Cleanup/Brand Kit/Markdown-Direktmanipulation), `audit.md` (Performance/Security — abgearbeitet bzw. dokumentiert vertagt). Maßgeblich für den Ist-Stand: **CLAUDE.md**.
