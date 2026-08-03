import { useMemo } from 'react'
import type { Presentation } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { t } from '@/i18n'
import { SlidePreview } from './SlidePreview'

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
    // Gestapelt (Spec §26): aktuelle Folie oben groß & randlos im 16:9, darunter eine
    // Leiste mit Timer/Zähler, nächster Folie und Notizen.
    <div className="flex h-full w-full flex-col gap-3 p-4 text-white">
      {/* Kopfzeile: aktuelle Folie + Timer/Zähler */}
      <div className="flex shrink-0 items-center justify-between">
        <Label>{t('present.speaker.current', { label: current?.label ?? '—' })}</Label>
        <div className="flex items-baseline gap-3">
          <span className="text-2xl font-semibold tabular-nums">{formatTime(elapsed)}</span>
          <span className="text-sm text-white/50 tabular-nums">
            {Math.min(index + 1, count)} / {count}
            {stepTotal > 1 && (
              <span className="text-white/30">
                {' · '}
                {t('present.speaker.step', { current: step + 1, total: stepTotal })}
              </span>
            )}
          </span>
        </div>
      </div>

      {/* Aktuelle Folie — so groß wie möglich, exakt 16:9 (füllt randlos), zentriert.
          Höhen-getrieben (h-full → Breite = Höhe·16/9); max-w/max-h fangen extreme
          Fensterformen ab (der Iframe-Inhalt passt sich per Scale-to-fit an, Spec §21). */}
      <div className="flex min-h-0 flex-1 items-center justify-center">
        <div className="relative aspect-video h-full max-h-full max-w-full overflow-hidden rounded-xl border border-white/10 bg-black">
          {current && <SlidePreview presentation={presentation} zone={current} assets={assets} />}
        </div>
      </div>

      {/* Untere Info-Leiste: nächste Folie + Notizen nebeneinander */}
      <div className="flex h-[32%] min-h-[9rem] shrink-0 gap-4">
        <div className="flex w-[34%] min-w-[13rem] flex-col gap-1.5">
          <Label>
            {next ? t('present.speaker.next', { label: next.label }) : t('present.speaker.last')}
          </Label>
          <div className="flex min-h-0 flex-1 items-center justify-center">
            <div className="relative aspect-video h-full max-h-full max-w-full overflow-hidden rounded-lg border border-white/10 bg-black">
              {next ? (
                <SlidePreview presentation={presentation} zone={next} assets={assets} />
              ) : (
                <div className="absolute inset-0 flex items-center justify-center text-sm text-white/30">
                  {t('present.speaker.end')}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-1.5">
          <Label>{t('present.speaker.notes')}</Label>
          <div className="min-h-0 flex-1 overflow-y-auto whitespace-pre-wrap rounded-lg border border-white/10 bg-white/5 p-3 text-sm leading-relaxed text-white/85">
            {notes || <span className="text-white/30">{t('present.speaker.noNotes')}</span>}
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

function formatTime(seconds: number): string {
  const m = Math.floor(seconds / 60)
  const s = seconds % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}
