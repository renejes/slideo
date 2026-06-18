import { useEffect, useMemo, useRef, useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { renderFullPage } from '@/lib/renderer'
import { splitMarkdownBlocks } from '@/lib/markdown-tiptap'
import { isTauri, assetUrlBase } from '@/lib/tauri'
import { Icon } from '@/components/ui/Icon'
import { SpeakerView } from './SpeakerView'
import { SlideOverview } from './SlideOverview'
import { AnnotationLayer, type AnnotationTool } from './AnnotationLayer'

const ASSET_BASE = isTauri() ? assetUrlBase() : undefined

type View = 'audience' | 'speaker'

const AUTO_INTERVALS = [3, 5, 8, 10, 15, 20]

// Vollbild-Präsentationsmodus. Navigation ist **parent-autoritativ**: dieser
// Component hält Folien-Index UND Build-Schritt; das Audience-Iframe ist nur
// Anzeige und reagiert auf `slideo:show {index, step}`. So bleiben Folie + Builds
// auch beim Wechsel in die Speaker-View synchron (Spec §19.1).
//
// Presenter-Tools (Spec §19.3): Folien-Übersicht/Sprung-Grid, Laser-/Stift-
// Overlay (Canvas) und Auto-Advance/Kiosk-Loop — alle hier verankert, weil die
// Navigation parent-autoritativ ist.
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

  // Presenter-Tools
  const [overview, setOverview] = useState(false)
  const [tool, setTool] = useState<AnnotationTool>('none')
  const [clearNonce, setClearNonce] = useState(0)
  const [auto, setAuto] = useState(false)
  const [autoSeconds, setAutoSeconds] = useState(5)
  const [loop, setLoop] = useState(false)

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
  const accent = presentation?.tokens['color-accent'] ?? '#e94560'

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

  function toggleTool(t: Exclude<AnnotationTool, 'none'>) {
    setTool((cur) => (cur === t ? 'none' : t))
  }

  // Schritt im gültigen Bereich der aktiven Folie halten — auch wenn der aktive
  // Index oder das Deck von außen geändert wird (MCP `set_active_slide` /
  // Deck-Edit via applyExternalPresentation), wo `step` sonst stehen bliebe und
  // ein veraltetes `slideo:show {index, step}` posten würde (Spec §19.1:
  // Folie + Schritt müssen konsistent sein). Interne Navigation setzt `step`
  // bereits korrekt → die Klemme lässt gültige Werte unangetastet.
  useEffect(() => {
    setStep((s) => Math.min(Math.max(0, s), stepCount(activeSlideIndex) - 1))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSlideIndex, presentation])

  // Timer (verstrichene Zeit seit Betreten des Präsentationsmodus).
  useEffect(() => {
    const start = Date.now()
    const id = setInterval(() => setElapsed(Math.floor((Date.now() - start) / 1000)), 1000)
    return () => clearInterval(id)
  }, [])

  // Tastatur: Navigation (Schritte), Speaker (s), Übersicht (g), Laser (l),
  // Stift (p), Löschen (c), Auto-Advance (a), Verlassen (Esc). Bei offener
  // Übersicht übernimmt diese die Tastatur (Capture-Listener) — hier still.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (overview) return
      if (e.key === 'Escape') {
        e.preventDefault()
        if (tool !== 'none') setTool('none')
        else setMode('editor')
      } else if (e.key === 's' || e.key === 'S') {
        e.preventDefault()
        setView((v) => (v === 'audience' ? 'speaker' : 'audience'))
      } else if (e.key === 'g' || e.key === 'G') {
        e.preventDefault()
        setOverview(true)
      } else if (e.key === 'l' || e.key === 'L') {
        e.preventDefault()
        toggleTool('laser')
      } else if (e.key === 'p' || e.key === 'P') {
        e.preventDefault()
        toggleTool('pen')
      } else if (e.key === 'c' || e.key === 'C') {
        e.preventDefault()
        setClearNonce((n) => n + 1)
      } else if (e.key === 'a' || e.key === 'A') {
        e.preventDefault()
        setAuto((v) => !v)
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

  // Auto-Advance / Kiosk-Loop (Spec §19.3): nach `autoSeconds` einen Schritt
  // weiter; am Ende → Schleife (loop) oder Stopp. Pausiert bei offener Übersicht.
  useEffect(() => {
    if (!auto || overview) return
    const id = window.setTimeout(() => {
      const atEnd = activeSlideIndex >= count - 1 && step >= stepCount(activeSlideIndex) - 1
      if (atEnd) {
        if (loop) doJump(0, 0)
        else setAuto(false)
      } else {
        doStep(1)
      }
    }, autoSeconds * 1000)
    return () => window.clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [auto, overview, activeSlideIndex, step, autoSeconds, loop, count, presentation])

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

      {/* Laser/Stift-Overlay nur über der Audience-Folie; Remount (key) löscht
          Annotationen bei Folienwechsel oder „Löschen". */}
      {view === 'audience' && tool !== 'none' && (
        <AnnotationLayer key={`${activeSlideIndex}-${clearNonce}`} tool={tool} color={accent} />
      )}

      {/* Steuerleiste */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-20 flex items-center justify-center pb-5">
        <div className="pointer-events-auto flex items-center gap-1 rounded-full border border-white/10 bg-black/55 px-1.5 py-1 text-white/90 backdrop-blur">
          <ControlButton onClick={() => doStep(-1)} title="Zurück (←)" icon="chevron_left" />
          <span className="min-w-[3.5rem] text-center text-[13px] tabular-nums text-white/70">
            {Math.min(activeSlideIndex + 1, count)} / {count}
            {total > 1 && <span className="text-white/40"> · {step + 1}/{total}</span>}
          </span>
          <ControlButton onClick={() => doStep(1)} title="Weiter (→)" icon="chevron_right" />

          <Divider />
          <ControlButton onClick={() => setOverview(true)} title="Übersicht (g)" icon="grid_view" />
          <ControlButton
            onClick={() => toggleTool('laser')}
            title="Laserpointer (l)"
            icon="gps_fixed"
            active={tool === 'laser'}
          />
          <ControlButton
            onClick={() => toggleTool('pen')}
            title="Stift (p)"
            icon="draw"
            active={tool === 'pen'}
          />
          {tool === 'pen' && (
            <ControlButton
              onClick={() => setClearNonce((n) => n + 1)}
              title="Annotationen löschen (c)"
              icon="ink_eraser"
            />
          )}

          <Divider />
          <ControlButton
            onClick={() => setAuto((v) => !v)}
            title={auto ? 'Auto-Advance stoppen (a)' : 'Auto-Advance starten (a)'}
            icon={auto ? 'pause' : 'play_arrow'}
            active={auto}
          />
          <select
            value={autoSeconds}
            onChange={(e) => setAutoSeconds(Number(e.target.value))}
            title="Sekunden pro Schritt"
            className="h-7 rounded-md border border-white/10 bg-white/5 px-1 text-[12px] text-white/80 outline-none hover:bg-white/10"
          >
            {AUTO_INTERVALS.map((s) => (
              <option key={s} value={s} className="text-black">
                {s}s
              </option>
            ))}
          </select>
          <ControlButton
            onClick={() => setLoop((v) => !v)}
            title={loop ? 'Schleife aus' : 'Schleife (am Ende von vorn)'}
            icon="repeat"
            active={loop}
          />

          <Divider />
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
        className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 text-[13px] text-white/80 backdrop-blur transition-colors hover:bg-white/10"
        title="Verlassen (Esc)"
      >
        <Icon name="close" size={17} weight={400} />
        Verlassen
      </button>

      {overview && (
        <SlideOverview
          presentation={presentation}
          assets={assets}
          current={activeSlideIndex}
          onJump={(i) => {
            doJump(i, 0)
            setOverview(false)
          }}
          onClose={() => setOverview(false)}
        />
      )}
    </div>
  )
}

function Divider() {
  return <span className="mx-1 h-5 w-px bg-white/10" />
}

function ControlButton({
  onClick,
  title,
  icon,
  active = false,
}: {
  onClick: () => void
  title: string
  icon: string
  active?: boolean
}) {
  return (
    <button
      onClick={onClick}
      className={`flex h-7 w-7 items-center justify-center rounded-full transition-colors ${
        active ? 'bg-white/20 text-white' : 'hover:bg-white/10'
      }`}
      title={title}
      aria-pressed={active}
    >
      <Icon name={icon} size={20} weight={400} />
    </button>
  )
}
