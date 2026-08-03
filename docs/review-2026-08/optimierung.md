## A. Das Urteil in zehn Zeilen

1. Slideo ist kein Präsentations-Editor mit KI-Feature, sondern **ein lokaler MCP-Server mit angeschlossenem Editor** — 37 semantische Tools gegen Googles 2 (`developers.google.com/workspace/slides`) und Slidevs 8, in einer laufenden GUI mit autoritativem State, ohne OAuth, ohne Cloud, ohne Credits.
2. Der verteidigbare Boden ist genau eine Schleife: **die KI bedient ein Designsystem, der Mensch korrigiert live darüber** (§20/§18.1). Kein KI-nativer Wettbewerber versucht das — deren beschnittene Leinwand ist geschäftsmodell-tragend (Gamma deckelt Pixel-Kontrolle ausdrücklich).
3. „Deine KI baut das Deck" ist als Verkaufsargument **tot**: Gamma (23.01.2026), Google (13.07.2026), Microsoft (15.07.2026) und Slidev (10.07.2026) sind innerhalb eines Quartals in den MCP-Kanal eingezogen.
4. Was bleibt, ist die zweite Hälfte des Satzes — und die hat heute **keinen Boden**: vier unabhängige Reviewspuren fanden vier Wege, wie ein echtes Kundendeck verschwindet (B1, B3, B4, B7), jeder endet mit einem grünen „Gespeichert."-Toast.
5. Das Produkt ist an mehreren Stellen **ehrlich kaputt statt unfertig**: `savePresentation` meldet Erfolg über einem Datenverlust (B2/B3), `addFont` zeigt roten und grünen Toast gleichzeitig (M54), `validate_deck` meldet „0 Probleme" für ein Deck, dessen Folien es selbst gerade als überlaufend eingestuft hat (H5b, CONFIRMED).
6. Die Auslieferung ist ungebaut: `POLAR_ORG_ID = "REPLACE_WITH_…"` (license.rs:30-31) macht Tag 31 zu einer Sackgasse **ohne Kaufweg** (B9, CONFIRMED); es gibt keine Signierung/Notarisierung — Homebrew deaktiviert Gatekeeper-durchfallende Casks am **01.09.2026**, also in vier Wochen.
7. Die riskanteste Codestelle hat das schwächste Netz: ~1100 Zeilen untypisiertes Template-Literal-JavaScript (S3), kein JS-Testrunner (S37) — und **genau dort** sitzen H16, H17, M28, M31.
8. Der Markt bestätigt die These und benennt die Lücke präzise: PresentBench (arXiv 2603.07244) misst „Visual Design & Layout" als schlechteste Dimension über **alle** Systeme (bester Wert 62,8/100) — und Slideo ist der einzige Anbieter, der jede Folie bereits in echten 1280×720 im Fenster rendert, diese Wahrheit aber **niemandem** zeigt (H5c: `grep check_zone_overflow src/` = 0).
9. Präsentation/Delivery ist an oder über Parität mit Figma Slides und über dem gesamten KI-nativen Feld — und wird nicht verkauft, während ein Klick auf die Folie die Presenter-Tastatur stilllegt (B10, CONFIRMED).
10. **Der eine Satz, der entscheidet, was als Nächstes gebaut wird:** Jede Aktion, die schreibt, muss entweder gelingen und das sagen, oder scheitern und das sagen — bis das gilt, ist jedes Keil-Feature verschwendete Arbeit, weil der Rezensent bei Cmd+Shift+Z aufhört, lange bevor er §20 findet.

---

## B. Wo Slideo im Markt steht — nach Ebenen

