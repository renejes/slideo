import { memo, useEffect, useRef, useState, lazy, Suspense } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Zone } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { t, tp } from '@/i18n'
import { T } from '@/i18n/T'
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
  // Überstand in Bühnen-px, 0 = passt (Befund H5c).
  const overflowPx = useUiStore((s) => s.overflowZones[zone.id] ?? 0)
  const isActive = activeZoneId === zone.id

  // Kurze Textvorschau für die zugeklappte Zeile: Markdown-/HTML-Auszeichnung
  // entfernen, damit dort lesbarer Text steht und keine spitzen Klammern.
  const preview = (
    isHtml ? (zone.html ?? '').replace(/<[^>]+>/g, ' ') : zone.markdown.replace(/[#*`>_[\]!]/g, '')
  )
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180)

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
      if (all.length > 0) notify(t('editor.card.mediaTypeOnly'), 'info')
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
    if (failed > 0) notify(tp('editor.card.mediaReadFailed', failed), 'error')
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
        // Auswahl VOR isHtml prüfen (Review 2026-08, Befund M59): vorher gewann
        // immer der Terrakotta-Rahmen der HTML-Zone, der Accent-Ring nie — an einem
        // HTML-lastigen KI-Deck arbeitete man also ohne jede Bestätigung, wo das
        // Nächste landet, obwohl Komponente/Medien/Palette alle auf activeZoneId zielen.
        (isActive
          ? 'border-chrome-accent/60 ring-1 ring-chrome-accent/30 '
          : isHtml
            ? 'border-chrome-warn/30 '
            : 'border-chrome-border hover:border-chrome-border-strong ')
      }
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center rounded-xl border-2 border-dashed border-chrome-accent bg-chrome-accent-soft/85">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-chrome-accent-600">
            <Icon name="image" size={18} weight={400} />
            {t('editor.card.dropMedia')}
          </span>
        </div>
      )}
      {/* Header / Handle */}
      <div className="flex items-center gap-1.5 border-b border-chrome-border px-2.5 py-1.5">
        <button
          {...attributes}
          {...listeners}
          className="flex h-7 w-6 cursor-grab items-center justify-center rounded text-chrome-faint transition-colors hover:text-chrome-secondary active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title={t('editor.card.dragHandle')}
          aria-label={t('editor.card.dragHandleAria')}
        >
          <Icon name="drag_indicator" size={18} weight={400} />
        </button>
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-chrome-surface-2 text-[11px] font-semibold tabular-nums text-chrome-muted">
          {index + 1}
        </span>
        <ZoneToolbar zone={zone} />
      </div>

      {/* Überlauf-Warnung (Review 2026-08, Befund H5c). Gemessen am ECHTEN Layout im
          Vorschau-Iframe — die Rust-Heuristik, die die KI nutzt, sieht Umbruch,
          Padding, custom_css und Split-Spalten gar nicht. Bis hierher wurde der
          Überlauf schlicht geclippt und der Mensch erfuhr es nie; die KI hatte zwei
          Tools dafür, der Besitzer des Decks keins. */}
      {overflowPx > 0 && (
        <div className="flex items-center gap-1.5 border-b border-chrome-warn/15 bg-chrome-warn-soft px-4 py-1.5 text-[12px]">
          <Icon name="warning" size={14} weight={500} className="text-chrome-warn" />
          <span className="font-semibold text-chrome-warn">{t('editor.card.overflowTitle')}</span>
          <span className="text-chrome-warn/70">
            {t('editor.card.overflowDetail', { px: overflowPx })}
          </span>
        </div>
      )}

      {/* Custom-HTML-Hinweis */}
      {isHtml && (
        <div className="flex items-center gap-1.5 border-b border-chrome-warn/15 bg-chrome-warn-soft px-4 py-1.5 text-[12px]">
          <Icon name="bolt" size={14} weight={500} className="text-chrome-warn" />
          <span className="font-semibold text-chrome-warn">{t('editor.card.htmlBadge')}</span>
          <span className="text-chrome-warn/70">{t('editor.card.htmlHint')}</span>
        </div>
      )}

      {/* Editor-Body — NUR für die aktive Folie (Review 2026-08, Befund H13/S22).
          Vorher mountete jede Zone gleichzeitig eine lebende Tiptap- bzw.
          CodeMirror-Instanz: bei einem 30–60-Folien-Deck, wie es ein Agent in einem
          Prompt erzeugt, lag die komplette Editiermaschinerie im Speicher, und die
          einzige Repräsentation des Decks war eine unvirtualisierte Spalte, durch
          die man scrollen musste (seit dem Wegfall der Folienliste gab es gar keine
          Navigation mehr). Zugeklappt bleibt eine kompakte Zeile mit Textvorschau —
          das bringt den Deck-Überblick zurück UND löst das Windowing-Problem, ohne
          die gelöschte Folienliste wiederzubeleben. */}
      {isActive ? (
        <>
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
        </>
      ) : (
        <button
          onClick={() => setActiveZone(zone.id)}
          className="block w-full px-4 py-2.5 text-left transition-colors hover:bg-chrome-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title={t('editor.card.clickToEdit')}
        >
          <span className="line-clamp-2 text-[12px] leading-relaxed text-chrome-muted">
            {preview || <span className="italic text-chrome-faint">{t('editor.card.emptySlide')}</span>}
          </span>
        </button>
      )}
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
        {t('editor.card.cssTitle')}
        {hasCss && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-chrome-accent-600"
            title={t('editor.card.cssActive')}
          />
        )}
        <span className="ml-auto text-[11px] text-chrome-faint">{t('editor.card.cssScope')}</span>
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          <Suspense fallback={<EditorFallback />}>
            <CssEditor initialCss={cssValue} onChange={(value) => updateZoneCss(zone.id, value)} />
          </Suspense>
          <p className="mt-1.5 text-[11px] text-chrome-faint">
            <T
              k="editor.card.cssHint"
              slots={[
                <code className="font-mono">h1 {'{'} letter-spacing: -.02em {'}'}</code>,
                <code className="font-mono">var(--color-accent)</code>,
              ]}
            />
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
        {t('editor.card.notesTitle')}
        {hasNotes && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-chrome-accent-600"
            title={t('editor.card.notesPresent')}
          />
        )}
        <span className="ml-auto text-[11px] text-chrome-faint">{t('editor.card.notesScope')}</span>
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          <textarea
            value={notes}
            onChange={(e) => updateZoneNotes(zone.id, e.target.value)}
            placeholder={t('editor.card.notesPlaceholder')}
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
