import { useEffect, useMemo, useRef, useState } from 'react'
import type { Presentation, AssetMap } from '@/types'
import { Icon } from '@/components/ui/Icon'
import { t, tp } from '@/i18n'
import { SlidePreview } from './SlidePreview'

interface SlideOverviewProps {
  presentation: Presentation
  assets: AssetMap
  /** Aktuell präsentierte Folie (0-basiert) — wird hervorgehoben. */
  current: number
  /** Springt zur Folie i (Schritt 0) und schließt die Übersicht. */
  onJump: (index: number) => void
  onClose: () => void
}

// Folien-Übersicht / Sprung-Grid (Spec §19.3): Raster aller Folien über der
// Präsentation; Klick oder Enter springt zur Folie. Tastatur-navigierbar
// (Pfeile bewegen die Auswahl, Enter springt, g/Esc schließt). Thumbnails sind
// statische Single-Zone-Pages (kein Nav-Script) → leichtgewichtig pro Zelle.
export function SlideOverview({ presentation, assets, current, onJump, onClose }: SlideOverviewProps) {
  const zones = useMemo(
    () => [...presentation.zones].sort((a, b) => a.order - b.order),
    [presentation],
  )
  const count = zones.length
  const [sel, setSel] = useState(() => Math.max(0, Math.min(current, count - 1)))
  const gridRef = useRef<HTMLDivElement>(null)
  const selRef = useRef<HTMLButtonElement>(null)

  // Spaltenanzahl aus dem aufgelösten Grid lesen (responsives auto-fill), damit
  // Hoch/Runter um genau eine Zeile springt.
  function columns(): number {
    const el = gridRef.current
    if (!el) return 1
    const tpl = getComputedStyle(el).gridTemplateColumns
    const n = tpl.split(' ').filter(Boolean).length
    return Math.max(1, n)
  }

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape' || e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        onJump(sel)
        return
      }
      const cols = columns()
      let next = sel
      if (e.key === 'ArrowRight') next = Math.min(count - 1, sel + 1)
      else if (e.key === 'ArrowLeft') next = Math.max(0, sel - 1)
      else if (e.key === 'ArrowDown') next = Math.min(count - 1, sel + cols)
      else if (e.key === 'ArrowUp') next = Math.max(0, sel - cols)
      else if (e.key === 'Home') next = 0
      else if (e.key === 'End') next = count - 1
      else return
      e.preventDefault()
      setSel(next)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [sel, count, onJump, onClose])

  // Auswahl an die tatsächlich präsentierte Folie koppeln, falls sich `current`
  // bei offener Übersicht extern ändert (z.B. MCP `set_active_slide`); zugleich
  // klemmt das `sel` in den gültigen Bereich, wenn das Deck schrumpft.
  useEffect(() => {
    setSel(Math.max(0, Math.min(current, count - 1)))
  }, [current, count])

  // Ausgewählte Kachel sichtbar halten + fokussieren (Fokus folgt der Auswahl →
  // Screenreader kündigt sie an, Fokus bleibt im modalen Overlay).
  useEffect(() => {
    selRef.current?.focus({ preventScroll: true })
    selRef.current?.scrollIntoView({ block: 'nearest' })
  }, [sel])

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t('present.overview.aria')}
      /* Voll deckend OHNE backdrop-filter: ein backdrop-filter auf einem Vorfahren lässt
         in WebKit verschachtelte Iframes (die Folien-Thumbnails) leer rendern. */
      className="absolute inset-0 z-30 flex flex-col bg-[#0b0b0f]"
    >
      <div className="flex items-center justify-between px-6 py-4 text-white">
        <span className="text-sm font-medium text-white/70">
          {tp('present.overview.count', count)}
        </span>
        <button
          onClick={onClose}
          className="flex items-center gap-1 rounded-lg border border-white/10 bg-white/5 px-2.5 py-1.5 text-[13px] text-white/80 transition-colors hover:bg-white/10"
          title={t('present.overview.close')}
        >
          <Icon name="close" size={17} weight={400} />
          {t('common.close')}
        </button>
      </div>

      <div
        ref={gridRef}
        className="grid min-h-0 flex-1 content-start gap-4 overflow-y-auto px-6 pb-8"
        style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))' }}
      >
        {zones.map((zone, i) => {
          const isCurrent = i === current
          const isSel = i === sel
          return (
            <button
              key={zone.id}
              ref={isSel ? selRef : undefined}
              onClick={() => onJump(i)}
              onMouseEnter={() => setSel(i)}
              className={`group flex flex-col gap-1.5 rounded-xl p-1.5 text-left outline-none transition-colors ${
                isSel ? 'bg-white/10' : 'hover:bg-white/5'
              }`}
            >
              <div
                // 16:9-Höhe über padding-bottom (nicht aspect-video): Der Kasten hat nur
                // absolut positionierte Kinder (SlidePreview + Badges) → ohne In-Flow-Inhalt
                // gibt WebKit einer aspect-ratio-Box hier keine Höhe (sie kollabiert auf 0 →
                // „nur Titel"). padding-bottom:56.25% erzwingt 16:9 unabhängig vom Inhalt.
                style={{ paddingBottom: '56.25%' }}
                className={`relative w-full overflow-hidden rounded-lg border bg-black ${
                  isCurrent
                    ? 'border-chrome-accent ring-2 ring-chrome-accent'
                    : isSel
                      ? 'border-white/50'
                      : 'border-white/10'
                }`}
              >
                <Thumb presentation={presentation} assets={assets} zoneIndex={i} />
                <span className="absolute left-1.5 top-1.5 rounded bg-black/60 px-1.5 py-0.5 text-[11px] font-medium tabular-nums text-white/85">
                  {i + 1}
                </span>
                {isCurrent && (
                  <span className="absolute right-1.5 top-1.5 rounded bg-chrome-accent px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {t('present.overview.current')}
                  </span>
                )}
              </div>
              <span className="truncate px-0.5 text-[12px] text-white/55">{zone.label}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}

// Eine Folie als statisches Thumbnail (Single-Zone-Page; Klick fängt der
// umschließende Button, daher pointer-events:none auf dem Iframe).
function Thumb({
  presentation,
  assets,
  zoneIndex,
}: {
  presentation: Presentation
  assets: AssetMap
  zoneIndex: number
}) {
  const zones = useMemo(
    () => [...presentation.zones].sort((a, b) => a.order - b.order),
    [presentation],
  )
  const zone = zones[zoneIndex]
  if (!zone) return null
  return <SlidePreview presentation={presentation} zone={zone} assets={assets} />
}
