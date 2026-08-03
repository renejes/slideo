# Vollreview Slideo — August 2026

> Vollumfängliches Review der Anwendung, Marktvergleich und Optimierungsplan.
> Methode: 6 parallele Code-Spuren über den echten Quellcode + 6 Web-Recherchespuren (Stand 2026-08-03),
> danach **adversariale Gegenprüfung** der teuersten Befunde (12 Teilbehauptungen, je eigenes Verdikt),
> dann drei unabhängige Vorschlagsspuren (Vertrauen · Keil · Vereinfachen) zu einem Plan zusammengeführt.
> Jeder Befund trägt `file:line`. Was widerlegt wurde, steht unter „Bewusst nicht".

## Die drei Dokumente

| Datei | Inhalt |
|---|---|
| [befunde.md](befunde.md) | Was Slideo laut Code wirklich ist · Fähigkeits-Inventar · **Reibungs-Register** (B1–B10 Blocker, H1–H29 hoch, M1–M66 mittel, L1–L15 niedrig) · **Architektur-Schulden** S1–S40 · die 10 wichtigsten Erkenntnisse |
| [markt.md](markt.md) | **Marktkarte nach Ebenen** (wer konkurriert wo, wie hart, wo Slideo sitzt) · Table-Stakes-Checkliste 2026 · was der Markt besser macht · wo Slideo strukturell vorne ist · Marktbewegungen 2026 mit Datum + Quelle |
| [optimierung.md](optimierung.md) | **Die Optimierungsliste** (47 Maßnahmen in 4 Blöcken, mit Aufwand/Wirkung/behobenen Befund-IDs) · Reihenfolge in 5 Stages · **die 5 Entscheidungen, die der Mensch treffen muss** |

## Kernaussage in vier Sätzen

1. Slideo ist kein Präsentations-Editor mit KI-Feature, sondern **ein lokaler MCP-Server mit angeschlossenem Editor**; der verteidigbare Boden ist die Schleife *KI bedient ein Designsystem → Mensch korrigiert live darüber*.
2. „Deine KI baut das Deck über MCP" ist als Verkaufsargument **tot** — Gamma (23.01.2026), Google Slides (13.07.2026), Microsoft (15.07.2026) und Slidev (10.07.2026) sind alle in den MCP-Kanal eingezogen; verteidigbar bleibt die **Tiefe** (37 domänengeformte Tools gegen Googles 2) und die Korrekturschicht darüber, die kein KI-nativer Wettbewerber anbietet.
3. Die zweite Hälfte dieses Satzes hat heute **keinen Boden**: vier unabhängige Reviewspuren fanden vier Wege, wie ein echtes Kundendeck verschwindet (B1, B3, B4, B7) — jeder endet mit einem grünen „Gespeichert."-Toast.
4. Der Engpass ist **Auslieferbarkeit, nicht Funktionsumfang**: keine Signierung/Notarisierung (Homebrew deaktiviert Gatekeeper-durchfallende Casks am **01.09.2026**), kein Auto-Updater, `POLAR_ORG_ID` noch ein Platzhalter (= kein Kaufweg an Tag 31), und eine deutsche UI gegen ausnahmslos englische Distributionskanäle.

## Positionierungs-Notiz (aus der Session-Diskussion)

Die Hypothese „Slideo ist DSGVO-konform, weil man Ollama einbinden kann, die anderen sind es nicht" **trägt so nicht** und sollte nicht die Führung übernehmen:

