# Wording — der Vokabular-Vertrag der Oberfläche

> Maßnahme #47 aus dem August-Review (Befunde M58/S25). Gilt für **App-Chrome**.
> Die AI-facing MCP-Fläche ist davon nicht berührt — die ist Englisch und bleibt es.

Vor diesem Dokument benutzte die Oberfläche vier Wörter für dasselbe Objekt. Ein
Message-Katalog erzwingt pro Begriff genau eine Entscheidung; hier steht, welche.

## Die Regel für „Oberfläche oder Inhalt?"

> **Wandert der String jemals in eine `.slideo`-Datei, in einen Export (HTML/PDF/PPTX)
> oder in eine MCP-Antwort — ist er Inhalt. Existiert er nur im Speicher des laufenden
> App-Fensters — ist er Oberfläche.**

Der Test dafür ist mechanisch: *Sieht diesen String jemand, der Slideo nicht offen hat?*

- **Oberfläche** wird übersetzt und folgt der eingestellten Sprache.
- **Inhalt** wird **einmalig beim Erzeugen** in der damals eingestellten Sprache
  geschrieben und ist danach eingefroren. Ein Sprachwechsel fasst **nie** ein
  bestehendes Deck an — sonst änderte eine Anzeigeeinstellung fremde Dateien.

Präzedenzfall im Repo: der deutsche Stempel in [pptx.ts](../src/lib/pptx.ts) wurde
entfernt, weil er in der Kundendatei landete.

## Begriffstabelle

| Konzept | Deutsch | Englisch | Anmerkung |
|---|---|---|---|
| Eine einzelne Folie | **Folie** | **slide** | Nie „Slide", „Zone" oder „Seite" in der Oberfläche. Das Datenmodell heißt weiterhin `zone` — das ist Code, kein Anzeigetext. |
| Das Dokument | **Präsentation** | **presentation** | Nie „Deck". |
| Gespeicherter Stand | **Snapshot** / **Schnappschuss** | **snapshot** | Bewusst **nicht** vereinheitlicht (Entscheidung 2026-08-03). Der englische Katalog ist in sich konsistent. |
| Referentenansicht | **Speaker-Ansicht** | **speaker view** | Bewusst **nicht** vereinheitlicht (Entscheidung 2026-08-03). |
| Die KI-Gegenstelle | **KI-Agent** / **MCP-Client** | s. Katalog | Bewusst **nicht** vereinheitlicht (Entscheidung 2026-08-03). Herstellerneutral bleibt es in jedem Fall — Slideo spricht MCP, nicht „Claude". |
| Medien | **Medium/Medien** | **media** | „Asset" nur dort, wo es der Dateiname ist. |
| Schritt-Einblendung | **Schritt-Einblendung** | **build** | |

**Nicht vereinheitlichen** — das sind echte Bedeutungsunterschiede, keine Dopplungen:

- **Design ≠ Theme ≠ Token.** Drei Hierarchieebenen: das Design-Overlay enthält
  Themes, ein Theme setzt Tokens.
- **Vorlage ≠ Theme.** [templates.ts](../src/lib/templates.ts) liefert Start-Decks,
  [presets.ts](../src/lib/presets.ts) liefert Farb-/Schriftsätze. Dass beide ein
  „Editorial" führen, ist eine unglückliche Namensgleichheit, kein Terminologiefehler.
- **„einblenden"** meint in der Editor-Shell das Aufklappen einer Spalte, in der
  Zonen-Toolbar eine Schritt-Einblendung.

## Was absichtlich NICHT übersetzt wird

