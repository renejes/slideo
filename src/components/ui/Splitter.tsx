import { useRef } from 'react'

/**
 * Drag-Griff zwischen zwei Bereichen (Pointer-Events — WKWebView-sicher,
 * kein HTML5-DnD). Meldet inkrementelle Maus-Deltas seit dem letzten Event;
 * der Aufrufer wendet sie auf Breite (vertical) bzw. Höhe (horizontal) an.
 */
export function Splitter({
  onDelta,
  ariaLabel,
  orientation = 'vertical',
}: {
  onDelta: (d: number) => void
  ariaLabel: string
  orientation?: 'vertical' | 'horizontal'
}) {
  const last = useRef(0)
  const horizontal = orientation === 'horizontal'

  function onPointerDown(e: React.PointerEvent) {
    e.preventDefault()
    last.current = horizontal ? e.clientY : e.clientX
    const move = (ev: PointerEvent) => {
      const now = horizontal ? ev.clientY : ev.clientX
      onDelta(now - last.current)
      last.current = now
    }
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
    document.body.style.cursor = horizontal ? 'row-resize' : 'col-resize'
    document.body.style.userSelect = 'none'
  }

  return (
    <div
      role="separator"
      aria-orientation={orientation}
      aria-label={ariaLabel}
      onPointerDown={onPointerDown}
      className={
        'group relative z-10 shrink-0 touch-none bg-chrome-border/0 transition-colors hover:bg-chrome-accent/30 ' +
        (horizontal ? 'h-1.5 w-full cursor-row-resize' : 'w-1.5 cursor-col-resize')
      }
    >
      <span className={horizontal ? 'absolute inset-x-0 -top-1 -bottom-1' : 'absolute inset-y-0 -left-1 -right-1'} />
    </div>
  )
}
