import { useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { AssetMap, Presentation, Zone } from '@/types'
import { renderSingleZonePage } from '@/lib/renderer'

/**
 * Statische Folien-Vorschau (Thumbnail / Speaker-Mini / Übersicht).
 *
 * WKWebView malt kleine Vorschau-Iframes leer, weil WebKit ein Iframe oft nach seinem
 * INHALT dimensioniert statt nach der CSS-Größe. Deshalb rendert die Vorschau-Seite bei
 * **fester, nativer 1280×720-Größe** ([renderSingleZonePage]) und das Iframe füllt ein
 * **1280×720-Wrapper-`div`**; dieses `div` (NICHT das Iframe — Transform aufs Iframe ist in
 * Safari fehlerhaft) wird per CSS-`transform: scale()` in den 16:9-Container eingepasst.
 * Der Parent misst den Container (`ResizeObserver`) und berechnet den Faktor.
 *
 * Das Iframe lädt über eine `data:`-URL; Sandbox (`allow-scripts`) + die strikte Folien-CSP
 * bleiben unverändert. Der Container muss eine feste 16:9-Größe haben (z.B. `aspect-video`).
 */
export function SlidePreview({
  presentation,
  zone,
  assets,
  interactive = false,
}: {
  presentation: Presentation
  zone: Zone
  assets: AssetMap
  /** false (Default) = anzeige-only (pointer-events:none). */
  interactive?: boolean
}) {
  const src = useMemo(
    () =>
      'data:text/html;charset=utf-8,' +
      encodeURIComponent(renderSingleZonePage(presentation, zone, assets)),
    [presentation, zone, assets],
  )
  const wrapRef = useRef<HTMLDivElement>(null)
  // Skalierungsfaktor 1280×720 → Container. 0 = noch nicht vermessen (unsichtbar).
  const [scale, setScale] = useState(0)

  useLayoutEffect(() => {
    const el = wrapRef.current
    if (!el) return
    const fit = () => {
      const s = Math.min(el.clientWidth / 1280, el.clientHeight / 720)
      if (s > 0) setScale(s)
    }
    fit()
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  return (
    // absolute inset-0 (statt h-full) → füllt den (relativen) 16:9-Container zuverlässig,
    // auch wenn dieser per aspect-ratio dimensioniert ist (WebKit behandelt eine
    // aspect-ratio-Höhe nicht als „definit" für ein h-full-Kind → sonst 0 → unsichtbar).
    <div ref={wrapRef} className="absolute inset-0 overflow-hidden">
      {/* Skaliertes 1280×720-Wrapper-div (Transform hier, nicht aufs Iframe), zentriert. */}
      <div
        className="absolute"
        style={{
          width: 1280,
          height: 720,
          transform: `scale(${scale})`,
          transformOrigin: 'top left',
          left: `calc(50% - ${640 * scale}px)`,
          top: `calc(50% - ${360 * scale}px)`,
        }}
      >
        <iframe
          src={src}
          title={zone.label || 'Folienvorschau'}
          sandbox="allow-scripts"
          tabIndex={-1}
          scrolling="no"
          className={'block border-0' + (interactive ? '' : ' pointer-events-none')}
          style={{ width: 1280, height: 720 }}
        />
      </div>
    </div>
  )
}
