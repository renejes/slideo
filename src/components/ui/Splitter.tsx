import { useRef } from 'react'

/**
 * Vertikaler Drag-Griff zwischen zwei Spalten (Pointer-Events — WKWebView-sicher,
 * kein HTML5-DnD). Meldet inkrementelle Maus-Deltas (dx seit dem letzten Event);
 * der Aufrufer wendet sie auf die jeweilige Spaltenbreite an.
 */
export function Splitter({
  onDelta,
  ariaLabel,
}: {
  onDelta: (dx: number) => void
  ariaLabel: string
}) {
  const lastX = useRef(0)

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    lastX.current = e.clientX
    const move = (ev: PointerEvent) => {
      onDelta(ev.clientX - lastX.current)
      lastX.current = ev.clientX
    }
    const up = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', up)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className="group relative z-10 w-1.5 shrink-0 cursor-col-resize bg-chrome-border/0 transition-colors hover:bg-chrome-accent/30"
    >
      {/* breitere, unsichtbare Trefferzone */}
      <span className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
