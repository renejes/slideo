import { useEffect, useMemo, useRef, useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { renderFullPage } from '@/lib/renderer'
import { isTauri, assetUrlBase } from '@/lib/tauri'
import { Icon } from '@/components/ui/Icon'

const ASSET_BASE = isTauri() ? assetUrlBase() : undefined

// Live-Vorschau der gesamten Präsentation neben dem Editor.
// Re-rendert debounced in ein isoliertes Iframe (sandbox) und scrollt zur
// aktiven Zone.
export function PreviewPane() {
  const presentation = usePresentationStore((s) => s.presentation)
  const assets = usePresentationStore((s) => s.assets)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const reorderZoneBlocks = usePresentationStore((s) => s.reorderZoneBlocks)
  const resizeZoneImage = usePresentationStore((s) => s.resizeZoneImage)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState('')

  // Debounced Full-Page-Render (vermeidet Iframe-Reload bei jedem Tastendruck).
  // editable: Markdown-Blöcke per Drag umsortierbar (Spec §18.1 / interaktive Vorschau).
  useEffect(() => {
    if (!presentation) return
    const id = setTimeout(
      () =>
        setHtml(
          renderFullPage(presentation, {
            present: false,
            assets,
            assetUrlBase: ASSET_BASE,
            editable: true,
          }),
        ),
      220,
    )
    return () => clearTimeout(id)
  }, [presentation, assets])

  // Block-Reorder und Bild-Resize aus der Vorschau übernehmen.
  useEffect(() => {
    function onMessage(e: MessageEvent) {
      const d = e.data || {}
      if (d.type === 'slideo:reorder-blocks' && typeof d.zoneId === 'string' && Array.isArray(d.order)) {
        reorderZoneBlocks(d.zoneId, d.order as number[])
      } else if (
        d.type === 'slideo:resize-image' &&
        typeof d.zoneId === 'string' &&
        typeof d.blockIndex === 'number' &&
        typeof d.width === 'string'
      ) {
        resizeZoneImage(d.zoneId, d.blockIndex, typeof d.imgIndex === 'number' ? d.imgIndex : 0, d.width)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [reorderZoneBlocks, resizeZoneImage])

  const activeIndex = useMemo(() => {
    if (!presentation) return 0
    const zones = [...presentation.zones].sort((a, b) => a.order - b.order)
    const i = zones.findIndex((z) => z.id === activeZoneId)
    return i < 0 ? 0 : i
  }, [presentation, activeZoneId])

  // Bei Wechsel der aktiven Zone sanft dorthin scrollen (ohne Reload).
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:goto', index: activeIndex, smooth: true },
      '*',
    )
  }, [activeIndex])

  function handleLoad() {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:goto', index: activeIndex, smooth: false },
      '*',
    )
  }

  return (
    <section className="flex min-w-0 flex-1 flex-col border-l border-chrome-border bg-chrome-bg">
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-chrome-muted">
        <Icon name="visibility" size={15} weight={400} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Vorschau</span>
      </div>
      <div className="min-h-0 flex-1 p-3.5 pt-0">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleLoad}
          title="Vorschau"
          sandbox="allow-scripts"
          className="h-full w-full rounded-xl border border-chrome-border bg-black shadow-card"
        />
      </div>
    </section>
  )
}
