import { useEffect, useRef } from 'react'

export type AnnotationTool = 'none' | 'laser' | 'pen'

interface AnnotationLayerProps {
  /** 'laser' = flüchtiger Leucht-Komet, 'pen' = bleibende Striche. */
  tool: Exclude<AnnotationTool, 'none'>
  /** Strich-/Leuchtfarbe (aus den Design-Tokens, z.B. var --color-accent). */
  color: string
}

interface Point {
  x: number
  y: number
}
interface TrailPoint extends Point {
  t: number
}

const LASER_TRAIL_MS = 420 // Lebensdauer eines Kometen-Punkts
const LASER_HEAD = 9 // Radius des hellen Kopfes
const PEN_WIDTH = 4

// Laser-/Stift-Overlay (Spec §19.3): ein Canvas über der Audience-Folie,
// **Pointer-Events** (HTML5-Zeichnen ist im WKWebView die zuverlässige Variante).
// Pen-Striche bleiben (bis Folienwechsel/Löschen → Remount via key); der Laser
// ist ein flüchtiger Komet mit ausblendendem Schweif. Die Farbe kommt aus den
// Tokens, damit die Annotation zum Deck passt.
export function AnnotationLayer({ tool, color }: AnnotationLayerProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  // Refs statt State: die rAF-Schleife liest sie ohne Re-Render.
  const toolRef = useRef(tool)
  const colorRef = useRef(color)
  const strokes = useRef<Point[][]>([]) // abgeschlossene Pen-Striche
  const active = useRef<Point[] | null>(null) // laufender Pen-Strich
  const trail = useRef<TrailPoint[]>([]) // Laser-Schweif
  const dpr = useRef(1)

  toolRef.current = tool
  colorRef.current = color

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    function resize() {
      const c = canvasRef.current
      if (!c) return
      dpr.current = Math.min(window.devicePixelRatio || 1, 2)
      c.width = Math.round(c.clientWidth * dpr.current)
      c.height = Math.round(c.clientHeight * dpr.current)
    }
    resize()
    window.addEventListener('resize', resize)

    let raf = 0
    function frame(now: number) {
      const c = canvasRef.current
      const g = c?.getContext('2d')
      if (!c || !g) {
        raf = requestAnimationFrame(frame) // nie ohne Neuplanung aussteigen
        return
      }
      g.setTransform(dpr.current, 0, 0, dpr.current, 0, 0)
      g.clearRect(0, 0, c.clientWidth, c.clientHeight)
      const col = colorRef.current

      // Bleibende Pen-Striche (auch im Laser-Modus sichtbar).
      g.lineCap = 'round'
      g.lineJoin = 'round'
      g.strokeStyle = col
      g.lineWidth = PEN_WIDTH
      for (const stroke of strokes.current) drawStroke(g, stroke)
      if (active.current) drawStroke(g, active.current)

      // Laser-Komet: Schweif nach Alter ausblenden + heller Kopf.
      if (toolRef.current === 'laser') {
        trail.current = trail.current.filter((p) => now - p.t < LASER_TRAIL_MS)
        const pts = trail.current
        for (let i = 1; i < pts.length; i++) {
          const age = (now - pts[i].t) / LASER_TRAIL_MS
          g.globalAlpha = Math.max(0, 1 - age)
          g.strokeStyle = col
          g.lineWidth = LASER_HEAD * (1 - age) + 2
          g.beginPath()
          g.moveTo(pts[i - 1].x, pts[i - 1].y)
          g.lineTo(pts[i].x, pts[i].y)
          g.stroke()
        }
        const head = pts[pts.length - 1]
        if (head) {
          g.globalAlpha = 1
          const grad = g.createRadialGradient(head.x, head.y, 0, head.x, head.y, LASER_HEAD * 2)
          grad.addColorStop(0, '#ffffff')
          grad.addColorStop(0.4, col)
          grad.addColorStop(1, 'rgba(0,0,0,0)')
          g.fillStyle = grad
          g.beginPath()
          g.arc(head.x, head.y, LASER_HEAD * 2, 0, Math.PI * 2)
          g.fill()
        }
        g.globalAlpha = 1
      }
      raf = requestAnimationFrame(frame)
    }
    raf = requestAnimationFrame(frame)
    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(raf)
    }
  }, [])

  function localXY(clientX: number, clientY: number): Point {
    const r = canvasRef.current!.getBoundingClientRect()
    return { x: clientX - r.left, y: clientY - r.top }
  }

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    canvasRef.current?.setPointerCapture(e.pointerId)
    if (tool === 'pen') {
      active.current = [localXY(e.clientX, e.clientY)]
    } else {
      trail.current.push({ ...localXY(e.clientX, e.clientY), t: e.timeStamp })
    }
  }

  function onPointerMove(e: React.PointerEvent) {
    if (tool === 'pen') {
      if (!active.current) return
      // High-Hz-Eingaben bündelt der Browser zu einem pointermove → alle
      // Zwischenpunkte abholen, sonst werden Striche eckig.
      const coalesced = e.nativeEvent.getCoalescedEvents?.() ?? []
      if (coalesced.length > 0) {
        for (const ce of coalesced) active.current.push(localXY(ce.clientX, ce.clientY))
      } else {
        active.current.push(localXY(e.clientX, e.clientY))
      }
    } else {
      trail.current.push({ ...localXY(e.clientX, e.clientY), t: e.timeStamp })
    }
  }

  function onPointerUp(e: React.PointerEvent) {
    const c = canvasRef.current
    // Auch über onLostPointerCapture erreichbar — dann ist die Capture evtl.
    // schon weg, releasePointerCapture würde sonst werfen.
    if (c?.hasPointerCapture?.(e.pointerId)) c.releasePointerCapture(e.pointerId)
    if (tool === 'pen' && active.current) {
      if (active.current.length > 1) strokes.current.push(active.current)
      active.current = null
    }
  }

  return (
    <canvas
      ref={canvasRef}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerUp}
      onLostPointerCapture={onPointerUp}
      className="absolute inset-0 z-10 h-full w-full"
      style={{ cursor: tool === 'pen' ? 'crosshair' : 'none', touchAction: 'none' }}
    />
  )
}

function drawStroke(g: CanvasRenderingContext2D, stroke: Point[]) {
  if (stroke.length < 2) {
    if (stroke.length === 1) {
      g.beginPath()
      g.arc(stroke[0].x, stroke[0].y, PEN_WIDTH / 2, 0, Math.PI * 2)
      g.fillStyle = g.strokeStyle
      g.fill()
    }
    return
  }
  g.beginPath()
  g.moveTo(stroke[0].x, stroke[0].y)
  for (let i = 1; i < stroke.length; i++) g.lineTo(stroke[i].x, stroke[i].y)
  g.stroke()
}
