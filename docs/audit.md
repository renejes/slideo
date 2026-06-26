# Slideo — Performance- & Security-Audit

> Stand: 2026-06-26 · Branch `main` · lokale Tauri-2-Desktop-App (single-user, macOS-zentriert).
> Methodik: Multi-Agent-Audit (12 Dimensionen parallel — 7 Security, 5 Performance), jedes Finding
> adversarial gegengeprüft + Severity kalibriert, Vollständigkeits-Kritik, Dedup/Priorisierung.
> 40 Findings roh → kein high/critical hat die adversariale Prüfung überlebt; das höchste reale
> Risiko ist **medium**. Datei-/Zeilenangaben verifiziert.

---

## 0. Umsetzungsstand (2026-06-26)

**Security: alle S1–S9 umgesetzt** (Branch `security-hardening`), adversarial review-gegengeprüft, zwei dabei
gefundene Regressionen (M1 Windows-Asset-Host in der Slide-CSP, M2 Rechte-Downgrade fremder Configs) gefixt.
**Headless grün:** `cargo test` **33** (+4 neue Tests: ZIP-Caps, `write_json`-Rechte), `typecheck`, `vite build`.
`cargo audit` ausgeführt → **0 Vulnerabilities** (17 unmaintained/unsound-Warnungen, überwiegend Linux-GTK-Stack,
auf macOS nicht kompiliert; `proc-macro-error` build-only; `unic-*` transitiv). `npm audit` (Production) clean.

| Finding | Status | Datei |
|---|---|---|
| S1 IPC-Token + 0600 + 16-MiB-Cap | ✅ umgesetzt | ipc.rs |
| S2 App-CSP (+ devCsp, Vite-Polyfill off) | ✅ umgesetzt — **GUI-Verifikation offen** | tauri.conf.json, vite.config.ts |
| S3 Slide-CSP (`connect-src 'none'`) | ✅ umgesetzt — **GUI-Verifikation offen** | renderer.ts |
| S4 Editor `html:true` | ✅ als sicher bestätigt (ProseMirror-Schema) + CSP-Backstop | tiptap-extensions.ts |
| S5 Print-Iframe sandbox | ✅ umgesetzt | print.ts |
| S6 `write_json` atomar + rechtebewahrend + Lock | ✅ umgesetzt (M2-Fix) | mcp_registration.rs |
| S7 `.slideo` Größen-/Anzahl-Caps | ✅ umgesetzt (Total über echte Bytes) | file/reader.rs |
| S8 IPC-Zeilen-/Byte-Cap | ✅ umgesetzt | ipc.rs |
| S9 Print-Temp randomisiert | ✅ umgesetzt | commands.rs |

**Offen (Mensch / nächste Phase):**
- **GUI-Verifikation der CSP (S2/S3)** auf echtem `tauri:dev`/`tauri build` (macOS **und** Windows/WebView2): App lädt,
  MCP-IPC + Projector-Fenster laufen, Folien-Nav/§20/Auto-Animate funktionieren, gestreamte Videos/Audios laden, **keine**
  CSP-Verstöße in der DevTools-Konsole.
- **Performance P1–P13** ist die **nächste Phase** (noch nicht begonnen — der Nutzer wollte erst Security, dann Performance).

**Akzeptierte Restrisiken (dokumentiert, kein Fix geplant):**
- **S1 Same-UID:** ein Prozess desselben Nutzers kann `ipc.json` (0600) lesen und damit das Token — er hat ohnehin die
  Rechte des Nutzers. 0600 + Token schützen gegen *andere* lokale Nutzer (Multi-User-Host) und „nur den Port kennen".
- **S8 Verbindungsanzahl:** kein Limit gleichzeitiger IPC-Verbindungen (je 16 MiB gecappt, Token-Check nach Voll-Puffern);
  nur 127.0.0.1, ohne Token nutzlos → akzeptiert (lokaler Prozess kann die App ohnehin crashen).
- **S4/F3:** externes `<script src>`/externe Embeds in HTML-Zonen werden in-app von der Slide-CSP blockiert
  (gewollte Offline-Härtung); der Standalone-Export bleibt offen.
- **S7 Lese- ohne Schreib-Caps:** ein selbst gespeichertes Deck > 2 GiB ließe sich nicht wieder öffnen — Caps sind
  bewusst großzügig (1 GiB/Asset, 2 GiB gesamt); Speichern wird nie blockiert (kein Datenverlust).

