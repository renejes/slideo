import MarkdownIt from 'markdown-it'
import { generateJSON } from '@tiptap/html'
import type { JSONContent } from '@tiptap/react'
import { baseExtensions } from './tiptap-extensions'

// Markdown → HTML / Tiptap-JSON.
// Eine einzige markdown-it-Instanz dient als Konvertierungs-Engine; dieselbe
// Engine, die tiptap-markdown intern verwendet, sodass Editor und Renderer
// dasselbe Markdown gleich interpretieren.
const md: MarkdownIt = new MarkdownIt({
  html: true, // rohes HTML durchreichen ("custom HTML block", Zone N)
  linkify: true,
  typographer: true,
  breaks: false,
})

/** Markdown → HTML-String (für den Renderer / die Slide-Vorschau). */
export function markdownToHtml(markdown: string): string {
  return md.render(markdown ?? '')
}

/** Markdown → Tiptap-JSON (z.B. um den Editor programmatisch zu befüllen). */
export function markdownToTiptapJSON(markdown: string): JSONContent {
  return generateJSON(markdownToHtml(markdown), baseExtensions())
}

/**
 * Zerlegt Markdown in **Top-Level-Blöcke** (Absätze, Überschriften, Listen,
 * Bilder, Zitate, Code, '+++' …) anhand der markdown-it-Token-Grenzen
 * (`token.map` = Zeilenbereich der Block-Tokens auf Ebene 0). Robust gegenüber
 * mehrzeiligen Blöcken. Genutzt vom Renderer (Drag-Wrapping) und vom Store
 * (Reorder). `splitMarkdownBlocks(md).join('\n\n')` ist semantisch äquivalent.
 */
export function splitMarkdownBlocks(markdown: string): string[] {
  const src = markdown ?? ''
  const lines = src.split('\n')
  const tokens = md.parse(src, {})
  const blocks: string[] = []
  const covered = new Array(lines.length).fill(false)
  for (const t of tokens) {
    // Jeder Top-Level-Block erzeugt genau ein öffnendes/selbst-schließendes
    // Token auf Ebene 0 mit Zeilenbereich; schließende Tokens (nesting -1) skippen.
    if (t.level === 0 && t.nesting !== -1 && t.map) {
      const [start, end] = t.map
      for (let i = start; i < end; i++) covered[i] = true
      const block = lines.slice(start, end).join('\n').replace(/\s+$/, '')
      if (block.trim()) blocks.push(block)
    }
  }
  // Nicht abgedeckte, nicht-leere Zeilen bewahren: Link-Referenz-Definitionen (`[id]: url`)
  // konsumiert markdown-it in env.references und emittiert KEIN Token → sie gingen sonst
  // beim Split verloren und jeder Referenz-Link bräche. Als eigenen Block anhängen (die
  // Position einer Referenz-Def ist fürs Rendering bedeutungslos → beim Rejoin resolviert
  // markdown-it die Referenzen dokumentweit weiterhin korrekt).
  const orphan = lines.filter((l, i) => !covered[i] && l.trim())
  if (orphan.length) blocks.push(orphan.join('\n'))
  if (blocks.length === 0 && src.trim()) return [src.trim()]
  return blocks
}

function escAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/** Setzt/ersetzt `width:<w>` im style eines `<img>`-Tags (Klasse/übrige Props bleiben). */
function updateImgTagWidth(tag: string, width: string): string {
  if (/style\s*=\s*"/i.test(tag)) {
    return tag.replace(/style\s*=\s*"([^"]*)"/i, (_m, css: string) => {
      const rest = css
        .replace(/(^|;)\s*width\s*:[^;]*;?/gi, '$1')
        .split(';')
        .map((d) => d.trim())
        .filter(Boolean)
      return `style="${[...rest, `width:${width}`].join(';')}"`
    })
  }
  return tag.replace(/\s*\/?>$/, ` style="width:${width}">`)
}

/**
 * Setzt die Breite des (ersten) Bildes in einem Markdown-Block auf `width`
 * (z.B. "63%"). Default-Bilder `![]()` werden dabei zu rohem `<img style>`
 * (unser Positionierungs-Format, round-trip-sicher). Genutzt vom Bild-Resize
 * in der Vorschau (Spec §18.1).
 */
export function setBlockImageWidth(block: string, width: string): string {
  const trimmed = block.trim()
  // Roher <img …>-Block: Breite im style aktualisieren.
  const imgTag = /^<img\b[^>]*>/i.exec(trimmed)
  if (imgTag) {
    return updateImgTagWidth(imgTag[0], width) + trimmed.slice(imgTag[0].length)
  }
  // Markdown-Bild ![alt](src "title") → rohes <img> mit Breite.
  const mdImg = /^!\[([^\]]*)\]\(([^)\s]+)(?:\s+"([^"]*)")?\)\s*$/.exec(trimmed)
  if (mdImg) {
    const [, alt, src] = mdImg
    let tag = `<img src="${escAttr(src)}"`
    if (alt) tag += ` alt="${escAttr(alt)}"`
    tag += ` style="width:${width}">`
    return tag
  }
  return block
}
