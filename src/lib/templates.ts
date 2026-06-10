import type { ZoneLayout, RevealMode } from '@/types'

// Starter-Templates (Spec §19.4): kuratierte Decks (Token-Preset + Seed-Zonen),
// im Neu-Dialog auswählbar. Tokens kommen aus presets.ts (eine Quelle).

export interface TemplateZone {
  markdown: string
  layout?: ZoneLayout
  reveal?: RevealMode
}

export interface DeckTemplate {
  id: string
  label: string
  description: string
  /** Name eines Presets aus presets.ts (Farben/Fonts); fehlt = Default-Tokens. */
  preset?: string
  zones: (title: string) => TemplateZone[]
}

export const TEMPLATES: DeckTemplate[] = [
  {
    id: 'blank',
    label: 'Leer',
    description: 'Eine Titelfolie — freier Aufbau.',
    zones: (title) => [{ markdown: `# ${title}\n\nDein erster Slide. Leg los.` }],
  },
  {
    id: 'pitch',
    label: 'Pitch',
    description: 'Startup-Pitch: Problem → Lösung → Markt → Ask.',
    preset: 'dark-tech',
    zones: (title) => [
      { markdown: `# ${title}\n\nTagline in einem Satz.`, layout: 'hero' },
      { markdown: `## Problem\n\n- Schmerzpunkt der Zielgruppe\n- Warum bestehende Lösungen scheitern\n- Warum jetzt`, reveal: 'steps' },
      { markdown: `## Lösung\n\nDein Produkt in einem Satz.\n\n+++\n\n### So funktioniert's\n\n- Schritt 1\n- Schritt 2\n- Schritt 3`, layout: 'split' },
      { markdown: `## Markt\n\n**TAM** – Gesamtmarkt\n\n**SAM** – erreichbarer Markt\n\n**SOM** – realistischer Anteil` },
      { markdown: `## Traktion\n\n- Nutzer / Umsatz\n- Wachstum pro Monat\n- Wichtige Meilensteine`, reveal: 'steps' },
      { markdown: `## Ask\n\nWir suchen **X €** für **Y**.\n\nKontakt: …`, layout: 'hero' },
    ],
  },
  {
    id: 'lecture',
    label: 'Vortrag',
    description: 'Vortrag/Lehre: Titel, Agenda, Kapitel, Fazit.',
    preset: 'minimal',
    zones: (title) => [
      { markdown: `# ${title}\n\nName · Datum`, layout: 'hero' },
      { markdown: `## Agenda\n\n1. Einführung\n2. Hauptteil\n3. Beispiele\n4. Zusammenfassung`, reveal: 'steps' },
      { markdown: `## Einführung\n\nKernbegriffe und Kontext kurz umreißen.` },
      { markdown: `## Hauptteil\n\nDeine zentrale Aussage — ein Gedanke pro Folie.` },
      { markdown: `## Zusammenfassung\n\n- Kernpunkt 1\n- Kernpunkt 2\n- Ausblick`, reveal: 'steps' },
    ],
  },
  {
    id: 'editorial',
    label: 'Editorial',
    description: 'Redaktioneller Look: große Typo, ruhige Abschnitte.',
    preset: 'editorial',
    zones: (title) => [
      { markdown: `# ${title}`, layout: 'hero' },
      { markdown: `## Eine starke These\n\nEin Absatz, der sie ruhig entfaltet.` },
      { markdown: `> Ein prägnantes Zitat, das hängen bleibt.`, layout: 'center' },
      { markdown: `## Drei Punkte\n\n- Erstens\n- Zweitens\n- Drittens`, reveal: 'steps' },
    ],
  },
]

export function findTemplate(id: string): DeckTemplate | undefined {
  return TEMPLATES.find((t) => t.id === id)
}