---

## 1. Bedrohungsmodell

Slideo läuft vollständig lokal, ohne Cloud/Netz; die einzige KI-Schnittstelle ist der MCP-Server.

| Akteur | Beschreibung |
|---|---|
| **A** | Bösartige `.slideo`-Datei, die der Nutzer öffnet. HTML-Zonen führen *bewusst* beliebiges JS aus (dokumentiertes Feature). |
| **B** | Fremder lokaler Prozess unter demselben User. Hauptweg: der unauthentifizierte IPC-Socket. |
| **C** | Die per MCP / Prompt-Injection gesteuerte KI. |
| **D** | Bösartige Asset-Inhalte (Bild/SVG/Video/Audio). |
| **E** | Supply-Chain (npm/cargo). |

**Sicherheits-Haltung:** Die Kern-Isolation ist solide. Aller untrusted Inhalt rendert in
`<iframe sandbox="allow-scripts">` **ohne** `allow-same-origin` (opaker Origin, kein Zugriff auf
Tauri-IPC/Parent) — verifiziert über alle 6 Folien-Iframes. Komponenten-/Asset-Generatoren sind
escaped bzw. allowlisted (`components.rs`), Pfad-Traversal in Asset-Lookup und Snapshot-IDs ist
geprüft (`history.rs valid_id` + `index_lock`), und es gibt **keinen Zip-Slip** (Asset-Namen bleiben
in-memory, nie `Path::join`'d). Zwei reale Schwächen: (1) der **IPC-Steuer-Socket ist
unauthentifiziert** → Akteur B/C erreicht alle 35 Tools; (2) **`csp: null`** entfernt jede zweite
Verteidigungslinie. Kein heutiger Sandbox-Escape und keine Privilegien-Eskalation belegt; die
übrigen Funde sind Defense-in-Depth bzw. Robustheit.

---

## 2. Security-Findings (priorisiert)

### S1 — Unauthentifizierter IPC-Steuer-Socket · **medium**
`src-tauri/src/ipc.rs` (`start` Z.45-71, `process_request` Z.91-129, `write_discovery` Z.27-34) ·
`src-tauri/src/tools.rs` (`open_presentation`, `save_presentation`)

Der TCP-Server bindet `127.0.0.1:0` und schreibt den Port in eine **world-readable** `ipc.json`
(verifiziert `-rw-r--r--`, **kein Token**). `process_request` reicht jede Zeile direkt an
`tools::handle` — ohne Auth, Handshake oder Peer-Prüfung. Jeder lokale Prozess (B) bzw. die
prompt-injizierte KI (C) kann alle **35 Tools** aufrufen: das gesamte Live-Deck lesen (inkl.
ungespeicherter Änderungen + lokaler Dateipfade), beliebig mutieren, und `save_presentation`
schreibt ein `.slideo`-ZIP an einen **frei wählbaren Pfad** (truncatet bestehende Dateien).

Von *high* auf **medium** kalibriert: ein Same-UID-Prozess hat ohnehin Dateirechte des Nutzers; der
echte inkrementelle Hebel ist *stilles Echtzeit-Lesen/Mutieren des In-Memory-Decks* + *ZIP-Writes
über eine bekannte API*. Open/Save liefern **kein** arbitrary-raw-content (Write ist ZIP-gerahmt) und
**kein** generisches File-Exfil (Read nur `presentation.json` gültiger ZIPs). Auf Multi-User-Hosts
tendiert es Richtung high (world-readable Port).

**Fix:** Shared-Secret beim Start erzeugen, neben dem Port in `ipc.json` ablegen, Datei mit **0600**
schreiben (`PermissionsExt::set_mode(0o600)` / Windows-ACL). `process_request` prüft pro Request ein
Pflicht-Token (Constant-Time-Vergleich); `client_request` liest es mit. Schließt die ganze
35-Tool-Fläche. Optional sauberer: Unix-Domain-Socket im 0700-Verzeichnis. Defense-in-depth für
Open/Save: Pfad canonicalisieren + `.slideo`-Endung + Symlinks ausschließen.

### S2 — `csp: null` app-weit · **low** (Defense-in-Depth)
`src-tauri/tauri.conf.json` (`app.security.csp = null`, Z.25)

Keine CSP im App-Origin. Heute nicht ausnutzbar (Sandbox + Dev/Prod-Branch halten, kein
`dangerouslySetInnerHTML` mit untrusted Daten), aber **kein Backstop**: schlüpft je ein
untrusted-HTML-zu-App-Origin-Pfad durch (vergessenes `sandbox`, ein `dangerouslySetInnerHTML`, oder
`print.ts` im Tauri-Pfad), ist der Script-Inject in einer Tauri-App command-/RCE-äquivalent.
**Wichtig:** `app.security.csp` härtet nur das Haupt-WebView und propagiert **nicht** in die opaken
Folien-Iframes — gegen S3 hilft es nicht.

**Fix:** Strikte CSP setzen, z.B. `default-src 'self'; script-src 'self'; style-src 'self'
'unsafe-inline'; img-src 'self' data: slideoasset:; media-src 'self' slideoasset:; font-src 'self'
data:; connect-src 'self' ipc:; frame-src 'self' data:`. HMR/Vite über `devCsp` lockern.

### S3 — Folien-Iframes ohne CSP → Deck-Exfiltration · **low**
`src/lib/renderer.ts` (`renderFullPage` Z.1213-1262)

`renderFullPage` joint alle Zonen in EIN Iframe-Dokument ohne CSP-Meta-Tag. Die Sandbox hält die
Isolation, schränkt aber `connect-src`/`img-src` nicht ein → eine bösartige HTML-Zone (A/C) kann per
`fetch`/`new Image().src`/WebSocket das gesamte Deck exfiltrieren. Bricht die Offline-Zusage, aber
reine Confidentiality ohne Sandbox-Escape; Ausnutzung eng. **Der tauri.conf.json-Fix wirkt hier
nicht.**

**Fix:** In `renderFullPage` einen restriktiven CSP-Meta-Tag in den Folien-`<head>` injizieren:
`default-src 'none'; img-src data: blob: slideoasset:; media-src data: blob: slideoasset:; font-src
data:; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'none'; object-src 'none';
base-uri 'none'; form-action 'none'`. `connect-src 'none'` killt Exfiltration; `script-src
'unsafe-inline'` bleibt nötig (HTML-Zonen-JS läuft bewusst). Standalone-Export ggf. lockerer.

### S4 — App-Origin-Editor parst KI/Datei-Markdown mit `html:true` · **low, ungeprüft**
`src/lib/tiptap-extensions.ts` (`Markdown.configure html:true`, Z.24-30) ·
`src/components/editor/TiptapEditor.tsx` (`setContent` Z.49-54)

**Vollständigkeits-Lücke — von keiner Dimension geprüft.** `tiptap-markdown` ist mit `html:true` +
`transformPastedText:true` konfiguriert, und `TiptapEditor` ruft `setContent(initialMarkdown, false)`
bei **jeder externen Inhaltsänderung** (MCP-Live-Edits über den unauth. Socket, `.slideo`-Load,
Snapshot-Restore). Dieser Pfad parst Markdown→HTML→ProseMirror im **App-Origin-Editor-DOM**, nicht im
Sandbox-Iframe. Markdown-Inhalt ist via B/C beeinflussbar. Wahrscheinlich mitigiert, weil
ProseMirrors schema-beschränkter DOMParser Nicht-Schema-Knoten (`<script>`, `on*`, `<iframe>`)
verwirft — **aber nicht verifiziert**. Bei `csp:null` (S2) wäre ein Durchschlupf RCE-äquivalent.

**Prüfung:** Im Tauri-Dev-Build eine Zone-Markdown über den IPC-Socket auf
`<img src=x onerror=alert(origin)>` + `<script>fetch(...)</script>` setzen, Zone fokussieren,
bestätigen dass nichts im App-Origin ausgeführt wird; gleiches für Paste. Falls doch: HTML-Blöcke
vor `setContent` sanitisieren oder `html:false`.

### S5 — Print-Iframe ohne sandbox · **low, latent**
`src/lib/print.ts` (Z.40)

Der einzige Iframe ohne `sandbox`; alle anderen 6 sind isoliert. Lädt rohes Deck-HTML same-origin.
**Heute konstruktiv nicht ausnutzbar** (läuft nur im `!isTauri()`-Zweig = reiner Browser-Dev, wo
keine Tauri-IPC-Bridge existiert). Latenter Footgun, falls je in den Tauri-Pfad verdrahtet.

**Fix:** `iframe.setAttribute('sandbox', 'allow-scripts allow-modals')` — oder die dev-only Funktion
entfernen. (Bei der GUI-Verifikation `renderPrintPage`, renderer.ts:1279, gegenlesen.)

### S6 — RMW auf `~/.claude.json` ohne Lock/atomares Schreiben · **low**
`src-tauri/src/mcp_registration.rs` (`write_json` Z.115-123, `reconcile` Z.354-367)

`std::fs::write` (nicht atomar), RMW ohne Lock, aus zwei Pfaden erreichbar. `~/.claude.json` ist eine
fremde, aktiv beschriebene Datei. Worst Case (paralleler `claude`-Schreiber + Crash): abgeschnittene
Drittdatei. Kein Threat-Model-Trigger; interner Race selbstheilend. Das bessere Muster existiert
bereits (`history.rs index_lock()`).

**Fix:** `write_json` atomar (temp + `fs::rename`); RMW über prozessweiten Mutex serialisieren.

### S7 — Decompression-Bomb + fehlende Entry-Caps · **low**
`src-tauri/src/file/reader.rs` (`read_to_string` Z.26, `read_assets` Z.43-62)

`read_*` ohne Cap; gemessen 51 KB → 50 MB (~1025:1) → bei 1 MB → ~1 GB → OOM. Erreichbar über
bösartige `.slideo` (A) und den unauth. Socket (B). `read_assets` ohne per-entry-/Total-/Count-Cap.
Positiv: **kein Zip-Slip**. Reiner DoS.

**Fix:** Pro Eintrag `entry.size()` gegen ~64 MB + `Read::take(MAX)`; Total-Cap (~256 MB) +
`archive.len()`-Limit.

### S8 — IPC: unbegrenzte Zeilenlänge + uncapped Verbindungen · **low**
`src-tauri/src/ipc.rs` (`BufReader::lines` Z.75-76, accept-Loop Z.58-69)

`next_line()` liest unbegrenzt → OOM; Tasks ohne Semaphore. Akteur B kann die App ohnehin trivial
crashen. **Fix:** Framing mit `read_until` + `MAX_LINE` (~4 MiB); optional Semaphore. (Das Token aus
S1 ist der wertvollere Schritt.)

### S9 — `open_print_view`: fester Temp-Name · **low**
`src-tauri/src/commands.rs` (Z.94-99)

`fs::write` folgt Symlinks. **Auf macOS nicht ausnutzbar** (`$TMPDIR` 0700); Linux-/tmp verlangt
zweiten bösartigen User (ausserhalb A-E). Nur Clobber, keine Code-Ausführung. **Fix:** `tempfile`
(O_EXCL, zufälliger Name) oder per-user-0700 + UUID.

---

## 3. Performance-Findings (priorisiert)

**Mess-Kontext:** `dist/assets` = 5,2 MB. `material-symbols-outlined.woff2` = **3.627.184 B (67%)**,
`index.js` = 1.337.130 B raw / 451.311 B gzip, `pptxgen.es` = 368 KB (bereits korrekt lazy).
Renderer-Mikrobenchmarks (Node): `resolveAssetRefs` 2,89 ms (8×293 KB), markdown-it ~0,5 ms/8 Folien
(kein Hotspot). PreviewPane 220-ms-Debounce; MCP-Sync 120-ms-Debounce. npm-audit Production: **clean**.

### P1 — Voller Material-Symbols-Font (3,63 MB) · **medium**
`src/main.tsx` (Z.6)

67% des Bundles für ~70-90 genutzte Glyphen. `font-display:block` → blanke Icon-Buttons bis
Dekodierung. Slide-Inhalt nutzt die Font nicht (Inline-SVG). **Fix:** `pyftsubset` mit Glyphenliste
aus **einer** zentralen TS-Konstante (statisch + dynamisch + `COMPONENT_ICONS`/Transitions-Maps —
sonst fehlen Komponenten-/Diagramm-Icons still!), **Variations-Achsen erhalten** (FILL/wght/GRAD/opsz);
eigenes `@font-face`; CI-Guard; `block→swap` als Sofort-Pflaster. Erwartung: <80-150 KB statt 3,63 MB.

### P2 — Vorschau setzt `srcDoc` komplett neu pro Edit-Settle · **medium**
`src/components/preview/PreviewPane.tsx` (Z.35-51, Z.199)

Bei jeder Änderung nach 220 ms voller Iframe-Reload: HTML-Reparse, Re-Decode aller inline-Bilder,
navScript+editScript (~37 KB) neu, Scroll-/Video-/Auswahl-Verlust (teuer per Reselect-Handshake
rekonstruiert). Debounce coalesziert Bursts; nur die Editier-Vorschau betroffen. **Fix:** (schnell)
Bilder über `slideoasset://` (P3); (mittel) Double-Buffer gegen Flackern; (gross) echtes In-Place-
Update — Iframe einmal laden, geänderte Zone per `postMessage`-innerHTML-Patch.

### P3 — Bilder immer als inline base64 · **medium**
`src/lib/renderer.ts` (`resolveAssetRefs` Z.83-92, `urlBase` nur video/audio Z.88-89)

Das `slideoasset://`-Protocol existiert, wird aber nur für Video/Audio genutzt. Ein 5-MB-Foto bläht
srcDoc um ~6,67 MB, pro Render neu gespleisst + vom WKWebView neu dekodiert. **Fix:** Protocol auch
für `kind==='image'` (inline nur für Standalone/Print), **gleichzeitig** Protocol-Handler cachen (P7).

### P4 — `resolveAssetRefs` O(Zonen × Assets) + `parseDataUri` über volle MB-base64 · **medium**
`src/lib/renderer.ts` (Z.83-93, pro Zone Z.1158)

Pro Zone wird die gesamte Asset-Map durchlaufen (`split/join`), `parseDataUri` captured die komplette
MB-base64 in eine **nie genutzte** Regex-Gruppe. Gemessen bis 42,8 ms (20×293 KB). **Fix:** eine
`/assets\/([\w.-]+)/g`-Regex + Map-Lookup (nur referenzierte Assets); `parseDataUri` header-only;
`kind`/`mime`/`replacement` pro Asset memoisieren.

### P5 — Tippen rendert alle ZoneCards neu · **medium**
`src/components/editor/EditorCanvas.tsx` (Z.21/29/51-53) · `ZoneCard.tsx` (kein memo)

`mutate()` erzeugt pro Keystroke neue presentation-Identität → EditorCanvas re-rendert, `sort()`
unmemoisiert, alle N nicht-memoisierten ZoneCards reconcilen. Reiner VDOM-Diff; bei 5-15 Folien
unmerklich, Lag erst bei 30-40 im WKWebView. **Fix:** `React.memo(ZoneCard)`; EditorCanvas mappt über
stabile id-Liste (`useMemo`), ZoneCard liest die Zone per `find`-Selektor; Handler via `useCallback`.

### P6 — §20-Op löst vollen srcDoc-Reload aus · **medium**
`src/components/preview/PreviewPane.tsx` (Z.35-51, Z.167-174)

Jedes Move/Delete/Duplicate kostet einen Voll-Reload (Debounce hilft nur beim Tippen); Re-Select erst
danach. Bounded, nicht auf dem Präsentations-Kritikpfad. **Fix:** wie P2 — gezielter
`postMessage`-Patch der einen Zone.

### P7 — `slideoasset://`-Handler dekodiert base64 pro Request · **low**
`src-tauri/src/lib.rs` (Z.42-66)

Pro Request: linear `find`, voller base64-Clone unter Lock, `decode`, kein Cache, kein Range.
Verstärker beim Video-Editieren. Voraussetzung vor P3. **Fix:** dekodierter Bytes-Cache
(`HashMap<String, Arc<Vec<u8>>>`), HashMap-Lookup, Range-Requests (206).

### P8 — Monolithischer 1,3-MB index-Chunk · **low**
`vite.config.ts` (Z.39-43) · kein React.lazy

Tiptap/CodeMirror/markdown-it/dnd-kit eager im Initial-Chunk, obwohl beim Kaltstart (EmptyState)
nicht gemountet. **Fix:** `manualChunks` + `React.lazy` für TiptapEditor/HtmlEditor/CssEditor + dnd-kit.

### P9 — Hover-Overlay ohne rAF · **low**
`src/lib/renderer.ts` (Z.936-942, `boxFor` Z.709-715)

`getBoundingClientRect` + 5 Style-Writes pro `pointermove`, ungedrosselt — während der gleichwertige
`reposition()`-Pfad bewusst rAF-koalesziert ist. Spürbar nur auf langsamer Hardware. **Fix:**
Hover-Pfad analog `reposition()` rAF-koaleszieren (~6 Zeilen).

### P10-P13 — Polish · **low**
- **P10** Voller `presentation.json`-Sync ohne Delta (`mcp-bridge.ts` Z.43-49): debounced 120 ms, nur Text → nicht spürbar. Fix: längeres Debounce (400-600 ms).
- **P11** Undo-History 50× `JSON.parse(JSON.stringify)` (`presentation.ts` Z.229): text-only, sub-ms. Fix: `structuredClone` (trivial).
- **P12** Asset-base64 doppelt im Speicher (`state.rs` Z.17): Rust-Mirror load-bearing für MCP-Saves. Fix: `Vec<u8>` intern, base64 nur an der IPC-Grenze.
- **P13** ZIP+base64 sync auf dem Command-Thread + Deflate auf Bildern (`commands.rs`/`writer.rs`): läuft auf IPC-Thread (UI friert nicht), Save selten. Fix: `CompressionMethod::Stored` für Assets, optional `spawn_blocking`.

---

## 4. Quick Wins (hoher Nutzen, kleiner Aufwand)

1. **Font subsetten** (P1) — ~3,5 MB / 67% des Bundles weg, sofortiger Icon-Paint.
2. **IPC-Socket-Token + `ipc.json` 0600** (S1) — schließt die gesamte 35-Tool-Fläche in einem Schritt.
3. **Bilder via `slideoasset://` + Handler-Cache** (P3+P7) — entfernt srcDoc-Bloat + repeated decode.
4. **`resolveAssetRefs` → eine Regex + `parseDataUri` header-only** (P4) — eliminiert O(Zonen×Assets).
5. **`React.memo(ZoneCard)` + pro-id-Selektor** (P5) — nur getippte Zone re-rendert.
6. **Strikte App-CSP + `sandbox` am print.ts-Iframe** (S2+S5) — billige Defense-in-Depth.

---

## 5. Offene / unverifizierte Punkte (Vollständigkeits-Kritik)

- **(höchste Prio) App-Origin-Editor-XSS-Senke** — `tiptap-markdown html:true` via `setContent` (S4) ist **ungeprüft**. Im Tauri-Dev-Build mit `<script>`/`onerror`-Payload + Paste bestätigen.
- **Kein echter RUSTSEC-Scan** — `cargo audit` nicht installiert; Rust-Dep-Tree (tauri 2.11.2, wry 0.55.1, tao 0.35.3, tokio 1.52.3, zip 2.4.2 …) nur per Sichtung gegengelesen. Empfehlung: `cargo install cargo-audit && cd src-tauri && cargo audit`.
- **`print.ts` Render-Pfad** (`renderPrintPage`, renderer.ts:1279) — vom S5-Finding genannt, nicht gelesen; bei GUI-Verifikation prüfen.
- **Cross-Window Tauri-Event-Kanal** (`slideo:nav`/`slideo:projector-ready`/`slideo:deck-changed`) — zweite IPC-Oberfläche, ungeprüft. Impact niedrig (Payload nur Nav-Index/Step). `projector.json` `core:event`-Grant + Bounds-Clamping verifizieren.
- **Perf ausserhalb PreviewPane** — `SlideOverview` instanziiert **ein Iframe pro Folie** (O(N), wahrscheinlichster Thumbnail-Grid-Cliff); `ProjectorView`s `useMemo` re-rendert **ohne Debounce**. 50/100-Folien-Deck messen.
- **Capability-Gating** von `export_html`/`export_pptx`/`open_print_view` (`commands.rs` Z.84-111) — `capabilities/default.json` lesen.

## 6. Widerlegt / als sicher bestätigt

- **Widerlegt:** `export_html/pptx ohne Pfad-Prüfung` (geht in S1/Capability-Prüfung auf); `scopeCss als zeichenweiser JS-Parser` (kein Render-Hotspot).
- **Korrekt mitigiert** (nicht erneut auditieren): `components.rs` `esc()`/`safe_color()`/`with_data_id()` (Text-Content-Interpolation, Attribute allowlisted, Tests); `history.rs` (`valid_id` + `index_lock`); `dom-edit.ts` `sanitizeInline` (rekursive Allowlist auf detached DOMParser-Doc); `.slideo`-Asset-Extraktion (in-memory, exakter Name → **kein Zip-Slip**); `mcp.rs` Prompt-Handling.
- **Deps:** Production-Runtime npm-audit **clean**; vite (high) + esbuild (moderate) sind **dev-only**; `pptxgenjs` zieht ein leeres `https@1.0.0`-Placeholder, das nie gebundelt wird.
