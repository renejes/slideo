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
} from '@dnd-kit/sortable'
import { usePresentationStore } from '@/store/presentation'
import { ZoneCard } from './ZoneCard'
import { Icon } from '@/components/ui/Icon'

// Scroll-Container für alle Zones; Reordering via dnd-kit.
export function EditorCanvas() {
  const presentation = usePresentationStore((s) => s.presentation)
  const reorderZones = usePresentationStore((s) => s.reorderZones)
  const createZone = usePresentationStore((s) => s.createZone)

  // Drag erst nach kleiner Bewegung starten, damit Klicks/Selektion normal funktionieren.
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
    <div className="h-full overflow-y-auto bg-chrome-bg">
      <div className="mx-auto flex max-w-2xl flex-col gap-3.5 px-6 py-7">
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          modifiers={[restrictToVerticalAxis]}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={ids} strategy={verticalListSortingStrategy}>
            {zones.map((zone, index) => (
              <ZoneCard key={zone.id} zone={zone} index={index} />
            ))}
          </SortableContext>
        </DndContext>

        <button
          onClick={() => createZone(zones[zones.length - 1]?.id)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-chrome-border-strong py-3.5 text-[13px] font-medium text-chrome-muted transition-colors hover:border-chrome-accent hover:bg-chrome-accent-soft hover:text-chrome-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
        >
          <Icon name="add" size={18} />
          Slide hinzufügen
        </button>
      </div>
    </div>
  )
}
