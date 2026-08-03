# Slideo — Übergabe-Prompt für einen neuen Chat

> **Anleitung:** Kopiere den Block unten („PROMPT ANFANG" bis „PROMPT ENDE") und sende ihn als erste Nachricht in einem neuen Chat.

---

## PROMPT ANFANG

Wir arbeiten gemeinsam an **Slideo**. Dein Auftrag in dieser Session ist der **Rest von Block 3** — vier Aufräum-Maßnahmen aus dem August-Review (#42, #43, #44, #46). Das sind unabhängige Einzelschnitte; nimm sie einzeln, nicht als Paket.

**Projektverzeichnis:** `/Users/renejesser/Desktop/Programming - Projekte/slideo`
**Branch:** `stage-1-2-foundation` (nicht `main` — dort liegen alle Änderungen des August-Reviews, noch nicht gemerged).

**Was Slideo ist:** Lokale, offline laufende Desktop-App für Präsentationen (Tauri 2 + React/TS + Vite). **Kein AI-Layer in der App** — der KI-Client des Nutzers (jeder MCP-fähige) baut das Deck über einen mitgelieferten lokalen MCP-Server mit **38 Tools**, der Mensch editiert direkt in der Live-Vorschau drüber. Eine Präsentation ist eine HTML-Page aus „Zones" (Slides), `.slideo` = ZIP aus `presentation.json` + `assets/`.

### Dein Auftrag: Rest von Block 3

| # | Maßnahme | Aufwand | Behebt |
|---|---|---|---|
| #42 | `zone.order` als zweite Wahrheit streichen — Array autoritativ, `order` beim Schreiben aus dem Index ableiten | S | S7 |
| #43 | PPTX auf markdown-it + `splitMarkdownBlocks` umstellen (ein Parser statt zwei) | M | S19, M45 |
| #44 | Meta-MCP-Ziel löschen (samt handgerolltem HTTP-Client über std-TCP); `desktop`/`claude` zu unabhängigen Schaltern | M | M63, S33 |
| #46 | Ordentliches Modal-Primitive (Focus-Trap, Scroll-Lock, Initialfokus, Confirm-on-Dismiss) | S | M4, M56, S26 |

**Beachte bei #44:** die Fehlerpfade der MCP-Registrierung melden seit der i18n-Session **Fehlercodes** (`slideo:mcp.*`, siehe unten). Fällt das Meta-MCP-Ziel weg, müssen die zugehörigen Katalogschlüssel in `src/i18n/{de,en}/common.ts` mit weg — sonst bleiben tote Einträge stehen.
**Beachte bei #46:** die Modal-Texte liegen jetzt im Katalog (`modal.*`), nicht mehr inline.

### Was in dieser Session NICHT dran ist
- **Stage 5 (der Keil)** — gebündeltes MCP-Release (`apply_slides`, `add_asset`, vollständiges `create_zone`, Tool-Annotationen, Plan-Freigabe), Auto-fit, Messkanal zur KI, Split-Direktmanipulation, Brand-Ingest. Siehe [optimierung.md](review-2026-08/optimierung.md).
- **Auto-Updater** — bewusst zurückgestellt.
- **Notarisierung** — Konfiguration steht ([docs/release-macos.md](release-macos.md)), der Durchlauf ist Sache des Entwicklers (Apple-Lizenz vorhanden).

**#45 und #47 sind erledigt.** #47 fiel mit der i18n-Session, im bewusst gewählten Umfang (siehe unten).

### Bitte zuerst lesen (in dieser Reihenfolge)
1. **`CLAUDE.md`** (Projektwurzel) — maßgeblich für den Ist-Stand, alle Architektur-Entscheidungen.
2. **`docs/wording.md`** — der Vokabular- und i18n-Vertrag. **Bindend für jeden neuen Anzeigetext.**
3. **`docs/review-2026-08/README.md`** — Einstieg ins August-Review: Umsetzungsstand, die fünf getroffenen Entscheidungen.
4. **`docs/review-2026-08/optimierung.md`** — die 47 Maßnahmen mit Aufwand/Wirkung, die 5 Stages.
5. `docs/review-2026-08/befunde.md` + `markt.md` nur bei Bedarf (Befund-IDs nachschlagen).

### Stand nach der i18n-Session (2026-08-03, alles auf `stage-1-2-foundation`)

**Stage 1–4 vollständig** (Stage 4 bis auf Notarisierungs-Durchlauf und Auto-Updater).

**Wenn du irgendwo Anzeigetext anfasst, gelten drei Regeln:**
1. **Nie ein deutsches Literal in die Oberfläche schreiben.** Schlüssel in `src/i18n/de/<bereich>.ts` **und** `en/<bereich>.ts` anlegen, dann `t('…')`. `tsc` erzwingt beide Sprachen — eine fehlende Übersetzung ist ein Compile-Fehler, kein Testfehler. Plural über `tp()`, Sätze mit `<code>`/`<span>` über `<T>` mit `{0}`-Steckplätzen (nie in Fragmente zerlegen).
2. **Backend-Fehler NIE roh anzeigen.** Immer `describeError(e)` aus `@/lib/tauri`. Die Rust-Seite meldet handlungsrelevante Fehler als `slideo:<code>`; ohne den Übersetzer sieht der Nutzer den Maschinencode. Genau das ist beim Umbau an fünf Stellen passiert — der Scanner hat dafür jetzt die Regel `raw-error`.
3. **Dev-Kommentare bleiben deutsch** (Repo-Konvention), und die **AI-facing MCP-Fläche bleibt englisch und unangetastet**.

⚠️ **Die Backtick-Falle** (unverändert gültig): `navScript`/`editScript`/`patchScript` **und der `SLIDE_CSS`-Block** in [renderer.ts](../src/lib/renderer.ts) sind Template-Literale. Ein Backtick oder ein rohes `\n` — *auch in einem Kommentar darin* — zerlegt das Literal; `tsc` bleibt grün, zur Laufzeit stirbt der ganze Overlay. Der Katalog verbietet Backticks per Test, und `renderer.test.ts` parst jetzt **beide Sprachen**. Schreib in diesen Blöcken trotzdem ASCII.

**Weiteres aus der i18n-Session, das du nicht kaputtmachen darfst:**
- **`meta.language`** (additiv, `version` bleibt "1.0") = Sprache der **Folien**, nicht der Oberfläche. Wer eine neue Render-Variante baut, muss `deckLang(presentation)` benutzen statt `lang="de"`.
- **`classifyPreviewChange`** kennt `meta.language` als `full`-Auslöser. Jedes neue **deck-weite** Feld, das außerhalb einer Zone gerendert wird, braucht dort einen Eintrag — sonst kommt die Änderung nie in der Vorschau an.
- Der **Sprachwechsel wirkt nach Neustart**, nicht live. Das ist eine Produktentscheidung; `applyLocale()` steht bereit, es fehlen nur fünf Kopplungspunkte (im Kopfkommentar von [src/i18n/index.ts](../src/i18n/index.ts) namentlich aufgeführt).

**Offen / bewusst nicht gemacht:**
- Per **MCP** angelegte Decks bekommen kein `meta.language` (Rust kennt die Oberflächensprache nicht) → Default `de`. Ein `language`-Parameter für `create_presentation` gehört ins **Stage-5-Bündel**.
- Der Fenstertitel des Folien-Fensters (`present.rs`) ist hart deutsch — er muss zur Fensterliste von Zoom/Meet passen und wird in beiden Sprachen gleich zitiert.

### Verifikation
```bash
npm run build                      # tsc + vitest (92) + vite build
node scripts/check-i18n.mjs        # muss 0 Fundstellen melden
cd src-tauri && cargo test         # 54 Tests (+1 ignoriert: Release-Gate)
cd src-tauri && cargo check
```
**GUI-Abhängiges prüft der Mensch** — sag genau, was zu klicken ist. Der volle GUI-Durchlauf über Stage 1–4 steht noch aus; für i18n gehören dazu: Sprache umstellen + Neustart, Design-Overlay → „Sprache der Folien", ein MCP-Registrierungsfehler in den Einstellungen (muss Prosa zeigen, nicht `slideo:…`), Plural-Stellen bei genau 1 (Verlauf, Export-Dialog, Übersicht), die §20-Mini-Toolbar in englischer Oberfläche.

### Arbeitsweise
- Bei größeren Schritten erst Plan/Scope klären.
- Adversariales Multi-Agent-Review je größerem Schritt; bestätigte Findings fixen.
- **Für jedes Gate eine Negativkontrolle**: Fehler künstlich einbauen, prüfen, dass das Gate anschlägt, zurückbauen. Ein grünes Gate ohne diesen Nachweis sagt nichts — in der i18n-Session war der erste Scanner für die im Projekt dominierende Textform blind und meldete trotzdem „0 Fundstellen".
- Architektur-Entscheidungen in `CLAUDE.md` verankern.
- **Commit/Push/Merge nur auf mein Wort.**

## PROMPT ENDE

---

### Hinweis zur Nutzung
- **Diese Session:** Rest von Block 3 (#42, #43, #44, #46).
- **Danach:** Stage 5 (der Keil) — inkl. `language`-Parameter für `create_presentation`.
- **Parallel beim Menschen:** notarisierter Build ([release-macos.md](release-macos.md)) und der GUI-Durchlauf über Stage 1–4.
