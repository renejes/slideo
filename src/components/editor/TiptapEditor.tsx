import { useEditor, EditorContent } from '@tiptap/react'
import Placeholder from '@tiptap/extension-placeholder'
import { useEffect, useRef } from 'react'
import { baseExtensions } from '@/lib/tiptap-extensions'
import { editorToMarkdown } from '@/lib/tiptap-markdown'
import { useLicenseStore } from '@/store/license'
import { ImageToolbar } from './ImageToolbar'

interface TiptapEditorProps {
  /** Initialer Inhalt als Markdown (wird nur beim Mount gesetzt). */
  initialMarkdown: string
  /** Wird bei jeder Änderung mit dem aktuellen Markdown aufgerufen. */
  onChange: (markdown: string) => void
  /** Fokus-Callback (z.B. um die Zone als aktiv zu markieren). */
  onFocus?: () => void
}

// Eine Tiptap-Instanz pro Zone. Der Editor ist die Quelle der Wahrheit fürs
// Tippen; bei jeder Änderung liefert er Markdown zurück, das im Store landet.
export function TiptapEditor({ initialMarkdown, onChange, onFocus }: TiptapEditorProps) {
  // onChange als Ref halten, damit der Editor nicht bei jedem Render neu konfiguriert wird.
  const onChangeRef = useRef(onChange)
  onChangeRef.current = onChange

  // Read-only-Zustand (Trial abgelaufen). Siehe Effekt unten — der Editor wird
  // WIRKLICH gesperrt statt Eingaben still zu verwerfen.
  const editingAllowed = useLicenseStore((s) => s.status?.editing_allowed ?? true)

  const editor = useEditor({
    extensions: [
      ...baseExtensions(),
      Placeholder.configure({ placeholder: 'Schreib hier deinen Slide-Inhalt …' }),
    ],
    content: initialMarkdown,
    editorProps: {
      attributes: { class: 'tiptap-content', spellcheck: 'true' },
    },
    onUpdate: ({ editor }) => {
      onChangeRef.current(editorToMarkdown(editor))
    },
  })

  useEffect(() => {
    if (!editor || !onFocus) return
    editor.on('focus', onFocus)
    return () => {
      editor.off('focus', onFocus)
    }
  }, [editor, onFocus])

  // Nach Trial-Ablauf den Editor tatsächlich sperren (Review 2026-08, Befund B2).
  //
  // Vorher war das der schlimmste stille Fehler der App: `mutate` lehnte die
  // Tipp-Mutation ohne Rückmeldung ab (bewusst, gegen Toast-Flut), Tiptap ist aber
  // uncontrolled und re-synct nur, wenn sich `initialMarkdown` ÄNDERT — was nie
  // passierte, weil der Store ja abgelehnt hatte. Der Nutzer schrieb also eine
  // ganze Folie, sah sie im Editor stehen, und die Vorschau blieb stumm. Beim
  // Speichern landete der alte Text auf Platte, mit grünem „Gespeichert."-Toast.
  useEffect(() => {
    if (!editor) return
    editor.setEditable(editingAllowed)
  }, [editor, editingAllowed])

  // Externe Inhaltsänderungen (Bild-Import, MCP-Live-Edits) übernehmen.
  // Geschützt: nur wenn sich der Inhalt wirklich vom Editor-Stand unterscheidet,
  // sonst würde der Cursor beim Tippen springen.
  useEffect(() => {
    if (!editor) return
    if (editorToMarkdown(editor) !== initialMarkdown) {
      editor.commands.setContent(initialMarkdown, false)
    }
  }, [editor, initialMarkdown])

  return (
    <>
      <ImageToolbar editor={editor} />
      <EditorContent editor={editor} />
    </>
  )
}
