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

const SPLIT_W = 6 // muss zur Splitter-Breite (w-1.5) + Spielraum passen

/**
 * Editor-Arbeitsfläche: drei frei skalierbare, einklappbare Spalten
 * (Folienliste · Editor · Vorschau). Der Editor in der Mitte ist die elastische
 * Spalte; die Seitenspalten haben gemerkte Breiten und Splitter zum Ziehen. Bei
 * zu schmalem Fenster weichen Vorschau und dann Sidebar zurück, damit dem Editor
 * mindestens EDITOR_MIN bleibt (statt Überlauf).
 */
export function EditorShell() {
  const sidebarWidth = useLayoutStore((s) => s.sidebarWidth)
  const previewWidth = useLayoutStore((s) => s.previewWidth)
  const sidebarCollapsed = useLayoutStore((s) => s.sidebarCollapsed)
  const previewCollapsed = useLayoutStore((s) => s.previewCollapsed)
  const nudge = useLayoutStore((s) => s.nudge)
  const toggleSidebar = useLayoutStore((s) => s.toggleSidebar)
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

  // Effektive Breiten so kappen, dass dem Editor EDITOR_MIN bleibt: zuerst die
  // Vorschau, dann die Sidebar zurücknehmen (nie unter ihre Mindestbreite).
  let s = sidebarCollapsed ? 0 : sidebarWidth
  let p = previewCollapsed ? 0 : previewWidth
  const splitters = (s > 0 ? SPLIT_W : 0) + (p > 0 ? SPLIT_W : 0)
  let over = s + p + splitters + EDITOR_MIN - avail
  if (over > 0 && p > 0) {
    const cut = Math.min(over, Math.max(0, p - PREVIEW_MIN))
    p -= cut
    over -= cut
  }
  if (over > 0 && s > 0) {
    const cut = Math.min(over, Math.max(0, s - SIDEBAR_MIN))
    s -= cut
    over -= cut
  }

  return (
    <div ref={ref} className="flex min-h-0 flex-1 overflow-hidden">
      {sidebarCollapsed ? (
        <CollapsedRail side="left" onExpand={toggleSidebar} label="Folien" />
      ) : (
        <>
          <div style={{ width: s }} className="min-w-0 shrink-0">
            <Sidebar onCollapse={toggleSidebar} />
          </div>
          <Splitter onDelta={(dx) => nudge('sidebar', dx)} ariaLabel="Folienliste skalieren" />
        </>
      )}

      <div className="min-w-0 flex-1">
        <EditorCanvas />
      </div>

      {previewCollapsed ? (
        <CollapsedRail side="right" onExpand={togglePreview} label="Vorschau" />
      ) : (
        <>
          <Splitter onDelta={(dx) => nudge('preview', -dx)} ariaLabel="Vorschau skalieren" />
          <div style={{ width: p }} className="min-w-0 shrink-0">
            <PreviewPane onCollapse={togglePreview} />
          </div>
        </>
      )}
    </div>
  )
}

/** Schmale Leiste, die eine eingeklappte Spalte vertritt (Klick = wieder ausklappen). */
function CollapsedRail({
  side,
  onExpand,
  label,
}: {
  side: 'left' | 'right'
  onExpand: () => void
  label: string
}) {
  return (
    <div
      className={
        'flex w-9 shrink-0 flex-col items-center gap-2 bg-chrome-bg py-2 ' +
        (side === 'left' ? 'border-r border-chrome-border' : 'border-l border-chrome-border')
      }
    >
      <button
        onClick={onExpand}
        title={`${label} einblenden`}
        aria-label={`${label} einblenden`}
        className="flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
      >
        <Icon name={side === 'left' ? 'chevron_right' : 'chevron_left'} size={18} />
      </button>
      <span className="mt-1 select-none text-[10px] font-semibold uppercase tracking-wider text-chrome-faint [writing-mode:vertical-rl]">
        {label}
      </span>
    </div>
  )
}
