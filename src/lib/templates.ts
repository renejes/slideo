import type { ZoneLayout, RevealMode } from '@/types'
import { t } from '@/i18n'

// Starter-Templates (Spec §19.4): kuratierte Decks (Token-Preset + Seed-Zonen),
// im Neu-Dialog auswählbar. Tokens kommen aus presets.ts (eine Quelle).
//
// `label`/`description` sind Oberfläche. Das Markdown aus `zones()` ist dagegen
// INHALT (docs/wording.md): es wird genau einmal beim Anlegen des Decks in der
// damals eingestellten Sprache erzeugt und ist danach eingefroren — ein späterer
// Sprachwechsel fasst ein bestehendes Deck nie an.

export interface TemplateZone {
  markdown: string
  layout?: ZoneLayout
  reveal?: RevealMode
}

export interface DeckTemplate {
  /** API-/Persistenz-Wert (Auswahl im Neu-Dialog) — NIE übersetzen. */
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
    label: t('lib.template.blank.label'),
    description: t('lib.template.blank.description'),
    zones: (title) => [{ markdown: t('lib.template.blank.slide1', { title }) }],
  },
  {
    id: 'pitch',
    label: t('lib.template.pitch.label'),
    description: t('lib.template.pitch.description'),
    preset: 'dark-tech',
    zones: (title) => [
      { markdown: t('lib.template.pitch.slide1', { title }), layout: 'hero' },
      { markdown: t('lib.template.pitch.slide2'), reveal: 'steps' },
      { markdown: t('lib.template.pitch.slide3'), layout: 'split' },
      { markdown: t('lib.template.pitch.slide4') },
      { markdown: t('lib.template.pitch.slide5'), reveal: 'steps' },
      { markdown: t('lib.template.pitch.slide6'), layout: 'hero' },
    ],
  },
  {
    id: 'lecture',
    label: t('lib.template.lecture.label'),
    description: t('lib.template.lecture.description'),
    preset: 'minimal',
    zones: (title) => [
      { markdown: t('lib.template.lecture.slide1', { title }), layout: 'hero' },
      { markdown: t('lib.template.lecture.slide2'), reveal: 'steps' },
      { markdown: t('lib.template.lecture.slide3') },
      { markdown: t('lib.template.lecture.slide4') },
      { markdown: t('lib.template.lecture.slide5'), reveal: 'steps' },
    ],
  },
  {
    id: 'editorial',
    label: t('lib.template.editorial.label'),
    description: t('lib.template.editorial.description'),
    preset: 'editorial',
    zones: (title) => [
      { markdown: t('lib.template.editorial.slide1', { title }), layout: 'hero' },
      { markdown: t('lib.template.editorial.slide2') },
      { markdown: t('lib.template.editorial.slide3'), layout: 'center' },
      { markdown: t('lib.template.editorial.slide4'), reveal: 'steps' },
    ],
  },
]

export function findTemplate(id: string): DeckTemplate | undefined {
  // Parameter bewusst nicht `t` — das würde den Katalog-Helfer verschatten.
  return TEMPLATES.find((tpl) => tpl.id === id)
}
