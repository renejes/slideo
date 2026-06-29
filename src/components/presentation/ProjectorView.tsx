import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssetMap, Presentation } from '@/types'
import { renderFullPage } from '@/lib/renderer'
import { assetsToMap } from '@/lib/assets'
import { assetUrlBase, getAssetsState, getPresentationState, isTauri } from '@/lib/tauri'

const ASSET_BASE = isTauri() ? assetUrlBase() : undefined

// Presenter-Zweitfenster (Spec §19.3): zeigt NUR die Folien (Audience-Iframe),
// im Vollbild auf dem gewählten Monitor. Holt das Deck aus dem Rust-AppState
// (vom Hauptfenster gespiegelt) und folgt der Navigation des Steuerfensters über
// Tauri-Events (`slideo:nav`); bei Deck-Änderungen (`slideo:deck-changed`) neu laden.
// Die Tastatur-/Steuerungs-Hoheit liegt beim Hauptfenster — dieses Fenster ist reine Anzeige.
export function ProjectorView() {
  const [presentation, setPresentation] = useState<Presentation | null>(null)
  const [assets, setAssets] = useState<AssetMap>({})
  const iframeRef = useRef<HTMLIFrameElement>(null)
  // Letzter bekannter Navigationsstand — nach (Re-)Load des Iframes erneut anwenden.
  const navRef = useRef({ index: 0, step: 0 })

  const load = useCallback(async () => {
    if (!isTauri()) return
    try {
      const [p, a] = await Promise.all([getPresentationState(), getAssetsState()])
      setPresentation(p)
      setAssets(assetsToMap(a))
    } catch (e) {
      console.error('[slideo:projector] Laden fehlgeschlagen:', e)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const html = useMemo(
    () =>
      presentation
        ? renderFullPage(presentation, { present: true, assets, assetUrlBase: ASSET_BASE })
        : '',
    [presentation, assets],
  )

  function show(index: number, step: number, smooth: boolean) {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:show', index, step, smooth },
      '*',
    )
  }

  // Tauri-Events: Navigation folgen + bei Deck-Änderung neu laden.
  useEffect(() => {
    if (!isTauri()) return
    let alive = true
    const unsubs: Array<() => void> = []
    void (async () => {
      const { listen, emit } = await import('@tauri-apps/api/event')
      unsubs.push(
        await listen<{ index: number; step: number }>('slideo:nav', (e) => {
          navRef.current = { index: e.payload.index | 0, step: e.payload.step | 0 }
          show(navRef.current.index, navRef.current.step, true)
        }),
      )
      unsubs.push(await listen('slideo:deck-changed', () => void load()))
      // Bereitschaft melden → das Steuerfenster antwortet mit dem aktuellen Stand.
      if (alive) void emit('slideo:projector-ready', {})
    })()
    return () => {
      alive = false
      unsubs.forEach((u) => u())
    }
  }, [load])

  // Zonen-Link auf dem Projektor angeklickt: das Folien-Iframe ist anzeige-only und
  // postet den Sprungwunsch an dieses Fenster → an das Steuerfenster weiterreichen
  // (Steuerhoheit bleibt dort, Spec §23).
  useEffect(() => {
    if (!isTauri()) return
    function onMsg(e: MessageEvent) {
      const d = e.data || {}
      if (d.type === 'slideo:goto-request' && typeof d.index === 'number') {
        void import('@tauri-apps/api/event').then(({ emit }) =>
          emit('slideo:projector-goto', { index: Math.max(0, d.index | 0) }),
        )
      }
    }
    window.addEventListener('message', onMsg)
    return () => window.removeEventListener('message', onMsg)
  }, [])

  // Nach (Re-)Load des Iframes den letzten Stand wiederherstellen + erneut Bereitschaft melden.
  function handleLoad() {
    show(navRef.current.index, navRef.current.step, false)
    void import('@tauri-apps/api/event').then(({ emit }) => emit('slideo:projector-ready', {}))
  }

  if (!presentation) {
    return <div className="fixed inset-0 grid place-items-center bg-black text-sm text-white/60">…</div>
  }

  return (
    <iframe
      ref={iframeRef}
      srcDoc={html}
      onLoad={handleLoad}
      title="Präsentation"
      sandbox="allow-scripts"
      className="fixed inset-0 h-full w-full border-0 bg-black"
    />
  )
}
