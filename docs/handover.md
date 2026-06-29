# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat. Damit ist der nächste Claude vollständig im Bild und kann **P2/P6 (Vorschau-In-Place-Patch)** sauber angehen.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo**. Die App ist **funktional fertig**. Dein Auftrag in dieser Session ist **genau eine Sache**: der vertagte Performance-Refactor **P2/P6 — „Vorschau-Re-Render: `srcDoc`-Voll-Reload → In-Place-`postMessage`-Patch"**. Das ist der eine größere, **riskante** Umbau, der bewusst zum Schluss aufgehoben wurde. **Lies dich zuerst ein und kläre den Plan mit mir, bevor du Code schreibst.**

**Was Slideo ist:** Lokale, code-freie, **MCP-native** Desktop-App für Präsentationen (Tauri 2 + React/TS + Vite). Eine Präsentation ist eine HTML-Page aus „Zones" (Slides). Kein AI-Layer in der App — die KI baut das Deck ausschließlich über den mitgelieferten **MCP-Server** (Claude Desktop), der Mensch editiert drüber.

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`
**Branch:** `main` (alles gepusht, in sync mit `origin/main`).

### Das Problem (P2/P6)
Die **Vorschau** ([src/components/preview/PreviewPane.tsx](../src/components/preview/PreviewPane.tsx)) rendert heute bei **jeder** Änderung (debounced ~220 ms) die **ganze** Präsentation neu via `renderFullPage(...)` und setzt das Ergebnis als **`srcDoc`** aufs Iframe → **kompletter Iframe-Reload**: Flackern, alle Folien-Skripte (navScript/editScript) laufen neu, Assets werden neu aufgelöst, Scroll-/Auswahl-Zustand geht verloren (wird über den §20-Reselect-Handshake mühsam wiederhergestellt). Beim Tippen/Design-Justieren ist das spürbar.

**Ziel:** Inhalts-Änderungen **in-place** ins bestehende Iframe patchen (per `postMessage`), statt das Iframe neu zu laden. Voll-Reload nur noch bei **strukturellen** Änderungen.

### Vorgeschlagener Ansatz (mit mir vor dem Bauen final abstimmen)
Inkrementell, vom Billigsten/Sichersten zum Teuersten — der **Voll-Reload bleibt immer als Fallback**:

1. **Vorherigen Zustand vergleichen.** In PreviewPane den letzten `presentation`-Stand halten (ref) und die Änderung klassifizieren:
   - **Strukturell** (Zonen hinzugefügt/gelöscht/umsortiert, `content_type` getoggelt, Zonenzahl/-Reihenfolge/-IDs geändert) → **Voll-Reload** (heutiger Pfad, selten).
   - **Token/CSS-only** (Design-Tokens geändert) → `slideo:patch-tokens {tokens}` → das Iframe setzt nur die `:root`-CSS-Variablen neu (`root.style.setProperty`), **kein** HTML-Rebuild. Billigster + häufigster Fall (Brand-Kit-Justieren).
   - **Inhalt einer Zone** (`markdown`/`html`/`style`/`custom_css` einer Zone geändert) → `slideo:patch-zone {zoneId, frameHtml}` → das Iframe ersetzt das `outerHTML` der betroffenen `.slideo-frame` (bzw. `<section id="zone-<uuid>">`).
2. **Pro-Zone-HTML auf dem Parent rendern.** `renderZoneSection(zone, assets, urlBase, editable, fragments, logo)` aus [src/lib/renderer.ts](../src/lib/renderer.ts) liefert genau die eine `.slideo-frame` — **mit denselben Flags** (`editable`/`directEdit`/`fragments`) wie der Voll-Render, sonst driften Vorschau und Patch auseinander.
3. **Patch-Handler im Iframe.** Neuer kleiner **`patchScript`**, der NUR im Vorschau-/Editier-Modus (`!present`, `editable`) angehängt wird (analog zu navScript/editScript-Injektion in `renderFullPage`). Er hört auf `slideo:patch-tokens` und `slideo:patch-zone`, findet die Zielsektion über `#zone-<uuid>` und ersetzt sie; danach **§23-`zoneIndex` neu aufbauen** (falls genutzt) und — bei aktivem Direktbearbeiten — die §20-Auswahl für die gepatchte Zone neu setzen (vorhandener `slideo:reselect`/`slideo:reselect-block`-Handshake wiederverwenden, aber nur für die eine Zone).
4. **Auswahl/Scroll bleiben erhalten** für alle Zonen außer der gepatchten (kein Reload). Für die gepatchte Zone: gezielter Reselect.

