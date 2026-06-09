import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers, highlightActiveLine } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'

// Dezentes Light-Theme, passend zum App-Chrome (Penwright-nah).
const lightTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#fafafa', color: '#1a1a1a' },
    '.cm-content': { padding: '10px 4px', caretColor: '#2f63e6' },
    '.cm-gutters': { backgroundColor: '#fafafa', color: '#b3b3b3', border: 'none' },
    '.cm-activeLine': { backgroundColor: 'rgba(0,0,0,0.025)' },
    '.cm-activeLineGutter': { backgroundColor: 'transparent', color: '#737373' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: '#dbe5fd',
    },
    '.cm-cursor': { borderLeftColor: '#2f63e6' },
  },
  { dark: false },
)

interface HtmlEditorProps {
  /** Initialer HTML-Inhalt (wird nur beim Mount gesetzt). */
  initialHtml: string
  onChange: (html: string) => void
  onFocus?: () => void
}

// CodeMirror-6-Editor für HTML-Zonen (Spec §14). HTML-Sprachsupport bringt
// eingebettetes CSS- und JS-Highlighting mit.
export function HtmlEditor({ initialHtml, onChange, onFocus }: HtmlEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  useEffect(() => {
    if (!hostRef.current) return

    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialHtml,
        extensions: [
          lineNumbers(),
          highlightActiveLine(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          html(),
          lightTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) {
              onChangeRef.current(update.state.doc.toString())
            }
            if (update.focusChanged && update.view.hasFocus) {
              onFocusRef.current?.()
            }
          }),
        ],
      }),
    })
    viewRef.current = view

    return () => {
      view.destroy()
      viewRef.current = null
    }
    // Bewusst nur beim Mount erstellen.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Externe Inhaltsänderungen (Bild-Import, MCP-Live-Edits) übernehmen.
  // Geschützt: nur wenn sich der Inhalt wirklich unterscheidet (kein Cursor-Sprung beim Tippen).
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== initialHtml) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: initialHtml } })
    }
  }, [initialHtml])

  return <div ref={hostRef} className="overflow-hidden rounded-lg" />
}
