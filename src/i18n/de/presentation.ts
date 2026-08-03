// Deutscher Katalog — src/components/presentation/* + src/components/preview/*.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const presentation = {
  // --- Folien-Iframe (PresentationMode + ProjectorView zeigen dieselbe Anzeige) ---
  'present.iframe.title': 'Präsentation',

  // --- Folien-Fenster / Teilen (Spec §26) ---
  // Der Fenstertitel „Slideo — Präsentation" wird in Rust (present.rs) gesetzt und
  // ist deshalb in beiden Sprachen derselbe — er muss zur Auswahlliste von
  // Zoom/Meet passen, sonst findet ihn niemand.
  'present.share.opened':
    'Folien-Fenster geöffnet. Für Zoom/Meet: „Fenster teilen“ → „Slideo — Präsentation“. Für einen Beamer: aufs zweite Display ziehen, dann „Vollbild“.',
  'present.share.failed': 'Folien-Fenster fehlgeschlagen: {error}',
  'present.fullscreen.failed': 'Vollbild fehlgeschlagen: {error}',

  // --- Steuerleiste im Präsentationsmodus ---
  // Die Buchstaben in Klammern sind die Tastenkürzel und bleiben in jeder Sprache
  // gleich — der Tastatur-Handler prüft auf genau diese Tasten.
  'present.control.prev': 'Zurück (←)',
  'present.control.next': 'Weiter (→)',
  'present.control.overview': 'Übersicht (g)',
  'present.control.laser': 'Laserpointer (l)',
  'present.control.pen': 'Stift (p)',
  'present.control.clearAnnotations': 'Annotationen löschen (c)',
  'present.control.autoStop': 'Auto-Advance stoppen (a)',
  'present.control.autoStart': 'Auto-Advance starten (a)',
  'present.control.autoSeconds': 'Sekunden pro Schritt',
  'present.control.autoSecondsAria': 'Sekunden pro Schritt (Auto-Advance)',
  'present.control.loopOff': 'Schleife aus',
  'present.control.loopOn': 'Schleife (am Ende von vorn)',
  'present.control.share':
    'Folie im Extra-Fenster zeigen — für Zoom/Meet teilen oder auf einen zweiten Bildschirm ziehen (Notizen bleiben privat)',
  'present.control.projectorWindowed': 'Folien-Fenster: zurück zum Fenster (für Zoom/Meet teilen)',
  'present.control.projectorFullscreen':
    'Folien-Fenster: Vollbild auf seinem Bildschirm (auf den Beamer ziehen, dann klicken)',
  'present.control.projectorClose': 'Folien-Fenster schließen',
  'present.control.toggleSpeaker': 'Speaker-Ansicht umschalten (s)',
  'present.control.speaker': 'Speaker',
  'present.control.slide': 'Folie',
  'present.exit.title': 'Verlassen (Esc)',
  'present.exit.label': 'Verlassen',

  // --- Speaker-Ansicht ---
  'present.speaker.current': 'Aktuell · {label}',
  'present.speaker.next': 'Nächste · {label}',
  'present.speaker.last': 'Letzte Folie',
  'present.speaker.end': 'Ende der Präsentation',
  'present.speaker.notes': 'Notizen',
  'present.speaker.noNotes': 'Keine Notizen für diese Folie.',
  'present.speaker.step': 'Schritt {current}/{total}',

  // --- Folien-Übersicht (Sprung-Grid) ---
  'present.overview.aria': 'Folien-Übersicht',
  'present.overview.count.one': 'Übersicht · {count} Folie',
  'present.overview.count.other': 'Übersicht · {count} Folien',
  'present.overview.close': 'Schließen (Esc)',
  'present.overview.current': 'Aktuell',

  // --- Statisches Folien-Thumbnail ---
  'present.thumb.title': 'Folienvorschau',

  // --- Vorschau-Spalte neben dem Editor ---
  'present.preview.heading': 'Vorschau',
  'present.preview.directEditHint':
    'Direktbearbeiten: in der Vorschau anklicken — HTML-Elemente bzw. Markdown-Blöcke: Text bearbeiten (Doppelklick), duplizieren, löschen',
  'present.preview.directEdit': 'Direktbearbeiten',
  'present.preview.collapse': 'Vorschau einklappen',
  'present.preview.linkSlide': 'Mit Folie verknüpfen',
  'present.preview.noSlides': 'Keine Folien.',
  'present.preview.slideFallback': 'Folie {index}',
  'present.preview.removeLink': 'Link entfernen',
} as const
