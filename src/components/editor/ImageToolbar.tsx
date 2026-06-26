import { useEffect, useReducer, useState } from 'react'
import { createPortal } from 'react-dom'
import type { Editor } from '@tiptap/react'
import { Icon } from '@/components/ui/Icon'
import { type ImageAlign, type ImageFloat } from '@/lib/tiptap-image'
import { usePresentationStore } from '@/store/presentation'
import { CropModal } from '@/components/modals/CropModal'
import { notify } from '@/store/toast'

// Floating-Toolbar für selektierte Bilder (Spec §18.1 „Light"): Ausrichtung im Fluss
// und Float mit Textumfluss (Breite wird stufenlos per Resize in der Vorschau gezogen,
// die Größen-Presets sind dadurch redundant entfallen). Bewusst KEINE @tiptap/react-
// BubbleMenu (deren tippy-DOM-Verwaltung kollidiert mit Reacts Commit-Phase →
// "NotFoundError"). Stattdessen ein eigenes, per Portal in <body> gerendertes,
// fixed positioniertes Panel über dem Bild.
export function ImageToolbar({ editor }: { editor: Editor | null }) {
  // Bei jeder Editor-Transaktion neu rendern (Position + aktive Zustände).
  const [, force] = useReducer((x) => x + 1, 0)
  // Crop-Anforderung (Bildquelle + Modellposition) — überlebt unabhängig von der
  // Sichtbarkeit der Floating-Toolbar (das Modal soll offen bleiben).
  const [crop, setCrop] = useState<{ src: string; pos: number } | null>(null)
  const addAssetToLibrary = usePresentationStore((s) => s.addAssetToLibrary)

  useEffect(() => {
    if (!editor) return
    editor.on('transaction', force)
    editor.on('selectionUpdate', force)
    return () => {
      editor.off('transaction', force)
      editor.off('selectionUpdate', force)
    }
  }, [editor])

  // Zugeschnittenes Bild als neues Asset ablegen und die src des Bild-Knotens
  // an der gemerkten Position setzen (non-destruktiv; übrige Attribute bleiben).
  function onCropApply(dataUri: string) {
    const c = crop
    setCrop(null)
    if (!editor || !c) return
    // Asset erst anlegen, wenn der Bild-Knoten noch existiert (sonst Orphan-Asset
    // + falscher Erfolgs-Toast, falls c.pos durch eine Doc-Mutation veraltet ist).
    // addAssetToLibrary läuft synchron im command-Callback → hier zulässig.
    const ok = editor
      .chain()
      .focus()
      .command(({ tr }) => {
        const node = tr.doc.nodeAt(c.pos)
        if (!node || node.type.name !== 'image') return false
        const filename = addAssetToLibrary(dataUri)
        tr.setNodeMarkup(c.pos, undefined, { ...node.attrs, src: `assets/${filename}` })
        return true
      })
      .run()
    notify(
      ok ? 'Bild zugeschnitten.' : 'Zuschneiden fehlgeschlagen (Bildauswahl verloren).',
      ok ? 'success' : 'error',
    )
  }

  const cropModal = crop ? (
    <CropModal src={crop.src} onApply={onCropApply} onCancel={() => setCrop(null)} />
  ) : null

  let toolbar: React.ReactNode = null
  if (editor && !editor.isDestroyed && editor.isActive('image')) {
    const { state, view } = editor
    const from = state.selection.from
    const dom = view.nodeDOM(from) as HTMLElement | null
    const rect = dom?.getBoundingClientRect?.()
    if (rect) {
      const attrs = editor.getAttributes('image') as {
        width?: string | null
        align?: ImageAlign | null
        float?: ImageFloat | null
        alt?: string | null
      }
      const apply = (update: Record<string, unknown>) =>
        editor.chain().focus().updateAttributes('image', update).run()
      // Alt-Text ohne .focus(), damit das Eingabefeld den Fokus behält.
      const setAlt = (alt: string) => editor.commands.updateAttributes('image', { alt })
      const openCrop = () => {
        const el = dom as HTMLImageElement | null
        const s = el?.currentSrc || el?.src
        if (s) setCrop({ src: s, pos: from })
      }

      const alignIcon: Record<ImageAlign, string> = {
        left: 'format_align_left',
        center: 'format_align_center',
        right: 'format_align_right',
      }

      // Über dem Bild zentrieren; bei zu wenig Platz oben → darunter.
      const above = rect.top - 10
      const placeBelow = above < 64
      const left = Math.max(170, Math.min(rect.left + rect.width / 2, window.innerWidth - 170))
      const style: React.CSSProperties = {
        position: 'fixed',
        top: placeBelow ? rect.bottom + 10 : above,
        left,
        transform: placeBelow ? 'translateX(-50%)' : 'translate(-50%, -100%)',
        zIndex: 60,
      }

      toolbar = createPortal(
        // onMouseDown verhindern, damit die Bild-Selektion beim Klick erhalten bleibt —
        // außer auf dem Alt-Text-Eingabefeld, das fokussierbar bleiben muss.
        <div
          onMouseDown={(e) => {
            if ((e.target as HTMLElement).tagName !== 'INPUT') e.preventDefault()
          }}
          style={style}
        >
          <div className="flex flex-col gap-1.5 rounded-xl border border-chrome-border bg-chrome-surface p-2 shadow-pop">
            <Row label="Ausrichtung">
          {(['left', 'center', 'right'] as ImageAlign[]).map((a) => (
            <IconButton
              key={a}
              active={attrs.align === a}
              onClick={() => apply({ align: a, float: null })}
              icon={alignIcon[a]}
              title={`Ausrichtung ${a}`}
            />
          ))}
        </Row>
        <Row label="Umfluss">
          <TextButton active={!attrs.float} onClick={() => apply({ float: null })}>
            Kein
          </TextButton>
          <TextButton active={attrs.float === 'left'} onClick={() => apply({ float: 'left', align: null })}>
            Links
          </TextButton>
          <TextButton active={attrs.float === 'right'} onClick={() => apply({ float: 'right', align: null })}>
            Rechts
          </TextButton>
        </Row>
            <Row label="Alt-Text">
              <input
                type="text"
                value={attrs.alt ?? ''}
                onChange={(e) => setAlt(e.target.value)}
                placeholder="Bildbeschreibung (Barrierefreiheit)"
                className="h-6 w-[13rem] rounded-md border border-chrome-border bg-white px-2 text-[12px] text-chrome-text placeholder:text-chrome-faint focus:border-chrome-accent focus:outline-none focus:ring-1 focus:ring-chrome-accent/30"
              />
            </Row>
            <Row label="Bild">
              <button
                onClick={openCrop}
                className={btnBase + ' w-full gap-1 text-chrome-secondary hover:bg-chrome-surface-2'}
                title="Bild zuschneiden"
              >
                <Icon name="crop" size={14} weight={400} />
                Zuschneiden
              </button>
            </Row>
          </div>
        </div>,
        document.body,
      )
    }
  }

  return (
    <>
      {toolbar}
      {cropModal}
    </>
  )
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-center gap-1">
      <span className="w-[4.5rem] shrink-0 text-[11px] font-medium text-chrome-muted">{label}</span>
      <div className="flex items-center gap-0.5">{children}</div>
    </div>
  )
}

const btnBase =
  'flex h-6 items-center justify-center rounded-md px-1.5 text-[12px] font-medium transition-colors ' +
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40'

function TextButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        btnBase +
        ' min-w-[2rem] ' +
        (active
          ? 'bg-chrome-accent-soft text-chrome-accent-600'
          : 'text-chrome-secondary hover:bg-chrome-surface-2')
      }
    >
      {children}
    </button>
  )
}

function IconButton({
  active,
  onClick,
  icon,
  title,
}: {
  active: boolean
  onClick: () => void
  icon: string
  title: string
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={
        btnBase +
        ' w-7 ' +
        (active
          ? 'bg-chrome-accent-soft text-chrome-accent-600'
          : 'text-chrome-secondary hover:bg-chrome-surface-2')
      }
    >
      <Icon name={icon} size={16} weight={400} />
    </button>
  )
}
