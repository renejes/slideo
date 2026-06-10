// WCAG-Kontrast (Barrierefreiheit, Spec §19.7). Reine Funktionen, UI-frei.

function parseHex(color: string): [number, number, number] | null {
  const s = color.trim()
  let m = /^#([0-9a-f]{6})$/i.exec(s)
  if (m) {
    const n = parseInt(m[1], 16)
    return [(n >> 16) & 255, (n >> 8) & 255, n & 255]
  }
  m = /^#([0-9a-f]{3})$/i.exec(s)
  if (m) {
    const [r, g, b] = m[1].split('').map((c) => parseInt(c + c, 16))
    return [r, g, b]
  }
  return null
}

function luminance([r, g, b]: [number, number, number]): number {
  const f = (v: number) => {
    const x = v / 255
    return x <= 0.03928 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4)
  }
  return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
}

/** WCAG-Kontrastverhältnis (1–21) zweier Farben, oder null wenn nicht-hex. */
export function contrastRatio(fg: string, bg: string): number | null {
  const a = parseHex(fg)
  const b = parseHex(bg)
  if (!a || !b) return null
  const l1 = luminance(a)
  const l2 = luminance(b)
  const hi = Math.max(l1, l2)
  const lo = Math.min(l1, l2)
  return (hi + 0.05) / (lo + 0.05)
}

export interface ContrastRating {
  ratio: number
  label: string
  pass: boolean // erfüllt mind. AA für normalen Text (≥ 4.5)
}

/** Bewertet ein Kontrastverhältnis für normalen Fließtext (WCAG AA/AAA). */
export function rateContrast(ratio: number): ContrastRating {
  if (ratio >= 7) return { ratio, label: 'AAA', pass: true }
  if (ratio >= 4.5) return { ratio, label: 'AA', pass: true }
  if (ratio >= 3) return { ratio, label: 'nur große Schrift', pass: false }
  return { ratio, label: 'zu niedrig', pass: false }
}
