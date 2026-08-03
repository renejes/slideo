# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo**. Dein Auftrag in dieser Session ist **E2: Internationalisierung** — ein i18n-Layer plus Sprachumschalter in den Einstellungen, **Deutsch bleibt Default**. Das ist ein breiter, mechanischer Durchgang über ~67 `.tsx`-Dateien. **Lies dich zuerst ein und kläre den Plan mit mir, bevor du anfängst zu migrieren** — ein halb migrierter Zustand ist schlechter als der heutige.

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`
**Branch:** `stage-1-2-foundation` (nicht `main` — dort liegen alle Änderungen des August-Reviews, noch nicht gemerged).

**Was Slideo ist:** Lokale, offline laufende Desktop-App für Präsentationen (Tauri 2 + React/TS + Vite). **Kein AI-Layer in der App** — der KI-Client des Nutzers (jeder MCP-fähige) baut das Deck über einen mitgelieferten lokalen MCP-Server mit **38 Tools**, der Mensch editiert direkt in der Live-Vorschau drüber. Eine Präsentation ist eine HTML-Page aus „Zones" (Slides), `.slideo` = ZIP aus `presentation.json` + `assets/`.

### Dein Auftrag: E2 — i18n

**Entscheidung des Entwicklers (2026-08-03):** Oberfläche bleibt **Deutsch**, wird aber in den Einstellungen **umschaltbar** (Englisch als zweite Sprache). Begründung und Kontext: [docs/review-2026-08/README.md](review-2026-08/README.md), Abschnitt „Was als Nächstes zu entscheiden ist", Zeile E2.

Wichtige Randbedingungen:

- **Die MCP-/AI-facing Fläche ist BEREITS Englisch** (`server_instructions`, `slideo_guide`, alle Tool-Beschreibungen, `list_components`, Overflow-Hinweise, Fehler an die KI). Die bleibt unangetastet — hier geht es nur um das **App-Chrome**.
- **Die Palette-Anzeige** überlagert den englischen Rust-Katalog bewusst mit `COMPONENT_CATALOG_DE` ([component-forms.ts](../src/lib/component-forms.ts)). Diese Trennung ist gewollt und muss beim i18n-Umbau erhalten bleiben — oder sauber in den Katalog überführt werden.
- **Nimm #47 gleich mit** (Review-Befund M58/S25): die UI mischt heute vier Vokabeln für dasselbe Objekt — *Slide · Folie · Zone · Deck* —, dazu *Schnappschuss* vs. *Snapshot* und „Auto-Animate" in einer sonst deutschen Liste. Ein Message-Katalog erzwingt genau eine Entscheidung pro Begriff. Empfehlung: **„Folie"** durchgehend.
- Die deutschen **Dev-Kommentare im Code bleiben** (Repo-Konvention).
- Die geteilten Datei-I/O-Fehler in [reader.rs](../src-tauri/src/file/reader.rs)/[writer.rs](../src-tauri/src/file/writer.rs) sind deutsch und primär im Frontend sichtbar — beim Umbau mitdenken.

### Was in dieser Session NICHT dran ist
- **Stage 5 (der Keil)** — gebündeltes MCP-Release (`apply_slides`, `add_asset`, vollständiges `create_zone`, Tool-Annotationen, Plan-Freigabe), Auto-fit, Messkanal zur KI, Split-Direktmanipulation, Brand-Ingest. Siehe [optimierung.md](review-2026-08/optimierung.md).
- **Rest von Block 3** (siehe unten).
- **Auto-Updater** — bewusst zurückgestellt.
- **Notarisierung** — Konfiguration steht ([docs/release-macos.md](release-macos.md)), der Durchlauf ist Sache des Entwicklers (Apple-Lizenz vorhanden).

### Offen aus Block 3 (nach der i18n-Session)
| # | Maßnahme | Aufwand | Behebt |
|---|---|---|---|
| #42 | `zone.order` als zweite Wahrheit streichen — Array autoritativ, `order` beim Schreiben aus dem Index ableiten | S | S7 |
| #43 | PPTX auf markdown-it + `splitMarkdownBlocks` umstellen (ein Parser statt zwei) | M | S19, M45 |
| #44 | Meta-MCP-Ziel löschen (samt handgerolltem HTTP-Client über std-TCP); `desktop`/`claude` zu unabhängigen Schaltern | M | M63, S33 |
| #46 | Ordentliches Modal-Primitive (Focus-Trap, Scroll-Lock, Initialfokus, Confirm-on-Dismiss) | S | M4, M56, S26 |

**#45 ist erledigt** (postMessage-Herkunftsprüfung in allen drei Handlern + `ipc.json` wird beim App-Exit gelöscht). **#47 fällt mit i18n mit.**

### Bitte zuerst lesen (in dieser Reihenfolge)
1. **`CLAUDE.md`** (Projektwurzel) — maßgeblich für den Ist-Stand, alle Architektur-Entscheidungen.
2. **`docs/review-2026-08/README.md`** — Einstieg ins August-Review: Umsetzungsstand Stage 1–4, die fünf getroffenen Entscheidungen, bewusste Abweichungen.
3. **`docs/review-2026-08/optimierung.md`** — die 47 Maßnahmen mit Aufwand/Wirkung, die 5 Stages.
4. `docs/review-2026-08/befunde.md` + `markt.md` nur bei Bedarf (Befund-IDs nachschlagen).

### Stand nach dem August-Review (alles auf `stage-1-2-foundation`)
**Stage 1–3 vollständig, Stage 4 bis auf i18n.** Kurz, was sich geändert hat und was du beim Umbau nicht kaputtmachen darfst:

- **Es gibt jetzt ein Testnetz** (vorher keins): 69 Vitest-Tests. Darunter eine **Syntax-Garde über die injizierten Iframe-Skripte** ([renderer.test.ts](../src/lib/renderer.test.ts)) — sie rendert alle sieben Seitenvarianten und parst jedes `<script>` mit `vm.Script`. `npm run build` führt die Tests mit (`tsc && vitest run && vite build`).
- ⚠️ **Die Backtick-Falle**: `navScript`/`editScript`/`patchScript` **und der `SLIDE_CSS`-Block** in [renderer.ts](../src/lib/renderer.ts) sind Template-Literale. Ein Backtick oder rohes `\n` — *auch in einem Kommentar darin* — zerlegt das Literal; `tsc` bleibt grün, zur Laufzeit stirbt der ganze Overlay. Ich bin in einer Session dreimal reingelaufen. Der Test fängt es, aber schreib in diesen Blöcken ASCII und keine Backticks.
- **Datenverlust-Pfade sind zu**: Autosave + Crash-Recovery ([recovery.rs](../src-tauri/src/recovery.rs)), Flush-Handshake vor mutierenden MCP-Tools, `Effect::Opened/Saved` (Pfad + Assets fahren mit), `mutate` gibt `boolean` zurück.
- **Neu in der UI** (bei i18n zu erfassen): Redo, Folie duplizieren (Cmd+D), Speichern-unter (Cmd+Shift+S), inline umbenennbarer Deck-Titel, Overflow-Badge auf der Folienkarte, Verbindungs-Chip (`McpStatusChip`), Export-Dialog (`ExportModal`), Neustart-Panel im MCP-Setup, „Anderer MCP-Client"-Snippet in den Einstellungen, Zuletzt-geöffnet im Empty-State, ErrorBoundary.
- **MCP-Tools 37 → 38** (`duplicate_zone`). Nach Backend-Änderungen: `cargo build` + Client-Neustart.

### Verifikation
```bash
npm run build                      # tsc + vitest (69) + vite build
cd src-tauri && cargo test         # 52 Tests (+1 ignoriert: Release-Gate)
cd src-tauri && cargo check
```
**GUI-Abhängiges prüft der Mensch** — sag genau, was zu klicken ist. Der volle GUI-Durchlauf über Stage 1–3 steht noch aus.

### Arbeitsweise
- Bei größeren Schritten erst Plan/Scope klären.
- Adversariales Multi-Agent-Review je größerem Schritt; bestätigte Findings fixen.
- Architektur-Entscheidungen in `CLAUDE.md` verankern.
- **Commit/Push/Merge nur auf mein Wort.**

## PROMPT ENDE

---

### Hinweis zur Nutzung
- **Diese Session:** E2 — i18n-Layer + Sprachumschalter, Deutsch als Default, #47 (ein Vokabular) inklusive.
- **Danach:** Rest von Block 3 (#42, #43, #44, #46), dann Stage 5 (der Keil).
- **Parallel beim Menschen:** notarisierter Build ([release-macos.md](release-macos.md)) und der GUI-Durchlauf über Stage 1–3.
