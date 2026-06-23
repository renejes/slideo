// Outline-Modus (Spec §19.9): zerlegt den Markdown-Inhalt einer Folie in
// Titel (erste Überschrift) + Rumpf (Rest) und setzt ihn wieder zusammen.
//
// Verlustfreier Round-Trip: `recombineOutline(parseOutline(md))` ist semantisch
// äquivalent zu `md` (modulo Whitespace-Normalisierung). Die Gliederung bearbeitet
// damit ausschließlich das bestehende Markdown — kein Datenmodell-Eingriff.

export interface OutlineParts {
  /** Überschriften-Ebene 1–6 (Default 1, falls keine Überschrift existiert). */
  level: number
  /** Titeltext (Text nach `#`…). Leer, wenn die Folie mit keiner Überschrift beginnt. */
  title: string
  /** Restlicher Markdown-Inhalt (Absätze, Listen, '+++' …). */
  body: string
}

const HEADING = /^(#{1,6})\s+(.*)$/

/** Erste nicht-leere Zeile (ohne CRLF). Leer, falls keine vorhanden. */
function firstContentLine(markdown: string): string {
  const lines = (markdown ?? '').replace(/\r\n?/g, '\n').split('\n')
  return lines.find((l) => l.trim() !== '') ?? ''
}

/** Ob die Folie mit einer ATX-Überschrift (`#`…) beginnt. */
export function hasHeading(markdown: string): boolean {
  return HEADING.test(firstContentLine(markdown))
}

/** Zerlegt Folien-Markdown in { level, title, body }. */
export function parseOutline(markdown: string): OutlineParts {
  // CRLF/CR → LF normalisieren, damit die Überschrift erkannt wird (sonst bricht
  // das Zeilenende-`\r` die Regex; sonst Titelverlust/Heading-Duplizierung). Für
  // reine LF-Inhalte ein No-op → Round-Trip bleibt verlustfrei.
  const src = (markdown ?? '').replace(/\r\n?/g, '\n')
  const lines = src.split('\n')
  let i = 0
  while (i < lines.length && lines[i].trim() === '') i++ // führende Leerzeilen überspringen
  const m = i < lines.length ? HEADING.exec(lines[i]) : null
  if (m) {
    const level = m[1].length
    const title = m[2]
    const body = lines
      .slice(i + 1)
      .join('\n')
      .replace(/^\n+/, '') // Leerzeilen direkt unter der Überschrift
      .replace(/\s+$/, '') // abschließender Whitespace
    return { level, title, body }
  }
  return { level: 1, title: '', body: src.replace(/\s+$/, '') }
}

/** Setzt { level, title, body } wieder zu Markdown zusammen. */
export function recombineOutline({ level, title, body }: OutlineParts): string {
  const t = title.trim()
  const b = body.replace(/\s+$/, '')
  if (t === '') return b // keine Überschrift → nur Rumpf
  const lvl = Math.min(6, Math.max(1, level))
  const heading = `${'#'.repeat(lvl)} ${t}`
  return b.trim() === '' ? heading : `${heading}\n\n${b}`
}
