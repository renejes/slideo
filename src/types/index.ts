// Alle zentralen TypeScript-Typen für Slideo.
// Maßgeblich: docs/slideo-spec.md, Abschnitt 8.

export interface Presentation {
  version: string
  meta: PresentationMeta
  tokens: DesignTokens
  zones: Zone[]
  fonts?: FontFace[] // hochgeladene Schriften (Spec §19.4), optional/additiv
}

/** Eine eingebettete Schrift: Familienname + Asset-Datei in `assets/`. */
export interface FontFace {
  family: string
  asset: string
}

/** Breit verfügbare System-Fonts für die Schriftart-Auswahl (+ hochgeladene). */
export const SYSTEM_FONTS = [
  'Inter',
  'Helvetica Neue',
  'Arial',
  'Georgia',
  'Times New Roman',
  'Courier New',
  'Verdana',
  'Trebuchet MS',
  'Palatino',
]

export interface PresentationMeta {
  title: string
  created: string // ISO 8601
  modified: string // ISO 8601
  transition?: Transition // optional; fehlt = 'none' (reiner Scroll-Snap)
  logo?: BrandLogo // optionales Marken-Logo auf jeder Folie (Spec §19.4)
}

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface BrandLogo {
  asset: string // Bild-Asset in assets/
  position: LogoPosition
}

export const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: 'top-left', label: 'Oben links' },
  { value: 'top-right', label: 'Oben rechts' },
  { value: 'bottom-left', label: 'Unten links' },
  { value: 'bottom-right', label: 'Unten rechts' },
]

export type TransitionKind = 'none' | 'fade' | 'slide' | 'zoom'

/** Präsentations-weiter Folienübergang (Spec §18.3). */
export interface Transition {
  kind: TransitionKind
  duration_ms: number
}

export const DEFAULT_TRANSITION: Transition = { kind: 'none', duration_ms: 500 }

export const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: 'none', label: 'Keiner' },
  { value: 'fade', label: 'Überblenden' },
  { value: 'slide', label: 'Schieben' },
  { value: 'zoom', label: 'Zoom' },
]

export interface DesignTokens {
  'color-primary': string
  'color-secondary': string
  'color-bg': string
  'color-surface': string
  'color-text': string
  'color-accent': string
  'font-heading': string
  'font-body': string
  'font-size-base': string
  'spacing-base': string
  'border-radius': string
  [key: string]: string // erweiterbar
}

export type ContentType = 'markdown' | 'html'

/** Builds (Spec §19.1): 'steps' = Top-Level-Blöcke schrittweise einblenden. */
export type RevealMode = 'none' | 'steps'

export interface Zone {
  id: string // UUID v4
  label: string // z.B. "Slide 1"
  order: number // 0-basiert
  content_type: ContentType // 'markdown' (Default) | 'html' (interaktiv, siehe Spec §14)
  markdown: string // genutzt wenn content_type === 'markdown'
  html: string | null // genutzt wenn content_type === 'html'
  custom_css: string // optionales, auf diese Zone gescoptes CSS (Text bleibt sauber)
  style: ZoneStyle
  notes: string // Speaker Notes
  reveal?: RevealMode // optional; fehlt = 'none' (Builds, Spec §19.1)
}

export type ZoneLayout = 'center' | 'top' | 'split' | 'full' | 'hero'
export type TextAlign = 'left' | 'center' | 'right'

export interface ZoneStyle {
  layout: ZoneLayout
  padding: string
  background: string | null
  text_align: TextAlign
}

export const DEFAULT_TOKENS: DesignTokens = {
  'color-primary': '#6366f1',
  'color-secondary': '#818cf8',
  'color-bg': '#0f0f0f',
  'color-surface': '#1a1a2e',
  'color-text': '#f1f5f9',
  'color-accent': '#e94560',
  'font-heading': 'Cal Sans',
  'font-body': 'Inter',
  'font-size-base': '1rem',
  'spacing-base': '1rem',
  'border-radius': '0.5rem',
}

export const DEFAULT_ZONE_STYLE: ZoneStyle = {
  layout: 'center',
  padding: '4rem',
  background: null,
  text_align: 'left',
}

export const FILE_FORMAT_VERSION = '1.0'

/** Ein Asset (z.B. Bild) im .slideo-Archiv. `data` ist base64-kodiert. */
export interface Asset {
  name: string
  mime: string
  data: string
}

/** Laufzeit-Asset-Map im Frontend: Dateiname → vollständige Data-URI. */
export type AssetMap = Record<string, string>

/**
 * Reihenfolge + menschenlesbare Labels aller Design-Tokens.
 * Treibt das UI der Token-Sidebar; `kind` steuert das Eingabe-Widget.
 */
export type TokenKind = 'color' | 'font' | 'size' | 'text'

export interface TokenFieldDef {
  // & string: schließt die `number`-Variante aus, die die Index-Signatur in `keyof` einbringt.
  key: keyof DesignTokens & string
  label: string
  kind: TokenKind
}

export const TOKEN_FIELDS: TokenFieldDef[] = [
  { key: 'color-primary', label: 'Primär', kind: 'color' },
  { key: 'color-secondary', label: 'Sekundär', kind: 'color' },
  { key: 'color-bg', label: 'Hintergrund', kind: 'color' },
  { key: 'color-surface', label: 'Oberfläche', kind: 'color' },
  { key: 'color-text', label: 'Text', kind: 'color' },
  { key: 'color-accent', label: 'Akzent', kind: 'color' },
  { key: 'font-heading', label: 'Überschrift-Font', kind: 'font' },
  { key: 'font-body', label: 'Fließtext-Font', kind: 'font' },
  { key: 'font-size-base', label: 'Basis-Schriftgröße', kind: 'size' },
  { key: 'spacing-base', label: 'Basis-Abstand', kind: 'size' },
  { key: 'border-radius', label: 'Eckenradius', kind: 'size' },
]

export const ZONE_LAYOUTS: { value: ZoneLayout; label: string }[] = [
  { value: 'center', label: 'Zentriert' },
  { value: 'hero', label: 'Hero' },
  { value: 'top', label: 'Oben' },
  { value: 'split', label: 'Zwei Spalten' },
  { value: 'full', label: 'Vollflächig' },
]

export const TEXT_ALIGNS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: 'Links' },
  { value: 'center', label: 'Mitte' },
  { value: 'right', label: 'Rechts' },
]
