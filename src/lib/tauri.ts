// Dünne Bridge zum Tauri-Backend.
// Erlaubt es, das Frontend auch im reinen Browser (`npm run dev`) laufen zu
// lassen: Ist Tauri nicht vorhanden, liefern die Wrapper sinnvolle Fallbacks
// bzw. werfen einen klaren Fehler statt eines kryptischen `undefined`-Crashs.

import type { Asset, Presentation } from '@/types'
import { t, type I18nKey } from '@/i18n'
import { de } from '@/i18n/de'

/**
 * Macht aus einem Fehler vom Rust-Backend einen Text in der Sprache der Oberfläche.
 *
 * Ersetzt vier gleichlautende lokale `errMsg`-Helfer (Store, LicenseModal,
 * HistoryModal, ComponentPaletteModal) durch eine Stelle — und ist zugleich das
 * Vehikel für die Rust-Grenze (Review 2026-08, Entscheidung E2):
 *
 *  - Handlungsrelevante Fehler meldet Rust als MASCHINENCODE `slideo:<code>`,
 *    optional mit `|<detail>`. Der Code wird hier über den Katalog übersetzt
 *    (`error.<code>`), das Detail unübersetzt angehängt. Das ist die Menge, aus
 *    der der Nutzer eine Handlung ableiten muss (Lizenz, MCP-Registrierung,
 *    Fenster) — sie steht sonst auch in englischer Oberfläche auf Deutsch da.
 *  - Alles andere — der Diagnose-Schwanz aus `reader.rs`/`writer.rs`/`history.rs`,
 *    dazu die vielen Meldungen, die ohnehin auf einem `std`/`reqwest`-Text enden —
 *    wird unverändert durchgereicht. Übersetzen wäre dort Aufwand ohne Gewinn.
 *
 * Weil die Erkennung am Präfix hängt, lässt sich die Rust-Seite Stück für Stück
 * nachziehen, ohne eine einzige Aufrufstelle im Frontend erneut anzufassen.
 */
export function describeError(e: unknown): string {
  const raw = e instanceof Error ? e.message : String(e)
  if (!raw.startsWith('slideo:')) return raw

  const body = raw.slice('slideo:'.length)
  const sep = body.indexOf('|')
  const code = sep === -1 ? body : body.slice(0, sep)
  const detail = sep === -1 ? '' : body.slice(sep + 1).trim()

  const key = `error.${code}`
  // Unbekannter Code (älteres/neueres Backend): lieber den Rohtext zeigen als
  // eine leere Meldung — der Nutzer soll etwas zum Weitermelden in der Hand haben.
  if (!(key in de)) return raw

  // Der Katalogtext entscheidet, WO das Detail steht: enthält er `{detail}`, wird
  // es dort eingesetzt („Aktivierung abgelehnt (HTTP 403)."). Sonst hängt es
  // hinten an — so bleibt ein Code auch dann lesbar, wenn sein Text den Platz-
  // halter nicht vorsieht.
  const hasSlot = (de as Record<string, string>)[key].includes('{detail}')
  const text = t(key as I18nKey, { detail })
  return !hasSlot && detail ? `${text} (${detail})` : text
}

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
    throw new Error(t('lib.tauri.unavailable', { cmd }))
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

/**
 * Öffnet das Folien-Fenster als dekoriertes, teilbares 16:9-Fenster auf dem aktuellen
 * Bildschirm (Spec §26): in Zoom/Meet/Teams per „Fenster teilen" freigeben (Notizen/Tools
 * bleiben im Hauptfenster privat) ODER auf einen zweiten Bildschirm ziehen und per
 * `setProjectorFullscreen(true)` auf randlos-Vollbild schalten (Beamer/TV).
 */
export function openShareWindow(): Promise<void> {
  return invoke<void>('open_share_window')
}

/**
 * Schaltet das Folien-Fenster zwischen randlos-Vollbild auf seinem aktuellen Monitor
 * (Beamer/TV) und dekoriertem 16:9-Fenster (Remote/frei platzieren) um.
 */
export function setProjectorFullscreen(fullscreen: boolean): Promise<void> {
  return invoke<void>('set_projector_fullscreen', { fullscreen })
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

// ---------- Lizenzierung (Trial + Polar) ----------

/** Lizenzstatus — Spiegel von license.rs `LicenseStatus`. */
export interface LicenseStatus {
  state:
    | 'licensed'
    | 'trial'
    | 'trial_expired'
    | 'revoked'
    | 'expired'
    | 'upgrade_required'
    /** Polar-Konstanten noch Platzhalter → nie limitieren (Befund B9, license.rs compute()). */
    | 'unconfigured'
    /** `license_status` fehlgeschlagen → Bearbeiten erlaubt, aber Zustand ehrlich unbekannt (S27). */
    | 'unknown'
  editing_allowed: boolean
  configured: boolean
  checkout_available: boolean
  trial_days_left: number | null
  key_display: string | null
  expires_at: string | null
}

/** Aktueller Lizenz-/Trial-Status (billig, kein Netz). */
export function licenseStatus(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('license_status')
}

/** Aktiviert einen Lizenzschlüssel auf diesem Gerät (Polar activate + validate). */
export function licenseActivate(key: string): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('license_activate', { key })
}

/** Re-validiert eine aktivierte Lizenz online (offline = No-op, Cache gilt weiter). */
export function licenseRecheck(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('license_recheck')
}

/** Gibt dieses Gerät frei (Aktivierungs-Slot zurück) und löscht die lokale Lizenz. */
export function licenseDeactivate(): Promise<LicenseStatus> {
  return invoke<LicenseStatus>('license_deactivate')
}

/** Öffnet die Polar-Kaufseite im Standardbrowser. */
export function licenseOpenCheckout(): Promise<void> {
  return invoke<void>('license_open_checkout')
}

// ───────────────────────── Crash-Recovery (Review 2026-08, Befund B4) ─────────────────────────

/** Metadaten einer beim Start gefundenen, verwaisten Sicherung. */
export interface RecoveryInfo {
  session: string
  original_path: string | null
  title: string
  zone_count: number
  modified: string | null
}

/** Schreibt die Sicherung dieser Sitzung (atomar, überschreibt die vorherige). */
export function recoveryWrite(
  session: string,
  presentation: Presentation,
  assets: Asset[],
  originalPath: string | null,
): Promise<void> {
  return invoke<void>('recovery_write', { session, presentation, assets, originalPath })
}

/** Löscht die Sicherung dieser Sitzung (nach erfolgreichem Speichern). */
export function recoveryClear(session: string): Promise<void> {
  return invoke<void>('recovery_clear', { session })
}

/** Sucht beim Start nach einer verwaisten Sicherung der letzten Sitzung. */
export function recoveryScan(): Promise<RecoveryInfo | null> {
  return invoke<RecoveryInfo | null>('recovery_scan')
}

/** Lädt eine gefundene Sicherung und entfernt sie. */
export function recoveryTake(session: string): Promise<LoadResult> {
  return invoke<LoadResult>('recovery_take', { session })
}

/** Verwirft eine gefundene Sicherung ungelesen. */
export function recoveryDiscard(session: string): Promise<void> {
  return invoke<void>('recovery_discard', { session })
}
