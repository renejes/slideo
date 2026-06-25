import { useMemo } from 'react'
import type { Presentation, Zone, AssetMap } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { renderSingleZonePage } from '@/lib/renderer'

interface SpeakerViewProps {
  presentation: Presentation
  index: number
  /** Verstrichene Zeit in Sekunden. */
  elapsed: number
  /** Aktueller Build-Schritt der Folie (0-basiert). */
  step?: number
  /** Anzahl Build-Schritte der aktuellen Folie. */
  stepTotal?: number
}

// Integrierte Speaker-Ansicht: große aktuelle Folie, Vorschau der nächsten,
// Timer, Folienzähler und Notizen — alles im selben Fenster.
export function SpeakerView({ presentation, index, elapsed, step = 0, stepTotal = 1 }: SpeakerViewProps) {
  const assets = usePresentationStore((s) => s.assets)
  const zones = useMemo(
    () => [...presentation.zones].sort((a, b) => a.order - b.order),
    [presentation],
  )
  const count = zones.length
  const current = zones[index]
  const next = zones[index + 1]
  const notes = current?.notes?.trim() ?? ''

  return (
    <div className="flex h-full w-full gap-4 p-4 text-white">
      {/* Aktuelle Folie */}
      <div className="flex min-w-0 flex-[1.6] flex-col gap-2">
        <Label>Aktuell · {current?.label ?? '—'}</Label>
        <div className="min-h-0 flex-1 overflow-hidden rounded-xl border border-white/10 bg-black">
          {current && <MiniSlide presentation={presentation} zone={current} assets={assets} />}
        </div>
      </div>

      {/* Seitenspalte */}
      <div className="flex w-[34%] min-w-[18rem] flex-col gap-4">
        <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3">
          <span className="text-3xl font-semibold tabular-nums">{formatTime(elapsed)}</span>
          <span className="text-sm text-white/50 tabular-nums">
            {Math.min(index + 1, count)} / {count}
            {stepTotal > 1 && <span className="text-white/30"> · Schritt {step + 1}/{stepTotal}</span>}
          </span>
        </div>

        <div className="flex flex-col gap-2">
          <Label>{next ? `Nächste · ${next.label}` : 'Letzte Folie'}</Label>
          <div className="aspect-video overflow-hidden rounded-lg border border-white/10 bg-black">
            {next ? (
              <MiniSlide presentation={presentation} zone={next} assets={assets} />
            ) : (
              <div className="flex h-full items-center justify-center text-sm text-white/30">
                Ende der Präsentation
              </div>
            )}
          </div>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-2">
          <Label>Notizen</Label>
          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-white/85">
            {notes || <span className="text-white/30">Keine Notizen für diese Folie.</span>}
          </div>
        </div>
      </div>
    </div>
  )
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="text-[11px] font-semibold uppercase tracking-wider text-white/40">
      {children}
    </span>
  )
}

// Eine einzelne Folie, ins Fenster eingepasst (feste 16:9-Bühne, Spec §21).
function MiniSlide({
  presentation,
  zone,
  assets,
}: {
  presentation: Presentation
  zone: Zone
  assets: AssetMap
}) {
  const html = useMemo(
    () => renderSingleZonePage(presentation, zone, assets),
    [presentation, zone, assets],
  )
  return (
    <iframe
      srcDoc={html}
      title="Folienvorschau"
      sandbox="allow-scripts"
      className="h-full w-full border-0"
    />
  )
}

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
