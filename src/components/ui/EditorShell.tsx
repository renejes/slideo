import { useEffect, useRef, useState } from 'react'
import {
  useLayoutStore,
  EDITOR_MIN,
  PREVIEW_MIN,
  SIDEBAR_MIN,
} from '@/store/layout'
import { Icon } from './Icon'
import { Splitter } from './Splitter'
import { Sidebar } from './Sidebar'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { PreviewPane } from '@/components/preview/PreviewPane'

const SPLIT_W = 6 // Splitter-Breite (w-1.5) + Spielraum
const RAIL_W = 36 // eingeklappte Spalte (w-9)

type Pane = 'sidebar' | 'editor' | 'preview'

/**
 * Editor-Arbeitsfläche: drei frei skalierbare, EINZELN einklappbare Spalten
 * (Folienliste · Editor · Vorschau). Genau ein offener Bereich ist „elastisch"
 * (füllt den Rest) — Priorität Editor › Vorschau › Folienliste; die anderen offenen
 * Bereiche haben gemerkte Breiten + Splitter. Bei zu schmalem Fenster weichen die
 * festen Bereiche zurück, damit dem elastischen seine Mindestbreite bleibt (statt
 * Überlauf). Mindestens ein Bereich bleibt immer offen (Store-Guard).
 */
export function EditorShell() {
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth)
  const previewWidth = useLayoutStore((s) => s.previewWidth)
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed)
  const editorCollapsed = useLayoutStore((s) => s.editorCollapsed)
  const previewCollapsed = useLayoutStore((s) => s.previewCollapsed)
  const nudge = useLayoutStore((s) => s.nudge)
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)
  const toggleEditor = useLayoutStore((s) => s.toggleEditor)
  const togglePreview = useLayoutStore((s) => s.togglePreview)

  const ref = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(1200)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setAvail(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const sidebarOpen = !sidebarCollapsed
  const editorOpen = !editorCollapsed
  const previewOpen = !previewCollapsed

  // Elastischer (füllender) Bereich: Editor › Vorschau › Folienliste.
  const elastic: Pane = editorOpen ? 'editor' : previewOpen ? 'preview' : 'sidebar'

  // Feste Breiten der offenen, NICHT-elastischen Bereiche.
  let sFixed = sidebarOpen && elastic !== 'sidebar' ? sidebarWidth : 0
  let pFixed = previewOpen && elastic !== 'preview' ? previewWidth : 0

  // Dem elastischen Bereich seine Mindestbreite sichern: feste Bereiche zurücknehmen
  // (erst Vorschau, dann Sidebar), nie unter ihre eigene Mindestbreite.
  const elasticMin =
    elastic === 'editor' ? EDITOR_MIN : elastic === 'preview' ? PREVIEW_MIN : SIDEBAR_MIN
  const rails = (sidebarOpen ? 0 : RAIL_W) + (editorOpen ? 0 : RAIL_W) + (previewOpen ? 0 : RAIL_W)
  const splitters = (sFixed > 0 ? SPLIT_W : 0) + (pFixed > 0 ? SPLIT_W : 0)
  let over = sFixed + pFixed + rails + splitters + elasticMin - avail
  if (over > 0 && pFixed > 0) {
    const cut = Math.min(over, Math.max(0, pFixed - PREVIEW_MIN))
    pFixed -= cut
    over -= cut
  }
  if (over > 0 && sFixed > 0) {
    const cut = Math.min(over, Math.max(0, sFixed - SIDEBAR_MIN))
    sFixed -= cut
    over -= cut
  }

  return (
    <div ref={ref} className="flex min-h-0 flex-1 overflow-hidden">
      {/* Folienliste */}
      {sidebarOpen ? (
        <div
          style={elastic === 'sidebar' ? undefined : { width: sFixed }}
          className={'min-w-0 ' + (elastic === 'sidebar' ? 'flex-1' : 'shrink-0')}
        >
          <Sidebar onCollapse={toggleSidebar} />
        </div>
      ) : (
        <CollapsedRail side="left" icon="chevron_right" label="Folien" onExpand={toggleSidebar} />
      )}
      {sFixed > 0 && <Splitter onDelta={(dx) => nudge('sidebar', dx)} ariaLabel="Folienliste skalieren" />}

      {/* Editor (flussbasiert) */}
      {editorOpen ? (
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex h-9 shrink-0 items-center gap-1.5 border-b border-chrome-border px-3.5 text-chrome-muted">
            <Icon name="edit" size={15} weight={400} />
            <span className="text-[11px] font-semibold uppercase tracking-wider">Editor</span>
            <button
              onClick={toggleEditor}
              title="Editor einklappen"
              aria-label="Editor einklappen"
              className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
            >
              <Icon name="chevron_left" size={18} />
            </button>
          </div>
          <div className="min-h-0 flex-1">
            <EditorCanvas />
          </div>
        </div>
      ) : (
        <CollapsedRail side="middle" icon="edit" label="Editor" onExpand={toggleEditor} />
      )}
      {pFixed > 0 && <Splitter onDelta={(dx) => nudge('preview', -dx)} ariaLabel="Vorschau skalieren" />}

      {/* Vorschau */}
      {previewOpen ? (
        <div
          style={elastic === 'preview' ? undefined : { width: pFixed }}
          className={'min-w-0 ' + (elastic === 'preview' ? 'flex-1' : 'shrink-0')}
        >
          <PreviewPane onCollapse={togglePreview} />
        </div>
      ) : (
        <CollapsedRail side="right" icon="chevron_left" label="Vorschau" onExpand={togglePreview} />
      )}
    </div>
  )
}

/** Schmale Leiste, die eine eingeklappte Spalte vertritt (Klick = wieder ausklappen). */
function CollapsedRail({
  side,
  icon,
  label,
  onExpand,
}: {
  side: 'left' | 'middle' | 'right'
  icon: string
  label: string
  onExpand: () => void
}) {
  const border =
    side === 'left' ? 'border-r' : side === 'right' ? 'border-l' : 'border-x'
  return (
    <button
      onClick={onExpand}
      title={`${label} einblenden`}
      aria-label={`${label} einblenden`}
      className={
        'group flex w-9 shrink-0 flex-col items-center gap-2 bg-chrome-bg py-2 text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-chrome-accent/40 ' +
        border +
        ' border-chrome-border'
      }
    >
      <span className="flex h-7 w-7 items-center justify-center">
        <Icon name={icon} size={18} />
      </span>
      <span className="mt-1 select-none text-[10px] font-semibold uppercase tracking-wider text-chrome-faint [writing-mode:vertical-rl] group-hover:text-chrome-muted">
        {label}
      </span>
    </button>
  )
}
