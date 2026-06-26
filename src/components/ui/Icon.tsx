import { ICON_CODEPOINTS } from '@/lib/icon-codepoints'

interface IconProps {
  /** Material-Symbols-Name, z.B. "add", "save", "play_arrow". */
  name: string
  /** Pixelgröße (Default 18). */
  size?: number
  /** Strichstärke 100–700 (Default 300 — dünn/elegant). */
  weight?: number
  /** Gefüllt statt Outline. */
  fill?: boolean
  className?: string
  title?: string
}

// Dünner Wrapper um die selbst-gehosteten, subgesetzten Material Symbols (Audit P1).
// currentColor folgt der Text-Farbe des Containers (wie in Penwright).
//
// Gerendert wird per CODEPOINT (nicht per Ligatur): das Font-Subset enthält nur die
// ~70 genutzten Glyphen (Codepoint-basiert subgesetzt, siehe src/styles/material-symbols.css
// + scripts/subset-icons.sh). Fehlt ein Name im Subset, wird der Klartext-Name angezeigt —
// ein sichtbarer Hinweis, ihn zu scripts/icon-names.txt hinzuzufügen und neu zu subsetten.
export function Icon({ name, size = 18, weight = 300, fill = false, className = '', title }: IconProps) {
  const cp = ICON_CODEPOINTS[name]
  const glyph = cp ? String.fromCodePoint(parseInt(cp, 16)) : name
  return (
    <span
      className={`material-symbols-outlined shrink-0 ${className}`}
      style={{
        fontSize: size,
        fontVariationSettings: `'FILL' ${fill ? 1 : 0}, 'wght' ${weight}, 'GRAD' 0, 'opsz' ${size}`,
      }}
      aria-hidden={title ? undefined : true}
      role={title ? 'img' : undefined}
      aria-label={title}
    >
      {glyph}
    </span>
  )
}