| Fall | Wert | Warum |
|---|---|---|
| Standard-Folienname | `Slide 1`, `Slide 2`, … | Wird in der `.slideo` **persistiert** und ist über MCP (`set_zone_label`) schreibbar. Rust vergibt denselben Default ([tools.rs](../src-tauri/src/tools.rs), [file/mod.rs](../src-tauri/src/file/mod.rs)) — würde das Frontend hier lokalisieren, trügen menschlich und per KI angelegte Folien **im selben Deck** verschiedene Namen. Der Anzeige-Fallback für ein leeres Label ist dagegen übersetzt. |
| Reparierter Titel beim Laden | `Unbenannt` | [normalize.ts](../src/lib/normalize.ts) repariert eine **fremde** Datei und schreibt beim nächsten Speichern zurück. Eine Anzeigeeinstellung darf keine fremde Datei umbenennen — entscheidend ist, dass der Wert **sprachunabhängig fest** ist, nicht welches Wort es ist. Rust setzt in [recovery.rs](../src-tauri/src/recovery.rs) denselben Wert. Der Titel-Default beim **Anlegen** ist dagegen Inhalt und wird lokalisiert (`Meine Präsentation` / `My presentation`). |
| Duplikat-Suffix | `(Kopie)` | Wie der Folienname: persistiert, und Rust vergibt dasselbe Suffix. |
| Datei-Namensbestandteile | Slugs, `presentation` als Fallback | Landen im Dateisystem. |
| Eigennamen | Claude Desktop, Meta-MCP, Claude Code, Codex CLI, Cursor … | Produktnamen. |
| Technische Werte, die wie Labels aussehen | Icon-Namen, System-Schriftnamen, `data-id`, Token-Schlüssel, Enum-Werte aus Rust | Werden als **API-Werte** weitergereicht. Ein „alle `label:` in den Katalog"-Durchgang zerstört sie — siehe die Allowlist in [scripts/check-i18n.mjs](../scripts/check-i18n.mjs). |
| Etablierte Fachbegriffe | Markdown, HTML, CSS, MCP, PDF, PPTX, JSON | |
| Dev-Kommentare im Code | — | Repo-Konvention: bleiben Deutsch. |

## Katalog-Konventionen

- Schlüssel sind **flach und punktgetrennt**: `<bereich>.<komponente>.<was>`,
  z.B. `modal.export.title`. Verschachtelung würde `keyof typeof de` brechen.
- **Deutscher Text ist niemals der Schlüssel** (gettext-Stil). Dieses Projekt hatte
  genau diesen Bug schon: `PLACEHOLDER_TITLES` in [onboarding.ts](../src/lib/onboarding.ts)
  vergleicht auf deutschem Anzeigetext (Befund M2).
- **Plural** über zwei Schlüssel `<basis>.one` / `<basis>.other`, abgerufen mit `tp()`.
  Nie über ein angehängtes `n` im Code.
- **Eingebettete Knoten** (ein Satz um ein `<code>` herum) über nummerierte
  Steckplätze `{0}`, `{1}` und die Komponente `<T>` — nie als Satzfragmente,
  aus denen sich keine zweite Sprache bauen lässt.
- **Kein Backtick und kein `${`** in Katalogwerten. Teile des Katalogs landen in
  `renderer.ts` in injizierten Skripten, die als Template-Literale gebaut werden;
  beides zerlegt dort das Literal bei grünem Build. Ein Test hält das fest.

## Absicherung

| Gate | Fängt |
|---|---|
| `tsc --noEmit` (erster Schritt von `npm run build`) | ungültige Schlüssel an jeder Aufrufstelle; **fehlende und erfundene** Einträge im englischen Katalog, mit Zeilenangabe |
| [i18n.test.ts](../src/i18n/i18n.test.ts) | leere Werte, abweichende Platzhalter zwischen den Sprachen, unvollständige Plural-Paare, Backticks |
| [renderer.test.ts](../src/lib/renderer.test.ts) | die injizierten Iframe-Skripte parsen **in beiden Sprachen** |
| [scripts/check-i18n.mjs](../scripts/check-i18n.mjs) | zurückgebliebene Literale in JSX-Text, `title=`, `aria-label=`, `placeholder=`, `notify(`, `confirmDialog(` |
