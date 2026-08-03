// Deutscher Katalog — src/components/editor/* + src/components/tokens/*.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const editor = {
  // --- ZoneCard: Kopfzeile, Medien-Drop, Warnbaender, zugeklappte Zeile ---
  'editor.card.dragHandle': 'Ziehen zum Umsortieren',
  'editor.card.dragHandleAria': 'Verschieben',
  'editor.card.dropMedia': 'Medium hier ablegen',
  'editor.card.mediaTypeOnly': 'Nur Bilder, Video und Audio werden unterstützt.',
  // Ersetzt das frühere „Datei(en)" — eine Klammerform laesst sich nicht uebersetzen.
  'editor.card.mediaReadFailed.one': '{count} Datei konnte nicht gelesen werden.',
  'editor.card.mediaReadFailed.other': '{count} Dateien konnten nicht gelesen werden.',
  'editor.card.overflowTitle': 'Inhalt läuft über',
  'editor.card.overflowDetail': '~{px}px zu viel — wird in Präsentation und Export abgeschnitten.',
  'editor.card.htmlBadge': 'Custom HTML',
  'editor.card.htmlHint': 'Voller Browser-Modus — HTML, CSS & JavaScript werden direkt gerendert.',
  'editor.card.clickToEdit': 'Zum Bearbeiten anklicken',
  'editor.card.emptySlide': 'Leere Folie',

  // --- ZoneCard: Custom-CSS-Panel ---
  'editor.card.cssTitle': 'Custom CSS',
  'editor.card.cssActive': 'CSS aktiv',
  'editor.card.cssScope': 'stylt diese Folie',
  // Ein Satz um zwei <code>-Knoten herum → Steckplaetze statt Satzfragmenten.
  'editor.card.cssHint':
    'Selektoren beziehen sich auf diese Folie, z.B. {0}. Token-Variablen wie {1} bleiben themebar.',

  // --- ZoneCard: Notizen-Panel ---
  'editor.card.notesTitle': 'Notizen',
  'editor.card.notesPresent': 'Notizen vorhanden',
  'editor.card.notesScope': 'nur in der Speaker-View',
  'editor.card.notesPlaceholder': 'Sprechernotizen für diese Folie …',

  // --- ZoneToolbar ---
  'editor.toolbar.labelAria': 'Folien-Name',
  'editor.toolbar.lastSlide': 'Die letzte Folie kann nicht gelöscht werden.',
  'editor.toolbar.deleteConfirm': 'Folie „{label}" wirklich löschen? (Rückgängig mit Cmd/Strg+Z)',
  'editor.toolbar.toMarkdownConfirm':
    'Zurück zu Markdown wechseln? Der HTML-Inhalt kann nicht vollständig nach ' +
    'Markdown zurückkonvertiert werden und wird in der Vorschau nicht mehr angezeigt ' +
    '(bleibt aber gespeichert, bis du den Markdown-Inhalt änderst).',
  'editor.toolbar.layout': 'Layout (Zwei Spalten fügt automatisch einen +++ Spaltentrenner ein)',
  'editor.toolbar.textAlign': 'Textausrichtung',
  'editor.toolbar.reveal':
    'Schrittweise einblenden (Builds): Blöcke nacheinander im Präsentationsmodus',
  'editor.toolbar.revealAria': 'Schrittweise einblenden',
  'editor.toolbar.insertMedia':
    'Medium einfügen — öffnet die Asset-Verwaltung (importieren & auswählen)',
  'editor.toolbar.insertMediaAria': 'Medium einfügen',
  'editor.toolbar.insertComponent':
    'Komponente einfügen (Diagramme, Kennzahlen, Zeitstrahl, Zitat …)',
  'editor.toolbar.insertComponentAria': 'Komponente einfügen',
  'editor.toolbar.toggleContentType': 'Zwischen Markdown und HTML umschalten',
  'editor.toolbar.duplicateSlide': 'Folie duplizieren (Cmd/Strg+D)',
  'editor.toolbar.duplicateSlideAria': 'Folie duplizieren',
  // title und aria-label sind hier woertlich gleich → EIN Schluessel, zweimal benutzt.
  'editor.toolbar.deleteSlide': 'Folie löschen',

  // --- ImageToolbar (Floating-Toolbar am selektierten Bild) ---
  'editor.image.cropDone': 'Bild zugeschnitten.',
  'editor.image.cropFailed': 'Zuschneiden fehlgeschlagen (Bildauswahl verloren).',
  'editor.image.align': 'Ausrichtung',
  // {align} ist der rohe API-Wert (left/center/right) — so stand es schon vorher da.
  'editor.image.alignTitle': 'Ausrichtung {align}',
  'editor.image.wrap': 'Umfluss',
  'editor.image.wrapNone': 'Kein',
  'editor.image.wrapLeft': 'Links',
  'editor.image.wrapRight': 'Rechts',
  'editor.image.alt': 'Alt-Text',
  'editor.image.altPlaceholder': 'Bildbeschreibung (Barrierefreiheit)',
  'editor.image.image': 'Bild',
  'editor.image.cropTitle': 'Bild zuschneiden',
  'editor.image.crop': 'Zuschneiden',

  // --- TiptapEditor / EditorCanvas ---
  'editor.tiptap.placeholder': 'Schreib hier deinen Folien-Inhalt …',
  'editor.canvas.addSlide': 'Folie hinzufügen',

  // --- TokenEditor („Brand Kit" im Design-Overlay) ---
  'editor.tokens.themes': 'Themes',
  'editor.tokens.colors': 'Farben',
  'editor.tokens.colorAria': '{label} Farbe',
  'editor.tokens.fonts': 'Schriften',
  'editor.tokens.fontUpload': 'Schriftdatei (woff2/woff/ttf/otf) hochladen',
  'editor.tokens.upload': 'Hochladen',
  'editor.tokens.fontHint': 'Eigene Schrift hochladen → erscheint oben in „Überschrift-/Fließtext-Font".',
  'editor.tokens.logo': 'Logo',
  'editor.tokens.logoRemove': 'Entfernen',
  'editor.tokens.logoUpload': 'Logo-Bild hochladen (PNG/SVG mit Transparenz empfohlen)',
  'editor.tokens.logoHint': 'Logo-Bild hochladen → erscheint dezent auf jeder Folie (auch im Export).',
  'editor.tokens.contrast': 'Kontrast (WCAG)',
  'editor.tokens.contrastText': 'Text / Hintergrund',
  'editor.tokens.contrastAccent': 'Akzent / Hintergrund',
  'editor.tokens.contrastPass': 'Erfüllt WCAG AA',
  'editor.tokens.contrastFail': 'Unter WCAG AA (4.5:1) für normalen Text',
  'editor.tokens.transition': 'Übergang',
  'editor.tokens.transitionDuration': 'Dauer (ms)',
  'editor.tokens.transitionHint': 'Gilt für den Präsentationsmodus und den HTML-Export.',
  'editor.tokens.deckLanguage': 'Sprache der Folien',
  'editor.tokens.deckLanguageHint': 'Gilt für Silbentrennung, Screenreader und die Rechtschreibprüfung beim Bearbeiten in der Vorschau. Gehört zur Präsentation, nicht zur Oberfläche — sie wandert mit der Datei.',
  'editor.tokens.advanced': 'Erweitert',
  'editor.tokens.advancedHint': 'Größen & Abstände',
  'editor.tokens.resetTitle': 'Alle Design-Tokens auf den Standard zurücksetzen',
  'editor.tokens.reset': 'Alle Tokens zurücksetzen',

  // --- Label-Listen aus src/types/index.ts ---
  // Nur die `label`-Seite ist Anzeigetext; `value` bleibt der API-Wert.
  'editor.logoPos.topLeft': 'Oben links',
  'editor.logoPos.topRight': 'Oben rechts',
  'editor.logoPos.bottomLeft': 'Unten links',
  'editor.logoPos.bottomRight': 'Unten rechts',

  'editor.transition.none': 'Keiner',
  'editor.transition.fade': 'Überblenden',
  'editor.transition.slide': 'Schieben',
  'editor.transition.zoom': 'Zoom',
  'editor.transition.auto': 'Auto-Animate',

  'editor.token.colorPrimary': 'Primär',
  'editor.token.colorSecondary': 'Sekundär',
  'editor.token.colorBg': 'Hintergrund',
  'editor.token.colorSurface': 'Oberfläche',
  'editor.token.colorText': 'Text',
  'editor.token.colorAccent': 'Akzent',
  'editor.token.fontHeading': 'Überschrift-Font',
  'editor.token.fontBody': 'Fließtext-Font',
  'editor.token.fontSizeBase': 'Basis-Schriftgröße',
  'editor.token.spacingBase': 'Basis-Abstand',
  'editor.token.borderRadius': 'Eckenradius',

  'editor.layout.center': 'Zentriert',
  'editor.layout.hero': 'Hero',
  'editor.layout.top': 'Oben',
  'editor.layout.split': 'Zwei Spalten',
  'editor.layout.full': 'Vollflächig',

  'editor.textAlign.left': 'Links',
  'editor.textAlign.center': 'Mitte',
  'editor.textAlign.right': 'Rechts',
} as const
