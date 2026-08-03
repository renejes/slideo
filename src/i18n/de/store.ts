// Deutscher Katalog — src/store/* + App.tsx — vor allem die 59 notify()-Meldungen.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const store = {
  // ── Lizenz-Gate (mutate/newPresentation/restoreSnapshot) ────────────────────
  'store.readOnly.edit':
    'Testphase abgelaufen — Slideo ist schreibgeschützt. Aktiviere eine Lizenz zum Weiterbearbeiten.',
  'store.readOnly.new':
    'Testphase abgelaufen — bitte aktiviere eine Lizenz, um neue Präsentationen zu erstellen.',
  'store.readOnly.restore': 'Testphase abgelaufen — Wiederherstellen ist schreibgeschützt.',

  // ── Inhalts-Defaults ────────────────────────────────────────────────────────
  // Diese vier Texte entstehen beim ERZEUGEN und wandern in die `.slideo`-Datei.
  // Sie werden also einmalig in der damals eingestellten Sprache geschrieben und
  // sind danach eingefroren (docs/wording.md, „Oberfläche oder Inhalt?"). Der
  // Folienname `Slide N` und das Suffix `(Kopie)` stehen bewusst NICHT hier —
  // Rust vergibt dieselben Defaults, sie müssen deckungsgleich bleiben.
  'store.newDeck.untitled': 'Unbenannt',
  'store.newDeck.firstSlide': '# {title}\n\nDeine erste Folie. Leg los.',
  'store.htmlStarter.title': 'Interaktive Folie',
  'store.htmlStarter.body': 'Beliebiges HTML, CSS &amp; JavaScript möglich.',

  // ── Öffnen / Speichern ──────────────────────────────────────────────────────
  'store.open.newerVersion':
    'Diese Datei stammt aus einer neueren Slideo-Version — sie wird bestmöglich geöffnet, aber Unbekanntes kann fehlen.',
  'store.open.ok': 'Präsentation geöffnet.',
  'store.open.failed': 'Öffnen fehlgeschlagen: {error}',
  'store.save.ok': 'Gespeichert.',
  'store.save.failed': 'Speichern fehlgeschlagen: {error}',

  // ── Export ──────────────────────────────────────────────────────────────────
  'store.export.htmlOk': 'Als HTML exportiert — überall im Browser abspielbar.',
  'store.export.failed': 'Export fehlgeschlagen: {error}',
  'store.export.pdfOpened': 'Im Browser geöffnet — dort „Drucken → Als PDF sichern" (Cmd/Strg+P).',
  'store.export.pdfDialog': 'Druckdialog geöffnet — „Als PDF sichern".',
  'store.export.pdfFailed': 'PDF-Export fehlgeschlagen: {error}',
  'store.export.pptxOk': 'Als PowerPoint (.pptx) exportiert.',
  'store.export.pptxDownloaded': 'PPTX heruntergeladen.',
  'store.export.pptxFailed': 'PPTX-Export fehlgeschlagen: {error}',

  // ── Medien / Marke ──────────────────────────────────────────────────────────
  'store.font.added': 'Schrift „{family}" hinzugefügt — in der Schriftart-Auswahl wählbar.',
  'store.logo.set': 'Logo gesetzt — erscheint auf jeder Folie.',
  'store.media.needsHtmlSlide':
    'Video/Audio gespeichert — in einer HTML-Folie einbinden (Toggle „HTML").',
  'store.media.imageInserted': 'Bild eingefügt.',
  'store.media.inserted': 'Medium eingefügt.',

  // ── Themes ──────────────────────────────────────────────────────────────────
  'store.preset.notFound': 'Theme „{name}" nicht gefunden.',
  'store.preset.applied': 'Theme „{name}" angewendet.',

  // ── Versionshistorie ────────────────────────────────────────────────────────
  'store.history.desktopOnly': 'Versionshistorie ist nur in der Desktop-App verfügbar.',
  'store.history.saveFirst': 'Bitte die Präsentation zuerst speichern (Cmd/Strg+S).',
  'store.history.created': 'Schnappschuss erstellt.',
  'store.history.unchanged': 'Keine Änderungen seit dem letzten Schnappschuss.',
  'store.history.createFailed': 'Schnappschuss fehlgeschlagen: {error}',
  'store.history.restored': 'Snapshot wiederhergestellt — zum Übernehmen speichern (Cmd/Strg+S).',
  // Wörtlich gleich in restoreSnapshot und restoreRecovery → ein Schlüssel.
  'store.restore.failed': 'Wiederherstellen fehlgeschlagen: {error}',

  // ── MCP (die KI hat ein anderes Deck geöffnet/angelegt) ─────────────────────
  'store.mcp.opened': 'Präsentation von der KI geöffnet.',
  'store.mcp.created': 'Neue Präsentation von der KI angelegt.',

  // ── Crash-Sicherung ─────────────────────────────────────────────────────────
  'store.recovery.restored': 'Stand wiederhergestellt — zum Übernehmen speichern (Cmd/Strg+S).',
  'store.recovery.restoredUnsaved':
    'Stand wiederhergestellt — noch ungespeichert, bitte speichern (Cmd/Strg+S).',

  // ── App.tsx ─────────────────────────────────────────────────────────────────
  'app.errorBoundary.presentation': 'Der Präsentationsmodus konnte nicht gestartet werden',
  'app.recovery.title': 'Ungesicherte Arbeit gefunden',
  'app.recovery.body':
    'Die letzte Sitzung wurde nicht ordentlich beendet.\n\n„{title}" · {slides} · zuletzt geändert {when}\nDatei: {file}\n\nDiesen Stand wiederherstellen?',
  'app.recovery.unknownTime': 'unbekannt',
  'app.recovery.neverSaved': 'nie gespeichert',
  'app.empty.title': 'Willkommen bei Slideo',
  'app.empty.intro': 'Erstelle eine neue Präsentation oder öffne eine bestehende {0}-Datei.',
  'app.empty.agent': 'ein KI-Agent',
  'app.empty.ai':
    'Die Folien baut {0} über MCP (z.B. Claude Desktop, Codex CLI) — du verfeinerst sie hier.',
  'app.empty.how': "Wie funktioniert's?",
  'app.empty.new': 'Neue Präsentation',
  'app.empty.open': 'Öffnen',
  'app.empty.recent': 'Zuletzt geöffnet',
} as const
