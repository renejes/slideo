import { useEffect, useMemo, useRef } from 'react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToHorizontalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  horizontalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { AssetMap, Presentation, Zone } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { t } from '@/i18n'
import { Icon } from '@/components/ui/Icon'
import { SlidePreview } from '@/components/presentation/SlidePreview'

/**
 * Untere Folienleiste: Sprung, Reorder, neue Folie. Ersetzt die frühere
 * Karten-Liste im Editor — Sequenz lebt hier, Bearbeitung auf der Bühne.
 */
export function SlideFilmstrip() {
  const presentation = usePresentationStore((s) => s.presentation)
  const assets = usePresentationStore((s) => s.assets)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const reorderZones = usePresentationStore((s) => s.reorderZones)
  const createZone = usePresentationStore((s) => s.createZone)

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))
  const scroller = useRef<HTMLDivElement>(null)

  const zones = useMemo(
    () => (presentation ? [...presentation.zones].sort((a, b) => a.order - b.order) : []),
    [presentation],
  )
  const ids = useMemo(() => zones.map((z) => z.id), [zones])

  useEffect(() => {
    if (!activeZoneId || !scroller.current) return
    const el = scroller.current.querySelector(`[data-filmstrip-id="${activeZoneId}"]`)
    el?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: 'smooth' })
  }, [activeZoneId])

  if (!presentation) return null

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    reorderZones(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <div
      className="flex shrink-0 items-stretch gap-1.5 border-t border-chrome-border bg-chrome-surface px-2 py-2"
      aria-label={t('ui.shell.filmstrip')}
    >
      <div ref={scroller} className="flex min-w-0 flex-1 items-stretch gap-1.5 overflow-x-auto">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToHorizontalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={horizontalListSortingStrategy}>
            {zones.map((zone, index) => (
              <FilmstripThumb
                key={zone.id}
                zone={zone}
                index={index}
                presentation={presentation}
                assets={assets}
                active={zone.id === activeZoneId}
                onSelect={() => setActiveZone(zone.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      <button
        type="button"
        onClick={() => createZone(activeZoneId ?? zones[zones.length - 1]?.id)}
        title={t('editor.canvas.addSlide')}
        aria-label={t('editor.canvas.addSlide')}
        className="flex w-11 shrink-0 flex-col items-center justify-center gap-1 rounded-lg border border-dashed border-chrome-border-strong text-chrome-muted transition-colors hover:border-chrome-accent hover:bg-chrome-accent-soft hover:text-chrome-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
      >
        <Icon name="add" size={18} />
      </button>
    </div>
  )
}

function FilmstripThumb({
  zone,
  index,
  presentation,
  assets,
  active,
  onSelect,
}: {
  zone: Zone
  index: number
  presentation: Presentation
  assets: AssetMap
  active: boolean
  onSelect: () => void
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: zone.id,
  })
  const style: React.CSSProperties = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.55 : 1,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-filmstrip-id={zone.id}
      className="w-[148px] shrink-0"
    >
      <button
        type="button"
        {...attributes}
        {...listeners}
        onClick={onSelect}
        title={zone.label || t('present.preview.slideFallback', { index: index + 1 })}
        className={
          'group flex w-full flex-col gap-1 rounded-lg p-1 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
          (active ? 'bg-chrome-accent-soft' : 'hover:bg-chrome-surface-2')
        }
      >
        <div
          style={{ paddingBottom: '56.25%' }}
          className={
            'relative w-full overflow-hidden rounded-md border bg-black ' +
            (active ? 'border-chrome-accent ring-1 ring-chrome-accent/40' : 'border-chrome-border')
          }
        >
          <SlidePreview presentation={presentation} zone={zone} assets={assets} />
          <span className="absolute left-1 top-1 rounded bg-black/55 px-1 py-px text-[10px] font-medium tabular-nums text-white/90">
            {index + 1}
          </span>
        </div>
        <span
          className={
            'truncate px-0.5 text-[11px] ' +
            (active ? 'font-medium text-chrome-accent-600' : 'text-chrome-muted')
          }
        >
          {zone.label || t('present.preview.slideFallback', { index: index + 1 })}
        </span>
      </button>
    </div>
  )
}
