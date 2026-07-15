# Slideo — Pre-Release Bug-Review (2026-07-15)

> Multi-Agent-Code-Review der Gesamt-App vor dem Release. 13 Review-Spuren (Rust + Frontend) lasen den
> echten Code; **jeder Fund wurde adversarial gegengeprüft** (bestätigt / refutiert / unsicher), damit
> dieser Report vertrauenswürdig ist. Ergebnis: **10 bestätigte Bugs, 0 unsicher, 8 refutiert** (von 18
> Rohfunden). **Kein Critical.**
>
> **STATUS (2026-07-15): alle 10 Bugs gefixt + headless verifiziert** — `cargo check` + `cargo test` 42/42,
> `tsc --noEmit` + `vite build` grün, die 4 injizierten Iframe-Skripte (nav/edit/patch) `node --check` sauber
> (Template-Literal-Falle vermieden), B10 konkret gegen den Repro geprüft (Referenz-Link erhalten, kein
> Klartext-Regress). **GUI-Verifikation ausstehend** für die laufzeitabhängigen Fixes (B3 Inline-Edit-Reichweite,
> B7 `<script>`-Reexec nach Patch, B8 Transition-Versatz) — im echten `tauri:dev` gegenprüfen.

---

## 0. Zusammenfassung

| # | Titel | Severity (adjustiert) | Datei | Klasse |
|---|---|---|---|---|
| **B1** | `~/.claude.json` / `claude_desktop_config.json` bei Parse-Fehler komplett überschrieben | 🔴 **HIGH** | [mcp_registration.rs:163](../../src-tauri/src/mcp_registration.rs#L163) | Datenverlust (fremde Datei) |
| **B2** | Nicht-atomares `write_presentation` zerstört bestehendes `.slideo` bei Schreibfehler | 🟠 **MEDIUM** | [writer.rs:18](../../src-tauri/src/file/writer.rs#L18) | Datenverlust (eigenes Deck) |
| **B3** | Inline-Text-Edit löscht verschachtelte Bilder/Medien still | 🟠 **MEDIUM** | [dom-edit.ts:116](../../src/lib/dom-edit.ts#L116) | Datenverlust (§20) |
| **B4** | `addLogo()` crasht bei unbekannter `logo.position` → **gesamter** PPTX-Export scheitert | 🟡 **LOW** | [pptx.ts:224](../../src/lib/pptx.ts#L224) | Korrektheit / Export |
| **B5** | `reorder_zones` dupliziert Zone + UUID bei wiederholter id | 🟡 **LOW** | [tools.rs:204](../../src-tauri/src/tools.rs#L204) | Datenkorruption (MCP) |
| **B6** | `replace_in_zone` mit leerem `search` zerhackt Zonen-Inhalt | 🟡 **LOW** | [tools.rs:332](../../src-tauri/src/tools.rs#L332) | Korrektheit (MCP) |
| **B7** | In-Place-`patch-zone` führt `<script>` in HTML-Zonen nicht neu aus → interaktive Zone wird leer | 🟡 **LOW** | [renderer.ts:1450](../../src/lib/renderer.ts#L1450) | Korrektheit (Vorschau) |
| **B8** | Deck/Transition: Geschwister-Margin schlägt `margin:0` → jede Nicht-Erst-Folie ~10 px verschoben | 🟡 **LOW** | [renderer.ts:169](../../src/lib/renderer.ts#L169) | Layout (kosmetisch) |
| **B9** | Nicht-atomares `index.json` kann Versionshistorie eines Decks bei Crash verwaisen | 🟡 **LOW** | [history.rs:92](../../src-tauri/src/history.rs#L92) | Datenverlust (History) |
| **B10** | `splitMarkdownBlocks` verliert Link-Referenz-Definitionen → Block-Op bricht Links | 🟡 **LOW** | [markdown-tiptap.ts:42](../../src/lib/markdown-tiptap.ts#L42) | Round-Trip-Korruption |

**Muster:** kein Critical, keine erreichbare Panik/Absturz-Kette. Die zwei ernsten Funde sind
**Datenverlust an Dateien** (B1 fremde Config, B2 eigenes Deck) — beide **direkt gegen die local-first-
Zusage „wir fassen deine Sachen nicht an"** und beide **billig zu beheben** (das Repo hat bereits ein
atomares, rechtebewahrendes `write_json` als Vorbild). Der Rest sind Korrektheits-/Kosmetik-Nits in
Randfällen, meist Ein-Zeilen-Fixes.

---

## 1. Bestätigte Bugs im Detail

### 🔴 B1 — `~/.claude.json` / `claude_desktop_config.json` wird bei Parse-Fehler komplett überschrieben
- **Datei:** [mcp_registration.rs:163](../../src-tauri/src/mcp_registration.rs#L163) (`set_mcp_server`)
- **Was:** `let mut config = read_json(path).unwrap_or_else(|| json!({}));`. `read_json` gibt bei **jedem**
  Fehler `None` zurück — auch bei JSON-**Parse-Fehler** oder truncated read. Dann wird nur
  `mcpServers.slideo` eingesetzt und `write_json` **ersetzt die ganze Datei atomar** → aller vorherige
  Inhalt weg. Zweiter Clobber-Pfad (Z. 164–166): parst die Datei zu einem Nicht-Objekt (Array/String), wird
  sie ebenfalls auf `{}` zurückgesetzt.
- **Auslöser:** Claude Code (ein Registrierungsziel!) schreibt `~/.claude.json` **sehr häufig** und **nicht
  atomar**. Läuft Slideos Reconcile (Start-Thread oder `mcp_set_target`) genau während eines solchen
  Schreibvorgangs, liest es einen halb geschriebenen Puffer → Parse schlägt fehl → **die gesamte
  Claude-Code-User-State (Projekte, History, andere MCP-Server, Auth) wird durch
  `{"mcpServers":{"slideo":…}}` ersetzt.** Gleiches gilt für `claude_desktop_config.json` (alle anderen
  MCP-Server des Nutzers).
- **Warum es sicher ein Bug ist (nicht intendiert):** die Geschwister-Funktionen `remove_mcp_server`
  (Z. 183) und `meta_unregister` (Z. 339) machen genau das Richtige — `let Some(mut config) = read_json(...)
  else { return Ok(()) }` mit dem Kommentar *„unparsbar → lieber nichts kaputtmachen"*. **Nur
  `set_mcp_server` fehlt dieser Guard** — klarer Asymmetrie-Oversight.
- **Fix:** „Datei fehlt" von „Datei da, aber unparsbar" unterscheiden. Nur bei echtem *nicht-vorhanden*
  auf `json!({})` zurückfallen; bei Existenz-aber-Parse-Fehler `Err` (nicht schreiben) — spiegelt das
  Verhalten der Geschwister-Funktionen. **Aufwand: ~1–5 Zeilen.**

### 🟠 B2 — Nicht-atomares `write_presentation` zerstört das bestehende `.slideo` bei Schreibfehler
- **Datei:** [writer.rs:18](../../src-tauri/src/file/writer.rs#L18)
- **Was:** `File::create(path)` **truncatet die vorhandene `.slideo` sofort** und **erst dann** werden JSON +
  jedes Asset in den ZIP gestreamt. Ein I/O-Fehler nach dem Truncate (Platte voll, Volume/Netzlaufwerk weg
  — plausibel bei Asset-Decks bis 2 GiB) lässt das **Original bereits zerstört** und die neue Datei
  truncated/kaputt zurück (`Kein gültiges .slideo-Archiv` beim Öffnen). **Kein** Temp-Datei + atomarer
  Rename — obwohl `mcp_registration::write_json` (S6-Härtung) genau das Muster bereits bietet.
- **Auslöser:** primärer Speicherpfad (`save_presentation`, sowohl Mensch als auch MCP). Großes Deck, Save,
  Platte läuft mitten im Asset-Schreiben voll → Original weg, neue Datei korrupt.
- **Milderung (vom Verifier):** `savePresentation` legt nach erfolgreichem Save einen dedup. History-
  Snapshot an → letzte gute Version ist *oft* wiederherstellbar (nur falls ein früherer Save + History
  intakt + Nutzer weiß davon). Deshalb **MEDIUM** statt HIGH — aber der Ziel-Schreibvorgang selbst bleibt
  unsicher.
- **Fix:** in Sibling-Temp-Datei schreiben, `finish()`, dann `std::fs::rename()` über das Ziel nur bei
  vollem Erfolg (Temp bei Fehler löschen). **Aufwand: ~10–20 Zeilen, Muster existiert schon.**

### 🟠 B3 — Inline-Text-Edit löscht still verschachtelte Bilder/Medien
- **Datei:** [dom-edit.ts:116](../../src/lib/dom-edit.ts#L116) (`sanitizeInline`/`cleanInto`), Gate
  `isInlineEditable` (Z. 85, gespiegelt in [renderer.ts:861](../../src/lib/renderer.ts#L861))
- **Was:** `isInlineEditable` prüft nur die **direkten** Kinder gegen `INLINE_OK`. Ein `<img>` in einem
  Inline-Wrapper (`<a>`/`<span>`) besteht den Test (direktes Kind = inline). Beim Commit verwirft `cleanInto`
  das `<img>` (weder `INLINE_OK` noch `DROP_TAGS` → landet im else-Zweig, der nur den leeren Inhalt behält).
  **Das Bild ist still aus `zone.html` entfernt.** Die Direktmanipulations-UI **bietet Inline-Edit für
  genau solche Elemente aktiv an** — also erreichbar, nicht theoretisch. *(Verifier: höchste Konfidenz.)*
- **Auslöser:** HTML-Zone `<p>Docs <a href="/x"><img src="assets/logo.png"></a> here</p>`. Doppelklick auf
  den Absatz, Enter → `<p>Docs <a href="/x"></a> here</p>`. **Logo weg, ohne Warnung.** Undobar (Cmd+Z),
  aber still.
- **Fix:** `cleanInto`-else-Zweig darf `<img>`/void/replaced-Content nicht still entfernen (als sicheres
  Leaf whitelisten mit sanitisiertem src/alt/style/class) **oder** `isInlineEditable` tief prüfen (jedes
  nicht-inline Nachfahre-Element → Fallback auf Quell-Editor). **Aufwand: ~5–15 Zeilen.**

### 🟡 B4 — `addLogo()` crasht bei unbekannter `logo.position` → gesamter PPTX-Export scheitert
- **Datei:** [pptx.ts:224](../../src/lib/pptx.ts#L224)
- **Was:** `const pos = {…4 Corner-Keys…}[logo.position]`; ist `position` etwas anderes, ist `pos`
  `undefined` und `pos.x`/`pos.y` wirft `TypeError`. `.slideo` ist bewusst schemafrei (Frontend-Hoheit) →
  `loadPresentation` validiert `meta.logo.position` **nicht**. Ein hand-editiertes/geteiltes Deck mit
  `position:'center'` bringt den **ganzen** PPTX-Export zu Fall (generischer Fehler-Toast), während
  HTML/PDF **des identischen Decks** anstandslos exportieren (die degradieren grazil).
- **Fix:** Lookup absichern: `?? {default bottom-right}` (spiegelt Renderer-Verhalten). **Aufwand: 1 Zeile.**

### 🟡 B5 — `reorder_zones` dupliziert Zone + UUID bei wiederholter id
- **Datei:** [tools.rs:204](../../src-tauri/src/tools.rs#L204)
- **Was:** baut das Array neu, indem für jede id in `ordered_ids` `zones[idx].clone()` gepusht wird — **keine
  Deduplizierung**. Kommt eine id doppelt vor, entsteht eine **zweite Zone mit identischer UUID**;
  `renumber()` maskiert es (Order 0..n). Persistiert ins `.slideo`; spätere `zone_index()`-Lookups treffen
  nur die erste Kopie → zweite unadressierbar, Inhalt auf jeder Folie dupliziert.
- **Auslöser:** nur über **fehlerhafte MCP-Calls** (KI/Client) erreichbar (`["A","A","B"]`) — nicht aus dem
  App-Frontend. Da MCP der Haupt-Authoring-Weg ist, ist ein LLM-Doppel-id bei komplexem Restructure
  plausibel, aber nicht der Normalpfad. Deshalb LOW.
- **Fix:** `HashSet` beim Bauen; bereits platzierte id überspringen (bewahrt die „unbenannte anhängen"-
  Sicherheit). **Aufwand: ~3 Zeilen.**

### 🟡 B6 — `replace_in_zone` mit leerem `search` zerhackt den Inhalt
- **Datei:** [tools.rs:332](../../src-tauri/src/tools.rs#L332)
- **Was:** `search` via `req_str` erlaubt `""`. `str::replace("", r)` fügt `replace` an **jeder** Char-Grenze
  ein; `matches("").count()` = char_count+1. `"Hi"` + search `""`/replace `"X"` → `"XHXiX"`, gemeldet als
  3 Ersetzungen. Kein Guard.
- **Auslöser:** MCP-Call mit leerem `search`. Still, aber undobar. LOW.
- **Fix:** leeres `search` früh ablehnen (`Err`) oder als No-op behandeln. **Aufwand: 1 Zeile.**

### 🟡 B7 — In-Place-`patch-zone` führt `<script>` in HTML-Zonen nicht neu aus → interaktive Zone wird leer
- **Datei:** [renderer.ts:1450](../../src/lib/renderer.ts#L1450) (`patchScript`)
- **Was:** HTML-Zonen dürfen bewusst `<script>` enthalten (CSP erlaubt `script-src 'unsafe-inline'`).
  `patch-zone` macht `frame.innerHTML = newFrame.innerHTML`; per HTML-Spec **läuft so eingefügtes `<script>`
  nie**. Der Kommentar Z. 1444–1445 („Zonen-HTML enthält keine `<script>`") ist für `content_type:'html'`
  **falsch**. `preview-diff` klassifiziert eine `zone.html`-Änderung als `patch` (nicht `full`).
- **Auslöser:** HTML-Zone mit Inline-`<script>` (Canvas-Chart, animierter Zähler, Runtime-DOM). Nutzer
  editiert *irgendeinen* Text darin (§20) **oder** ein MCP-Edit berührt `zone.html` → Patch statt Reload →
  Skript läuft nicht → **Zone bleibt leer/statisch** bis zu einem unabhängigen Voll-Reload (previewEdit-
  Toggle, Folienzahl ändern, Deck neu öffnen). Kein Datenverlust (`zone.html` behält das Skript);
  Präsentation/Standalone rendern frisch. LOW.
- **Fix:** nach dem `innerHTML`-Swap eingefügte `<script>` klonen+ersetzen (damit sie laufen) **oder**
  `preview-diff` Zonen mit `<script>` als `kind:'full'` klassifizieren (wie die „removed token key"-
  Ausnahme). Kommentar korrigieren. **Aufwand: ~5–15 Zeilen.**

### 🟡 B8 — Deck/Transition: Geschwister-Margin schlägt `margin:0`, ~10 px Versatz
- **Datei:** [renderer.ts:169](../../src/lib/renderer.ts#L169) (`SLIDE_CSS`) vs. `transitionCss` (Z. 1471/1478)
- **Was:** `.slideo-frame + .slideo-frame { margin-top: 1.25rem }` (Spezifität 0,2,0, Vorschau-Gutter)
  schlägt `.slideo-frame { margin:0 }` (0,1,0) im Deck-Modus. Da Deck-Frames `position:absolute; inset:0`
  sind, sitzt jede **Nicht-Erst-Folie ~10 px tiefer** (asymmetrischer Letterbox); Crossfade zu/von Folie 0
  springt ~10 px; Auto-Animate misst den Offset mit.
- **Auslöser:** Deck mit `meta.transition.kind ∈ {fade,slide,zoom,auto}` präsentiert. Rein kosmetisch → LOW.
  (Scroll-Snap-Default `none` unbetroffen.)
- **Fix:** Vorschau-Gutter auf Vorschau scopen (`:not(.present) .slideo-frame + .slideo-frame`) oder
  gleich/höher spezifischen Reset im Deck/Snap-Zweig. **Aufwand: ~1–3 Zeilen.**

### 🟡 B9 — Nicht-atomares `index.json` kann die Versionshistorie eines Decks bei Crash verwaisen
- **Datei:** [history.rs:92](../../src-tauri/src/history.rs#L92) (`write_index`)
- **Was:** `std::fs::write(index_path, json)` truncatet+überschreibt in-place, kein Temp+Rename. Crash/
  Force-Quit im Schreibfenster → `index.json` truncated; `read_index` parst mit `unwrap_or_default()` →
  **leerer Vec**. Die `<id>.slideo`-Snapshots liegen noch da, aber `list()/restore()` sind index-getrieben →
  **gesamte Historie des Decks unerreichbar**.
- **Auslöser:** Auto-Snapshot beim Save (fire-and-forget) + Crash im kleinen Schreibfenster. Betrifft nur
  die sekundäre History-Komfortfunktion, nie das Deck. LOW.
- **Fix:** Temp-Datei + `rename()` (atomar auf gleichem FS). **Aufwand: ~5 Zeilen.**

### 🟡 B10 — `splitMarkdownBlocks` verliert Link-Referenz-Definitionen
- **Datei:** [markdown-tiptap.ts:42](../../src/lib/markdown-tiptap.ts#L42)
- **Was:** rekonstruiert Blöcke nur aus Level-0-Tokens mit `token.map`. markdown-it-Referenz-Definitionen
  (`[id]: url`) werden in `env.references` konsumiert und **emittieren kein Token** → beim Split verloren.
  Store-Block-Ops (`reorder/delete/duplicate/editZoneBlock`) splitten+reassemblieren → Definition weg, jeder
  Referenz-Link bricht (`[text][id]` als Literal).
- **Auslöser:** Zone mit `[foo]: https://…` + `[the site][foo]`; irgendeine Block-Op in der Vorschau. Der
  In-App-Tiptap-Editor erzeugt Inline-Links (löst es nicht aus) — nur **MCP/KI-authored** Markdown betroffen.
  Selten in LLM-Output. LOW.
- **Fix:** Referenz-Definitionen (und andere Zero-Token-Zeilen) beim Split bewahren, oder Markdown vorher
  über markdown-it/Tiptap zu Inline-Links normalisieren, mindestens dokumentieren. **Aufwand: mittel.**

---

## 2. Geprüft & entkräftet (refutiert) — Coverage-Nachweis

Diese Rohfunde wurden **gegen den echten Code refutiert** (nicht erreichbar / durch Guards abgedeckt /
intendiert). Zusammengefasst, damit sie nicht wieder aufkommen:

- **IPC-Accept-Loop bricht bei `accept()`-Fehler** → refutiert: Verbindungen sind kurzlebig/seriell
  (ein Tool-Call = eine Verbindung), EMFILE/ECONNABORTED in Single-User-Loopback nicht erreichbar.
- **Mutex-Vergiftung durch Panik in `tools::handle`** → refutiert: **keine erreichbare Panik** — alle
  Param-Extraktion über sichere Kombinatoren, jeder Array-Index via `zone_index()` guarded, der frühere
  `extract_styles`-Panic ist gefixt + getestet. (Der `catch_unwind`-Defense-in-Depth-Punkt bleibt optional.)
- **`resolveAssetRefs` Substring-Kollision** → refutiert: Asset-Namen sind maschinell (`img-<8>.ext`),
  können nicht Präfix voneinander sein.
- **`suppressClick` bleibt hängen** → refutiert: Pointer-Capture stellt den Klick im Iframe zu; self-healing.
- **`applyExternalPresentation` clampt `activeSlideIndex` nicht** → refutiert: Renderer-`go()` +
  Footer-`Math.min` clampen downstream; Rest ist ein selbstheilender Ein-Tasten-Hänger.
- **Tauri-Listener-Leak bei schnellem Unmount** → refutiert: `@tauri-apps/api/event` ist beim Boot schon
  geladen, kein Race-Fenster; 2 von 3 Handlern `alive`-guarded.
- **Global-Keydown kapert Space/Pfeil bei fokussiertem Control** → refutiert: macOS-WebKit fokussiert
  `<button>` bei Klick nicht; kein realer Fehlerfall.
- **duplicate/split klont `id`/`data-id`** → refutiert: Auto-Animate nimmt das erste DOM-Element pro
  `data-id`; Klon steht dahinter → Original morpht weiter korrekt.

**Saubere Spuren (0 Funde):** Rust Komponenten-Generator + Overflow-Heuristik
([components.rs](../../src-tauri/src/components.rs)/[overflow.rs](../../src-tauri/src/overflow.rs)), Rust
Commands + Projektor-Fenster ([commands.rs](../../src-tauri/src/commands.rs)/[present.rs](../../src-tauri/src/present.rs)),
und eine Frontend-Spur.

---

## 3. Fix-Status — alle umgesetzt (Entscheidung: „alles jetzt")

> Priorisiert war nach **Schaden × Erreichbarkeit × Aufwand**; auf Wunsch **alle 10 in einer Session** gefixt.

### Bucket A — Release-Blocker (Datensicherheit)
- ✅ **B1** `~/.claude.json`-Clobber — `read_json_checked` unterscheidet „fehlt" (frisch `{}`) von „unparsbar"
  (Err, Datei unangetastet); `set_mcp_server` errort statt zu überschreiben. [mcp_registration.rs](../../src-tauri/src/mcp_registration.rs)
- ✅ **B2** Nicht-atomares `.slideo`-Save — Temp-Datei + `rename` (Original bleibt bei Fehler unversehrt). [writer.rs](../../src-tauri/src/file/writer.rs)

### Bucket B — Korrektheit in ausgelieferten Features
- ✅ **B3** Inline-Edit löscht Bilder — `isInlineEditable` prüft jetzt **tief**; Blöcke mit verschachtelten
  Bildern fallen auf den Quell-Editor zurück (beide gespiegelten Stellen). [dom-edit.ts](../../src/lib/dom-edit.ts), [renderer.ts](../../src/lib/renderer.ts)
- ✅ **B4** PPTX-Export-Abbruch bei Logo-Position — Fallback auf unten-rechts. [pptx.ts](../../src/lib/pptx.ts)
- ✅ **B6** `replace_in_zone` leeres search — früh abgelehnt. [tools.rs](../../src-tauri/src/tools.rs)
- ✅ **B5** `reorder_zones` Dedup — `HashSet`, jede Zone genau einmal. [tools.rs](../../src-tauri/src/tools.rs)

### Bucket C — Polish
- ✅ **B7** Interaktive HTML-Zone leer nach Patch — `<script>` nach `innerHTML`-Swap neu erzeugt+ausgeführt. [renderer.ts](../../src/lib/renderer.ts)
- ✅ **B8** Transition ~10 px Versatz — Vorschau-Gutter im Präsentationsmodus gleich-spezifisch zurückgesetzt. [renderer.ts](../../src/lib/renderer.ts)
- ✅ **B9** History-`index.json`-Atomarität — Temp + `rename`. [history.rs](../../src-tauri/src/history.rs)
- ✅ **B10** Referenz-Link-Definitionen — nicht abgedeckte Zeilen beim Split bewahrt (konkret verifiziert). [markdown-tiptap.ts](../../src/lib/markdown-tiptap.ts)

**Headless grün** (cargo check/test 42, typecheck, vite build, injizierte Skripte `node --check`, B10-Repro).
**GUI-Check ausstehend** für die laufzeitabhängigen Fixes (B3/B7/B8) im echten `tauri:dev`.

---

*Methodik: 13 Finder-Spuren (general-purpose, Opus 4.8, high-effort) lasen die realen Dateien; jeder Fund
wurde von einem unabhängigen adversarialen Verifier gegen den Code geprüft (Default „refutiert" bei Zweifel,
um Falsch-Positive zu vermeiden). Rohdaten + volle Verifier-Begründungen im Workflow-Journal.*
