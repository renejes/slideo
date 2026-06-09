// Dünne Bridge zum Tauri-Backend.
// Erlaubt es, das Frontend auch im reinen Browser (`npm run dev`) laufen zu
// lassen: Ist Tauri nicht vorhanden, liefern die Wrapper sinnvolle Fallbacks
// bzw. werfen einen klaren Fehler statt eines kryptischen `undefined`-Crashs.

import type { Asset, Presentation } from '@/types'

export interface LoadResult {
  presentation: Presentation
  assets: Asset[]
}

export function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

/**
 * Basis-URL des Custom-Protocols, das Asset-Bytes streamt (für große Medien).
 * Windows nutzt http://<scheme>.localhost/, andere Plattformen <scheme>://localhost/.
 */
export function assetUrlBase(): string {
  const isWindows =
    typeof navigator !== 'undefined' && /Windows/i.test(navigator.userAgent)
  return isWindows ? 'http://slideoasset.localhost/' : 'slideoasset://localhost/'
}

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error(
      `Tauri-Backend nicht verfügbar (Command "${cmd}"). ` +
        `Datei-Operationen funktionieren nur in der Desktop-App (npm run tauri:dev).`,
    )
  }
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<T>(cmd, args)
}

/** Liest eine .slideo-Datei und gibt Presentation + Assets zurück. */
export function loadPresentationFile(path: string): Promise<LoadResult> {
  return invoke<LoadResult>('load_presentation', { path })
}

/** Schreibt eine Presentation + Assets als .slideo-Datei an den angegebenen Pfad. */
export function savePresentationFile(
  path: string,
  presentation: Presentation,
  assets: Asset[],
): Promise<void> {
  return invoke<void>('save_presentation', { path, presentation, assets })
}

/** Öffnet den nativen "Datei öffnen"-Dialog, gibt den gewählten Pfad zurück (oder null). */
export async function pickOpenPath(): Promise<string | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    multiple: false,
    directory: false,
    filters: [{ name: 'Slideo', extensions: ['slideo'] }],
  })
  return typeof selected === 'string' ? selected : null
}

/** Öffnet den nativen "Speichern unter"-Dialog, gibt den gewählten Pfad zurück (oder null). */
export async function pickSavePath(defaultName: string): Promise<string | null> {
  if (!isTauri()) return null
  const { save } = await import('@tauri-apps/plugin-dialog')
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: 'Slideo', extensions: ['slideo'] }],
  })
  return selected ?? null
}
