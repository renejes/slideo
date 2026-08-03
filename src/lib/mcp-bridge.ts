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
  const unlistenPres = await listen<{ presentation: Presentation; zoneIds: string[] }>(
    'mcp:presentation',
    (event) => {
      store.getState().applyExternalPresentation(event.payload.presentation, event.payload.zoneIds)
    },
  )
  // Deckwechsel (create_/open_presentation): Presentation + Pfad + Assets in EINEM
  // Event. Vorher fehlten Pfad und Assets komplett (Befund B3) — das Frontend zeigte
  // Deck B, verwies aber auf Datei A, und das nächste Cmd+S überschrieb die falsche.
  const unlistenOpened = await listen<{
    presentation: Presentation
    path: string | null
    assets: { name: string; mime: string; data: string }[]
  }>('mcp:opened', (event) => {
    const { presentation, path, assets } = event.payload
    store.getState().applyExternalOpen(presentation, path, assets)
  })
  // Der MCP-Server hat geschrieben → Dirty-Punkt weg, Pfad übernehmen (Befund M5).
  const unlistenSaved = await listen<{ path: string }>('mcp:saved', (event) => {
    store.getState().applyExternalSave(event.payload.path)
  })
  const unlistenSlide = await listen<number>('mcp:active-slide', (event) => {
    store.getState().setActiveSlide(event.payload)
  })

  // 2) Store → Rust spiegeln (debounced für Presentation, sofort für Pfad/Assets).
  let timer: ReturnType<typeof setTimeout> | null = null
  let deadline: ReturnType<typeof setTimeout> | null = null
  let lastPresentation = store.getState().presentation
  let lastFilePath = store.getState().filePath
  let lastAssets = store.getState().assets

  /** Spiegelt sofort und räumt beide Timer ab. */
  function flush(): void {
    if (timer) clearTimeout(timer)
    if (deadline) clearTimeout(deadline)
    timer = null
    deadline = null
    void invoke('sync_presentation', {
      presentation: store.getState().presentation,
    }).then(notifyDeckChanged)
  }

  // Der MCP-Server bittet vor jeder Mutation um den frischen Stand (Befund B7).
  // Ohne diese Antwort mutiert er eine bis zu 400 ms alte Kopie und schickt sie als
  // Ganzes zurück — die zuletzt getippten Zeichen wären verloren.
  const unlistenFlush = await listen('slideo:flush-sync', () => flush())

  const unsubscribe = store.subscribe((s) => {
    if (s.presentation !== lastPresentation) {
      lastPresentation = s.presentation
      if (timer) clearTimeout(timer)
      timer = setTimeout(flush, 400)
      // maxWait (Befund B7): ohne Deckel setzt durchgehendes Tippen den Idle-Timer
      // endlos zurück — Rust sähe den neuen Stand nie und der Handshake liefe
      // jedes Mal in seinen Timeout. Spätestens nach 1,2 s wird gespiegelt.
      if (!deadline) deadline = setTimeout(flush, 1200)
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
    unlistenOpened()
    unlistenSaved()
    unlistenSlide()
    unlistenFlush()
    unsubscribe()
    if (timer) clearTimeout(timer)
    if (deadline) clearTimeout(deadline)
    started = false
  }
}