### KRITISCHE Wechselwirkungen (hier ist das Risiko)
- **§20 Direktmanipulation** ([renderer.ts](../src/lib/renderer.ts) `editScript`, [dom-edit.ts](../src/lib/dom-edit.ts)): Die Editier-Handler sind dokument-delegiert (`closest()`) → überleben einen innerHTML-Austausch, ABER per-Element-Overlays/Boxen, die auf ersetzte Knoten zeigen, werden **stale** → Auswahl für die gepatchte Zone clearen + reselecten. **Achtung Drag:** Ein Patch darf einen laufenden §20-Drag/Freeze nicht zerreißen (Freeze schreibt `zone.html` → löst sofort einen Patch aus). Lösung: während eines aktiven Drags (Iframe meldet das) patchen unterdrücken oder den Drag-Zustand neu anwenden.
- **§23 Zonen-Links** ([renderer.ts](../src/lib/renderer.ts) `navScript`): `zoneIndex` (UUID→Index) wird beim Init gebaut. Inhalts-Patch (gleiche IDs) lässt ihn gültig; strukturell → Voll-Reload baut neu.
- **§21 Scale-to-fit** (`sldFit`): unberührt von Inhalts-Patches (Folie bleibt 1280×720).
- **markdown-editable Wrapping** (`renderEditableBlocks`/`renderFragmentBlocks`): die gepatchte Zone muss mit denselben `editable`/`fragments`-Flags gerendert werden wie der Voll-Render (sonst fehlen `data-block-index`/Drag-Handles).
- **WKWebView**: innerHTML-Austausch ist ok (keine Skripte im Zonen-HTML — Skripte sind page-level). Race: Patch trifft ein, während das Iframe noch (re)lädt → über `onLoad`/Ready-Flag serialisieren.
- **CSP**: unverändert (Patch ist nur DOM-Mutation, kein Netz).

### Verifikation
- **Headless:** `npm run typecheck && npx vite build` (der Patch lebt in TS + im Renderer-String). `cd src-tauri && cargo test` nur falls du Rust anfasst (P2/P6 ist reines Frontend).
- **GUI (ich, der Mensch):** Tippen in Markdown patcht **ohne** Reload/Flackern; Token-/Design-Änderung sofort; §20-Auswahl überlebt einen Inhalts-Patch; Zone hinzufügen/löschen/umsortieren → sauberer Voll-Reload; §23-Links + Auto-Animate/Transitions weiter korrekt; Bild/Video weiter sichtbar.
- **Adversariales Multi-Agent-Review** des Diffs vor Commit (Workflow-Tool) — dieser Refactor ist der riskanteste; bestätigte Findings fixen.

