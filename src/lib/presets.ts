import type { DesignTokens } from '@/types'
import { t } from '@/i18n'

// Theme-Presets: kuratierte Design-Token-Bündel für einen schnellen Look.
// Anwenden = setTokensBulk(preset.tokens) (store.applyPreset).
//
// WICHTIG: Spiegel dieser Liste lebt in src-tauri/src/presets.rs (für das
// MCP-Tool apply_preset). Beim Ändern beide Seiten anpassen — analog zu
// DEFAULT_TOKENS (types/index.ts ↔ tools.rs default_tokens()).
//
// Fonts sind als breit verfügbare System-Stacks gewählt; nicht installierte
// Namen fallen im Renderer ohnehin auf sans-serif/serif zurück.

export interface Preset {
  /** API-Wert (MCP `apply_preset`, presets.rs) — NIE übersetzen. */
  name: string
  label: string
  description: string
  tokens: DesignTokens
}

export const PRESETS: Preset[] = [
  {
    name: 'editorial',
    label: t('lib.preset.editorial.label'),
    description: t('lib.preset.editorial.description'),
    tokens: {
      'color-primary': '#1f1d1b',
      'color-secondary': '#6b6357',
      'color-bg': '#faf8f4',
      'color-surface': '#efece6',
      'color-text': '#1f1d1b',
      'color-accent': '#b5452f',
      'font-heading': 'Georgia',
      'font-body': 'Georgia',
      'font-size-base': '1rem',
      'spacing-base': '1rem',
      'border-radius': '0.25rem',
    },
  },
  {
    name: 'dark-tech',
    label: t('lib.preset.dark-tech.label'),
    description: t('lib.preset.dark-tech.description'),
    tokens: {
      'color-primary': '#3b82f6',
      'color-secondary': '#94a3b8',
      'color-bg': '#0b0f17',
      'color-surface': '#151b27',
      'color-text': '#e6edf6',
      'color-accent': '#22d3ee',
      'font-heading': 'Inter',
      'font-body': 'Inter',
      'font-size-base': '1rem',
      'spacing-base': '1rem',
      'border-radius': '0.5rem',
    },
  },
  {
    name: 'warm',
    label: t('lib.preset.warm.label'),
    description: t('lib.preset.warm.description'),
    tokens: {
      'color-primary': '#c2410c',
      'color-secondary': '#9a8478',
      'color-bg': '#fff7ed',
      'color-surface': '#ffedd5',
      'color-text': '#3b2f2a',
      'color-accent': '#ea580c',
      'font-heading': 'Georgia',
      'font-body': 'Helvetica Neue',
      'font-size-base': '1rem',
      'spacing-base': '1rem',
      'border-radius': '0.75rem',
    },
  },
  {
    name: 'minimal',
    label: t('lib.preset.minimal.label'),
    description: t('lib.preset.minimal.description'),
    tokens: {
      'color-primary': '#111111',
      'color-secondary': '#8a8a8a',
      'color-bg': '#ffffff',
      'color-surface': '#f4f4f4',
      'color-text': '#111111',
      'color-accent': '#111111',
      'font-heading': 'Helvetica Neue',
      'font-body': 'Helvetica Neue',
      'font-size-base': '1rem',
      'spacing-base': '1rem',
      'border-radius': '0rem',
    },
  },
  {
    name: 'corporate',
    label: t('lib.preset.corporate.label'),
    description: t('lib.preset.corporate.description'),
    tokens: {
      'color-primary': '#1e3a8a',
      'color-secondary': '#64748b',
      'color-bg': '#ffffff',
      'color-surface': '#eef2f7',
      'color-text': '#0f172a',
      'color-accent': '#2563eb',
      'font-heading': 'Arial',
      'font-body': 'Arial',
      'font-size-base': '1rem',
      'spacing-base': '1rem',
      'border-radius': '0.375rem',
    },
  },
]

export function findPreset(name: string): Preset | undefined {
  return PRESETS.find((p) => p.name === name)
}
