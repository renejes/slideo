// Deutscher Katalog — src/lib/component-forms.ts — Formularschemata + deutscher Komponenten-Katalog.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).
//
// Drei Bloecke, bewusst durch Praefixe getrennt:
//   comp.catalog.<typ>.*  Anzeige-Ueberlagerung des (englischen) Rust-Katalogs
//                         `list_components` fuer die menschliche Palette-UI.
//   comp.form.<typ>.*     Beschriftungen und Platzhalter der Eingabefelder.
//   comp.seed.<typ>.*     Vorbelegung der Formulare. Das ist INHALT: der Text
//                         wandert ueber `render_component` in die Folie. Er wird
//                         deshalb einmalig zur Einfuegezeit in der dann aktiven
//                         Sprache ausgewertet und danach nicht mehr angefasst.
//
// Die englische Fassung von comp.catalog.* und comp.seed.* ist bewusst wortgleich
// mit src-tauri/src/components.rs (Katalog bzw. Generator-Fallbacks) — sonst gaebe
// es fuer denselben Text drei Wahrheiten.

export const components = {
  // ---------------------------------------------------------------------------
  // (a) Katalog — Anzeige-Ueberlagerung je Komponententyp
  // ---------------------------------------------------------------------------
  'comp.catalog.stat_cards.label': 'Kennzahlen-Karten',
  'comp.catalog.stat_cards.description': 'Reihe großer KPI-Karten (Wert + Beschriftung).',
  'comp.catalog.bar_chart.label': 'Balkendiagramm',
  'comp.catalog.bar_chart.description': 'Horizontale Balken, automatisch skaliert.',
  'comp.catalog.line_chart.label': 'Liniendiagramm',
  'comp.catalog.line_chart.description': 'Linienverlauf (Trend über Zeit) als SVG, token-bewusst.',
  'comp.catalog.donut_chart.label': 'Donut-/Kreisdiagramm',
  'comp.catalog.donut_chart.description': 'Anteile als Donut mit Legende (Prozente automatisch).',
  'comp.catalog.progress.label': 'Fortschrittsbalken',
  'comp.catalog.progress.description': 'Beschriftete Prozent-Balken (0–100).',
  'comp.catalog.quote.label': 'Zitat',
  'comp.catalog.quote.description': 'Großes zentriertes Zitat mit Quelle.',
  'comp.catalog.timeline.label': 'Zeitstrahl',
  'comp.catalog.timeline.description': 'Vertikaler Zeitstrahl mit Punkten.',
  'comp.catalog.comparison.label': 'Vergleich (zwei Spalten)',
  'comp.catalog.comparison.description': 'Zwei gegenübergestellte Listen-Spalten.',
  'comp.catalog.callout.label': 'Hinweis-Box',
  'comp.catalog.callout.description': 'Hervorgehobener Kasten mit Titel und Text.',
  'comp.catalog.icon.label': 'Icon (Inline-SVG)',
  'comp.catalog.icon.description':
    'Token-gefärbtes Symbol (optional mit Beschriftung). Namen: check, close, arrow_right, arrow_up, plus, minus, star, heart, bolt, circle, check_circle, shield, info, warning, lightbulb.',
  'comp.catalog.toc.label': 'Inhaltsverzeichnis (Sprung-Links)',
  'comp.catalog.toc.description':
    'Klickbare Folienübersicht — jeder Eintrag springt zur Zielfolie (Folien-Link, Spec §23). target = Folien-ID ODER 1-basierte Foliennummer; ein Rücksprung-Link auf die Inhalts-Folie bringt zurück.',
  'comp.catalog.data_table.label': 'Tabelle',
  'comp.catalog.data_table.description':
    'Datentabelle, token-gestylt, gestreifte Zeilen. Max ~8 Zeilen (sonst Überlauf der 720px-Bühne).',
  'comp.catalog.big_number.label': 'Große Kennzahl',
  'comp.catalog.big_number.description': 'Eine herausragende Zahl (KPI-Hero) mit Label, optional Untertitel.',
  'comp.catalog.feature_grid.label': 'Feature-Raster',
  'comp.catalog.feature_grid.description':
    'Karten mit Icon + Titel + Text (2–3 nebeneinander). Icon-Namen wie bei „icon“.',
  'comp.catalog.process_steps.label': 'Prozess-Schritte',
  'comp.catalog.process_steps.description': 'Nummerierte Schritte mit Pfeilen (horizontal). Am besten 3–5 Schritte.',
  'comp.catalog.pricing.label': 'Preistabelle',
  'comp.catalog.pricing.description': '2–4 Preis-Karten; eine via featured:true hervorgehoben.',
  'comp.catalog.gallery.label': 'Bild-Galerie',
  'comp.catalog.gallery.description':
    'Bildraster aus vorhandenen Assets (Namen aus list_assets); columns 1–4. Ohne Bilder werden Platzhalter gezeigt.',

  // ---------------------------------------------------------------------------
  // (b) Formularfelder — Beschriftungen und Platzhalter
  // ---------------------------------------------------------------------------

  // Token-Farbauswahl: der WERT ist die CSS-Variable (API-Wert), hier steht nur
  // die Anzeige.
  'comp.form.color.accent': 'Akzent',
  'comp.form.color.primary': 'Primär',
  'comp.form.color.secondary': 'Sekundär',
  'comp.form.color.text': 'Text',

  'comp.form.stat_cards.items': 'Kennzahlen',
  'comp.form.stat_cards.addItem': 'Kennzahl',
  'comp.form.stat_cards.value': 'Wert',
  'comp.form.stat_cards.valuePlaceholder': '98%',
  'comp.form.stat_cards.label': 'Beschriftung',
  'comp.form.stat_cards.labelPlaceholder': 'Zufriedenheit',

  'comp.form.bar_chart.max': 'Maximum (optional, sonst automatisch)',
  'comp.form.bar_chart.maxPlaceholder': 'auto',
  'comp.form.bar_chart.items': 'Balken',
  'comp.form.bar_chart.addItem': 'Balken',
  'comp.form.bar_chart.label': 'Label',
  'comp.form.bar_chart.labelPlaceholder': 'Q1',
  'comp.form.bar_chart.value': 'Wert',
  'comp.form.bar_chart.valuePlaceholder': '40',

  'comp.form.line_chart.items': 'Datenpunkte',
  'comp.form.line_chart.addItem': 'Punkt',
  'comp.form.line_chart.label': 'Label',
  'comp.form.line_chart.labelPlaceholder': 'Jan',
  'comp.form.line_chart.value': 'Wert',
  'comp.form.line_chart.valuePlaceholder': '12',

  'comp.form.donut_chart.items': 'Segmente',
  'comp.form.donut_chart.addItem': 'Segment',
  'comp.form.donut_chart.label': 'Label',
  'comp.form.donut_chart.labelPlaceholder': 'Direkt',
  'comp.form.donut_chart.value': 'Wert',
  'comp.form.donut_chart.valuePlaceholder': '45',

  'comp.form.progress.items': 'Fortschrittsbalken',
  'comp.form.progress.addItem': 'Balken',
  'comp.form.progress.label': 'Label',
  'comp.form.progress.labelPlaceholder': 'Design',
  'comp.form.progress.percent': 'Prozent (0–100)',
  'comp.form.progress.percentPlaceholder': '90',

  'comp.form.quote.text': 'Zitat',
  'comp.form.quote.author': 'Quelle',

  'comp.form.timeline.items': 'Stationen',
  'comp.form.timeline.addItem': 'Station',
  'comp.form.timeline.title': 'Titel',
  'comp.form.timeline.titlePlaceholder': '2024',
  'comp.form.timeline.text': 'Text',
  'comp.form.timeline.textPlaceholder': 'Gründung',

  'comp.form.comparison.left.title': 'Linke Spalte — Titel',
  'comp.form.comparison.left.titlePlaceholder': 'Vorher',
  'comp.form.comparison.left.list': 'Punkte (eine Zeile = ein Punkt)',
  'comp.form.comparison.right.title': 'Rechte Spalte — Titel',
  'comp.form.comparison.right.titlePlaceholder': 'Nachher',
  'comp.form.comparison.right.list': 'Punkte (eine Zeile = ein Punkt)',

  'comp.form.callout.title': 'Titel',
  'comp.form.callout.text': 'Text',

  'comp.form.icon.name': 'Symbol',
  'comp.form.icon.label': 'Beschriftung (optional)',
  'comp.form.icon.labelPlaceholder': 'z.B. Sicher',
  'comp.form.icon.color': 'Farbe',
  'comp.form.icon.size': 'Größe (rem)',

  'comp.form.toc.items': 'Einträge',
  'comp.form.toc.addItem': 'Eintrag',
  'comp.form.toc.label': 'Beschriftung',
  'comp.form.toc.labelPlaceholder': 'Einleitung',
  'comp.form.toc.target': 'Ziel (Foliennummer oder Folien-ID)',
  'comp.form.toc.targetPlaceholder': '2',

  'comp.form.big_number.value': 'Zahl',
  'comp.form.big_number.label': 'Beschriftung',
  'comp.form.big_number.sub': 'Untertitel (optional)',
  'comp.form.big_number.subPlaceholder': 'seit Q1',

  'comp.form.feature_grid.items': 'Features',
  'comp.form.feature_grid.addItem': 'Feature',
  'comp.form.feature_grid.icon': 'Icon',
  'comp.form.feature_grid.title': 'Titel',
  'comp.form.feature_grid.titlePlaceholder': 'Schnell',
  'comp.form.feature_grid.text': 'Text',
  'comp.form.feature_grid.textPlaceholder': 'In Sekunden startklar.',

  'comp.form.process_steps.items': 'Schritte',
  'comp.form.process_steps.addItem': 'Schritt',
  'comp.form.process_steps.title': 'Titel',
  'comp.form.process_steps.titlePlaceholder': 'Entdecken',
  'comp.form.process_steps.text': 'Text',
  'comp.form.process_steps.textPlaceholder': 'Bedarf verstehen',

  // ---------------------------------------------------------------------------
  // (c) Seed-Werte — INHALT (wandert in die Folie), einmalig zur Einfuegezeit
  // ---------------------------------------------------------------------------
  'comp.seed.stat_cards.1.value': '98%',
  'comp.seed.stat_cards.1.label': 'Zufriedenheit',
  'comp.seed.stat_cards.2.value': '3.2x',
  'comp.seed.stat_cards.2.label': 'Wachstum',
  'comp.seed.stat_cards.3.value': '12k',
  'comp.seed.stat_cards.3.label': 'Nutzer',

  'comp.seed.bar_chart.1.label': 'Q1',
  'comp.seed.bar_chart.1.value': '40',
  'comp.seed.bar_chart.2.label': 'Q2',
  'comp.seed.bar_chart.2.value': '65',
  'comp.seed.bar_chart.3.label': 'Q3',
  'comp.seed.bar_chart.3.value': '80',
  'comp.seed.bar_chart.4.label': 'Q4',
  'comp.seed.bar_chart.4.value': '100',

  'comp.seed.line_chart.1.label': 'Jan',
  'comp.seed.line_chart.1.value': '12',
  'comp.seed.line_chart.2.label': 'Feb',
  'comp.seed.line_chart.2.value': '19',
  'comp.seed.line_chart.3.label': 'Mär',
  'comp.seed.line_chart.3.value': '15',
  'comp.seed.line_chart.4.label': 'Apr',
  'comp.seed.line_chart.4.value': '27',
  'comp.seed.line_chart.5.label': 'Mai',
  'comp.seed.line_chart.5.value': '34',

  'comp.seed.donut_chart.1.label': 'Direkt',
  'comp.seed.donut_chart.1.value': '45',
  'comp.seed.donut_chart.2.label': 'Suche',
  'comp.seed.donut_chart.2.value': '30',
  'comp.seed.donut_chart.3.label': 'Social',
  'comp.seed.donut_chart.3.value': '25',

  'comp.seed.progress.1.label': 'Design',
  'comp.seed.progress.1.percent': '90',
  'comp.seed.progress.2.label': 'Entwicklung',
  'comp.seed.progress.2.percent': '70',
  'comp.seed.progress.3.label': 'Test',
  'comp.seed.progress.3.percent': '45',

  'comp.seed.quote.text': 'Großartige Ideen brauchen Mut, nicht Erlaubnis.',
  'comp.seed.quote.author': 'Unbekannt',

  'comp.seed.timeline.1.title': '2024',
  'comp.seed.timeline.1.text': 'Gründung',
  'comp.seed.timeline.2.title': '2025',
  'comp.seed.timeline.2.text': 'Erste 1.000 Nutzer',
  'comp.seed.timeline.3.title': '2026',
  'comp.seed.timeline.3.text': 'Internationaler Start',

  'comp.seed.comparison.left.title': 'Vorher',
  'comp.seed.comparison.left.1': 'Manuelle Prozesse',
  'comp.seed.comparison.left.2': 'Hohe Fehlerquote',
  'comp.seed.comparison.left.3': 'Langsam',
  'comp.seed.comparison.right.title': 'Nachher',
  'comp.seed.comparison.right.1': 'Automatisiert',
  'comp.seed.comparison.right.2': 'Zuverlässig',
  'comp.seed.comparison.right.3': 'Schnell',

  'comp.seed.callout.title': 'Wichtig',
  'comp.seed.callout.text': 'Die zentrale Botschaft dieser Folie.',

  'comp.seed.toc.1.label': 'Einleitung',
  'comp.seed.toc.1.target': '2',
  'comp.seed.toc.2.label': 'Hauptteil',
  'comp.seed.toc.2.target': '3',
  'comp.seed.toc.3.label': 'Fazit',
  'comp.seed.toc.3.target': '4',

  'comp.seed.big_number.value': '+42%',
  'comp.seed.big_number.label': 'Wachstum im letzten Quartal',

  'comp.seed.feature_grid.1.title': 'Schnell',
  'comp.seed.feature_grid.1.text': 'In Sekunden startklar.',
  'comp.seed.feature_grid.2.title': 'Sicher',
  'comp.seed.feature_grid.2.text': 'Läuft komplett lokal.',
  'comp.seed.feature_grid.3.title': 'Einfach',
  'comp.seed.feature_grid.3.text': 'Keine Lernkurve.',

  'comp.seed.process_steps.1.title': 'Entdecken',
  'comp.seed.process_steps.1.text': 'Bedarf verstehen',
  'comp.seed.process_steps.2.title': 'Entwerfen',
  'comp.seed.process_steps.2.text': 'Lösung skizzieren',
  'comp.seed.process_steps.3.title': 'Liefern',
  'comp.seed.process_steps.3.text': 'Umsetzen & messen',
} as const
