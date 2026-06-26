import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import { restrictToVerticalAxis } from '@dnd-kit/modifiers'
import {
  SortableContext,
  verticalListSortingStrategy,
  arrayMove,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import type { Zone } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { Icon } from './Icon'

// Miniatur-Übersicht aller Zones (klickbar → aktive Zone + Scroll) MIT Drag-Reorder
// (dnd-kit, dieselbe reorderZones-Action wie der Editor). Ersetzt die frühere
// „Gliederung"-Ansicht für das Umsortieren.
export function ZoneList() {
  const presentation = usePresentationStore((s) => s.presentation)
  const createZone = usePresentationStore((s) => s.createZone)
  const reorderZones = usePresentationStore((s) => s.reorderZones)

  // Drag erst nach kleiner Bewegung; ein Klick (Auswahl) bleibt ein Klick.
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }))

  if (!presentation) return null
  const zones = [...presentation.zones].sort((a, b) => a.order - b.order)
  const ids = zones.map((z) => z.id)

  function onDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIndex = ids.indexOf(active.id as string)
    const newIndex = ids.indexOf(over.id as string)
    if (oldIndex === -1 || newIndex === -1) return
    reorderZones(arrayMove(ids, oldIndex, newIndex))
  }

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
          Folien · {zones.length}
        </span>
        <button
          onClick={() => createZone(zones[zones.length - 1]?.id)}
          className="flex h-6 w-6 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title="Slide hinzufügen"
        >
          <Icon name="add" size={18} />
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-1.5 pb-3">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            <div className="flex flex-col gap-px">
              {zones.map((zone, index) => (
                <ZoneRow key={zone.id} zone={zone} index={index} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      </div>
    </div>
  )
}

function ZoneRow({ zone, index }: { zone: Zone; index: number }) {
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: zone.id,
  })

  const isActive = activeZoneId === zone.id
  const isHtml = zone.content_type === 'html'
  const preview = isHtml ? 'Custom HTML' : firstLine(zone.markdown) || 'Leer'

  function select() {
    setActiveZone(zone.id)
    document.getElementById(`card-${zone.id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={
        'group flex items-center rounded-lg transition-colors ' +
        (isActive ? 'bg-chrome-accent-soft' : 'hover:bg-chrome-surface-2') +
        (isDragging ? ' relative z-10 opacity-70 shadow-card' : '')
      }
    >
      <button
        {...attributes}
        {...listeners}
        title="Ziehen zum Umsortieren"
        aria-label="Folie verschieben"
        className="flex h-8 w-5 shrink-0 cursor-grab touch-none items-center justify-center text-chrome-faint opacity-0 transition-opacity hover:text-chrome-muted focus-visible:opacity-100 group-hover:opacity-100 active:cursor-grabbing"
      >
        <Icon name="drag_indicator" size={16} weight={400} />
      </button>
      <button
        onClick={select}
        className="flex min-w-0 flex-1 items-center gap-2.5 py-1.5 pr-2 text-left focus-visible:outline-none"
      >
        <span
          className={
            'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums ' +
            (isActive
              ? 'bg-chrome-accent-600 text-white'
              : 'bg-chrome-surface-2 text-chrome-muted group-hover:bg-white')
          }
        >
          {index + 1}
        </span>
        <span className="min-w-0 flex-1">
          <span
            className={
              'block truncate text-[13px] ' +
              (isActive ? 'font-medium text-chrome-accent-600' : 'text-chrome-text')
            }
          >
            {zone.label}
          </span>
          <span
            className={
              'flex items-center gap-1 truncate text-[11px] ' +
              (isHtml ? 'text-chrome-warn' : 'text-chrome-muted')
            }
          >
            {isHtml && <Icon name="code" size={12} weight={400} />}
            <span className="truncate">{preview}</span>
          </span>
        </span>
      </button>
    </div>
  )
}

function firstLine(markdown: string): string {
  const line = markdown.split('\n').find((l) => l.trim().length > 0) ?? ''
  return line.replace(/^#+\s*/, '').replace(/[*_`>-]/g, '').trim()
}
