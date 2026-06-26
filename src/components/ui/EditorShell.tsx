import { useEffect, useRef, useState } from 'react'
import { useLayoutStore, EDITOR_MIN, PREVIEW_MIN } from '@/store/layout'
import { Icon } from './Icon'
import { Splitter } from './Splitter'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { PreviewPane } from '@/components/preview/PreviewPane'

const SPLIT_W = 6 // Splitter-Breite (w-1.5) + Spielraum
const RAIL_W = 36 // eingeklappte Spalte (w-9)

/**
 * Editor-Arbeitsfläche: zwei frei skalierbare, EINZELN einklappbare Spalten
 * (Editor · Vorschau). Der Editor ist elastisch (füllt den Rest), solange er offen
 * ist — sonst die Vorschau. Die Vorschau hat eine gemerkte Breite + Splitter. Bei zu
 * schmalem Fenster weicht die Vorschau zurück, damit dem elastischen Bereich seine
 * Mindestbreite bleibt (statt Überlauf). Mindestens ein Bereich bleibt immer offen
 * (Store-Guard). Die frühere linke Folienliste/Sidebar ist entfallen — Umsortieren
 * + Überblick laufen über die Editor-Karten selbst (Editor-Cleanup).
 */
export function EditorShell() {
  const previewWidth = useLayoutStore((s) => s.previewWidth)
  const editorCollapsed = useLayoutStore((s) => s.editorCollapsed)
  const previewCollapsed = useLayoutStore((s) => s.previewCollapsed)
  const nudge = useLayoutStore((s) => s.nudge)
  const toggleEditor = useLayoutStore((s) => s.toggleEditor)
  const togglePreview = useLayoutStore((s) => s.togglePreview)

  const ref = useRef<HTMLDivElement>(null)
  // Sinnvoller Startwert bis der ResizeObserver feuert (vermeidet einen ersten Frame
  // mit zu wenig Kapp-Druck auf schmalen Bildschirmen).
  const [avail, setAvail] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  )
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

  const editorOpen = !editorCollapsed
  const previewOpen = !previewCollapsed

  // Feste Vorschau-Breite nur, wenn der Editor offen ist (sonst füllt die Vorschau).
  let pFixed = previewOpen && editorOpen ? previewWidth : 0

  // Dem elastischen Bereich (Editor, sonst Vorschau) seine Mindestbreite sichern:
  // die feste Vorschau zurücknehmen, nie unter ihre eigene Mindestbreite.
  const elasticMin = editorOpen ? EDITOR_MIN : PREVIEW_MIN
  const rails = (editorOpen ? 0 : RAIL_W) + (previewOpen ? 0 : RAIL_W)
  const splitters = pFixed > 0 ? SPLIT_W : 0
  const over = pFixed + rails + splitters + elasticMin - avail
  if (over > 0 && pFixed > 0) {
    pFixed -= Math.min(over, Math.max(0, pFixed - PREVIEW_MIN))
  }

  return (
    <div ref={ref} className="flex min-h-0 flex-1 overflow-hidden">
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
        <CollapsedRail side="left" icon="edit" label="Editor" onExpand={toggleEditor} />
      )}
      {pFixed > 0 && <Splitter onDelta={(dx) => nudge(-dx)} ariaLabel="Vorschau skalieren" />}

      {/* Vorschau */}
      {previewOpen ? (
        <div
          style={editorOpen ? { width: pFixed } : undefined}
          className={'min-w-0 ' + (editorOpen ? 'shrink-0' : 'flex-1')}
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
  side: 'left' | 'right'
  icon: string
  label: string
  onExpand: () => void
}) {
  const border = side === 'left' ? 'border-r' : 'border-l'
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
