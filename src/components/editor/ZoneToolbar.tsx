import { useRef } from 'react'
import type { Zone, ZoneLayout, TextAlign } from '@/types'
import { ZONE_LAYOUTS, TEXT_ALIGNS } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { confirmDialog } from '@/lib/dialog'
import { Icon } from '@/components/ui/Icon'

interface ZoneToolbarProps {
  zone: Zone
}

const selectClass =
  'h-7 cursor-pointer rounded-md border border-chrome-border bg-white pl-2 pr-1 text-[12px] ' +
  'text-chrome-secondary transition-colors hover:border-chrome-border-strong focus:border-chrome-accent ' +
  'focus:outline-none focus:ring-2 focus:ring-chrome-accent/30'

// Toolbar über jeder Zone: Label, Layout, Ausrichtung, Content-Type-Toggle, Löschen.
export function ZoneToolbar({ zone }: ZoneToolbarProps) {
  const updateZoneLabel = usePresentationStore((s) => s.updateZoneLabel)
  const updateZoneStyle = usePresentationStore((s) => s.updateZoneStyle)
  const setZoneLayout = usePresentationStore((s) => s.setZoneLayout)
  const setZoneReveal = usePresentationStore((s) => s.setZoneReveal)
  const setZoneContentType = usePresentationStore((s) => s.setZoneContentType)
  const deleteZone = usePresentationStore((s) => s.deleteZone)
  const addMediaToZone = usePresentationStore((s) => s.addMediaToZone)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const openModal = useUiStore((s) => s.openModal)
  const fileRef = useRef<HTMLInputElement>(null)

  const isHtml = zone.content_type === 'html'

  function onPickMedia(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = '' // erlaubt erneute Auswahl derselben Datei
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') addMediaToZone(zone.id, reader.result)
    }
    reader.readAsDataURL(file)
  }

  async function toggleContentType() {
    if (isHtml) {
      const ok = await confirmDialog(
        'Zurück zu Markdown wechseln? Der HTML-Inhalt kann nicht vollständig nach ' +
          'Markdown zurückkonvertiert werden und wird in der Vorschau nicht mehr angezeigt ' +
          '(bleibt aber gespeichert, bis du den Markdown-Inhalt änderst).',
      )
      if (!ok) return
      setZoneContentType(zone.id, 'markdown')
    } else {
      setZoneContentType(zone.id, 'html')
    }
  }

  return (
    <div className="flex flex-1 items-center gap-2">
      <input
        value={zone.label}
        onChange={(e) => updateZoneLabel(zone.id, e.target.value)}
        className="w-36 rounded-md border border-transparent bg-transparent px-1.5 py-1 text-[13px] font-medium text-chrome-text transition-colors hover:bg-chrome-surface-2 focus:border-chrome-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
        aria-label="Slide-Name"
      />

      <div className="ml-auto flex items-center gap-1.5">
        <select
          value={zone.style.layout}
          onChange={(e) => setZoneLayout(zone.id, e.target.value as ZoneLayout)}
          className={selectClass}
          title="Layout (Zwei Spalten fügt automatisch einen +++ Spaltentrenner ein)"
        >
          {ZONE_LAYOUTS.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>

        <select
          value={zone.style.text_align}
          onChange={(e) => updateZoneStyle(zone.id, { text_align: e.target.value as TextAlign })}
          className={selectClass}
          title="Textausrichtung"
        >
          {TEXT_ALIGNS.map((a) => (
            <option key={a.value} value={a.value}>
              {a.label}
            </option>
          ))}
        </select>

        {!isHtml && (
          <button
            onClick={() => setZoneReveal(zone.id, zone.reveal === 'steps' ? 'none' : 'steps')}
            className={
              'flex h-7 w-7 items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
              (zone.reveal === 'steps'
                ? 'bg-chrome-accent-soft text-chrome-accent-600'
                : 'text-chrome-muted hover:bg-chrome-surface-2 hover:text-chrome-text')
            }
            title="Schrittweise einblenden (Builds): Blöcke nacheinander im Präsentationsmodus"
            aria-label="Schrittweise einblenden"
            aria-pressed={zone.reveal === 'steps'}
          >
            <Icon name="animation" size={17} weight={400} />
          </button>
        )}

        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          onChange={onPickMedia}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title="Medium einfügen (Bild, Video, Audio)"
          aria-label="Medium einfügen"
        >
          <Icon name="image" size={17} weight={400} />
        </button>

        <button
          onClick={() => {
            setActiveZone(zone.id)
            openModal('components')
          }}
          className="flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title="Komponente einfügen (Diagramme, Kennzahlen, Zeitstrahl, Zitat …)"
          aria-label="Komponente einfügen"
        >
          <Icon name="widgets" size={17} weight={400} />
        </button>

        <button
          onClick={toggleContentType}
          className={
            'flex h-7 items-center gap-1 rounded-md border px-2 text-[12px] font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
            (isHtml
              ? 'border-chrome-warn/40 bg-chrome-warn-soft text-chrome-warn hover:bg-chrome-warn/15'
              : 'border-chrome-border bg-white text-chrome-secondary hover:border-chrome-border-strong')
          }
          title="Zwischen Markdown und HTML umschalten"
        >
          <Icon name={isHtml ? 'code' : 'notes'} size={15} weight={400} />
          {isHtml ? 'HTML' : 'Markdown'}
        </button>

        <button
          onClick={() => deleteZone(zone.id)}
          className="flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-danger/10 hover:text-chrome-danger focus:outline-none focus-visible:ring-2 focus-visible:ring-chrome-danger/40"
          title="Slide löschen"
          aria-label="Slide löschen"
        >
          <Icon name="delete" size={17} weight={400} />
        </button>
      </div>
    </div>
  )
}
