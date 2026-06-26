import Image from '@tiptap/extension-image'
import { mergeAttributes } from '@tiptap/core'
import { defaultMarkdownSerializer } from '@tiptap/pm/markdown'
import { resolveAsset } from './asset-resolver'

// Bild-Extension mit Positionierungs-Attributen (Spec §18.1 „Light"):
// width (z.B. "50%"), align (left|center|right, im Fluss) und float (left|right,
// mit Textumfluss). Bleibt fluss-basiert — keine absoluten Koordinaten.
//
// Persistenz/Round-Trip (wichtig): Bilder OHNE Sonder-Attribute werden weiter als
// Markdown `![alt](src)` serialisiert (bleiben sauber). Bilder MIT Attributen
// werden als rohes `<img src style class>` geschrieben — markdown-it (html:true)
// rendert das, und parseHTML liest die Attribute wieder ein (round-trip-sicher).

export type ImageAlign = 'left' | 'center' | 'right'
export type ImageFloat = 'left' | 'right'

function classAlign(el: HTMLElement): ImageAlign | null {
  if (el.classList.contains('align-left')) return 'left'
  if (el.classList.contains('align-center')) return 'center'
  if (el.classList.contains('align-right')) return 'right'
  return null
}

function classFloat(el: HTMLElement): ImageFloat | null {
  if (el.classList.contains('float-left')) return 'left'
  if (el.classList.contains('float-right')) return 'right'
  return null
}

function escAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

export const SlideoImage = Image.extend({
  addAttributes() {
    return {
      ...this.parent?.(),
      width: {
        default: null,
        parseHTML: (el) => (el as HTMLElement).style.width || el.getAttribute('width') || null,
        renderHTML: () => ({}), // wird in renderHTML() des Nodes zusammengebaut
      },
      align: {
        default: null,
        parseHTML: (el) => classAlign(el as HTMLElement),
        renderHTML: () => ({}),
      },
      float: {
        default: null,
        parseHTML: (el) => classFloat(el as HTMLElement),
        renderHTML: () => ({}),
      },
    }
  },

  // width → Inline-Style, align/float → CSS-Klassen (vom Renderer gestylt).
  // src: `assets/<name>` wird NUR für die Editor-Anzeige zur Data-URI aufgelöst
  // (Modell/Markdown behalten `assets/<name>` — siehe asset-resolver.ts).
  renderHTML({ HTMLAttributes, node }) {
    const { src, width, align, float } = node.attrs as {
      src: string | null
      width: string | null
      align: ImageAlign | null
      float: ImageFloat | null
    }
    const extra: Record<string, string> = {}
    if (typeof src === 'string' && src.startsWith('assets/')) {
      const resolved = resolveAsset(src.slice('assets/'.length))
      if (resolved) extra.src = resolved
    }
    if (width) extra.style = `width:${width}`
    const classes: string[] = []
    if (align) classes.push(`align-${align}`)
    if (float) classes.push(`float-${float}`)
    if (classes.length) extra.class = classes.join(' ')
    return ['img', mergeAttributes(this.options.HTMLAttributes, HTMLAttributes, extra)]
  },

  // Markdown-Serialisierung: Default-Bild → `![]()`, sonst rohes <img>.
  addStorage() {
    return {
      markdown: {
        serialize(state: any, node: any, parent: any, index: number) {
          const { width, align, float, src, alt } = node.attrs
          if (!width && !align && !float) {
            // unverändertes Bild: bewährte Markdown-Serialisierung beibehalten.
            defaultMarkdownSerializer.nodes.image(state, node, parent, index)
            return
          }
          const classes: string[] = []
          if (align) classes.push(`align-${align}`)
          if (float) classes.push(`float-${float}`)
          let html = `<img src="${escAttr(src ?? '')}"`
          if (alt) html += ` alt="${escAttr(alt)}"`
          if (width) html += ` style="width:${escAttr(width)}"`
          if (classes.length) html += ` class="${classes.join(' ')}"`
          html += '>'
          state.write(html)
          if (node.isBlock) state.closeBlock(node)
        },
        parse: {
          // markdown-it (html:true) übernimmt das Parsen des rohen <img>.
        },
      },
    }
  },
})