### Bitte zuerst lesen (in dieser Reihenfolge):
1. **`CLAUDE.md`** (Projektwurzel) — **maßgeblich für den Ist-Stand**: alle Architektur-Entscheidungen/Konventionen, inkl. §20/§21/§22/§23/§24. Aktuell.
2. **`docs/slideo-spec.md`** — Spec. Für P2/P6 besonders: **§20** (Direktmanipulation), **§21** (feste 16:9-Bühne, Scale-to-fit), **§23** (Zonen-Links), **§24** (Workflow-Optimierung).
3. **Kernit-Dateien:** [src/components/preview/PreviewPane.tsx](../src/components/preview/PreviewPane.tsx) (der Render-Effekt + alle `slideo:*`-Message-Handler), [src/lib/renderer.ts](../src/lib/renderer.ts) (`renderFullPage`/`renderZoneSection`/`navScript`/`editScript`/`tokensToCssString`/`SLIDE_CSP_META`), [src/lib/dom-edit.ts](../src/lib/dom-edit.ts), [src/store/presentation.ts](../src/store/presentation.ts).
4. **Architektur-Überblick:** `.loom/` (loom-spec Knoten-Graph der Codebase) — ansehen mit `npx loom-spec view` (→ localhost:7777). 33 Knoten/42 Kanten mit `code_refs`.
5. **`docs/next-steps.md`** — Gesamt-To-do (P2/P6 ist der offene Perf-Punkt; danach „Release-Ready": GUI-Test A1–A7 + Distribution/Notarization Abschnitt C).

### Wichtigster Kontext (sofort handlungsfähig):
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS, lazy) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline, **subgesetzt** — neues Icon → `scripts/icon-names.txt` + `npm run icons:subset`) · Zustand-Store. `.slideo` = ZIP (`presentation.json` + `assets/`).
- **Navigation parent-autoritativ:** Iframe ist anzeige-only und bekommt `slideo:goto`/`slideo:show`; es **postet** aber zurück (§20-Ops, §23 `slideo:goto-request`). Das ist genau der Kanal, den P2/P6 um Patch-Nachrichten erweitert.
- **Stand (alles auf `main`, gepusht):** funktional komplett + §20/§21/§22/§23/§24. **cargo test 42**, typecheck, vite build grün. Jeder Schritt adversarial reviewt. **GUI-Verifikation der §24-Features (Onboarding/Assets/Komponenten/Layout-Tools) steht noch aus** (separat vom P2/P6-Auftrag).

### KRITISCHE Stolpersteine:
- **Icons subgesetzt** (s.o.). **CSP gesetzt** (App + strikte Folien-Iframe-CSP). **Nach JEDER MCP-Backend-Änderung:** `cargo build` + **Claude Desktop neu starten** (P2/P6 braucht das aber nicht — reines Frontend). **WKWebView:** HTML5-DnD/`window.print()` unzuverlässig → Pointer-Events. **Markdown ist primäres Content-Format; State lebt im Zustand-Store.**
- **Offener Defense-in-Depth-Punkt (nicht P2/P6, aber notiert):** ein Panic in `tools::handle` vergiftet die IPC-Mutexes (App-Datenebene bricht bis Neustart). Der konkrete Heuristik-Panic ist gefixt; ein generelles `catch_unwind` um `handle` in [src-tauri/src/ipc.rs](../src-tauri/src/ipc.rs) bleibt offen.

### Arbeitsweise:
- Verifiziere headless (`npm run typecheck && npx vite build`); GUI-Abhängiges prüfe **ich** — sag genau, was ich klicken soll.
- **Adversariales Multi-Agent-Review je größerem Schritt** (Workflow-Tool), bestätigte Findings fixen.
- Architektur-Entscheidungen in `slideo-spec.md` + `CLAUDE.md` verankern. `version` bleibt "1.0" (kein Schema-Eingriff — P2/P6 ist reine Render-/UI-Mechanik).
- **Commit/Push/Merge nur auf mein Wort.** Für größere Schritte erst Plan/Scope mit mir klären.

Bitte bestätige kurz, dass du die Dokumente gelesen hast, fasse P2/P6 + den vorgeschlagenen Ansatz in 3–4 Sätzen zusammen, und **kläre mit mir den Plan/Detailgrad, bevor du anfängst zu bauen**.

## PROMPT ENDE

---

### Hinweis zur Nutzung
- **Diese Session-Aufgabe:** ausschließlich **P2/P6** (Vorschau-In-Place-Patch). Inkrementell: Token-Patch → Zonen-Inhalts-Patch → Voll-Reload nur strukturell. Voll-Reload bleibt Fallback.
- **Bereits erledigt (auf `main`):** §23 Zonen-Links, `.loom`-Architektur-Karte, §24 Workflow-Optimierung (Onboarding, Asset-Verwaltung, Komponenten 11→17, KI-Layout-Check `check_zone_overflow`/`validate_deck`, MCP 35→37).
- **Danach offen:** GUI-Verifikation der §24-Features + **Release-Ready** (Distribution/Notarization, `docs/next-steps.md` Abschnitt C) + optionaler `catch_unwind`-Hardening-Punkt.
