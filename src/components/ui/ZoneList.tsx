import { usePresentationStore } from '@/store/presentation'
import { Icon } from './Icon'

// Miniatur-Übersicht aller Zones (klickbar → aktive Zone + Scroll).
export function ZoneList() {
  const presentation = usePresentationStore((s) => s.presentation)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const createZone = usePresentationStore((s) => s.createZone)

  if (!presentation) return null
  const zones = [...presentation.zones].sort((a, b) => a.order - b.order)

  function select(id: string) {
    setActiveZone(id)
    document.getElementById(`card-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
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

      <div className="flex flex-col gap-px overflow-y-auto px-1.5 pb-3">
        {zones.map((zone, index) => {
          const isActive = activeZoneId === zone.id
          const isHtml = zone.content_type === 'html'
          const preview = isHtml ? 'Custom HTML' : firstLine(zone.markdown) || 'Leer'
          return (
            <button
              key={zone.id}
              onClick={() => select(zone.id)}
              className={
                'group flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors focus-visible:outline-none ' +
                (isActive ? 'bg-chrome-accent-soft' : 'hover:bg-chrome-surface-2')
              }
            >
              <span
                className={
                  'flex h-5 w-5 shrink-0 items-center justify-center rounded text-[11px] font-semibold tabular-nums ' +
                  (isActive ? 'bg-chrome-accent-600 text-white' : 'bg-chrome-surface-2 text-chrome-muted group-hover:bg-white')
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
          )
        })}
      </div>
    </div>
  )
}

function firstLine(markdown: string): string {
  const line = markdown.split('\n').find((l) => l.trim().length > 0) ?? ''
  return line.replace(/^#+\s*/, '').replace(/[*_`>-]/g, '').trim()
}
