import type { Presentation, Zone, AssetMap } from '@/types'

// PPTX-Export (Spec §19.5) — **native Rekonstruktion** (v1).
//
// Bewusste Entscheidung: WKWebView „verseucht" (taint) das Canvas beim Rastern
// von HTML (foreignObject) → bild-basierter Export ist in-app unzuverlässig.
// Stattdessen bauen wir echte PPTX-Objekte mit pptxgenjs: Token-Hintergründe,
// Textboxen (Überschriften/Listen/Zitate, inkl. Bold/Italic/Code) und Bilder.
// Zuverlässig auf jeder Plattform, voll offline, in PowerPoint editierbar.
//
// Grenzen (v1, dokumentiert): HTML-Zonen werden zu Text vereinfacht (Tags
// entfernt) + Hinweis; Komponenten/Charts (SVG in HTML-Zonen) und Custom-CSS
// werden NICHT originalgetreu übernommen; nur #RGB/#RRGGBB-Farben werden als
// PPTX-Farbe erkannt (sonst Token-Default).

// LAYOUT_WIDE = 13.33" × 7.5" (16:9).
const PAGE_W = 13.33
const PAGE_H = 7.5
const MARGIN = 0.55

interface Colors {
  text: string
  secondary: string
  accent: string
  bg: string
}

/** CSS-Farbe → 6-stelliger Hex ohne '#'; sonst Fallback. */
function hex(css: string | null | undefined, fallback: string): string {
  if (!css) return fallback
  const s = css.trim()
  let m = /^#([0-9a-fA-F]{6})$/.exec(s)
  if (m) return m[1].toUpperCase()
  m = /^#([0-9a-fA-F]{3})$/.exec(s)
  if (m)
    return m[1]
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()
  return fallback
}

/** Schriftname aus Token säubern (Anführungszeichen/Fallbacks weg). */
function fontName(token: string | undefined, fallback: string): string {
  if (!token) return fallback
  const first = token.split(',')[0].replace(/["']/g, '').trim()
  return first || fallback
}

type BlockKind = 'h1' | 'h2' | 'h3' | 'p' | 'quote' | 'code' | 'bullet' | 'number'
interface Block {
  kind: BlockKind
  text: string
}

/** Asset-Namen (Teil hinter `assets/`) aus Markdown/HTML extrahieren. */
function extractImages(content: string): string[] {
  const names: string[] = []
  const push = (ref: string) => {
    const i = ref.indexOf('assets/')
    const name = i >= 0 ? ref.slice(i + 'assets/'.length) : ref
    if (name && !names.includes(name)) names.push(name)
  }
  const mdImg = /!\[[^\]]*\]\(\s*([^)\s]+)[^)]*\)/g
  const htmlImg = /<img[^>]*\bsrc\s*=\s*["']([^"']+)["']/gi
  let m: RegExpExecArray | null
  while ((m = mdImg.exec(content))) push(m[1])
  while ((m = htmlImg.exec(content))) push(m[1])
  return names
}

/** Markdown → vereinfachte Blockliste (Bilder vorher entfernt). */
export function parseBlocks(markdown: string): Block[] {
  const noImg = markdown
    .replace(/!\[[^\]]*\]\([^)]*\)/g, '')
    .replace(/<img[^>]*>/gi, '')
  const blocks: Block[] = []
  let inCode = false
  for (const raw of noImg.split('\n')) {
    const line = raw.replace(/\s+$/, '')
    const s = line.trim()
    if (/^```/.test(s)) {
      inCode = !inCode
      continue
    }
    if (inCode) {
      if (line.trim()) blocks.push({ kind: 'code', text: line })
      continue
    }
    if (!s || /^\+\+\+$/.test(s)) continue
    if (/^(-{3,}|\*{3,}|_{3,})$/.test(s)) continue // horizontale Linie
    if (/^###\s+/.test(s)) blocks.push({ kind: 'h3', text: s.replace(/^###\s+/, '') })
    else if (/^##\s+/.test(s)) blocks.push({ kind: 'h2', text: s.replace(/^##\s+/, '') })
    else if (/^#\s+/.test(s)) blocks.push({ kind: 'h1', text: s.replace(/^#\s+/, '') })
    else if (/^>\s?/.test(s)) blocks.push({ kind: 'quote', text: s.replace(/^>\s?/, '') })
    else if (/^[-*+]\s+/.test(s)) blocks.push({ kind: 'bullet', text: s.replace(/^[-*+]\s+/, '') })
    else if (/^\d+\.\s+/.test(s)) blocks.push({ kind: 'number', text: s.replace(/^\d+\.\s+/, '') })
    else blocks.push({ kind: 'p', text: s })
  }
  return blocks
}

interface RunOpts {
  fontSize: number
  color: string
  fontFace: string
  bold?: boolean
  italic?: boolean
  bullet?: boolean | { type: 'number' }
  breakLine?: boolean
}

function baseStyle(kind: BlockKind, c: Colors, headingFont: string, bodyFont: string): RunOpts {
  switch (kind) {
    case 'h1':
      return { fontSize: 34, bold: true, color: c.text, fontFace: headingFont }
    case 'h2':
      return { fontSize: 26, bold: true, color: c.text, fontFace: headingFont }
    case 'h3':
      return { fontSize: 20, bold: true, color: c.text, fontFace: headingFont }
    case 'quote':
      return { fontSize: 17, italic: true, color: c.secondary, fontFace: bodyFont }
    case 'code':
      return { fontSize: 13, color: c.text, fontFace: 'Courier New' }
    default:
      return { fontSize: 16, color: c.text, fontFace: bodyFont }
  }
}

/** Inline-Markdown (Bold/Italic/Code, Links→Text) → Run-Liste mit Optionen. */
function inlineRuns(text: string, base: RunOpts, accent: string): { text: string; options: RunOpts }[] {
  const clean = text.replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  const runs: { text: string; options: RunOpts }[] = []
  // Einzel-Unterstrich-Italic nur an Wortgrenzen, damit snake_case-Bezeichner
  // (foo_bar_baz) nicht fälschlich kursiv werden (wie in markdown-it/CommonMark).
  const re = /(\*\*[^*]+\*\*|__[^_]+__|\*[^*\s][^*]*\*|(?<![A-Za-z0-9])_[^_\s][^_]*_(?![A-Za-z0-9])|`[^`]+`)/g
  let last = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(clean))) {
    if (m.index > last) runs.push({ text: clean.slice(last, m.index), options: { ...base } })
    const tok = m[0]
    if (tok.startsWith('**') || tok.startsWith('__'))
      runs.push({ text: tok.slice(2, -2), options: { ...base, bold: true, color: accent } })
    else if (tok.startsWith('`'))
      runs.push({ text: tok.slice(1, -1), options: { ...base, fontFace: 'Courier New' } })
    else runs.push({ text: tok.slice(1, -1), options: { ...base, italic: true } })
    last = re.lastIndex
  }
  if (last < clean.length) runs.push({ text: clean.slice(last), options: { ...base } })
  if (runs.length === 0) runs.push({ text: clean, options: { ...base } })
  return runs
}

