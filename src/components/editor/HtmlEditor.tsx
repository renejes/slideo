import { useEffect, useRef } from 'react'
import { useLicenseStore } from '@/store/license'
import {
  EditorView,
  keymap,
  lineNumbers,
  highlightActiveLine,
  Decoration,
  type DecorationSet,
} from '@codemirror/view'
import { Compartment, EditorState, StateField, StateEffect } from '@codemirror/state'
import { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands'
import { html } from '@codemirror/lang-html'
import { useUiStore } from '@/store/ui'
import { insertSelectionIntoChat } from '@/lib/chat/insertAnchor'

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
    // „Klick → Quelle"-Markierung (Spec §20): sichtbar AUCH ohne Editor-Fokus
    // (die native Selektion zeigt CodeMirror nur fokussiert) → eigene Dekoration.
    '.cm-reveal-highlight': { backgroundColor: 'rgba(79,125,249,0.22)', borderRadius: '2px' },
  },
  { dark: false },
)

// Persistente Highlight-Dekoration für die zuletzt per „Klick → Quelle" gezeigte
// Quell-Range (fokus-unabhängig sichtbar, anders als die native Selektion).
const setRevealMark = StateEffect.define<{ from: number; to: number } | null>()
const revealMarkDeco = Decoration.mark({ class: 'cm-reveal-highlight' })
const revealField = StateField.define<DecorationSet>({
  create: () => Decoration.none,
  update(deco, tr) {
    deco = deco.map(tr.changes)
    for (const e of tr.effects) {
      if (e.is(setRevealMark)) {
        deco =
          e.value && e.value.to > e.value.from
            ? Decoration.set([revealMarkDeco.range(e.value.from, e.value.to)])
            : Decoration.none
      }
    }
    return deco
  },
  provide: (f) => EditorView.decorations.from(f),
})

interface HtmlEditorProps {
  /** Zone-ID dieser HTML-Zone (für „Klick → Quelle", Spec §20). */
  zoneId: string
  /** Initialer HTML-Inhalt (wird nur beim Mount gesetzt). */
  initialHtml: string
  onChange: (html: string) => void
  onFocus?: () => void
}

// CodeMirror-6-Editor für HTML-Zonen (Spec §14). HTML-Sprachsupport bringt
// eingebettetes CSS- und JS-Highlighting mit.
export function HtmlEditor({ zoneId, initialHtml, onChange, onFocus }: HtmlEditorProps) {
  // Nur den Reveal DIESER Zone abonnieren → kein Re-Render bei Auswahl anderer Zonen.
  const reveal = useUiStore((s) => (s.htmlReveal?.zoneId === zoneId ? s.htmlReveal : null))
  const hostRef = useRef<HTMLDivElement>(null)
  const viewRef = useRef<EditorView | null>(null)
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange
  const onFocusRef = useRef(onFocus)
  onFocusRef.current = onFocus

  // Read-only nach Trial-Ablauf: der Editor wird WIRKLICH gesperrt (Befund B2).
  // Ein Compartment ist noetig, weil die EditorState-Extensions nur beim Mount
  // gesetzt werden — ohne ihn liesse sich weiter tippen, waehrend der Store die
  // Aenderung still verwirft.
  const editableRef = useRef(new Compartment())
  const editingAllowed = useLicenseStore((s) => s.status?.editing_allowed ?? true)
  const editingAllowedRef = useRef(editingAllowed)

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
          editableRef.current.of(EditorView.editable.of(editingAllowedRef.current)),
          revealField,
          lightTheme,
          EditorView.lineWrapping,
          EditorView.domEventHandlers({
            contextmenu(event, view) {
              const sel = view.state.selection.main
              if (sel.empty) return false
              const selectionText = view.state.sliceDoc(sel.from, sel.to)
              if (!selectionText.trim()) return false
              event.preventDefault()
              insertSelectionIntoChat({
                file: zoneId,
                selectionText,
                prefix: view.state.sliceDoc(0, sel.from),
                nodeType: 'html',
              })
              return true
            },
          }),
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


  // Sperre bei Statuswechsel nachziehen (der Editor wird nur beim Mount erstellt).
  useEffect(() => {
    editingAllowedRef.current = editingAllowed
    const view = viewRef.current
    if (!view) return
    view.dispatch({
      effects: editableRef.current.reconfigure(EditorView.editable.of(editingAllowed)),
    })
  }, [editingAllowed])

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

  // „Klick → Quelle" (Spec §20): bei Reveal für diese Zone die Quell-Range
  // sichtbar markieren (Dekoration, fokus-unabhängig) + Selektion setzen +
  // dorthin scrollen. `nonce` triggert auch bei gleicher Range erneut.
  // `view.focus()` nur, wenn `focusEditor` gesetzt ist — im Direktbearbeiten-Modus
  // bleibt der Fokus im Vorschau-Iframe (sonst sterben dessen Tastatur-Ops).
  useEffect(() => {
    const view = viewRef.current
    if (!view || !reveal) return
    const len = view.state.doc.length
    const from = Math.max(0, Math.min(reveal.from, len))
    const to = Math.max(from, Math.min(reveal.to, len))
    view.dispatch({
      selection: { anchor: from, head: to },
      scrollIntoView: true,
      effects: setRevealMark.of({ from, to }),
    })
    if (reveal.focusEditor) view.focus()
  }, [reveal])

  return <div ref={hostRef} className="overflow-hidden rounded-lg" />
}
