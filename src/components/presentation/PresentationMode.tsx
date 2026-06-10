import { useEffect, useMemo, useRef, useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { renderFullPage } from '@/lib/renderer'
import { splitMarkdownBlocks } from '@/lib/markdown-tiptap'
import { isTauri, assetUrlBase } from '@/lib/tauri'
import { Icon } from '@/components/ui/Icon'
import { SpeakerView } from './SpeakerView'

const ASSET_BASE = isTauri() ? assetUrlBase() : undefined

type View = 'audience' | 'speaker'

// Vollbild-Präsentationsmodus. Navigation ist **parent-autoritativ**: dieser
// Component hält Folien-Index UND Build-Schritt; das Audience-Iframe ist nur
// Anzeige und reagiert auf `slideo:show {index, step}`. So bleiben Folie + Builds
// auch beim Wechsel in die Speaker-View synchron (Spec §19.1).
export function PresentationMode() {
  const presentation = usePresentationStore((s) => s.presentation)
  const assets = usePresentationStore((s) => s.assets)
  const activeSlideIndex = usePresentationStore((s) => s.activeSlideIndex)
  const setActiveSlide = usePresentationStore((s) => s.setActiveSlide)
  const setMode = usePresentationStore((s) => s.setMode)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [view, setView] = useState<View>('audience')
  const [elapsed, setElapsed] = useState(0)
  const [step, setStep] = useState(0)

  const html = useMemo(
    () =>
      presentation
        ? renderFullPage(presentation, { present: true, assets, assetUrlBase: ASSET_BASE })
        : '',
    [presentation, assets],
  )
  const zones = useMemo(
    () => (presentation ? [...presentation.zones].sort((a, b) => a.order - b.order) : []),
    [presentation],
  )
  const count = zones.length

  // Anzahl Schritte (Builds) einer Folie: 1, sofern keine reveal-Steps.
  function stepCount(i: number): number {
    const z = zones[i]
    if (!z || z.reveal !== 'steps' || z.content_type !== 'markdown' || z.style.layout === 'split') {
      return 1
    }
    const n = splitMarkdownBlocks(z.markdown).length
    return n > 1 ? n : 1
  }

  function doStep(dir: number) {
    if (dir > 0) {
      if (step < stepCount(activeSlideIndex) - 1) setStep(step + 1)
      else if (activeSlideIndex < count - 1) {
        setActiveSlide(activeSlideIndex + 1)
        setStep(0)
      }
    } else if (step > 0) {
      setStep(step - 1)
    } else if (activeSlideIndex > 0) {
      const ni = activeSlideIndex - 1
      setActiveSlide(ni)
      setStep(stepCount(ni) - 1)
    }
  }

  function doJump(i: number, s: number) {
    setActiveSlide(i)
    setStep(s)
  }

  // Timer (verstrichene Zeit seit Betreten des Präsentationsmodus).
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // Tastatur: Navigation (Schritte), Speaker-Toggle (s), Verlassen (Esc).
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
        doStep(1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        e.preventDefault()
        doStep(-1)
      } else if (e.key === 'Home') {
        e.preventDefault()
        doJump(0, 0)
      } else if (e.key === 'End') {
        e.preventDefault()
        doJump(count - 1, stepCount(count - 1) - 1)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  })

  // Aktiven Slide + Build-Schritt ins Audience-Iframe spiegeln.
  useEffect(() => {
    if (view !== 'audience') return
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:show', index: activeSlideIndex, step, smooth: true },
      '*',
    )
  }, [activeSlideIndex, step, view])

  function handleLoad() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:show', index: activeSlideIndex, step, smooth: false },
      '*',
    )
  }

  if (!presentation) return null
  const total = stepCount(activeSlideIndex)

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
        <SpeakerView
          presentation={presentation}
          index={activeSlideIndex}
          elapsed={elapsed}
          step={step}
          stepTotal={total}
        />
      )}

      {/* Steuerleiste */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-center pb-5">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-1.5 py-1 text-white/90 backdrop-blur">
          <ControlButton onClick={() => doStep(-1)} title="Zurück (←)" icon="chevron_left" />
          <span className="min-w-[3.5rem] text-center text-[13px] tabular-nums text-white/70">
            {Math.min(activeSlideIndex + 1, count)} / {count}
            {total > 1 && <span className="text-white/40"> · {step + 1}/{total}</span>}
          </span>
          <ControlButton onClick={() => doStep(1)} title="Weiter (→)" icon="chevron_right" />
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
