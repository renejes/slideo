import type { DesignTokens } from '@/types'

// Utilities rund um Design Tokens ↔ CSS Custom Properties.
// Ein Token "color-primary" wird zur CSS-Variable "--color-primary".

/** Wandelt das Token-Objekt in ein `--key: value`-Mapping. */
export function tokensToCssVars(tokens: DesignTokens): Record<string, string> {
  const vars: Record<string, string> = {}
  for (const [key, value] of Object.entries(tokens)) {
    vars[`--${key}`] = value
  }
  return vars
}

/** Wandelt das Token-Objekt in einen CSS-Deklarationsblock-Inhalt (für `:root` o.ä.). */
export function tokensToCssString(tokens: DesignTokens): string {
  return Object.entries(tokens)
    .map(([key, value]) => `  --${key}: ${value};`)
    .join('\n')
}

/** Wandelt das Token-Objekt in ein React-`style`-kompatibles Objekt mit CSS-Variablen. */
export function tokensToReactStyle(tokens: DesignTokens): React.CSSProperties {
  return tokensToCssVars(tokens) as React.CSSProperties
}
