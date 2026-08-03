import { useEffect, useMemo, useRef, useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { renderFullPage } from '@/lib/renderer'
import { splitMarkdownBlocks } from '@/lib/markdown-tiptap'
import {
  isTauri,
  assetUrlBase,
  openShareWindow,
  setProjectorFullscreen,
  closePresentationWindow,
  describeError,
} from '@/lib/tauri'
import { notify } from '@/store/toast'
import { t } from '@/i18n'
import { mapToAssets } from '@/lib/assets'
import { Icon } from '@/components/ui/Icon'
import { SpeakerView } from './SpeakerView'
import { SlideOverview } from './SlideOverview'
import { AnnotationLayer, type AnnotationTool } from './AnnotationLayer'

const TAURI = isTauri()

/** Tauri-Event fensterübergreifend feuern (No-op außerhalb von Tauri). */
async function emitEvent(name: string, payload: unknown): Promise<void> {
  if (!TAURI) return
  const { emit } = await import('@tauri-apps/api/event')
  await emit(name, payload)
}

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

  // Folien-Fenster (Spec §26): offen? + im randlos-Vollbild auf seinem Monitor (Beamer)
  // vs. dekoriertem 16:9-Fenster (Remote/frei platzieren).
  const [projectorOpen, setProjectorOpen] = useState(false)
  const [isProjFullscreen, setIsProjFullscreen] = useState(false)
  // Letzter Navigationsstand — für die Antwort auf die Projector-Bereitschaft.
  const navStateRef = useRef({ index: activeSlideIndex, step })
  navStateRef.current = { index: activeSlideIndex, step }
  // Aktueller Tastatur-Handler, damit der Message-Listener (der nur einmal
  // registriert wird) immer die frische Closure trifft (Befund B10).
  const keyHandlerRef = useRef<(e: { key: string; preventDefault?: () => void }) => void>(() => {})

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

  // Echtes Vollbild beim Betreten (Review 2026-08, Befund H25). Vorher war der
  // „Präsentationsmodus" nur ein `fixed inset-0`-Overlay INNERHALB des App-Fensters:
  // wer nicht maximiert hatte, präsentierte mit Titelleiste und sichtbarem Desktop
  // drumherum. `setFullscreen` wurde im gesamten Frontend nie aufgerufen — und war
  // per Capability auch gar nicht erlaubt (H26, jetzt in default.json ergänzt).
  //
  // Beim Verlassen sauber zurückschalten. Fehler bewusst still: Vollbild ist eine
  // Verbesserung, kein Muss — auf einer Plattform ohne die Berechtigung soll der
  // Präsentationsmodus trotzdem starten.
  useEffect(() => {
    if (!TAURI) return
    let cancelled = false
    void (async () => {
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        const win = getCurrentWindow()
        await win.setFullscreen(true)
        // Fokus zurück ans Steuerfenster, damit die Tastatur hier ankommt.
        await win.setFocus()
      } catch (e) {
        console.warn('[slideo] Vollbild nicht möglich:', e)
      }
    })()
    return () => {
      cancelled = true
      void (async () => {
        try {
          const { getCurrentWindow } = await import('@tauri-apps/api/window')
          await getCurrentWindow().setFullscreen(false)
        } catch {
          /* still */
        }
      })()
      void cancelled
    }
  }, [])

  // Tastatur: Navigation (Schritte), Speaker (s), Übersicht (g), Laser (l),
  // Stift (p), Löschen (c), Auto-Advance (a), Verlassen (Esc). Bei offener
  // Übersicht übernimmt diese die Tastatur (Capture-Listener) — hier still.
  useEffect(() => {
    // Nimmt sowohl echte KeyboardEvents (Parent-Fenster) als auch die vom
    // Folien-Iframe weitergereichten Beschreibungen entgegen (Befund B10).
    function onKey(e: { key: string; preventDefault?: () => void }) {
      const preventDefault = () => e.preventDefault?.()
      if (overview) return
      if (e.key === 'Escape') {
        preventDefault()
        if (tool !== 'none') setTool('none')
        else setMode('editor')
      } else if (e.key === 's' || e.key === 'S') {
        preventDefault()
        setView((v) => (v === 'audience' ? 'speaker' : 'audience'))
      } else if (e.key === 'g' || e.key === 'G') {
        preventDefault()
        setOverview(true)
      } else if ((e.key === 'l' || e.key === 'L') && !projectorOpen) {
        preventDefault()
        toggleTool('laser')
      } else if ((e.key === 'p' || e.key === 'P') && !projectorOpen) {
        preventDefault()
        toggleTool('pen')
      } else if ((e.key === 'c' || e.key === 'C') && !projectorOpen) {
        preventDefault()
        setClearNonce((n) => n + 1)
      } else if (e.key === 'a' || e.key === 'A') {
        preventDefault()
        setAuto((v) => !v)
      } else if (['ArrowRight', 'ArrowDown', 'PageDown', ' '].includes(e.key)) {
        preventDefault()
        doStep(1)
      } else if (['ArrowLeft', 'ArrowUp', 'PageUp'].includes(e.key)) {
        preventDefault()
        doStep(-1)
      } else if (e.key === 'Home') {
        preventDefault()
        doJump(0, 0)
      } else if (e.key === 'End') {
        preventDefault()
        doJump(count - 1, stepCount(count - 1) - 1)
      }
    }
    keyHandlerRef.current = onKey
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

  // Zonen-Link-Sprung aus dem Audience-Iframe (data-slideo-goto / #zone-Hash):
  // das Iframe ist anzeige-only und bittet den parent-autoritativen Steuerstand,
  // zur Zielfolie zu springen. doJump nutzt nur stabile Setter → einmal registrieren.
  useEffect(() => {
    function onMsg(e: MessageEvent) {
      // Herkunftsprüfung (Befund S15): nur das eigene Folien-Iframe darf steuern.
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return
      const d = e.data || {}
      if (d.type === 'slideo:goto-request' && typeof d.index === 'number') {
        doJump(Math.max(0, d.index | 0), 0)
      } else if (d.type === 'slideo:key' && typeof d.key === 'string') {
        // Der Fokus liegt im Folien-Iframe (Klick auf die Folie, Refokus nach
        // Alt-Tab) — ohne diese Brücke wäre die gesamte Presenter-Tastatur tot,
        // mitten im Vortrag (Befund B10).
        keyHandlerRef.current({ key: d.key })
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Zweitfenster-Sync (Spec §19.3), einmalige Listener: Bereitschaft des Folien-
  // Fensters mit dem aktuellen Stand beantworten; vom Nutzer geschlossenes Fenster
  // erkennen. (Tastatur/Steuerung bleiben hier im Hauptfenster.)
  useEffect(() => {
    if (!TAURI) return
    let alive = true
    const unsubs: Array<() => void> = []
    void (async () => {
      const { listen } = await import('@tauri-apps/api/event')
      unsubs.push(
        await listen('slideo:projector-ready', () => {
          void emitEvent('slideo:nav', navStateRef.current)
        }),
      )
      unsubs.push(
        await listen('slideo:projector-closed', () => {
          if (alive) setProjectorOpen(false)
        }),
      )
      // Zonen-Link auf dem Projektor angeklickt → das Folien-Fenster reicht den
      // Sprungwunsch hierher (Steuerhoheit bleibt am Hauptfenster, Spec §23).
      unsubs.push(
        await listen<{ index: number }>('slideo:projector-goto', (e) => {
          if (alive) doJump(Math.max(0, e.payload.index | 0), 0)
        }),
      )
    })()
    return () => {
      alive = false
      unsubs.forEach((u) => u())
    }
  }, [])

  // Navigationsstand ans Folien-Fenster spiegeln.
  useEffect(() => {
    if (projectorOpen) void emitEvent('slideo:nav', { index: activeSlideIndex, step })
  }, [projectorOpen, activeSlideIndex, step])

  // Hinweis: `slideo:deck-changed` (Re-Load des Folien-Fensters bei Live-Edits)
  // feuert die mcp-bridge NACH dem (debounced) AppState-Sync — sonst läse der
  // Projector noch den alten Stand. Hier daher kein eigener Emit nötig.

  // Verlassen des Präsentationsmodus / Unmount → Folien-Fenster schließen.
  useEffect(() => {
    return () => {
      if (TAURI) void closePresentationWindow().catch(() => {})
    }
  }, [])

  // Folien-Fenster öffnen (Spec §26): dekoriertes 16:9-Fenster auf dem aktuellen Screen.
  // In Zoom/Meet per „Fenster teilen" freigeben ODER auf einen zweiten Bildschirm ziehen
  // und per „Vollbild" randlos füllen (Beamer/TV). Die Presenter-View bleibt privat.
  async function presentShareWindow() {
    try {
      // AppState frisch machen, bevor das Folien-Fenster ihn liest (Store→AppState ist sonst
      // debounced → frisch geöffnet könnte es einen veralteten Stand sehen).
      const { invoke } = await import('@tauri-apps/api/core')
      await invoke('sync_presentation', { presentation })
      await invoke('sync_assets', { assets: mapToAssets(assets) })
      await openShareWindow()
      // Fokus zurück aufs Hauptfenster (Cockpit) → Tastatur-Navigation bleibt hier; das
      // Folien-Fenster darf ruhig dahinter liegen (Window-Capture erfasst es trotzdem).
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().setFocus()
      } catch {
        /* ignorieren */
      }
      setProjectorOpen(true)
      setIsProjFullscreen(false)
      setView('speaker')
      setTool('none') // Laser/Stift im Zwei-Fenster-Modus (v1) deaktiviert
      notify(t('present.share.opened'), 'info')
    } catch (e) {
      notify(
        t('present.share.failed', { error: describeError(e) }),
        'error',
      )
    }
  }
  // Vollbild-Umschalter: randlos-füllend auf dem Monitor, auf dem das Fenster GERADE liegt
  // (Beamer/TV) ⇄ dekoriertes 16:9-Fenster (Remote/frei platzieren).
  async function toggleProjectorFullscreen() {
    const next = !isProjFullscreen
    try {
      await setProjectorFullscreen(next)
      setIsProjFullscreen(next)
      // Fokus zurück aufs Cockpit (Tastatur-Nav bleibt hier).
      try {
        const { getCurrentWindow } = await import('@tauri-apps/api/window')
        await getCurrentWindow().setFocus()
      } catch {
        /* ignorieren */
      }
    } catch (e) {
      notify(
        t('present.fullscreen.failed', { error: describeError(e) }),
        'error',
      )
    }
  }
  async function stopProjector() {
    try {
      await closePresentationWindow()
    } catch {
      /* ignorieren */
    }
    setProjectorOpen(false)
    setIsProjFullscreen(false)
  }

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
          title={t('present.iframe.title')}
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
          <ControlButton
            onClick={() => doStep(-1)}
            title={t('present.control.prev')}
            icon="chevron_left"
          />
          <span className="min-w-[3.5rem] text-center text-[13px] tabular-nums text-white/70">
            {Math.min(activeSlideIndex + 1, count)} / {count}
            {total > 1 && <span className="text-white/40"> · {step + 1}/{total}</span>}
          </span>
          <ControlButton
            onClick={() => doStep(1)}
            title={t('present.control.next')}
            icon="chevron_right"
          />

          <Divider />
          <ControlButton
            onClick={() => setOverview(true)}
            title={t('present.control.overview')}
            icon="grid_view"
          />
          {/* Laser/Stift im Zwei-Bildschirm-Modus (v1) ausgeblendet: das Overlay läge nur
              über der Speaker-Ansicht des Laptops, nicht über der Beamer-Folie. */}
          {!projectorOpen && (
            <>
              <ControlButton
                onClick={() => toggleTool('laser')}
                title={t('present.control.laser')}
                icon="gps_fixed"
                active={tool === 'laser'}
              />
              <ControlButton
                onClick={() => toggleTool('pen')}
                title={t('present.control.pen')}
                icon="draw"
                active={tool === 'pen'}
              />
              {tool === 'pen' && (
                <ControlButton
                  onClick={() => setClearNonce((n) => n + 1)}
                  title={t('present.control.clearAnnotations')}
                  icon="ink_eraser"
                />
              )}
            </>
          )}

          <Divider />
          <ControlButton
            onClick={() => setAuto((v) => !v)}
            title={auto ? t('present.control.autoStop') : t('present.control.autoStart')}
            icon={auto ? 'pause' : 'play_arrow'}
            active={auto}
          />
          <select
            value={autoSeconds}
            onChange={(e) => setAutoSeconds(Number(e.target.value))}
            title={t('present.control.autoSeconds')}
            aria-label={t('present.control.autoSecondsAria')}
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
            title={loop ? t('present.control.loopOff') : t('present.control.loopOn')}
            icon="repeat"
            active={loop}
          />

          {TAURI && (
            <>
              <Divider />
              {/* Folien-Fenster (Spec §26): dekoriertes 16:9-Fenster — für Zoom/Meet „Fenster
                  teilen" ODER auf einen zweiten Bildschirm ziehen + „Vollbild" (Beamer/TV).
                  Ein Fenster für beide Fälle; kein separater Zwei-Bildschirm-Modus mehr. */}
              {!projectorOpen ? (
                <ControlButton
                  onClick={presentShareWindow}
                  title={t('present.control.share')}
                  icon="screen_share"
                />
              ) : (
                <>
                  <ControlButton
                    onClick={toggleProjectorFullscreen}
                    title={
                      isProjFullscreen
                        ? t('present.control.projectorWindowed')
                        : t('present.control.projectorFullscreen')
                    }
                    icon={isProjFullscreen ? 'fullscreen_exit' : 'fullscreen'}
                    active={isProjFullscreen}
                  />
                  <ControlButton
                    onClick={stopProjector}
                    title={t('present.control.projectorClose')}
                    icon="cancel_presentation"
                    active
                  />
                </>
              )}
            </>
          )}

          <Divider />
          <button
            onClick={() => setView((v) => (v === 'audience' ? 'speaker' : 'audience'))}
            className="flex h-7 items-center gap-1 rounded-full px-2.5 text-[13px] hover:bg-white/10"
            title={t('present.control.toggleSpeaker')}
          >
            <Icon name={view === 'audience' ? 'co_present' : 'slideshow'} size={18} weight={400} />
            {view === 'audience' ? t('present.control.speaker') : t('present.control.slide')}
          </button>
        </div>
      </div>

      <button
        onClick={() => setMode('editor')}
        className="absolute right-4 top-4 z-20 flex items-center gap-1 rounded-lg border border-white/10 bg-black/55 px-2.5 py-1.5 text-[13px] text-white/80 backdrop-blur transition-colors hover:bg-white/10"
        title={t('present.exit.title')}
      >
        <Icon name="close" size={17} weight={400} />
        {t('present.exit.label')}
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

// `hasPopup`/`expanded` sind mit §26 entfallen (Befund S40): sie bedienten das
// gelöschte Monitor-Dropdown, seither übergab sie kein Aufrufer mehr. Alle
// verbliebenen Steuerknöpfe sind Umschalter → aria-pressed genügt.
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
      aria-label={title}
      aria-pressed={active}
    >
      <Icon name={icon} size={20} weight={400} />
    </button>
  )
}