| Ebene | Stand | Evidenz (eine Zeile) |
|---|---|---|
| **Generierung** (Prompt → Entwurf) | **nimmt nicht teil — ökonomisch vorne, narrativ wertlos** | Kein AI-Layer (CLAUDE.md Regel 3); Entwurf kommt aus dem bezahlten Frontier-Modell des Nutzers ⇒ null Grenzkosten gegen Gammas Credit-Modell, aber „deine KI baut das Deck" sagen 2026 alle. |
| **Nachbearbeitung / Editing** | **vorne im Konzept, hinten in der Mechanik** | §20-Direktmanipulation ist konkurrenzlos (Slidevs `v-drag` gibt eigene Unzuverlässigkeit zu) — aber sie ist in Split-Folien komplett tot und der Resize-Griff erscheint trotzdem und verwirft die Änderung still (H16, CONFIRMED, empirisch nachgestellt). |
| **Editor-Grundmechanik** | **klar hinten — hier fällt das Urteil** | Kein Redo (H1, `grep redo src/` = 0), kein Folie-Duplizieren (H2), kein Autosave (B4, exakt ein `setInterval` im Repo: die Presenter-Stoppuhr), 4 globale Shortcuts gegen PowerPoints 50–80. |
| **Design-System / Marke** | **Parität mit Lücken an beiden Enden** | 11 Tokens, für Mensch **und** KI schreibbar + Token-Pflicht für Komponenten = echte Anti-Slop-Mechanik; aber kein Ingest (MS zieht seit 15.07.2026 das Kit aus einem Guidelines-Dokument) und kein Checker (MS Brand Reviewer). |
| **Präsentation / Delivery** | **über Parität mit dem gesamten KI-nativen Feld, unterverkauft** | SpeakerView + Sprung-Grid + `auto`-FLIP-Morph, das den Standalone-Export überlebt (Gamma entfernt beim PPTX-Export alle Animationen); Gamma lieferte die Presenter-Zoomstufe erst 06/2026. Selbstverschuldet: Laser/Stift im Zwei-Fenster-Modus aus (M36), kein Vollbild (H25). |
| **Export / Interop** | **architektonisch richtig, in Details unvollständig, kein Import** | Nativ editierbares PPTX ohne LibreOffice ist der stärkste verifizierbare Vorsprung (Slidev bild-basiert, Marp braucht Impress) — aber Split-Folien verlieren ihre Bilder (H21), jede HTML-Folie trägt „HTML-Folie — in PPTX vereinfacht" ins Kundendeck (H22), keine Notizen (H6). |
| **Kollaboration** | **draußen, korrekterweise** | Kein Backend ⇒ strukturell unerreichbar; das einzige, was sonst niemand hat, ist **Mensch + Agent live am selben Deck** — heute abgesichert durch einen 400-ms-Debounce ohne maxWait (B7, CONFIRMED). |
| **Plattform-Bündelung** | **kann nicht mitspielen — Verteidigung ist explizit nicht-Enterprise** | Copilot Agent Mode GA+Default seit 22.04.2026; Claude Design × Canva seit 16.04.2026 greift exakt die Zielgruppe an. Gegenargument mit Beleg: Office-Bug vom 18.02.2026 (vertrauliche Mails gegenüber Copilot offengelegt). |
| **Infrastruktur / MCP** | **Tiefe vorne, Distribution hinten** | 37 domänengeformte Tools gegen 2 rohe (Google) — aber kein `.mcpb`, keine Registry, kein Generic-Client-Pfad (H4: viermal „beliebiger MCP-Client" versprochen, `desktop|meta|claude` implementiert), keine Verbindungsanzeige (B8), kein Neustart-Hinweis (B6, `grep restart` = 0). |
| **Auslieferung / Geschäftsmodell** | **der eigentliche Engpass** | Keine Signierung/Notarisierung, kein Auto-Updater, deutsche UI gegen ausnahmslos englische Kanäle (67 von 68 `.tsx`) — und `POLAR_ORG_ID` ist ein Platzhalter (B9). $99 Apple Developer Program ist der billigste Freischalter im ganzen Plan. |

---

## C. Die Optimierungsliste

Aufwandsskala: **XS** < ½ Tag · **S** ½–2 Tage · **M** 3–8 Tage · **L** 2–3 Wochen · **XL** > 3 Wochen.
„3 Spuren" = alle drei Vorschlagstracks haben denselben Eingriff unabhängig vorgeschlagen — **das sind die belastbaren.**

### Block 0 — Nicht auslieferbar ohne das

Hier steht nichts, was ein Feature wäre. Fünf unabhängige Pfade enden mit einem grünen Erfolgs-Toast über echtem Datenverlust (B1, B2, B3, B4, B7), ein sechster mit einer App, die an Tag 31 dauerhaft schreibgeschützt ist und **beide** Kaufknöpfe deaktiviert (B9), und ein siebter damit, dass ein Homebrew-Cask ab 01.09.2026 nicht mehr listbar ist. Zusammen sind das weniger Arbeit als ein einziges Roadmap-Feature — aber es ist der Unterschied zwischen „unfertiges Projekt" und „ernstes Werkzeug". #1 steht bewusst vor allem anderen: drei Eingriffe dieses Blocks fassen die untypisierten Iframe-Skripte an, in denen ein rohes `\n` schon einmal den kompletten Overlay zur Laufzeit tötete, während der Build grün blieb.

| # | Maßnahme | Behebt | Aufwand | Wirkung | vereinfacht? |
|---|---|---|---|---|---|
| 1 | **`node --check` als Pflicht-Build-Step über die 4 evaluierten Iframe-Skripte + Vitest mit 5 reinen Funktionen** (`splitMarkdownBlocks`, `classifyPreviewChange`, `applyElementOp`, `scopeCss`, `parseBlocks`) + 3 Spiegel-Assertions (`DEFAULT_TOKENS` TS↔Rust, `PRESETS` TS↔Rust, `safeGoto`↔`safe_goto`) | S3, S37, S10 | S | hoch | ja — **3 Spuren** |
| 2 | **„Neue Präsentation" über `pickSavePath()` statt selbstgebautem Pfad**; `newPresentation` gibt `boolean` zurück, `create()` prüft ihn (`NewPresentationModal.tsx:61-67`) | B1, H14 | S | kritisch | ja |
| 3 | **Lizenz-Sackgasse unmöglich machen:** `!configured()` ⇒ `license::compute` emittiert nie read-only (license.rs:217-236); echte Polar-Werte + Release-Test `assert!(configured())`; `license.ts:load()` fail-closed **innerhalb** Tauri statt still `state:'licensed'` | B9, S27 | XS | kritisch | nein |
| 4 | **`Effect`-Enum in EINEM Zug neu entwerfen:** `Opened{path, assets}` (+`file::read_assets` in `tools.rs open_presentation`), `Saved(path)`, `zone_ids` an `Presentation`; neue Events `mcp:opened`/`mcp:saved`; Store-Actions `applyExternalOpen`/`applyExternalSave` | **B3(a–d)**, M5, S14, S36, Vorarbeit S2 | M | kritisch | ja — **3 Spuren** |
| 5 | **Flush-Handshake vor jedem nicht-read-only-Tool** (`ipc.rs` emittiert `slideo:flush-sync`, wartet ≤250 ms auf vorrückende `rev`; Bridge synct sofort). Sofort-Deckel vorab: `maxWait` im Debounce (`mcp-bridge.ts:43-51` hat heute **keinen**) | **B7** | M | kritisch | nein — **3 Spuren** |
| 6 | **Idle-Autosave (3 s idle / 30 s maxWait, `silent`-Flag) + Recovery-Sidecar** `<config>/slideo/recovery/<uuid>.slideo` für pfadlose KI-Sitzungen + Wiederherstellen-Angebot beim Start | **B4** | M | kritisch | nein — 2 Spuren |
| 7 | **`mutate` gibt `boolean` zurück**; Editoren werden wirklich `editable:false` (Tiptap `setEditable`, CodeMirror-`Compartment`); Gate an `undo`, `restoreSnapshot`, `addAssetToLibrary`, `removeAsset`; Asset-Schreibung **hinter** erfolgreiches `mutate`; `docs/licensing.md:11` an die eigene Tabelle angleichen | **B2**, H14, M54, M20, S11, S28 | M | kritisch | ja — **3 Spuren** |
| 8 | **`@tiptap/extension-link` nachrüsten** (`autolink:false`, `openOnClick:false`) + falschen Kommentar `tiptap-markdown.ts:16-23` korrigieren + Round-Trip-Test | B5, S31 | XS | hoch | nein — 2 Spuren |
| 9 | **`isImg` an einen committierbaren Kontext binden** (`renderer.ts:708-713`: `&& (el.closest('.slideo-zone-html') \|\| el.closest('.slideo-block'))`) — beendet den stillen Verlust-Edit in Split-Folien | H16 (Teil 1) | XS | hoch | ja — 2 Spuren |
| 10 | **`catch_unwind` um `tools::handle` + `PoisonError`-Recovery** — ein Panic vergiftet heute drei Mutexe und legt MCP **und** Speichern bis zum Neustart lahm | S12 | XS | hoch | nein |
| 11 | **Signierung + Notarisierung (macOS), Windows-Signaturpfad, `tauri-plugin-updater`** — Homebrew deaktiviert Gatekeeper-durchfallende Casks am 01.09.2026 | Markt §6.6 | M (+ Wartezeit) | kritisch | nein |
| 12 | **Toten Code und Falschangaben löschen:** „35 Tools"→Laufzeitwert, TODO-Sektion in Settings, Claude-verengtes About, `APP_VERSION`-Hardcode, `templateLabel` (kein Aufrufer), `ControlButton.hasPopup/expanded`, `src/lib/print.ts` | M1, M2, M64, S30, S40 | XS | mittel | ja — 3 Spuren |

### Block 1 — Table Stakes, an denen das erste Urteil hängt

Der Marktreport ist eindeutig: „Das erste Urteil fällt an der langweiligen Mechanik, nicht am Keil." Jedes Feature in diesem Block ist in PowerPoint, Keynote, Slides, Canva, Figma **und** Beautiful.ai vorhanden und in Slideo im Repo verifiziert nicht vorhanden. Fehlendes Redo ist in einer KI-Authoring-App doppelt teuer, weil der Nutzer permanent KI-Änderungen zurücknimmt — und weil eine KI-Runde heute 50–150 Undo-Schritte erzeugt statt einem (H29). #13 steht oben, obwohl es kein Datenverlust ist: ein Klick auf die Folie legt vor Publikum die gesamte Presenter-Tastatur still, und der Refokus-Aufruf, der das auffangen soll, ist per Capability gar nicht erlaubt und wird stumm geschluckt (H26, CONFIRMED).

| # | Maßnahme | Behebt | Aufwand | Wirkung | vereinfacht? |
|---|---|---|---|---|---|
| 13 | **Tastatur-Brücke aus dem Audience-Iframe** (`navScript` postet `slideo:key` an den Parent, `onKey`→`handleKey`) + `core:window:allow-set-focus` **und** `allow-set-fullscreen` in `capabilities/default.json` + Vollbild-Mount-Effect | **B10**, H25, H26 | S | hoch | nein — 2 Spuren |
| 14 | **Redo:** `future`-Stack neben `past`, Cmd+Shift+Z, `slideo:redo`-Forward aus dem Iframe; `future` in `mutate`/`applyExternal*`/`load`/`new`/`restoreSnapshot` leeren | **H1** | S | hoch | nein — 3 Spuren |
| 15 | **Undo-Granularität:** Tipp-Checkpoints (Push nach ~800 ms Tippstille oder Zonenwechsel) + KI-Runden-Koaleszenz in `applyExternalPresentation` (~1,2 s) + `updateZoneLabel`/`setToken` auf `recordHistory=false` | H28, H29, S6 | S | hoch | nein — 3 Spuren |
| 16 | **Folie duplizieren** (`duplicateZone` + Cmd+D + MCP-`duplicate_zone`, neue UUIDs!) · **Löschen mit Confirm** · **Einfügen an Position** (`createZone(activeZoneId)`) · Modul-Klemmbrett für Cmd+C/V | H2, M3, M60 | S | hoch | nein — 3 Spuren |
| 17 | **„Speichern unter…" (Cmd+Shift+S + Topbar) + Deck-Titel inline umbenennbar** (`setPresentationTitle` über `mutate`, gleiche Semantik wie das MCP-Tool) | H7, H8 | S | mittel | nein — 2 Spuren |
| 18 | **MCP sichtbar machen:** `last_seen`/`last_tool` im AppState + Topbar-Chip „zuletzt vor N s" · Erfolgspanel „Starte jetzt \<Ziel\> neu, dann frag: …" · Connect-/Read-Timeouts in `client_request` (Muster steht in `mcp_registration.rs:72-75`) · Versions-Handshake `client_version` | **B6, B8**, M14, M15, M16 | M | hoch | nein — 2 Spuren |
| 19 | **Karte „Anderer MCP-Client":** `status()` gibt `desired_entry(&exe)` zurück, Frontend zeigt kopierbares `{"mcpServers":{"slideo":{"command":…,"args":["mcp"]}}}` — registriert nichts, hebt die 3-Client-Decke praktisch kostenlos auf | **H4**, S33 | S | hoch | ja — 2 Spuren |
| 20 | **Overflow für den Menschen messen:** `sldCheckFit()` in `navScript` (nach `sldFit()`, `resize`, `document.fonts.ready`) vergleicht `getBoundingClientRect()` von `.slideo-content` gegen `.slideo-zone` — **nicht `scrollHeight`** (zentriertes Flex läuft auch nach oben über) → Warn-Outline + `slideo:overflow`→ZoneCard-Badge, abschaltbar | **H5(c)** | S | hoch | nein — **3 Spuren** |
| 21 | **`validate_deck` meldet Zonen mit *irgendeinem* Issue** (+ `fits`-Feld, damit die KI hartes Clipping von Safe-Area-Rat trennt); Heading-**Breiten**-Falschpositiv streichen (Überschriften umbrechen); HTML ohne Inline-Geometrie ⇒ `fits: null, measured: false` statt erfundenem `true` | **H5(b)**, S4 (Teil) | XS | hoch | ja — 2 Spuren |
| 22 | **PPTX-Trio:** Redaktionsstempel „HTML-Folie — in PPTX vereinfacht" ersatzlos raus (`pptx.ts:254-259`) · `slide.addNotes(zone.notes)` · `extractImages`/`addImageRow` im Split-Zweig (`pptx.ts:279-298`) | H22, **H6**, H21 | XS | hoch | ja |
| 23 | **Assets ins Undo-/Dirty-/Lizenz-Modell heben:** `past`/`future` auf `{presentation, assets}` (Asset-Map als **Referenz**, kein Deep-Clone), `removeAsset`/`addAssetToLibrary` über `mutate`, Löschen mit Referenzzählung + Confirm, History-Dedupe-Key an die Snapshot-Nutzlast angleichen | **H3**, M53, M54, S1, S9 | M | hoch | ja — 3 Spuren |
| 24 | **`normalizePresentation` an allen drei Deck-Eingängen** (`loadPresentation`, `applyExternalPresentation`, `restoreSnapshot`) — nur auffüllen/klemmen/sortieren, **nie verwerfen** (Vorwärtskompatibilität ist Kernentscheidung) + `version`-Major-Check + `ErrorBoundary` um `EditorShell` | M49, M50, S8 | S | mittel | ja — 2 Spuren |
| 25 | **Zuletzt geöffnet (max 8) + `fileAssociations` für `.slideo` + Öffnen-Dialog mit `defaultProjectDir` vorbelegt**; `settings.ts` bekommt dabei `version`/`migrate` | M22, S29 | S | mittel | nein |
| 26 | **Editor-Canvas: nur die aktive Folie ist ein Editor**, alle anderen eine `ZoneRow` (Nummer, Label, Textvorschau, Drag-Handle, „+ darunter") — bringt Deck-Überblick zurück **und** löst das Windowing-Problem, ohne die gelöschte Folienliste wiederzubeleben; Auswahl-Border **vor** `isHtml`-Border prüfen | **H13**, S22, M59, M60 | M | hoch | ja — 2 Spuren |
| 27 | **Topbar von 14 auf 6 Elemente + EIN Export-Dialog**, der pro Format einen Satz Wahrheit über den Treuegrad zeigt (HTML ≫ PDF ≫ PPTX); „Teilen" ersatzlos streichen (heißt an zwei Stellen Verschiedenes) | M55, H24, Erkenntnis 9 | S | hoch | ja |

### Block 2 — Den Keil schärfen

Alles hier ist etwas, das die Konkurrenz strukturell nicht kopieren kann, weil sie weder ein echtes Layout im Fenster noch einen bidirektionalen Live-Kanal hat. #28 ist der Kernbeweis des Produkts: der Markt hat Layout nicht gelöst (PresentBench 62,8/100), Slideos Detektor ist die **schwächste** Ausprägung im Feld (`overflow.rs` zählt Quellzeilen ohne Umbruchmodell, liest weder `padding` noch `custom_css`, summiert Split-Spalten statt zu maximieren, sieht im HTML-Pfad nur Inline-`style=` ⇒ 40 Fluss-`<p>` = „passt") — und Slideo ist der Einzige, der die Wahrheit bereits rendert. Wichtig: die Messung ist für den **Menschen** billig (#20, Block 1), für die **KI** teuer und ehrlich zu deklarieren (#28), weil die Vorschau eingeklappt/unmounted sein kann.

| # | Maßnahme | Behebt | Aufwand | Wirkung | vereinfacht? |
|---|---|---|---|---|---|
| 28 | **Messkanal Iframe→Rust:** `slideo:measure` → Store-Slice `measure.ts` (**nicht** ins `presentation`-Objekt) → neues Command → `AppState.measurements` **mit Inhalts-Hash**; `overflow::analyze` bevorzugt frische Messung und meldet `"source": "measured" \| "heuristic"`, `measured:false` wenn keine da ist | **H5**, S4 | L | kritisch | ja — 3 Spuren |
| 29 | **Auto-fit mit hartem Font-Minimum** über `--slideo-fit` als Schriftgrößen-Multiplikator (**niemals `transform:scale()`** — das führte einen zweiten Faktor neben `--slideo-scale` ein und bräche jede §20-Pixelrechnung); deck-weit `meta.autofit`, additiv; muss auch in `renderPrintPage`/`renderSingleZonePage` laufen | Markt St.1 #1 | M | hoch | nein |
| 30 | **`add_asset(path)`** (lokaler Dateipfad, MIME-Allowlist, Größen-Cap, sichtbarer Toast) + **`list_assets` um `width`/`height`/`bytes`** — schließt „KI-Decks sind reiner Text" ohne die „keine Binärdaten über MCP"-Haltung aufzugeben | Markt St.1 #3, M65 | M | hoch | nein |
| 31 | **Komponenten-Parameter typisieren:** JSON-Schema statt Prosa-String; `items()` wirft **Fehler** bei übergebenen aber unerkannten Keys (Platzhalter nur ohne params); Kürzungen als `warnings` melden statt still; Test Rust-Katalog ↔ die drei TS-Maps | **H20**, M11, S24, L7 | M | hoch | ja |
| 32 | **`create_presentation(force)`** — ohne Flag ablehnen, solange ein Deck offen ist (heute zerstört genau der kopierbare Onboarding-Prompt das gerade konfigurierte Deck) + **„speichern" in `server_instructions`/`build_guide` lehren** („do NOT invent a filesystem path") | **H15**, M13 | S | hoch | nein |
| 33 | **Split-Direktmanipulation echt freischalten:** spaltenbewusste `.slideo-block`-Wrapper mit `+++`-versetztem `data-block-index`, `cbWidthOf` auf `.slideo-col` (heute doppelte Schrumpfrate), `imgIndex` im Store ehren | H16 (Teil 2), H17 | M | hoch | nein — 2 Spuren |
| 34 | **`apply_slides(slides[], mode)` + `create_zone` vervollständigen** (`content_type`, `style`, `notes`, `reveal`, `custom_css`) — ein 15-Folien-Deck kostet heute 60+ Roundtrips; **kein** generisches `batch(ops[])` (zweite Dispatch-Ebene macht Annotationen und Lizenz-Gate unscharf) | M6 | M | mittel | ja |
| 35 | **Tool-Annotationen** (`readOnlyHint` aus `is_read_only_tool` — kein zweiter Wahrheitsort — `destructiveHint`, `idempotentHint`, `openWorldHint:false`) + `title` je Tool + Test über alle 37 Namen; Pflicht fürs Anthropic Connectors Directory | M12 | XS | mittel | ja |
| 36 | **Agenten-Provenance:** `zone_ids` aus #4 → UI-Slice `changedByAi` mit TTL → dezenter Puls auf ZoneCard + Topbar-Zeile „KI hat Folie 4 geändert" (reine Laufzeit-UI, **nicht** ins Schema) | Markt St.2 #12 | S | mittel | nein |
| 37 | **Plan-Freigabe als Instruktion**, nicht als Panel: `build_guide` Schritt 0 „present the slide-by-slide outline in chat and WAIT for approval" — kostet nichts, kein `meta.plan`, keine Schema-Mutation pro Planschritt | Markt St.1 #5 | XS | mittel | ja |
| 38 | **Marke: Ingest als Prompt-Muster + `check_brand_compliance()`** (Rust-Textscan auf `#rrggbb`/`rgb(`/`font-family:`-Literale außerhalb `var(--…)`, mit Allowlist für `transparent`/`currentColor`/Alpha-Schwarz) — Ingest erbt gratis den Fetch/Browser-Stack des Nutzer-Clients | Markt St.1 #4 | M | mittel | nein |

### Block 3 — Vereinfachen & Schulden tilgen

Slideo hat nicht zu wenige Funktionen, sondern zu viele Dinge doppelt — und in den Dopplungen sitzen die bestätigten Bugs: zwei Layout-Modelle (#28), zwei Öffnen-Implementierungen (#4), zwei Historien (#23), zwei Markdown-Parser (#43), vier Render-Einstiege mit Ad-hoc-CSS (#39/#40), zwei Wahrheiten über die Folienreihenfolge (#42), vier Vokabeln für dasselbe Objekt (#47). Jede Zeile hier entfernt Code **und** eine Fehlerklasse. #39 ist eine einzelne Zeile mit der besten Rendite im Dokument.

| # | Maßnahme | Behebt | Aufwand | Wirkung | vereinfacht? |
|---|---|---|---|---|---|
| 39 | **`urlBase` an `renderSingleZonePage` durchreichen** — heute inlinen alle Thumbnails **jedes** Asset als base64 und werden dann als `data:text/html` URL-kodiert, während die Präsentation daneben über `slideoasset://` streamt | **H23**, S17 | XS | hoch | ja |
| 40 | **Vertikalrhythmus: Kantenregeln statt Rhythmus-Ersatz** — `.slideo-block`/`.slideo-fragment`-Margins durch `:first-child`/`:last-child`-Regeln ersetzen. **Korrektur zur Vorlage:** die Vorschau flacht *nicht* alles auf 0,75em ab (der Drag-Handle stiehlt `:first-child`, Heading-Margins überleben); die echte Drift ist ~8 px — der 47-px-Fall ist `.slideo-fragment` (renderer.ts:317-319), und dort ist die **Vorschau höher** als die Präsentation | H18 (korrigiert), M33 | XS | mittel | ja — 2 Spuren |
| 41 | **Toggle „Bearbeiten" → „Direktbearbeiten"** umbenennen (deckungsgleich mit seinem eigenen Tooltip) + Löschen-Shortcut zusätzlich auf `Backspace` außerhalb von `contenteditable`/Inputs (die physische Löschtaste eines MacBooks meldet `'Backspace'`) | M28 (echte Hälfte), M31 | XS | mittel | ja |
| 42 | **`zone.order` als zweite Wahrheit streichen** — genau einmal beim Laden sortieren, danach Array autoritativ; `renumber()` und die Renormalisierung in `tools.rs:115-119` löschen; `order` beim Schreiben aus dem Index ableiten (**kein** Formatbruch) | S7 | S | mittel | ja |
| 43 | **PPTX auf markdown-it + `splitMarkdownBlocks` umstellen** — ein Parser statt zwei; behebt Tabellen, `####`, verschachtelte Listen, Referenzlinks, Hyperlinks strukturell statt Feature für Feature | S19, M45 | M | mittel | ja |
| 44 | **Meta-MCP-Ziel löschen** (`meta_http`/`meta_register`/… = der gesamte handgerollte HTTP-Client über std-TCP) und `desktop`/`claude` zu **unabhängigen Schaltern** machen; Meta-MCP-Nutzer bedient künftig #19 | M63, S33 | M | mittel | ja |
| 45 | **`postMessage`-Herkunftsprüfung** (`e.source === iframe.contentWindow`) in PreviewPane/PresentationMode/ProjectorView + `ipc.json` beim Exit löschen | S15, S32 | XS | mittel | nein |
| 46 | **Ordentliches Modal-Primitive** (Focus-Trap, Scroll-Lock, Initialfokus, Confirm-on-Dismiss, Größenkonvention) — `CropModal` umgeht das heutige komplett | M4, M56, S26 | S | mittel | ja |
| 47 | **Ein Vokabular für die Oberfläche** — „Folie" überall (nicht Slide/Zone/Deck gemischt), Schnappschuss statt Snapshot, `docs/wording.md` als Vertrag. Sprachwahl siehe Entscheidung E2; der Diff kollidiert mit allem, daher **zuletzt** | M58, S25 | XL | hoch | ja |

### Bewusst nicht

| Vorschlag | Warum nicht |
|---|---|
| **`savePresentation` im read-only-Zustand gaten** | Adversarial **widerlegt**: Speichern/Öffnen/Exportieren stehen bewusst auf der MCP-Allowlist (`tools.rs:145-146`) und sind in `docs/licensing.md:83` so dokumentiert. Gaten würde zusätzlich den CloseGuard in eine Schleife schicken. Stattdessen: den widersprüchlichen Prosa-Satz `docs/licensing.md:11` an die eigene Tabelle angleichen. |
| **Sprechernotizen in HTML-/PDF-Export schreiben** | Widerlegt für diese Formate: es gibt dort keinen versteckten Notizkanal — die Notizen landeten **sichtbar** auf der Folie und würden in geteilten Decks leaken, entgegen der eigenen MCP-Zusage (`tools.rs:972`). Nur PPTX hat `addNotes()` (#22). Ein Notizen-Handout wäre ein eigenes, opt-in Feature. |
| **Die `data-slideo-goto`-Unterdrückung im Direktbearbeiten-Modus „reparieren"** | Kein Defekt, sondern Design: ein Klick kann nicht gleichzeitig selektieren und navigieren. In Präsentation, Projektor und Standalone funktionieren die Links unverändert. |
| **Den `previewEdit`-Toggle ganz abschaffen** (Track 3) | Die Begründung „lügt in beide Richtungen" ist zur Hälfte widerlegt; abschaffen würde §23-Links in der Vorschau dauerhaft hinter einen Modifier zwingen. Stattdessen #41 (umbenennen) — XS statt S, gleiche Ehrlichkeit. |
| **Vorschau auf `editable:false` umstellen**, um den Rhythmus anzugleichen | Killt die Direktmanipulation — also den Produktkeil. #40 löst dasselbe mit CSS. |
| **Voller Merge-/CRDT-Layer für den MCP-Sync** (`base_rev` + zonenweiser Merge) | Die Nahtstelle ist ein Einzelnutzer plus ein Agent. Der Flush-Handshake (#5) beseitigt die Ursache; ein Merge-Layer wäre die zehnfache Arbeit für den Rest. |
| **Headless-Browser oder `render_slide_png` für die Overflow-Messung** | `foreignObject`→Canvas verseucht im WKWebView das Canvas (dokumentiert, deshalb ist PPTX nativ rekonstruiert). Das Vorschau-Iframe misst dasselbe zum Nulltarif (#20/#28). |
| **Bild-basierter PPTX-Export** | Gleicher Canvas-Taint; und die native Rekonstruktion ist der stärkste verifizierbare Marktvorsprung (Slidev bild-basiert, Marp braucht LibreOffice). |
| **Iframe-Skripte jetzt zu echten `.ts`-Modulen auslagern** (S3, XL) | Richtig, aber der riskanteste Umbau am ungetestetsten Code. #1 (`node --check` + Vitest) holt den dokumentierten Fehlermodus für ~5 % der Kosten. Nach Stage 5 wieder aufrufen. |
| **`meta.plan`-Panel für die Agenten-Schrittliste** | Macht jede Planaktualisierung zu einer Deck-Mutation (Sync, Snapshot, Undo). Die 90 % des Nutzens liegen in der Instruktion (#37); die Provenance-Anzeige liefert #36 ohne Schema-Eingriff. |
| **Share-Links, Multiplayer/Kommentare, Mobile-Editing, Multiplex, Deck-zu-Video, Speaker Coach** | Auf jedem bezahlten Cloud-Tarif Table Stakes und für eine Backend-lose lokale App strukturell unerreichbar. Gehört in eine FAQ mit den ehrlichen Substituten (Standalone-HTML, teilbares Projektor-Fenster), nicht in die Roadmap. Einzige Ausnahme mit gutem Verhältnis: **LAN-Fernbedienung fürs Handy** — Socket und Event-Bus existieren bereits; für v1.1 parken. |

---

## D. Reihenfolge

**Stage 1 — Netz spannen und die Blutung stoppen** (≈ 5–7 Tage) · #1, #2, #3, #8, #9, #10, #12
Beginnt mit dem Testnetz, weil #9, #20, #13 und #33 alle in `renderer.ts` schreiben und der dokumentierte Fehlermodus dort ein grüner Build mit totem Overlay ist. Danach nur XS/S-Eingriffe mit maximaler Verlust-Reduktion: der Save-Dialog beendet B1 komplett, die drei Zeilen in `license.rs` machen eine 30-Tage-Bombe unmöglich, die Link-Extension stoppt einen aktiven stillen Datenzerstörer, `catch_unwind` deckelt den Blast-Radius für alles Folgende.
**Warum nicht früher an die Schleife?** Weil #5 und #6 `process_request` async machen und Autosave in einen falsch adressierten Pfad schreiben würde, solange B3 offen ist — Reihenfolge ist hier keine Präferenz, sondern Kausalität.

**Stage 2 — Boden unter die Kernschleife** (≈ 8–10 Tage) · #4, #5, #6, #7, #15
Das `Effect`-Redesign zuerst und **in einem Zug** — drei Vorschlagstracks fassen dasselbe Enum an; dreimal patchen erzeugt genau die Divergenz, die B3 verursacht hat. Erst danach Autosave (schreibt sonst automatisiert an die falsche Stelle) und erst danach der Flush-Handshake (braucht den `rev`-Zähler, den #4 mit einführt). #7 und #15 gehören zusammen ausgeliefert: Tipp-Checkpoints ohne Redo (#14) vergrößern nur die Menge des unwiederbringlich Zurückgenommenen — deshalb steht #14 direkt am Anfang von Stage 3, nicht später.

**Stage 3 — Das erste Urteil gewinnen** (≈ 12–15 Tage) · #13 → #14 → #16, #17, #21, #22, #39, #40, #41, #20, #24, #25, #18, #19, #23, #26, #27
Ab hier ist die Reihenfolge weitgehend frei; sinnvoll ist innerhalb des Blocks: erst die vier XS-Zeilen (#21, #22, #39, #40, #41 — zusammen ein Tag, fünf Befunde), dann die Shortcut-/Datei-Mechanik, dann die beiden M-Stücke (#23, #26) und zuletzt die Chrome-Umbauten (#27), damit der Diff nicht mit allem anderen kollidiert.

**Stage 4 — Auslieferbar machen** (≈ 5 Tage Arbeit + Wartezeiten) · #11, GUI-Verifikationsdurchlauf, Entscheidungen E1/E2 umsetzen
Signierung/Notarisierung ist terminiert (Homebrew, 01.09.2026) und braucht Vorlauf; parallel läuft der bisher nie abgehakte GUI-Check (next-steps A1–A7) über die dann geänderten Flächen. Die Sprachentscheidung muss **hier** getroffen sein, sonst kollidiert #47 mit Stage 5.

**Stage 5 — Den Keil schärfen** (≈ 15–20 Tage) · #32, #35, #37 (je XS/S, sofort) → #28, #29 → #30, #31, #33, #34, #36, #38
Alle MCP-Oberflächenänderungen (#32, #34, #35, #37, #30, #31) in **einem** Release bündeln und den Versions-Handshake aus #18 mitliefern — jede Änderung verlangt `cargo build` + Client-Neustart, und heute kann keine Seite den Mismatch erkennen (M15). #28 nach #4, weil es denselben Sync-Kanal und einen weiteren AppState-Mutex anfasst.

**Die drei Änderungen mit der besten Befund-pro-Aufwand-Rendite:**
1. **#4 (`Effect`-Redesign, M)** — schließt B3(a–d), M5, S14, S36 und legt `zone_ids` für #36 und die spätere Patch-Synchronisation (S2) mit hin. Ein Enum, sechs Befunde.
2. **#7 (`mutate`→`boolean`, ~12 Zeilen Kern + Aufrufer-Durchgang)** — schließt B2, H14, M54, M20, S11, S28. Sechs Befunde für einen Rückgabewert; TypeScript fängt ignorierte Rückgaben nicht, also ist das manuelle Durchgehen der ~40 Aufrufstellen die eigentliche Arbeit.
3. **#1 (Testnetz, S)** — schließt S3, S37, S10 und ist die Voraussetzung dafür, dass #9, #13, #20, #29 und #33 verantwortbar sind. Ohne es sind fünf Positionen dieser Liste Blindflug.
*Ehrenvolle Erwähnung:* **#39** — eine durchgereichte Funktionssignatur beseitigt eine komplette Performanceklasse (H23) und einen Architektur-Schuldposten (S17).

---

## E. Die fünf Entscheidungen, die der Mensch treffen muss

### E1 — Trial-Modell: read-only nach 30 Tagen oder unbegrenzte, fähigkeitsbeschränkte Demo

**Optionen.** (a) Status quo reparieren: read-only bleibt, aber #7 macht es sichtbar statt still (Editoren wirklich gesperrt, kein grüner Toast über einer Ablehnung). (b) Ersetzen: unbegrenzte Demo mit hartem Folien-Limit (~7) plus Wasserzeichen in den Exporten, durchgesetzt an genau **zwei** Stellen (`createZone` und Export) statt am generischen `mutate`.

**Trade-off.** (a) hält die Kaufentscheidung an einem Stichtag fest und ist der stärkere Conversion-Druck — kostet aber fünf zusätzliche Durchsetzungsstellen (B2, H14, M54, M20, S28) und trifft jemanden, der nie bezahlt hat, mit einem Mechanismus, den Sketch und 1Password nur auf **zahlende** Kunden mit ausgelaufenem Abo anwenden. (b) löscht diese ganze Fehlerklasse ersatzlos, inklusive der 15-Einträge-Allowlist `is_read_only_tool` und des Gates in `ipc.rs:170-175` — verliert aber den Stichtag als Anlass.

**Empfehlung: (b).** Der ausschlaggebende Grund ist nicht Fairness, sondern Distribution: die installierte MCP-Registrierung **ist** der Wachstumskanal. Ein abgelaufenes Slideo bleibt im Claude-Client sichtbar, die KI ruft ein Tool auf und bekommt einen Fehler — das ist schlechter als gar nicht da zu sein, und zwar genau in dem Client, der die Schleife tragen soll. Ein 7-Folien-Deck reicht für jedes Evaluations-Deck und für jede Demo, und ein Wasserzeichen ist ein sichtbarer, jederzeit wirksamer Kaufanlass statt eines einmaligen. **Unabhängig von der Wahl** ist #3 Pflicht: `!configured()` darf nie limitieren.

### E2 — UI-Sprache: Deutsch bleiben oder auf Englisch umstellen

**Optionen.** (a) Deutsch, mit vereinheitlichtem Vokabular (#47 als S statt XL). (b) Englisch, inline, **ohne** i18n-Bibliothek und ohne Message-Katalog — es gibt dann schlicht keine zweite Sprache.

**Trade-off.** (a) kostet fast nichts und passt zu einem DE/EU-Positionierungsvorteil (DSGVO, EAA seit 28.06.2025). (b) kostet einen breiten, mechanischen Diff über ~67 `.tsx` — aber jeder Kanal, der Slideo überhaupt finden kann, ist englisch: MCP-Registry, Anthropic Connectors Directory, Homebrew, HN, r/ClaudeAI. Der Zustand ist heute grotesk: die MCP-Fläche wurde gerade **auf Englisch** lokalisiert — **die KI kann das Produkt lesen, der Käufer nicht.**

**Empfehlung: (b), Entscheidung in Stage 4, Umsetzung als letzter Merge.** Die MCP-Lokalisierung hat die Richtung bereits festgelegt; zwei Halbsprachen sind teurer als eine ganze. Deutsch bleibt als Marktargument in Marketing und Doku voll erhalten — dafür braucht die App-Oberfläche es nicht. Wenn (a): dann ist #47 trotzdem Pflicht, denn vier Vokabeln für dasselbe Objekt sind sprachunabhängig ein Verständlichkeitsproblem.

### E3 — Umfang und Takt der MCP-Oberflächenänderungen

**Optionen.** (a) Bei 37 Tools einfrieren und nur Beschreibungen/Annotationen ändern. (b) Eine gebündelte Erweiterung: `duplicate_zone`, `apply_slides`, `add_asset`, `create_presentation(force)`, Annotationen, Komponenten-Schemas — **ein** Release. (c) Kontinuierlich nachschieben.

**Trade-off.** Jede Änderung greift erst nach `cargo build` **und** Neustart des MCP-Clients, und keine Seite kann den Mismatch heute erkennen (M15): ein noch laufender alter `slideo mcp` bewirbt den alten Toolsatz und bekommt „Unknown tool" zurück. (c) multipliziert diesen Zustand. (a) verzichtet auf den größten Hebel im Keil — `add_asset` schließt die von zwei Rechercheschienen unabhängig als „größte konkrete Lücke" benannte Stelle, und `apply_slides` senkt 60+ Roundtrips auf einen.

**Empfehlung: (b), mit dem Versions-Handshake im selben Release.** Konkret: `client_version` im IPC-Request, bei Abweichung eine Fehlermeldung, die wörtlich „Slideo was updated — restart your MCP client" sagt, statt zu raten. Nebenentscheidung im selben Paket: **Meta-MCP-Ziel löschen (#44)** — es kostet einen handgerollten HTTP-Client über std-TCP plus eine dritte Karte in zwei UIs und wird durch das Config-Snippet (#19) vollständig ersetzt, das gleichzeitig Cursor, Windsurf, Zed, LM Studio und Codex CLI abdeckt.

### E4 — Wie weit bei Overflow und Auto-fit

**Optionen.** (a) Nur die Mensch-Warnung (#20) — Messung bleibt im Iframe, `check_zone_overflow` bleibt Heuristik, wird aber ehrlich (#21). (b) Zusätzlich der Messkanal nach Rust (#28), damit die KI die Wahrheit bekommt. (c) Zusätzlich Auto-fit (#29): Text schrumpft statt zu verschwinden.

**Trade-off.** (a) ist S und liefert sofort den größten Qualitätssprung für den Menschen. (b) ist **L, nicht billig** — das ist die adversarial korrigierte Einschätzung: die Messung fehlt genau dann, wenn die Vorschau eingeklappt (unmounted), das Iframe im Reload oder ein Patch aufgeschoben ist, also oft genau dann, wenn der Agent headless arbeitet. Eine veraltete Messung ist schlimmer als keine, deshalb ist der Inhalts-Hash nicht optional. (c) ist eine sichtbare Verhaltensänderung an bestehenden Decks und muss in **jeder** Renderfläche laufen — `navScript` wird heute nur von `renderFullPage` injiziert, PDF und Thumbnails hätten es nicht.

**Empfehlung: (a) sofort, (c) als `meta.autofit` mit Default AUS für bestehende und AN für neue Decks, (b) erst nach #4.** Begründung für die Reihenfolge: Auto-fit macht die Warnung seltener und damit erträglicher (Marps Lehre: eine Diagnose mit 40 Warnungen wird abgeschaltet), und es bedient eine antrainierte Erwartung — PowerPoints Platzhalter-Default ist „Shrink text on overflow". Harte Untergrenze 0,7; darunter bleibt die Warnung stehen statt unlesbar zu schrumpfen. Für (b) gilt: `measured:false` muss in der Tool-Beschreibung stehen, sonst ersetzt man eine falsche Antwort durch eine fehlende.

### E5 — 16:9 hartkodiert lassen oder Seitenverhältnis konfigurierbar machen

**Optionen.** (a) Bleiben: 1280×720 literal in `renderer.ts:157-177` und `@page { size: 1280px 720px }`. (b) `meta.aspect` einführen (additiv), Bühne und Safe-Area daraus ableiten, MCP-Getter/Setter, Presets für 16:9 / 4:3 / A4-quer / 9:16.

**Trade-off.** (a) ist der Grund, warum §21 funktioniert: **eine** Zahl macht Vorschau, Präsentation, Print, Export, Thumbnails und die Overflow-Messung deckungsgleich — und macht die 1280×720-Doktrin in den MCP-Instructions lehrbar. (b) öffnet 4:3-Beamer, Hochformat/Social und Kunden-Landscape-A4 — kostet aber, dass die Safe-Area-Prosa in `server_instructions`/`slideo_guide`, `overflow.rs`, `pptx.ts` (feste Punktgrößen) und die Print-Seite alle parametrisiert werden müssen, und jede §20-Pixelrechnung eine zweite Variable bekommt.

**Empfehlung: (a) für v1, bewusst und öffentlich.** Der Keil ist „die KI baut verlässlich auf einer festen Bühne" — variable Bühnen verwässern genau das Versprechen, an dem #28 und #29 hängen, und der Nutzen ist im Kernsegment (Pitch/Konzept-Decks, Zoom, Beamer) klein. **Aber:** wenn (b) je kommen soll, dann als `meta.aspect` **jetzt** ins Datenmodell schreiben (Default `"16:9"`, additiv, `version` bleibt „1.0") und überall lesen — nachträglich ist es ein Formatbruch nach CLAUDE.md-Regel 7. Das ist eine Zeile heute gegen eine Migration später.
