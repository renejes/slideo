import { describe, it, expect } from 'vitest'
import { Editor } from '@tiptap/core'
import { baseExtensions } from './tiptap-extensions'
import { editorToMarkdown, htmlBlockToMarkdown } from './tiptap-markdown'

// ---------------------------------------------------------------------------
// Regressionsnetz für Befund B5 (Review 2026-08): das ProseMirror-Schema verwirft
// jede Mark, für die keine Extension registriert ist — STILL. Bis August 2026
// fehlte `@tiptap/extension-link`, wodurch jeder von der KI geschriebene Link beim
// ersten Tastendruck des Menschen zu reinem Text wurde. Diese Suite fixiert den
// Markdown-Round-Trip für alle Inline-Marks, auf die sich die App verlässt.
// ---------------------------------------------------------------------------

/** Markdown → Tiptap → Markdown, exakt der Weg, den ein Edit im Editor nimmt. */
function roundTrip(markdown: string): string {
  const editor = new Editor({ extensions: baseExtensions(), content: '' })
  try {
    const storage = editor.storage as { markdown?: { parser: { parse: (md: string) => unknown } } }
    editor.commands.setContent(storage.markdown!.parser.parse(markdown) as never)
    return editorToMarkdown(editor).trim()
  } finally {
    editor.destroy()
  }
}

describe('Markdown-Round-Trip durch den Editor', () => {
  it('erhält Inline-Links (B5)', () => {
    expect(roundTrip('Siehe [die Doku](https://example.com/a).')).toBe(
      'Siehe [die Doku](https://example.com/a).',
    )
  })

  it('erhält einen Link innerhalb eines Listenpunkts', () => {
    expect(roundTrip('- [Punkt](https://example.com)')).toContain('[Punkt](https://example.com)')
  })

  it('erhält fett, kursiv und Code', () => {
    const out = roundTrip('**fett** und *kursiv* und `code`')
    expect(out).toContain('**fett**')
    expect(out).toContain('*kursiv*')
    expect(out).toContain('`code`')
  })

  it('erhält Überschriftenebenen 1–3', () => {
    expect(roundTrip('# Eins')).toBe('# Eins')
    expect(roundTrip('## Zwei')).toBe('## Zwei')
    expect(roundTrip('### Drei')).toBe('### Drei')
  })

  it('erhält Bildreferenzen auf Assets', () => {
    expect(roundTrip('![Alt](assets/bild.png)')).toContain('assets/bild.png')
  })
})

describe('htmlBlockToMarkdown (Inline-Commit aus der Vorschau)', () => {
  it('konvertiert einen Anker zurück in Markdown-Link-Syntax (B5)', () => {
    expect(htmlBlockToMarkdown('<p>Siehe <a href="https://example.com">hier</a>.</p>')).toBe(
      'Siehe [hier](https://example.com).',
    )
  })

  it('konvertiert Überschrift + Inline-Marks', () => {
    expect(htmlBlockToMarkdown('<h2>Titel <strong>fett</strong></h2>')).toBe('## Titel **fett**')
  })

  it('verwirft <script> by construction (Audit S4)', () => {
    const out = htmlBlockToMarkdown('<p>ok<script>alert(1)</script></p>')
    expect(out).not.toContain('alert')
    expect(out).toContain('ok')
  })
})
