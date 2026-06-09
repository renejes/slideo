import type { Editor } from '@tiptap/react'

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
