# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat. Damit ist der nächste Claude vollständig im Bild.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo**. Die App ist **funktional komplett** — die gesamte Feature-Roadmap (§18–§26) ist umgesetzt, headless verifiziert und auf `main`. Dein Fokus in dieser Session ist **Release-Ready**: die App fürs Ausliefern fertig machen. **Lies dich zuerst ein und kläre Scope/Plan mit mir, bevor du größere Schritte baust.**

**Was Slideo ist:** Lokale, code-freie, **MCP-native** Desktop-App für Präsentationen (Tauri 2 + React/TS + Vite). Eine Präsentation ist eine HTML-Page aus „Zones" (Slides). Kein AI-Layer in der App — die KI baut das Deck ausschließlich über den mitgelieferten **MCP-Server** (Claude Desktop o.ä.), der Mensch editiert drüber.

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`
**Branch:** `main` (alles gepusht, in sync mit `origin/main`).

### Offene Aufgaben (Release-Ready)
1. **Distribution & Notarization** (Hauptpunkt) — [docs/next-steps.md](../docs/next-steps.md) Abschnitt C: Code-Signing, notarisierte macOS-Builds, Cross-Platform-Builds (Windows/Linux), Release-Hygiene.
2. **Voller GUI-Durchlauf** ([docs/next-steps.md](../docs/next-steps.md) Abschnitt A, A1–A7) — headless ist grün, aber viele Features sind GUI-abhängig und noch nicht lückenlos end-to-end durch den Menschen geprüft (u.a. Multi-Display-Hardware, MCP-Tools in Claude Desktop).
3. **Optional (Defense-in-Depth):** `catch_unwind` um `tools::handle` in [src-tauri/src/ipc.rs](../src-tauri/src/ipc.rs) — ein Panic dort vergiftet sonst die IPC-Mutexes bis zum Neustart.

### Bereits erledigt (auf `main`)
Alles bis inkl. §26: §18/§19-Roadmap, **§20** Direktmanipulation in der Vorschau, **§21** feste 16:9-Bühne + Scale-to-fit, **§22** Security-Härtung (Audit S1–S9, CSP), **§23** Zonen-Links, **§24** Workflow-Optimierung (**37 MCP-Tools**, **17 Komponenten**, KI-Layout-Check), **§25** Vorschau-**In-Place-Patch** (Iframe wird nicht mehr bei jeder Änderung neu geladen — Token-/Zonen-Patch per postMessage, Voll-Reload nur strukturell), **§26** teilbares **Folien-Fenster** für Ein-Monitor-Remote (Zoom/Meet, „Folie teilen") **+ gestapelte SpeakerView + WebKit-robuste Folien-Vorschauen** (gemeinsame `SlidePreview`). Alles GUI-bestätigt.

### Bitte zuerst lesen (in dieser Reihenfolge):
1. **`CLAUDE.md`** (Projektwurzel) — **maßgeblich für den Ist-Stand**: alle Architektur-Entscheidungen/Konventionen inkl. §20–§26. Aktuell.
2. **`docs/next-steps.md`** — Gesamt-To-do; **Abschnitt A** (GUI-Test A1–A7) + **Abschnitt C** (Distribution/Notarization) sind der offene Kern.
3. **`docs/slideo-spec.md`** — Spec (maßgeblich bei Widerspruch; §25 In-Place-Patch, §26 Remote-Fenster besonders relevant).

### Wichtigster Kontext:
- **Tech:** Tauri 2 (Rust) + React 18/TS + Vite · Tiptap (Markdown-WYSIWYG) · CodeMirror (HTML/CSS, lazy) · Tailwind (nur App-Chrome, NICHT im Slide-Iframe) · Material Symbols (offline, **subgesetzt** — neues Icon → `scripts/icon-names.txt` + `npm run icons:subset`) · Zustand-Store. `.slideo` = ZIP (`presentation.json` + `assets/`).
- **Verifikation:** headless `npm run typecheck && npx vite build`; `cd src-tauri && cargo test` (**42**) + `cargo check`. GUI-Abhängiges prüft **der Mensch** — sag genau, was zu klicken ist.
- **Konventionen:** Markdown ist primäres Content-Format; State lebt im Zustand-Store; kein Schema-Bruch ohne `version`-Bump; **nach jeder MCP-Backend-Änderung: `cargo build` + Claude Desktop neu starten** (sonst altes Binary). **WKWebView-Eigenheiten** (dokumentiert in CLAUDE.md): HTML5-DnD/`window.print()`/`getDisplayMedia` unzuverlässig; kleine/mehrere/backdrop-gefilterte Iframes rendern leer → Folien-Vorschauen laufen über `SlidePreview` (native 1280×720 + CSS-transform-Scale).

### Arbeitsweise:
- **Adversariales Multi-Agent-Review je größerem Schritt** (Workflow-Tool), bestätigte Findings fixen.
- Architektur-Entscheidungen in `slideo-spec.md` + `CLAUDE.md` verankern.
- **Commit/Push/Merge nur auf mein Wort.** Für größere Schritte erst Plan/Scope mit mir klären.

## PROMPT ENDE

---

### Hinweis zur Nutzung
- **Bereits erledigt (auf `main`):** §18–§26 komplett — zuletzt **§25** Vorschau-In-Place-Patch und **§26** teilbares Folien-Fenster + gestapelte SpeakerView + WebKit-robuste Folien-Vorschauen. (Der frühere Auftrag dieser Datei, P2/P6, ist genau §25 und **erledigt**.)
- **Diese Session:** **Release-Ready** — **Distribution/Notarization** (next-steps Abschnitt C) + voller **GUI-Test** (Abschnitt A) + optionaler `catch_unwind`-Hardening-Punkt.
