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

// Dünner Wrapper um die selbst-gehosteten Material Symbols.
// currentColor folgt der Text-Farbe des Containers (wie in Penwright).
export function Icon({ name, size = 18, weight = 300, fill = false, className = '', title }: IconProps) {
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
      {name}
    </span>
  )
}
