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
    // Ein cleanup für pointerup, pointercancel UND window-blur — sonst bleiben bei
    // einem Release außerhalb des Fensters/Touch-Abbruch die Listener + der
    // col-resize-Cursor/userSelect:none hängen (Muster wie in renderer.ts).
    const cleanup = () => {
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', cleanup)
      window.removeEventListener('pointercancel', cleanup)
      window.removeEventListener('blur', cleanup)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
    }
    window.addEventListener('pointermove', move)
    window.addEventListener('pointerup', cleanup)
    window.addEventListener('pointercancel', cleanup)
    window.addEventListener('blur', cleanup)
    document.body.style.cursor = 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      role="separator"
      aria-orientation="vertical"
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className="group relative z-10 w-1.5 shrink-0 cursor-col-resize touch-none bg-chrome-border/0 transition-colors hover:bg-chrome-accent/30"
    >
      {/* breitere, unsichtbare Trefferzone */}
      <span className="absolute inset-y-0 -left-1 -right-1" />
    </div>
  )
}
