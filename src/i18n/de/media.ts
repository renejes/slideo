// Deutscher Katalog — AssetManager-, Crop-, Komponenten-Palette-, Verlaufs- und Design-Modal.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const media = {
  // --- Asset-Verwaltung (Topbar „Medien" bzw. Auswahl aus einer Zone) ---------
  'media.assets.pickTitle': 'Medium einfügen',
  'media.assets.manageTitle': 'Asset-Verwaltung',

  // --- Bild-Crop (Spec §19.8) -------------------------------------------------
  // Ein Schlüssel für aria-label des Dialogs UND die Überschrift — wörtlich gleich.
  'media.crop.title': 'Bild zuschneiden',
  'media.crop.hint': 'Rahmen ziehen, dann „Zuschneiden"',
  'media.crop.apply': 'Zuschneiden',
  'media.crop.errNoSize': 'Zuschneiden nicht möglich (Bildgröße unbekannt).',
  'media.crop.errNoCanvas': 'Zuschneiden nicht möglich (kein Canvas-Kontext).',
  'media.crop.errFailed': 'Zuschneiden fehlgeschlagen (Bildquelle nicht lesbar).',
  'media.crop.errLoad': 'Bild konnte nicht geladen werden.',

  // --- Komponenten-Palette (Spec §18.7) ---------------------------------------
  // Achtung: Label/Beschreibung der Komponenten selbst kommen aus
  // COMPONENT_CATALOG_DE (lib/component-forms.ts), nicht von hier.
  'media.palette.title': 'Komponente einfügen',
  'media.palette.markdownNotice':
    'Aktive Folie enthält Markdown — die Komponente wird als neue HTML-Folie eingefügt.',
  'media.palette.insert': 'Einfügen',
  'media.palette.unavailable': 'Die Komponenten-Palette ist nur in der Desktop-App verfügbar.',
  'media.palette.unavailableHint':
    'Der Komponenten-Generator läuft im Rust-Backend (npm run tauri:dev).',
  'media.palette.preview': 'Vorschau',
  'media.palette.previewFrame': 'Komponenten-Vorschau',
  'media.palette.defaults': 'Diese Komponente wird mit Standardwerten eingefügt.',
  'media.palette.itemFieldAria': '{label} (Zeile {row})',
  'media.palette.removeRow': 'Zeile entfernen',
  'media.palette.removeRowAria': 'Zeile {row} entfernen',
  'media.palette.noItems': 'Keine Einträge — wird mit Beispieldaten gerendert.',
  'media.palette.dataIdPlaceholder': 'optional — für Auto-Animate (Übergang „auto“)',
  'media.palette.dataIdAria': 'data-id für Auto-Animate (optional)',
  'media.palette.dataIdTitle':
    'Erlaubt: Buchstaben, Ziffern, - _ : (max. 64). Andere Zeichen werden entfernt.',
  // Überschrift der Platzierungs-Auswahl; gleiches Wort wie der Knopf, aber
  // eigener Kontext (englisch könnte es auseinanderlaufen).
  'media.palette.placementLabel': 'Einfügen',
  'media.palette.placeReplace': 'In „{label}" einsetzen',
  'media.palette.placeAppend': 'An „{label}" anhängen',
  'media.palette.placeNewAfter': 'Als neue Folie nach „{label}"',
  'media.palette.placeNew': 'Als neue Folie',
  'media.palette.inserted': 'Komponente eingefügt.',
  'media.palette.insertFailed': 'Einfügen fehlgeschlagen: {error}',

  // --- Versionsverlauf (Spec §19.9) -------------------------------------------
  'media.history.title': 'Versionsverlauf',
  'media.history.unavailable': 'Der Versionsverlauf ist nur in der Desktop-App verfügbar.',
  'media.history.needsSave':
    'Bitte die Präsentation zuerst speichern (Cmd/Strg+S) — danach werden bei jedem Speichern automatisch Snapshots angelegt.',
  'media.history.labelAria': 'Beschriftung für den Schnappschuss (optional)',
  'media.history.labelPlaceholder': 'Beschriftung (optional), z.B. „Vor dem Umbau“',
  'media.history.create': 'Schnappschuss',
  'media.history.empty': 'Noch keine Snapshots. Beim Speichern wird automatisch einer angelegt.',
  'media.history.auto': 'Auto',
  'media.history.manual': 'Manuell',
  'media.history.restore': 'Wiederherstellen',
  'media.history.restoreTitle': 'Diesen Stand wiederherstellen',
  // Ein Schlüssel für title UND aria-label des Lösch-Knopfs — wörtlich gleich.
  'media.history.deleteSnapshot': 'Snapshot löschen',
  'media.history.footnote':
    'Snapshots liegen lokal (max. 50 je Präsentation); beim Speichern wird automatisch einer angelegt, sofern sich etwas geändert hat.',
  'media.history.confirmRestore':
    'Snapshot vom {time} wiederherstellen? Der aktuelle Stand wird ersetzt (per Cmd/Strg+Z umkehrbar; zum dauerhaften Übernehmen anschließend speichern).',
  'media.history.confirmDelete':
    'Diesen Snapshot endgültig löschen? Das kann nicht rückgängig gemacht werden.',

  // --- Design-Overlay ----------------------------------------------------------
  'media.design.title': 'Design',
} as const