- **Juristisch angreifbar.** M365 Copilot, Google Workspace + Gemini und die Enterprise-Angebote von Anthropic/OpenAI haben AV-Verträge und EU-Datenresidenz. Der belastbare Satz ist: *es gibt keine Auftragsverarbeitung, weil keine Verarbeitung stattfindet* — kein AVV, kein Sub-Auftragsverarbeiter, kein TIA, kein Eintrag ins Verarbeitungsverzeichnis. Das ist ein **Beschaffungsaufwands**-Argument, kein Legalitätsargument.
- **Technisch ungeprüft.** Ollama ist selbst kein MCP-Client; es braucht zusätzlich einen (LM Studio, Goose, Cherry Studio …). Und ein Deck kostet heute 50–150 Tool-Calls über 37 Tools ([tools.rs](../../src-tauri/src/tools.rs) — `create_zone` legt genau *eine* Folie ohne Style/Notes an). Ob ein lokal lauffähiges Modell das trägt, ist **offen und in einem Nachmittag testbar**: LM Studio + 30B-Modell + „bau ein 8-Folien-Deck über X", dann zählen, wie viele Folien korrekt entstehen. Maßnahme #34 (`apply_slides` + vollständiges `create_zone`) senkt diese Hürde erheblich und ist damit die Voraussetzung, unter der die Ollama-These überhaupt gewinnen kann.
- **Belastbar bleibt** das Delta gegen Cloud-Offline-Modi: Canva Offline (~06/2026, gratis) braucht Vor-Markierung, läuft nach 14 Tagen ab und sperrt offline *alle* KI-Werkzeuge, Exporte und neue Designs; Gamma hat keinen Offline-Modus. Formulierung deshalb: **„kein Konto, kein Sync, kein Ablaufdatum, die Datei liegt auf deiner Platte"** — nicht „funktioniert offline".

## Umsetzungsstand

| Stage | Inhalt | Stand |
|---|---|---|
| **Stage 1** | #1 Testnetz · #2 Neu-Dialog · #3 Lizenz-Sackgasse · #8 Link-Extension · #9 isImg · #10 catch_unwind · #12 toter Code | ✅ umgesetzt (Commit `047ecf9`) |
| **Stage 2** | #4 Effect-Redesign · #5 Flush-Handshake · #6 Autosave + Recovery · #7 mutate→boolean · #15 Undo-Granularität | ✅ umgesetzt |
| **Stage 3** | #13 Presenter-Tastatur+Vollbild · #14 Redo · #16 Folie duplizieren · #17 Speichern unter + Umbenennen · #20 Overflow sichtbar · #21 validate_deck ehrlich · #22 PPTX-Trio · #23 Assets undoable · #24 normalize+ErrorBoundary · #25 Zuletzt geöffnet · #26 Editor-Windowing · #27 Export-Dialog · #39/#40/#41 | ✅ 17 von 17 |
| Stage 4–5 | Auslieferbarkeit (Signierung/Notarisierung/Updater) · Keil (MCP-Erweiterung, Messkanal, Auto-fit) | offen |

Headless grün nach Stage 3: **69 Vitest-Tests** (vorher 0), **52 cargo-Tests** (vorher 42), typecheck, vite build.
**MCP-Tools 37 → 38** (`duplicate_zone`) — braucht `cargo build` + Neustart des MCP-Clients.

**GUI-Verifikation steht für alle drei Stages aus** — insbesondere: Crash-Recovery-Dialog nach hartem
Beenden, Read-only-Sperre der drei Editoren, MCP-`open_presentation` mit Assets, Flush-Handshake unter
Tipplast, Presenter-Tastatur nach Klick auf die Folie, Vollbild beim Präsentieren, Overflow-Badge auf
einer zu vollen Folie, PPTX mit Notizen und Split-Bildern.

**Rest von #27:** Die Topbar ging von 14 auf 11 Bedienelemente (drei Export-Knöpfe → einer, Lizenz in die
Einstellungen). Der Plan nennt 6 als Ziel — dafür bräuchte es ein echtes Overflow-Menü für Suchen /
Verlauf / Hilfe / Einstellungen; das ist bewusst offen geblieben.
**Vereinfachte Umsetzung von #26:** Statt einer eigenen `ZoneRow`-Komponente klappt für inaktive Folien
nur der Editor-Body weg (kompakte Textvorschau bleibt). Gleicher Effekt für H13 und S22 — Deck-Überblick
plus nur eine lebende Editor-Instanz — bei einem Bruchteil des Diffs.

