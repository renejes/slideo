// Deutscher Katalog — src/lib/* + src/types/index.ts — Datenkataloge, Renderer, Vorlagen.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const lib = {
  // --- Vorschau-Overlay im Iframe (renderer.ts, Spec §20) ---------------------
  // ACHTUNG: Diese fünf Werte wandern als JSON in ein injiziertes Iframe-Skript,
  // das als Template-Literal gebaut wird. Backtick/`${` sind hier tödlich (ein
  // Test in i18n.test.ts + renderer.test.ts halten das fest).
  // „Duplizieren" der Mini-Toolbar ist wörtlich common.duplicate → dort geholt.
  'lib.preview.dragHandle': 'Ziehen zum Umsortieren',
  'lib.preview.selectParent': 'Eine Ebene höher (Esc)',
  'lib.preview.editText': 'Text bearbeiten (Doppelklick)',
  'lib.preview.linkSlide': 'Mit Folie verknüpfen (Folien-Link)',
  'lib.preview.delete': 'Löschen (Entf)',

  // --- WCAG-Kontrastbewertung (contrast.ts) -----------------------------------
  // „AA"/„AAA" sind WCAG-Stufennamen und bleiben in jeder Sprache stehen.
  'lib.contrast.largeTextOnly': 'nur große Schrift',
  'lib.contrast.tooLow': 'zu niedrig',

  // --- Tauri-Bruecke (tauri.ts) -----------------------------------------------
  'lib.tauri.unavailable':
    'Tauri-Backend nicht verfügbar (Command "{cmd}"). Datei-Operationen funktionieren nur in der Desktop-App (npm run tauri:dev).',

  // --- Onboarding: Beispiel-Prompt zum Kopieren (onboarding.ts) ---------------
  // Der Mensch liest den Prompt, bevor er ihn absendet → er folgt der UI-Sprache.
  'lib.onboarding.topicPlaceholder': '[dein Thema]',
  'lib.onboarding.topicQuoted': '„{title}“',
  'lib.onboarding.samplePrompt':
    'Baue in Slideo eine Präsentation über {topic}. Erstelle 6–8 klare Folien — eine Kernaussage pro Folie, in Markdown. Nutze die Design-Tokens, passende Layouts und fertige Komponenten und halte alles in der 1280×720-Safe-Area. Die Folien erscheinen live in Slideo, während du baust.',

  // --- Theme-Presets (presets.ts) ---------------------------------------------
  // Nur label/description sind Oberfläche; `name` ist ein API-Wert (MCP
  // `apply_preset`) und über src-tauri/src/presets.rs gespiegelt.
  'lib.preset.editorial.label': 'Editorial',
  'lib.preset.editorial.description': 'Hell, serif, redaktionell — ruhige Typo mit Terrakotta-Akzent.',
  'lib.preset.dark-tech.label': 'Dark Tech',
  'lib.preset.dark-tech.description': 'Dunkel, sachlich — Blau/Cyan-Akzente auf tiefem Nachtblau.',
  'lib.preset.warm.label': 'Warm',
  'lib.preset.warm.description': 'Warmes Creme mit Orange — einladend und freundlich.',
  'lib.preset.minimal.label': 'Minimal',
  'lib.preset.minimal.description': 'Schwarz-Weiß, maximale Zurückhaltung — keine Eckenradien.',
  'lib.preset.corporate.label': 'Corporate',
  'lib.preset.corporate.description': 'Professionell — Marineblau auf Weiß, klare Blautöne.',

  // --- Starter-Vorlagen (templates.ts, Spec §19.4) ----------------------------
  // Die `slideN`-Werte sind MARKDOWN und werden zu INHALT, sobald das Deck
  // angelegt ist: einmal in der damals eingestellten Sprache erzeugt, danach
  // eingefroren (docs/wording.md). Struktur exakt halten — Überschriften-Ebenen,
  // der '+++'-Spaltentrenner und die Leerzeilen sind bedeutungstragend.
  'lib.template.blank.label': 'Leer',
  'lib.template.blank.description': 'Eine Titelfolie — freier Aufbau.',
  'lib.template.blank.slide1': '# {title}\n\nDeine erste Folie. Leg los.',

  'lib.template.pitch.label': 'Pitch',
  'lib.template.pitch.description': 'Startup-Pitch: Problem → Lösung → Markt → Ask.',
  'lib.template.pitch.slide1': '# {title}\n\nTagline in einem Satz.',
  'lib.template.pitch.slide2':
    '## Problem\n\n- Schmerzpunkt der Zielgruppe\n- Warum bestehende Lösungen scheitern\n- Warum jetzt',
  'lib.template.pitch.slide3':
    "## Lösung\n\nDein Produkt in einem Satz.\n\n+++\n\n### So funktioniert's\n\n- Schritt 1\n- Schritt 2\n- Schritt 3",
  'lib.template.pitch.slide4':
    '## Markt\n\n**TAM** – Gesamtmarkt\n\n**SAM** – erreichbarer Markt\n\n**SOM** – realistischer Anteil',
  'lib.template.pitch.slide5':
    '## Traktion\n\n- Nutzer / Umsatz\n- Wachstum pro Monat\n- Wichtige Meilensteine',
  'lib.template.pitch.slide6': '## Ask\n\nWir suchen **X €** für **Y**.\n\nKontakt: …',

  'lib.template.lecture.label': 'Vortrag',
  'lib.template.lecture.description': 'Vortrag/Lehre: Titel, Agenda, Kapitel, Fazit.',
  'lib.template.lecture.slide1': '# {title}\n\nName · Datum',
  'lib.template.lecture.slide2':
    '## Agenda\n\n1. Einführung\n2. Hauptteil\n3. Beispiele\n4. Zusammenfassung',
  'lib.template.lecture.slide3': '## Einführung\n\nKernbegriffe und Kontext kurz umreißen.',
  'lib.template.lecture.slide4': '## Hauptteil\n\nDeine zentrale Aussage — ein Gedanke pro Folie.',
  'lib.template.lecture.slide5': '## Zusammenfassung\n\n- Kernpunkt 1\n- Kernpunkt 2\n- Ausblick',

  'lib.template.editorial.label': 'Editorial',
  'lib.template.editorial.description': 'Redaktioneller Look: große Typo, ruhige Abschnitte.',
  'lib.template.editorial.slide1': '# {title}',
  'lib.template.editorial.slide2': '## Eine starke These\n\nEin Absatz, der sie ruhig entfaltet.',
  'lib.template.editorial.slide3': '> Ein prägnantes Zitat, das hängen bleibt.',
  'lib.template.editorial.slide4': '## Drei Punkte\n\n- Erstens\n- Zweitens\n- Drittens',
} as const
