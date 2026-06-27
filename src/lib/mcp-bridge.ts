import { isTauri } from './tauri'
import { usePresentationStore } from '@/store/presentation'
import { mapToAssets } from './assets'
import type { Presentation } from '@/types'

// Live-Bridge zwischen MCP-Server (Rust) und Frontend-Store.
//
// - Eingehend: Tauri-Events `mcp:presentation` / `mcp:active-slide` → Store.
// - Ausgehend: Store-Änderungen werden (debounced) nach Rust gespiegelt, damit
//   der MCP-Server jederzeit den aktuellen Stand lesen/mutieren kann.
//
// Außerhalb von Tauri (reiner Browser-`dev`) ist das ein No-op.

let started = false

export async function startMcpBridge(): Promise<() => void> {
  if (!isTauri() || started) return () => {}
  started = true

  const { listen, emit } = await import('@tauri-apps/api/event')
  const { invoke } = await import('@tauri-apps/api/core')
  const store = usePresentationStore

  // Signalisiert dem Presenter-Zweitfenster (Spec §19.3), dass das Deck im AppState
  // frisch ist → es lädt neu. Bewusst NACH dem Sync (sonst läse der Projector noch
  // den alten Stand). Ohne offenes Zweitfenster hört niemand zu (harmlos).
  const notifyDeckChanged = () => void emit('slideo:deck-changed', {})

  // 1) Eingehende MCP-Events anwenden.
  const unlistenPres = await listen<Presentation>('mcp:presentation', (event) => {
    store.getState().applyExternalPresentation(event.payload)
  })
  const unlistenSlide = await listen<number>('mcp:active-slide', (event) => {
    store.getState().setActiveSlide(event.payload)
  })

  // 2) Store → Rust spiegeln (debounced für Presentation, sofort für Pfad/Assets).
  let timer: ReturnType<typeof setTimeout> | null = null
  let lastPresentation = store.getState().presentation
  let lastFilePath = store.getState().filePath
  let lastAssets = store.getState().assets

  const unsubscribe = store.subscribe((s) => {
    if (s.presentation !== lastPresentation) {
      lastPresentation = s.presentation
      if (timer) clearTimeout(timer)
      timer = setTimeout(() => {
        void invoke('sync_presentation', { presentation: s.presentation }).then(notifyDeckChanged)
        // 400 ms (war 120): bündelt Tipp-Bursts stärker, bevor der volle presentation.json-
        // Sync nach Rust geht (Audit P10). MCP liest dadurch unmerklich später (Text-only).
      }, 400)
    }
    if (s.filePath !== lastFilePath) {
      lastFilePath = s.filePath
      void invoke('set_file_path', { path: s.filePath })
    }
    if (s.assets !== lastAssets) {
      lastAssets = s.assets
      void invoke('sync_assets', { assets: mapToAssets(s.assets) }).then(notifyDeckChanged)
    }
  })

  // Initialen Stand einmal spiegeln.
  void invoke('sync_presentation', { presentation: store.getState().presentation })

  return () => {
    unlistenPres()
    unlistenSlide()
    unsubscribe()
    if (timer) clearTimeout(timer)
    started = false
  }
}