Abweichungen vom Plan (bewusst):
- `src/lib/print.ts` **nicht** gelöscht — entgegen der Annahme in Track 3 ist es der aktive PDF-Pfad im Browser-Dev-Modus.
- Der Flush-Handshake wartet **async** (`tokio::time::sleep` in `handle_connection`) statt blockierend in
  `process_request` — dort hätte ein `std::thread::sleep` einen Tokio-Worker bis zu 250 ms lahmgelegt und
  Befund S13 verschärft, statt B7 zu lösen.
- `zone_ids` wird über den `Effect` durchgereicht, aber noch nicht ausgewertet — die Provenance-Anzeige ist
  Maßnahme #36 (Stage 5).

## Was als Nächstes zu entscheiden ist

Siehe [optimierung.md](optimierung.md) Abschnitt E. Kurzfassung der fünf Gabelungen:

**Produktziel (entschieden 2026-08-03): erst kostenlos/Beta, später Einmallizenz verkaufen.**
Damit gilt Stage 4 in voller Breite (Notarisierung, Windows-Signatur, i18n, Auto-Updater) und Polar
wird später scharfgestellt. ⚠️ **Latente Entscheidung:** sobald `POLAR_ORG_ID` gesetzt wird, schaltet
sich automatisch das *heutige* Modell ein — 30 Tage, danach read-only. Das ist NICHT das aus dem
Review empfohlene Modell (unbegrenzte Demo mit Folien-Limit, siehe E1). Vor dem Verkaufsstart also
noch einmal bewusst wählen.

Entschieden am **2026-08-03**:

| | Entscheidung | Empfehlung aus dem Review | **Getroffen** |
|---|---|---|---|
| E1 | Trial: read-only nach 30 Tagen **oder** unbegrenzte Demo | Demo mit Limit | **Gar kein Trial** — Slideo ist zunächst ein Werkzeug für den Entwickler selbst. *Erfordert keine Arbeit:* solange `POLAR_ORG_ID` ein Platzhalter ist, liefert `compute()` `unconfigured` mit `editing_allowed: true` ([license.rs:194](../../src-tauri/src/license.rs#L194)); die Lizenzleiste blendet sich aus. Umlegbar durch Eintragen der Polar-Werte. |
| E2 | UI-Sprache Deutsch **oder** Englisch | Englisch (eine Sprache, kein i18n-Layer) | **Deutsch, umschaltbar in den Einstellungen.** Teuerster Posten der Liste (Message-Katalog + ~67 `.tsx`), nimmt aber #47 (ein Vokabular) gratis mit. |
| E3 | MCP-Oberfläche einfrieren **oder** gebündelt erweitern | Ein gebündeltes Release + Versions-Handshake | **Wie empfohlen** (an die KI delegiert). Handshake steckt in #18. |
| E4 | Wie weit bei Overflow/Auto-fit | Warnung sofort, Auto-fit als `meta.autofit`, Messkanal später | **Wie empfohlen.** Warnung ✅ (Stage 3 #20). Auto-fit über Schriftgrößen-Multiplikator, harte Untergrenze 0,7, **nie** `transform: scale()`. |
| E5 | 16:9 hart **oder** konfigurierbar | „Hart bleiben, aber `meta.aspect` jetzt additiv einbauen" | **Hart bleiben, ganz — kein `meta.aspect`.** ⚠️ *Die Begründung der Empfehlung war falsch:* ein optionales Feld ist **kein** Formatbruch, wenn es später kommt — genau so wurden `meta.transition`, `meta.logo`, `zone.reveal` und `presentation.fonts` nachträglich ergänzt (CLAUDE.md, „Additive Datenmodell-Felder", `version` blieb „1.0"). Ein Feld, das nichts liest, wäre nur eine tote Zeile. |
