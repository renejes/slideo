import { useEffect, useRef } from 'react'
import { EditorView, keymap, lineNumbers } from '@codemirror/view'
import { EditorState } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { css } from '@codemirror/lang-css'

interface CssEditorProps {
  initialCss: string
  onChange: (css: string) => void
}

const lightTheme = EditorView.theme(
  {
    '&': { backgroundColor: '#fafafa', color: '#1a1a1a' },
    '.cm-content': { padding: '8px 4px', caretColor: '#2f63e6' },
    '.cm-gutters': { backgroundColor: '#fafafa', color: '#b3b3b3', border: 'none' },
    '&.cm-focused .cm-selectionBackground, .cm-selectionBackground, ::selection': {
      backgroundColor: '#dbe5fd',
    },
    '.cm-cursor': { borderLeftColor: '#2f63e6' },
  },
  { dark: false },
)

// CodeMirror-Editor für zonen-gescoptes Custom-CSS (separat vom Text).
export function CssEditor({ initialCss, onChange }: CssEditorProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  useEffect(() => {
    if (!hostRef.current) return
    const view = new EditorView({
      parent: hostRef.current,
      state: EditorState.create({
        doc: initialCss,
        extensions: [
          lineNumbers(),
          history(),
          keymap.of([...defaultKeymap, ...historyKeymap, indentWithTab]),
          css(),
          lightTheme,
          EditorView.lineWrapping,
          EditorView.updateListener.of((update) => {
            if (update.docChanged) onChangeRef.current(update.state.doc.toString())
          }),
        ],
      }),
    })
    viewRef.current = view
    return () => {
      view.destroy()
      viewRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Externe Änderungen (z.B. MCP set_zone_css) übernehmen, ohne Cursor-Sprung.
  useEffect(() => {
    const view = viewRef.current
    if (!view) return
    const current = view.state.doc.toString()
    if (current !== initialCss) {
      view.dispatch({ changes: { from: 0, to: current.length, insert: initialCss } })
    }
  }, [initialCss])

  return <div ref={hostRef} className="overflow-hidden rounded-lg border border-chrome-border" />
}
