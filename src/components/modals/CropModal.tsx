import { useCallback, useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui/Icon'
import { notify } from '@/store/toast'

interface CropModalProps {
  /** Bildquelle (Data-URI / aufgelöste Anzeige-URL). */
  src: string
  /** Liefert das zugeschnittene Bild als Data-URI. */
  onApply: (dataUri: string) => void
  onCancel: () => void
}

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

type Mode = 'move' | 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w'

const MIN = 0.06 // kleinster Crop (Anteil der Bildkante)

const clamp = (v: number, lo: number, hi: number) => Math.min(Math.max(v, lo), hi)

function applyDrag(mode: Mode, s: Rect, dx: number, dy: number): Rect {
  if (mode === 'move') {
    return { x: clamp(s.x + dx, 0, 1 - s.w), y: clamp(s.y + dy, 0, 1 - s.h), w: s.w, h: s.h }
  }
  let { x, y, w, h } = s
  const right = s.x + s.w
  const bottom = s.y + s.h
  if (mode.includes('w')) {
    x = clamp(s.x + dx, 0, right - MIN)
    w = right - x
  }
  if (mode.includes('e')) w = clamp(s.w + dx, MIN, 1 - s.x)
  if (mode.includes('n')) {
    y = clamp(s.y + dy, 0, bottom - MIN)
    h = bottom - y
  }
  if (mode.includes('s')) h = clamp(s.h + dy, MIN, 1 - s.y)
  return { x, y, w, h }
}

// Bild-Crop (Spec §19.8): zieh-/skalierbares Crop-Rechteck über dem Bild
// (Pointer-Events), Anwenden rendert den Ausschnitt per Canvas in voller
// Auflösung → neue Data-URI. Non-destruktiv: der Aufrufer legt daraus ein neues
// Asset an, das Original bleibt erhalten.
export function CropModal({ src, onApply, onCancel }: CropModalProps) {
  const [rect, setRect] = useState<Rect>({ x: 0.1, y: 0.1, w: 0.8, h: 0.8 })
  const imgRef = useRef<HTMLImageElement>(null)
  const drag = useRef<{ mode: Mode; startX: number; startY: number; start: Rect } | null>(null)

  // onMove/onUp mit stabiler Identität, damit die Unmount-Cleanup exakt die
  // angehängten Listener wieder entfernt (sonst Leak, falls das Modal mitten im
  // Ziehen unmountet — z.B. durch eine externe MCP-Live-Edit).
  const onMove = useCallback((e: PointerEvent) => {
    const d = drag.current
    const bounds = imgRef.current?.getBoundingClientRect()
    if (!d || !bounds || !bounds.width || !bounds.height) return
    const dx = (e.clientX - d.startX) / bounds.width
    const dy = (e.clientY - d.startY) / bounds.height
    setRect(applyDrag(d.mode, d.start, dx, dy))
  }, [])
  const onUp = useCallback(() => {
    drag.current = null
    window.removeEventListener('pointermove', onMove)
    window.removeEventListener('pointerup', onUp)
  }, [onMove])
  useEffect(
    () => () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    },
    [onMove, onUp],
  )

  function startDrag(mode: Mode) {
    return (e: React.PointerEvent) => {
      e.preventDefault()
      e.stopPropagation()
      drag.current = { mode, startX: e.clientX, startY: e.clientY, start: { ...rect } }
      window.addEventListener('pointermove', onMove)
      window.addEventListener('pointerup', onUp)
    }
  }

  function apply() {
    // Anzeigegröße als Fallback, falls die Quelle keine intrinsische Größe hat
    // (z.B. SVG ohne width/height → naturalWidth 0, sonst 1×1-Crop).
    const dispW = Math.round(imgRef.current?.getBoundingClientRect().width ?? 0)
    const dispH = Math.round(imgRef.current?.getBoundingClientRect().height ?? 0)
    const img = new Image()
    img.onload = () => {
      const nw = img.naturalWidth || dispW
      const nh = img.naturalHeight || dispH
      if (!nw || !nh) {
        notify('Zuschneiden nicht möglich (Bildgröße unbekannt).', 'error')
        return
      }
      const sx = Math.round(rect.x * nw)
      const sy = Math.round(rect.y * nh)
      // Quellrechteck am Bitmap-Rand klemmen (unabhängiges Runden kann sonst 1px
      // über naturalWidth/Height hinauslaufen → transparente Randspalte).
      const sw = Math.max(1, Math.min(Math.round(rect.w * nw), nw - sx))
      const sh = Math.max(1, Math.min(Math.round(rect.h * nh), nh - sy))
      const canvas = document.createElement('canvas')
      canvas.width = sw
      canvas.height = sh
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        notify('Zuschneiden nicht möglich (kein Canvas-Kontext).', 'error')
        return
      }
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, sw, sh)
      try {
        const isJpeg = /^data:image\/jpe?g/i.test(src)
        onApply(canvas.toDataURL(isJpeg ? 'image/jpeg' : 'image/png', 0.92))
      } catch {
        notify('Zuschneiden fehlgeschlagen (Bildquelle nicht lesbar).', 'error')
      }
    }
    img.onerror = () => notify('Bild konnte nicht geladen werden.', 'error')
    img.src = src
  }

  const pct = (v: number) => `${v * 100}%`
  const handles: { mode: Mode; cls: string; cursor: string }[] = [
    { mode: 'nw', cls: 'left-0 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'nwse-resize' },
    { mode: 'n', cls: 'left-1/2 top-0 -translate-x-1/2 -translate-y-1/2', cursor: 'ns-resize' },
    { mode: 'ne', cls: 'right-0 top-0 translate-x-1/2 -translate-y-1/2', cursor: 'nesw-resize' },
    { mode: 'e', cls: 'right-0 top-1/2 translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
    { mode: 'se', cls: 'right-0 bottom-0 translate-x-1/2 translate-y-1/2', cursor: 'nwse-resize' },
    { mode: 's', cls: 'left-1/2 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'ns-resize' },
    { mode: 'sw', cls: 'left-0 bottom-0 -translate-x-1/2 translate-y-1/2', cursor: 'nesw-resize' },
    { mode: 'w', cls: 'left-0 top-1/2 -translate-x-1/2 -translate-y-1/2', cursor: 'ew-resize' },
  ]

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Bild zuschneiden"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-6"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onCancel()
      }}
    >
      <div className="flex max-h-full w-full max-w-3xl flex-col gap-3 rounded-2xl border border-chrome-border bg-chrome-surface p-4 shadow-pop">
        <div className="flex items-center gap-2">
          <Icon name="crop" size={18} weight={400} className="text-chrome-secondary" />
          <span className="text-[14px] font-semibold text-chrome-text">Bild zuschneiden</span>
          <span className="ml-auto text-[12px] text-chrome-muted">Rahmen ziehen, dann „Zuschneiden"</span>
        </div>

        <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-lg bg-chrome-bg p-2">
          <div className="relative inline-block select-none">
            <img
              ref={imgRef}
              src={src}
              alt=""
              draggable={false}
              className="block max-h-[60vh] max-w-full rounded"
            />
            {/* Crop-Rechteck: dimmt außen via großem box-shadow */}
            <div
              onPointerDown={startDrag('move')}
              style={{
                left: pct(rect.x),
                top: pct(rect.y),
                width: pct(rect.w),
                height: pct(rect.h),
                boxShadow: '0 0 0 9999px rgba(0,0,0,0.55)',
                cursor: 'move',
              }}
              className="absolute border border-white/90"
            >
              {handles.map((h) => (
                <span
                  key={h.mode}
                  onPointerDown={startDrag(h.mode)}
                  style={{ cursor: h.cursor }}
                  className={`absolute h-3 w-3 rounded-sm border border-chrome-accent bg-white ${h.cls}`}
                />
              ))}
            </div>
          </div>
        </div>

        <div className="flex justify-end gap-2">
          <button
            onClick={onCancel}
            className="rounded-lg border border-chrome-border px-3.5 py-2 text-[13px] font-medium text-chrome-secondary transition-colors hover:border-chrome-border-strong hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            Abbrechen
          </button>
          <button
            onClick={apply}
            className="flex items-center gap-1.5 rounded-lg bg-chrome-accent-600 px-3.5 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2553c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            <Icon name="crop" size={16} weight={400} />
            Zuschneiden
          </button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
