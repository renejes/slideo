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

/** "Speichern unter"-Dialog für den HTML-Export (eigenständige, teilbare Datei). */
export async function pickExportHtmlPath(defaultName: string): Promise<string | null> {
  if (!isTauri()) return null
  const { save } = await import('@tauri-apps/plugin-dialog')
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: 'HTML', extensions: ['html'] }],
  })
  return selected ?? null
}

/** Schreibt eine fertige, eigenständige HTML-Page an den Pfad. */
export function exportHtmlFile(path: string, html: string): Promise<void> {
  return invoke<void>('export_html', { path, html })
}

/** "Speichern unter"-Dialog für den PPTX-Export. */
export async function pickExportPptxPath(defaultName: string): Promise<string | null> {
  if (!isTauri()) return null
  const { save } = await import('@tauri-apps/plugin-dialog')
  const selected = await save({
    defaultPath: defaultName,
    filters: [{ name: 'PowerPoint', extensions: ['pptx'] }],
  })
  return selected ?? null
}

/** Schreibt eine base64-kodierte PPTX-Datei an den Pfad. */
export function exportPptxFile(path: string, base64: string): Promise<void> {
  return invoke<void>('export_pptx', { path, base64 })
}

/** Schreibt die print-optimierte Page in eine Temp-Datei und öffnet sie im Browser (PDF). */
export function openPrintView(html: string): Promise<string> {
  return invoke<string>('open_print_view', { html })
}

/** Metadaten einer token-bewussten Komponente (Quelle: Rust `components::list`). */
export interface ComponentMeta {
  type: string
  label: string
  description: string
  params: string
}

/**
 * Listet die verfügbaren Komponenten für die Editor-Palette (Spec §18.7).
 * Rust ist die einzige Quelle der Wahrheit — die Palette dupliziert den Generator
 * nicht in TS. Nur in der Desktop-App verfügbar (im Browser-Dev nicht).
 */
export function listComponents(): Promise<ComponentMeta[]> {
  return invoke<ComponentMeta[]>('list_components')
}

/**
 * Rendert eine Komponente zu token-bewusstem HTML — derselbe Rust-Generator wie
 * das MCP-Tool `insert_component`. Wirft bei unbekanntem Typ/ungültigen Params.
 */
export function renderComponent(
  kind: string,
  params: unknown,
  dataId?: string,
): Promise<string> {
  return invoke<string>('render_component', { kind, params, dataId: dataId || null })
}

/** Metadaten eines lokalen `.slideo`-Snapshots (Versionshistorie, Spec §19.9). */
export interface SnapshotMeta {
  id: string
  created: string // ISO 8601
  label: string
  auto: boolean
  title: string
  slide_count: number
  size: number // Bytes
}

/** Listet die lokalen Snapshots eines Decks (neueste zuerst). */
export function listSnapshots(filePath: string): Promise<SnapshotMeta[]> {
  return invoke<SnapshotMeta[]>('list_snapshots', { filePath })
}

/**
 * Schreibt einen Snapshot. Gibt `null` zurück, wenn der Inhalt identisch zum
 * jüngsten Snapshot ist (dedupe, nichts geschrieben).
 */
export function createSnapshot(
  filePath: string,
  presentation: Presentation,
  assets: Asset[],
  label: string,
  auto: boolean,
  created: string,
  id: string,
): Promise<SnapshotMeta | null> {
  return invoke<SnapshotMeta | null>('create_snapshot', {
    filePath,
    presentation,
    assets,
    label,
    auto,
    created,
    id,
  })
}

/** Liest einen Snapshot (Presentation + Assets) zur Wiederherstellung. */
export function restoreSnapshot(filePath: string, id: string): Promise<LoadResult> {
  return invoke<LoadResult>('restore_snapshot', { filePath, id })
}

/** Entfernt einen Snapshot. */
export function deleteSnapshot(filePath: string, id: string): Promise<void> {
  return invoke<void>('delete_snapshot', { filePath, id })
}

/** Ein erkannter Monitor (für das Presenter-Routing, Spec §19.3). */
export interface MonitorInfo {
  index: number
  name: string
  width: number
  height: number
  primary: boolean
}

/** Listet die verfügbaren Monitore (für die Auswahl des Präsentations-Displays). */
export function listMonitors(): Promise<MonitorInfo[]> {
  return invoke<MonitorInfo[]>('list_monitors')
}

/** Öffnet das Folien-Fenster im Vollbild auf dem gewählten Monitor. */
export function openPresentationWindow(monitorIndex: number): Promise<void> {
  return invoke<void>('open_presentation_window', { monitorIndex })
}

/**
 * Öffnet das Folien-Fenster als teilbares 16:9-Fenster auf dem aktuellen Bildschirm
 * (Spec §26 — Ein-Monitor-Remote): in Zoom/Meet/Teams per „Fenster teilen" freigeben,
 * während die Presenter-View (Notizen/Tools) im Hauptfenster privat bleibt.
 */
export function openShareWindow(): Promise<void> {
  return invoke<void>('open_share_window')
}

/** Schließt das Folien-Fenster (falls offen). */
export function closePresentationWindow(): Promise<void> {
  return invoke<void>('close_presentation_window')
}

/** Liefert den aktuellen Presentation-State aus dem Backend (für das Projector-Fenster). */
export function getPresentationState(): Promise<Presentation | null> {
  return invoke<Presentation | null>('get_presentation')
}

/** Liefert die aktuellen Assets aus dem Backend (für das Projector-Fenster). */
export function getAssetsState(): Promise<Asset[]> {
  return invoke<Asset[]>('get_assets')
}
