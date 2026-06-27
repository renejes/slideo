import { memo, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Zone } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { ZoneToolbar } from './ZoneToolbar'
import { TiptapEditor } from './TiptapEditor'
import { Icon } from '@/components/ui/Icon'

// CodeMirror-basierte Editoren lazy laden (Audit P8): CodeMirror wird nur für HTML-Zonen
// bzw. das (standardmäßig eingeklappte) Custom-CSS-Panel gebraucht — reine Markdown-Decks
// laden den Chunk nie. Der Tiptap-Editor bleibt eager (jede Markdown-Folie braucht ihn sofort).
const HtmlEditor = lazy(() => import('./HtmlEditor').then((m) => ({ default: m.HtmlEditor })))
const CssEditor = lazy(() => import('./CssEditor').then((m) => ({ default: m.CssEditor })))

/** Platzhalter, solange ein lazy CodeMirror-Editor-Chunk lädt (i.d.R. ein Frame). */
function EditorFallback() {
  return <div className="h-24 animate-pulse rounded-lg bg-chrome-surface-2" />
}

interface ZoneCardProps {
  zone: Zone
  index: number
}

// Eine Card pro Zone: Drag-Handle + Toolbar + Editor (Tiptap oder CodeMirror).
function ZoneCardBase({ zone, index }: ZoneCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: zone.id,
  })
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const updateZoneMarkdown = usePresentationStore((s) => s.updateZoneMarkdown)
  const updateZoneHtml = usePresentationStore((s) => s.updateZoneHtml)
  const addMediaToZone = usePresentationStore((s) => s.addMediaToZone)

  const isHtml = zone.content_type === 'html'
  const isActive = activeZoneId === zone.id

  // „Klick → Quelle" (Spec §20): bei Reveal für diese Zone die Card in den
  // Sichtbereich scrollen (HtmlEditor übernimmt Markierung/Fokus). Nur den
  // Reveal-Nonce DIESER Zone abonnieren → kein Re-Render bei anderen Zonen.
  const revealNonce = useUiStore((s) => (s.htmlReveal?.zoneId === zone.id ? s.htmlReveal.nonce : null))
  useEffect(() => {
    if (revealNonce !== null) {
      document.getElementById(`card-${zone.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }, [revealNonce, zone.id])

  // Drag&Drop-Medienimport (Spec §19.8): Bild/Video/Audio direkt auf die Folie
  // ziehen. Nutzt HTML5-File-DnD (in der Desktop-App via dragDropEnabled:false
  // aktiviert). dragDepth zählt Enter/Leave robust über Kind-Elemente hinweg.
  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('Files')
  }
  function onDragEnter(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragOver(true)
  }
  function onDragOver(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  function onDragLeave(e: React.DragEvent) {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }
  async function onDrop(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    setActiveZone(zone.id)
    const all = Array.from(e.dataTransfer.files)
    const files = all.filter((f) => /^(image|video|audio)\//.test(f.type))
    if (files.length === 0) {
      if (all.length > 0) notify('Nur Bilder, Video und Audio werden unterstützt.', 'info')
      return
    }
    let failed = 0
    for (const f of files) {
      try {
        const uri = await fileToDataUri(f)
        addMediaToZone(zone.id, uri)
      } catch {
        failed++
      }
    }
    if (failed > 0) notify(`${failed} Datei(en) konnten nicht gelesen werden.`, 'error')
  }

  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      id={`card-${zone.id}`}
      onMouseDown={() => setActiveZone(zone.id)}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={
        'relative overflow-hidden rounded-xl border bg-chrome-surface shadow-card transition-colors ' +
        (isHtml
          ? 'border-chrome-warn/30 '
          : isActive
            ? 'border-chrome-accent/60 ring-1 ring-chrome-accent/30 '
            : 'border-chrome-border hover:border-chrome-border-strong ')
      }
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-chrome-accent bg-chrome-accent-soft/85">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-chrome-accent-600">
            <Icon name="image" size={18} weight={400} />
            Medium hier ablegen
          </span>
        </div>
      )}
      {/* Header / Handle */}
      <div className="flex items-center gap-1.5 border-b border-chrome-border px-2.5 py-1.5">
        <button
          {...attributes}
          {...listeners}
          className="flex h-7 w-6 cursor-grab items-center justify-center rounded text-chrome-faint transition-colors hover:text-chrome-secondary active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title="Ziehen zum Umsortieren"
          aria-label="Verschieben"
        >
          <Icon name="drag_indicator" size={18} weight={400} />
        </button>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-chrome-surface-2 text-[11px] font-semibold tabular-nums text-chrome-muted">
          {index + 1}
        </span>
        <ZoneToolbar zone={zone} />
      </div>

      {/* Custom-HTML-Hinweis */}
      {isHtml && (
        <div className="flex items-center gap-1.5 border-b border-chrome-warn/15 bg-chrome-warn-soft px-4 py-1.5 text-[12px]">
          <Icon name="bolt" size={14} weight={500} className="text-chrome-warn" />
          <span className="font-semibold text-chrome-warn">Custom HTML</span>
          <span className="text-chrome-warn/70">
            Voller Browser-Modus — HTML, CSS &amp; JavaScript werden direkt gerendert.
          </span>
        </div>
      )}

      {/* Editor-Body */}
      <div className="px-4 py-3.5">
        {isHtml ? (
          <Suspense fallback={<EditorFallback />}>
            <HtmlEditor
              zoneId={zone.id}
              initialHtml={zone.html ?? ''}
              onChange={(value) => updateZoneHtml(zone.id, value)}
              onFocus={() => setActiveZone(zone.id)}
            />
          </Suspense>
        ) : (
          <TiptapEditor
            initialMarkdown={zone.markdown}
            onChange={(value) => updateZoneMarkdown(zone.id, value)}
            onFocus={() => setActiveZone(zone.id)}
          />
        )}
      </div>

      {/* Custom-CSS-Panel: stylt den Text, ohne ihn in HTML zu vergraben */}
      <CssPanel zone={zone} />

      {/* Speaker-Notes-Panel: nur in der Speaker-View sichtbar */}
      <NotesPanel zone={zone} />
    </div>
  )
}

/** Liest eine Datei als Data-URI (für den Drag&Drop-Import). */
function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read failed'))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function CssPanel({ zone }: { zone: Zone }) {
  const updateZoneCss = usePresentationStore((s) => s.updateZoneCss)
  const cssValue = zone.custom_css ?? ''
  const hasCss = !!cssValue.trim()
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-chrome-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-chrome-muted transition-colors hover:text-chrome-text"
      >
        <Icon name={open ? 'expand_more' : 'chevron_right'} size={16} weight={400} />
        <Icon name="format_paint" size={15} weight={400} />
        Custom CSS
        {hasCss && <span className="h-1.5 w-1.5 rounded-full bg-chrome-accent-600" title="CSS aktiv" />}
        <span className="ml-auto text-[11px] text-chrome-faint">stylt diese Folie</span>
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          <Suspense fallback={<EditorFallback />}>
            <CssEditor initialCss={cssValue} onChange={(value) => updateZoneCss(zone.id, value)} />
          </Suspense>
          <p className="mt-1.5 text-[11px] text-chrome-faint">
            Selektoren beziehen sich auf diese Folie, z.B.{' '}
            <code className="font-mono">h1 {'{'} letter-spacing: -.02em {'}'}</code>. Token-Variablen
            wie <code className="font-mono">var(--color-accent)</code> bleiben themebar.
          </p>
        </div>
      )}
    </div>
  )
}

function NotesPanel({ zone }: { zone: Zone }) {
  const updateZoneNotes = usePresentationStore((s) => s.updateZoneNotes)
  const notes = zone.notes ?? ''
  const hasNotes = !!notes.trim()
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-chrome-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-chrome-muted transition-colors hover:text-chrome-text"
      >
        <Icon name={open ? 'expand_more' : 'chevron_right'} size={16} weight={400} />
        <Icon name="sticky_note_2" size={15} weight={400} />
        Notizen
        {hasNotes && (
          <span className="h-1.5 w-1.5 rounded-full bg-chrome-accent-600" title="Notizen vorhanden" />
        )}
        <span className="ml-auto text-[11px] text-chrome-faint">nur in der Speaker-View</span>
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          <textarea
            value={notes}
            onChange={(e) => updateZoneNotes(zone.id, e.target.value)}
            placeholder="Sprechernotizen für diese Folie …"
            rows={3}
            className="w-full resize-y rounded-lg border border-chrome-border bg-chrome-bg px-3 py-2 text-[13px] leading-relaxed text-chrome-text placeholder:text-chrome-faint focus:border-chrome-accent focus:outline-none focus:ring-1 focus:ring-chrome-accent/30"
          />
        </div>
      )}
    </div>
  )
}

// React.memo (Audit P5): `mutate` erhält die Objekt-Identität unveränderter Zonen
// (z.id === id ? {...z} : z), daher überspringt memo das Re-Rendern aller anderen
// ZoneCards beim Tippen in einer Folie. Props sind nur {zone, index} → Shallow-Compare reicht.
export const ZoneCard = memo(ZoneCardBase)
