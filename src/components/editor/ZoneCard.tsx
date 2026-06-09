import { useState } from 'react'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Zone } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { ZoneToolbar } from './ZoneToolbar'
import { TiptapEditor } from './TiptapEditor'
import { HtmlEditor } from './HtmlEditor'
import { CssEditor } from './CssEditor'
import { Icon } from '@/components/ui/Icon'

interface ZoneCardProps {
  zone: Zone
  index: number
}

// Eine Card pro Zone: Drag-Handle + Toolbar + Editor (Tiptap oder CodeMirror).
export function ZoneCard({ zone, index }: ZoneCardProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: zone.id,
  })
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const updateZoneMarkdown = usePresentationStore((s) => s.updateZoneMarkdown)
  const updateZoneHtml = usePresentationStore((s) => s.updateZoneHtml)

  const isHtml = zone.content_type === 'html'
  const isActive = activeZoneId === zone.id

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
      className={
        'overflow-hidden rounded-xl border bg-chrome-surface shadow-card transition-colors ' +
        (isHtml
          ? 'border-chrome-warn/30 '
          : isActive
            ? 'border-chrome-accent/60 ring-1 ring-chrome-accent/30 '
            : 'border-chrome-border hover:border-chrome-border-strong ')
      }
    >
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
          <HtmlEditor
            initialHtml={zone.html ?? ''}
            onChange={(value) => updateZoneHtml(zone.id, value)}
            onFocus={() => setActiveZone(zone.id)}
          />
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
    </div>
  )
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
          <CssEditor initialCss={cssValue} onChange={(value) => updateZoneCss(zone.id, value)} />
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
