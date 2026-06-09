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
