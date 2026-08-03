// Alle zentralen TypeScript-Typen für Slideo.
// Maßgeblich: docs/slideo-spec.md, Abschnitt 8.

import { t } from '@/i18n'

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
  /**
   * Sprache der FOLIEN (nicht der App-Oberfläche) als BCP-47-Tag, z.B. 'de' oder
   * 'en'. Additiv wie `transition`/`logo`, `version` bleibt "1.0"; fehlt das Feld,
   * gilt 'de'.
   *
   * Steuert das `lang`-Attribut in Vorschau, Präsentation, Standalone-Export,
   * PDF-Druck und Thumbnails — und damit Silbentrennung, Screenreader-Aussprache
   * und konkret die Rechtschreibprüfung im `contenteditable` beim §20-Inline-Edit:
   * ein englisches Deck bei `lang="de"` bekäme dort jedes Wort unterkringelt.
   *
   * Bewusst NICHT an die Oberflächensprache gekoppelt — sonst trüge dasselbe Deck
   * je nach Einstellung des Exportierenden ein anderes `lang`, der Sprachschalter
   * veränderte also ausgelieferte Dateien. Beim Anlegen wird das Feld einmal aus
   * der Oberflächensprache vorbelegt und wandert danach mit der Datei.
   */
  language?: string
}

export type LogoPosition = 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right'

export interface BrandLogo {
  asset: string // Bild-Asset in assets/
  position: LogoPosition
}

// Diese Label-Listen werden auf Modulebene ausgewertet. Das ist zulässig, weil die
// Anzeigesprache beim Start feststeht (ein Wechsel wirkt erst nach Neustart, siehe
// i18n/index.ts). `value` bleibt der API-Wert, nur `label` ist Anzeigetext.
export const LOGO_POSITIONS: { value: LogoPosition; label: string }[] = [
  { value: 'top-left', label: t('editor.logoPos.topLeft') },
  { value: 'top-right', label: t('editor.logoPos.topRight') },
  { value: 'bottom-left', label: t('editor.logoPos.bottomLeft') },
  { value: 'bottom-right', label: t('editor.logoPos.bottomRight') },
]

export type TransitionKind = 'none' | 'fade' | 'slide' | 'zoom' | 'auto'

/** Präsentations-weiter Folienübergang (Spec §18.3). */
export interface Transition {
  kind: TransitionKind
  duration_ms: number
}

export const DEFAULT_TRANSITION: Transition = { kind: 'none', duration_ms: 500 }

export const TRANSITIONS: { value: TransitionKind; label: string }[] = [
  { value: 'none', label: t('editor.transition.none') },
  { value: 'fade', label: t('editor.transition.fade') },
  { value: 'slide', label: t('editor.transition.slide') },
  { value: 'zoom', label: t('editor.transition.zoom') },
  { value: 'auto', label: t('editor.transition.auto') },
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
  { key: 'color-primary', label: t('editor.token.colorPrimary'), kind: 'color' },
  { key: 'color-secondary', label: t('editor.token.colorSecondary'), kind: 'color' },
  { key: 'color-bg', label: t('editor.token.colorBg'), kind: 'color' },
  { key: 'color-surface', label: t('editor.token.colorSurface'), kind: 'color' },
  { key: 'color-text', label: t('editor.token.colorText'), kind: 'color' },
  { key: 'color-accent', label: t('editor.token.colorAccent'), kind: 'color' },
  { key: 'font-heading', label: t('editor.token.fontHeading'), kind: 'font' },
  { key: 'font-body', label: t('editor.token.fontBody'), kind: 'font' },
  { key: 'font-size-base', label: t('editor.token.fontSizeBase'), kind: 'size' },
  { key: 'spacing-base', label: t('editor.token.spacingBase'), kind: 'size' },
  { key: 'border-radius', label: t('editor.token.borderRadius'), kind: 'size' },
]

export const ZONE_LAYOUTS: { value: ZoneLayout; label: string }[] = [
  { value: 'center', label: t('editor.layout.center') },
  { value: 'hero', label: t('editor.layout.hero') },
  { value: 'top', label: t('editor.layout.top') },
  { value: 'split', label: t('editor.layout.split') },
  { value: 'full', label: t('editor.layout.full') },
]

export const TEXT_ALIGNS: { value: TextAlign; label: string }[] = [
  { value: 'left', label: t('editor.textAlign.left') },
  { value: 'center', label: t('editor.textAlign.center') },
  { value: 'right', label: t('editor.textAlign.right') },
]
