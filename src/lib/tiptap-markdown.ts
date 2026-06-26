import { Editor } from '@tiptap/core'
import { baseExtensions } from './tiptap-extensions'

// Tiptap-JSON → Markdown.
// Die tiptap-markdown-Extension hängt einen Serializer an `editor.storage.markdown`.
// Im normalen Datenfluss liefert der Editor das Markdown direkt bei jedem Update
// (siehe ZoneCard/TiptapEditor) — daher genügt dieser dünne Helfer.

/** Gibt den aktuellen Editor-Inhalt als Markdown zurück. */
export function editorToMarkdown(editor: Editor): string {
  // `getMarkdown()` wird von tiptap-markdown bereitgestellt.
  const storage = editor.storage as { markdown?: { getMarkdown: () => string } }
  return storage.markdown?.getMarkdown() ?? ''
}

/**
 * Editiertes Block-HTML (aus der Vorschau-Direktmanipulation, editor-cleanup Punkt 3b)
 * → Markdown. Konvertiert über eine **transiente** Tiptap-Instanz mit denselben
 * Extensions wie der Editor → exakt dieselben MD↔HTML-Regeln (eine Quelle der Wahrheit),
 * inkl. Inline-Marks (bold/italic/code/link) und Überschrift-Level. ProseMirrors
 * schema-beschränkter Parser verwirft dabei Nicht-Schema-Knoten (`<script>`/`on*`),
 * Sanitisierung by construction (Audit S4). Headless: braucht ein DOM → läuft im
 * Browser/WebView (nicht in Node). Aufrufer ist die selten feuernde Inline-Commit-Stelle.
 */
export function htmlBlockToMarkdown(html: string): string {
  const editor = new Editor({ extensions: baseExtensions(), content: html })
  try {
    return editorToMarkdown(editor).trim()
  } finally {
    editor.destroy()
  }
}