/** Blockliste → flache Run-Liste für pptx.addText (breakLine/bullet pro Block). */
function blocksToRuns(blocks: Block[], c: Colors, headingFont: string, bodyFont: string) {
  const runs: { text: string; options: RunOpts }[] = []
  for (const b of blocks) {
    const base = baseStyle(b.kind, c, headingFont, bodyFont)
    const inline = inlineRuns(b.text, base, c.accent)
    // Bullet nur auf den ERSTEN Run des Absatzes: pptxgenjs startet bei jedem Run
    // mit `bullet` einen neuen Absatz, sonst zersplittert ein Listenpunkt mit
    // Inline-Markdown (z.B. „- **A** B") in mehrere Aufzählungspunkte.
    if (b.kind === 'bullet') inline[0].options.bullet = true
    if (b.kind === 'number') inline[0].options.bullet = { type: 'number' }
    inline[inline.length - 1].options.breakLine = true
    runs.push(...inline)
  }
  return runs
}

/** HTML-Zone → reiner Text (Tags/Style/Script entfernt). */
function htmlToText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|div|h1|h2|h3|li)>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

/** Bilder als Zeile platzieren (gleichmäßig über die Breite). */
function addImageRow(
  slide: any,
  names: string[],
  assets: AssetMap,
  area: { x: number; y: number; w: number; h: number },
) {
  // Quelle auflösen: Asset-Name → Data-URI; bereits eingebettete data:-URIs bzw.
  // http(s)-URLs direkt nutzen (sonst würden sie still verschwinden).
  const sources = names
    .map((n): { data: string } | { path: string } | null => {
      if (/^data:/i.test(n)) return { data: n }
      if (/^https?:/i.test(n)) return { path: n }
      const d = assets[n]
      return d ? { data: d } : null
    })
    .filter((s): s is { data: string } | { path: string } => s !== null)
  if (sources.length === 0) return
  const gap = 0.3
  const w = (area.w - gap * (sources.length - 1)) / sources.length
  sources.forEach((src, i) => {
    slide.addImage({
      ...src,
      x: area.x + i * (w + gap),
      y: area.y,
      w,
      h: area.h,
      sizing: { type: 'contain', w, h: area.h },
    })
  })
}

function addLogo(slide: any, presentation: Presentation, assets: AssetMap) {
  const logo = presentation.meta.logo
  const data = logo && assets[logo.asset]
  if (!logo || !data) return
  const w = 1.4
  const h = 0.7
  const corners: Record<string, { x: number; y: number }> = {
    'top-left': { x: 0.4, y: 0.3 },
    'top-right': { x: PAGE_W - w - 0.4, y: 0.3 },
    'bottom-left': { x: 0.4, y: PAGE_H - h - 0.3 },
    'bottom-right': { x: PAGE_W - w - 0.4, y: PAGE_H - h - 0.3 },
  }
  // Default = unten-rechts (App-Default). Ein hand-editiertes/geteiltes .slideo kann eine
  // Nicht-Ecke tragen (schemafreies Format) → nicht den GESAMTEN PPTX-Export crashen lassen
  // (HTML/PDF degradieren dort ebenfalls grazil).
  const pos = corners[logo.position] ?? corners['bottom-right']
  slide.addImage({ data, x: pos.x, y: pos.y, w, h, sizing: { type: 'contain', w, h } })
}

