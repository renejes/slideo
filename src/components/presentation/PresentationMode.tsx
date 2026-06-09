import { useEffect, useMemo, useRef, useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { renderFullPage } from '@/lib/renderer'
import { isTauri, assetUrlBase } from '@/lib/tauri'
import { Icon } from '@/components/ui/Icon'
import { SpeakerView } from './SpeakerView'

const ASSET_BASE = isTauri() ? assetUrlBase() : undefined

type View = 'audience' | 'speaker'

// Vollbild-Präsentationsmodus mit zwei Ansichten:
//  - audience: die Folie bildschirmfüllend (eigenes Iframe mit Tastatur-Navigation)
//  - speaker:  integrierte Speaker-Ansicht (aktuelle + nächste Folie, Timer, Notizen)
export function PresentationMode() {
  const presentation = usePresentationStore((s) => s.presentation)
  const assets = usePresentationStore((s) => s.assets)
  const activeSlideIndex = usePresentationStore((s) => s.activeSlideIndex)
  const setActiveSlide = usePresentationStore((s) => s.setActiveSlide)
  const nextSlide = usePresentationStore((s) => s.nextSlide)
  const prevSlide = usePresentationStore((s) => s.prevSlide)
  const setMode = usePresentationStore((s) => s.setMode)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [view, setView] = useState<View>('audience')
  const [elapsed, setElapsed] = useState(0)

  const html = useMemo(
    () =>
      presentation
        ? renderFullPage(presentation, { present: true, assets, assetUrlBase: ASSET_BASE })
        : '',
    [presentation, assets],
  )
  const count = presentation?.zones.length ?? 0

  // Timer (verstrichene Zeit seit Betreten des Präsentationsmodus).
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // Index-Meldungen nur aus dem Audience-Deck übernehmen (Speaker-Vorschauen
  // melden bewusst nichts — siehe navScript).
  useEffect(() => {
    if (view !== 'audience') return
    function onMessage(e: MessageEvent) {
      const d = e.data || {}
      if (d.type === 'slideo:index' && typeof d.index === 'number') setActiveSlide(d.index)
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [setActiveSlide, view])

  // Tastatur: Navigation, Speaker-Toggle (s), Verlassen (Esc).
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setMode('editor')
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setView((v) => (v === 'audience' ? 'speaker' : 'audience'))
      } else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        e.preventDefault()
        nextSlide()
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        prevSlide()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [nextSlide, prevSlide, setMode])

  // Aktiven Slide ins Audience-Iframe spiegeln.
  useEffect(() => {
    if (view !== 'audience') return
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:goto', index: activeSlideIndex, smooth: true },
      '*',
    )
  }, [activeSlideIndex, view])

  function handleLoad() {
    iframeRef.current?.focus()
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:goto', index: activeSlideIndex, smooth: false },
      '*',
    )
  }

  if (!presentation) return null

  return (
    <div className="fixed inset-0 z-50 bg-[#0b0b0f]">
      {view === 'audience' ? (
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleLoad}
          title="Präsentation"
          sandbox="allow-scripts"
          className="h-full w-full border-0"
        />
      ) : (
        <SpeakerView presentation={presentation} index={activeSlideIndex} elapsed={elapsed} />
      )}

      {/* Steuerleiste */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-5">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-1.5 py-1 text-white/90 backdrop-blur">
          <ControlButton onClick={prevSlide} title="Zurück (←)" icon="chevron_left" />
          <span className="min-w-[3.5rem] text-center text-[13px] tabular-nums text-white/70">
            {Math.min(activeSlideIndex + 1, count)} / {count}
          </span>
          <ControlButton onClick={nextSlide} title="Weiter (→)" icon="chevron_right" />
          <span className="mx-1 h-5 w-px bg-white/10" />
          <button
            onClick={() => setView((v) => (v === 'audience' ? 'speaker' : 'audience'))}
            className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] hover:bg-white/10"
            title="Speaker-Ansicht umschalten (s)"
          >
            <Icon name={view === 'audience' ? 'co_present' : 'slideshow'} size={18} weight={400} />
            {view === 'audience' ? 'Speaker' : 'Folie'}
          </button>
        </div>
      </div>

      <button
        onClick={() => setMode('editor')}
        className="absolute right-4 top-4 flex items-center gap-1 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 text-[13px] text-white/80 backdrop-blur transition-colors hover:bg-white/10"
        title="Verlassen (Esc)"
      >
        <Icon name="close" size={17} weight={400} />
        Verlassen
      </button>
    </div>
  )
}

function ControlButton({
  onClick,
  title,
  icon,
}: {
  onClick: () => void
  title: string
  icon: string
}) {
  return (
    <button
      onClick={onClick}
      className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-white/10"
      title={title}
    >
      <Icon name={icon} size={20} weight={400} />
    </button>
  )
}