function renderZone(
  slide: any,
  zone: Zone,
  presentation: Presentation,
  assets: AssetMap,
  c: Colors,
  headingFont: string,
  bodyFont: string,
) {
  slide.background = { color: hex(zone.style.background, c.bg) }
  const valign = zone.style.layout === 'top' ? 'top' : 'middle'
  const align = zone.style.layout === 'hero' ? 'center' : zone.style.text_align

  if (zone.content_type === 'html') {
    const text = htmlToText(zone.html ?? '')
    const images = extractImages(zone.html ?? '')
    const runs: { text: string; options: RunOpts }[] = [
      {
        text: 'HTML-Folie — in PPTX vereinfacht',
        options: { fontSize: 12, italic: true, color: c.secondary, fontFace: bodyFont, breakLine: true },
      },
    ]
    if (text) {
      const base: RunOpts = { fontSize: 16, color: c.text, fontFace: bodyFont }
      for (const para of text.split('\n')) {
        if (!para.trim()) continue
        const inline = inlineRuns(para, base, c.accent)
        inline[inline.length - 1].options.breakLine = true
        runs.push(...inline)
      }
    }
    const textH = images.length ? PAGE_H - 2.6 : PAGE_H - 1.4
    slide.addText(runs, { x: MARGIN, y: 0.5, w: PAGE_W - 2 * MARGIN, h: textH, valign: 'top', align: 'left' })
    if (images.length)
      addImageRow(slide, images, assets, { x: MARGIN, y: PAGE_H - 1.9, w: PAGE_W - 2 * MARGIN, h: 1.5 })
    addLogo(slide, presentation, assets)
    return
  }

  // Zwei-Spalten-Layout: an +++ getrennt, zwei Textboxen nebeneinander. Ohne
  // Trenner gibt es nur eine Spalte → unten als Vollbreite rendern (wie der Renderer).
  const splitParts =
    zone.style.layout === 'split' ? zone.markdown.split(/^[ \t]*\+\+\+[ \t]*$/m) : []
  if (splitParts.length >= 2) {
    const parts = splitParts
    const colW = (PAGE_W - 2 * MARGIN - 0.5) / 2
    ;[0, 1].forEach((i) => {
      const runs = blocksToRuns(parseBlocks(parts[i] ?? ''), c, headingFont, bodyFont)
      if (runs.length)
        slide.addText(runs, {
          x: MARGIN + i * (colW + 0.5),
          y: 0.5,
          w: colW,
          h: PAGE_H - 1.0,
          valign: 'middle',
          align: 'left',
        })
    })
    addLogo(slide, presentation, assets)
    return
  }

  const blocks = parseBlocks(zone.markdown)
  const runs = blocksToRuns(blocks, c, headingFont, bodyFont)
  const images = extractImages(zone.markdown)

  if (runs.length && images.length) {
    slide.addText(runs, { x: MARGIN, y: 0.45, w: PAGE_W - 2 * MARGIN, h: 3.9, valign, align })
    addImageRow(slide, images, assets, { x: MARGIN, y: 4.6, w: PAGE_W - 2 * MARGIN, h: 2.4 })
  } else if (runs.length) {
    slide.addText(runs, { x: 0.7, y: 0.5, w: PAGE_W - 1.4, h: PAGE_H - 1.0, valign, align })
  } else if (images.length) {
    addImageRow(slide, images, assets, { x: 1.2, y: 0.6, w: PAGE_W - 2.4, h: PAGE_H - 1.2 })
  }
  addLogo(slide, presentation, assets)
}

/**
 * Baut die Präsentation als PPTX und gibt sie als base64-String zurück
 * (zum Schreiben über das Rust-Backend bzw. Browser-Download).
 */
export async function buildPptxBase64(
  presentation: Presentation,
  assets: AssetMap,
): Promise<string> {
  const { default: PptxGenJS } = await import('pptxgenjs')
  const pptx = new PptxGenJS()
  pptx.layout = 'LAYOUT_WIDE'
  pptx.title = presentation.meta.title

  const t = presentation.tokens
  const colors: Colors = {
    text: hex(t['color-text'], 'F1F5F9'),
    secondary: hex(t['color-secondary'], '818CF8'),
    accent: hex(t['color-accent'], 'E94560'),
    bg: hex(t['color-bg'], '0F0F0F'),
  }
  const headingFont = fontName(t['font-heading'], 'Arial')
  const bodyFont = fontName(t['font-body'], 'Arial')

  const zones = [...presentation.zones].sort((a, b) => a.order - b.order)
  for (const zone of zones) {
    const slide = pptx.addSlide()
    renderZone(slide, zone, presentation, assets, colors, headingFont, bodyFont)
  }

  return (await pptx.write({ outputType: 'base64' })) as string
}
