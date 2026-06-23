import { useCallback, useEffect, useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { confirmDialog } from '@/lib/dialog'
import { isTauri, listSnapshots, deleteSnapshot, type SnapshotMeta } from '@/lib/tauri'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

function fmtSize(b: number): string {
  if (b < 1024) return `${b} B`
  if (b < 1024 * 1024) return `${Math.round(b / 1024)} KB`
  return `${(b / 1024 / 1024).toFixed(1)} MB`
}

function fmtTime(iso: string): string {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString()
}

// Versionshistorie (Spec §19.9): listet lokale `.slideo`-Snapshots eines Decks,
// erlaubt manuelle Schnappschüsse, Wiederherstellen und Löschen.
export function HistoryModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const filePath = usePresentationStore((s) => s.filePath)
  const createSnapshot = usePresentationStore((s) => s.createSnapshot)
  const restoreSnapshot = usePresentationStore((s) => s.restoreSnapshot)

  const tauri = isTauri()
  const [snapshots, setSnapshots] = useState<SnapshotMeta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)

  const refresh = useCallback(async () => {
    if (!tauri || !filePath) {
      setLoading(false)
      return
    }
    try {
      setSnapshots(await listSnapshots(filePath))
      setError(null)
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setLoading(false)
    }
  }, [tauri, filePath])

  useEffect(() => {
    void refresh()
  }, [refresh])

  async function onCreate() {
    if (busy) return
    setBusy(true)
    try {
      await createSnapshot(label)
      setLabel('')
      await refresh()
    } finally {
      setBusy(false)
    }
  }

  async function onRestore(s: SnapshotMeta) {
    const ok = await confirmDialog(
      `Snapshot vom ${fmtTime(s.created)} wiederherstellen? Der aktuelle Stand wird ersetzt ` +
        `(per Cmd/Strg+Z umkehrbar; zum dauerhaften Übernehmen anschließend speichern).`,
    )
    if (!ok) return
    await restoreSnapshot(s.id)
    closeModal()
  }

  async function onDelete(s: SnapshotMeta) {
    if (!filePath) return
    const ok = await confirmDialog(`Diesen Snapshot endgültig löschen? Das kann nicht rückgängig gemacht werden.`)
    if (!ok) return
    try {
      await deleteSnapshot(filePath, s.id)
      await refresh()
    } catch (e) {
      setError(errMsg(e))
    }
  }

  const canSnapshot = tauri && !!filePath

  return (
    <Modal
      title="Versionsverlauf"
      onClose={closeModal}
      width="w-[36rem]"
      footer={
        <button className={modalGhostBtn} onClick={closeModal}>
          Schließen
        </button>
      }
    >
      {!tauri ? (
        <Notice icon="history">Der Versionsverlauf ist nur in der Desktop-App verfügbar.</Notice>
      ) : !filePath ? (
        <Notice icon="save">
          Bitte die Präsentation zuerst speichern (Cmd/Strg+S) — danach werden bei jedem Speichern
          automatisch Snapshots angelegt.
        </Notice>
      ) : (
        <div className="flex flex-col gap-3">
          {/* Manuellen Snapshot erstellen */}
          <div className="flex items-center gap-2">
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && void onCreate()}
              aria-label="Beschriftung für den Schnappschuss (optional)"
              placeholder="Beschriftung (optional), z.B. „Vor dem Umbau“"
              className="min-w-0 flex-1 rounded-lg border border-chrome-border bg-white px-3 py-2 text-[13px] text-chrome-text placeholder:text-chrome-faint focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
            />
            <button className={modalPrimaryBtn} onClick={onCreate} disabled={busy}>
              <Icon name="bookmark_add" size={17} />
              Schnappschuss
            </button>
          </div>

          <div className="-mx-1 max-h-[52vh] overflow-y-auto px-1">
            {loading ? (
              <p className="py-6 text-center text-[13px] text-chrome-muted">Lädt …</p>
            ) : error ? (
              <p className="py-6 text-center text-[13px] text-chrome-danger">{error}</p>
            ) : snapshots.length === 0 ? (
              <p className="py-6 text-center text-[13px] text-chrome-muted">
                Noch keine Snapshots. Beim Speichern wird automatisch einer angelegt.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {snapshots.map((s) => (
                  <li
                    key={s.id}
                    className="flex items-center gap-3 rounded-lg border border-chrome-border bg-chrome-surface px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="truncate text-[13px] font-medium text-chrome-text">
                          {s.label || fmtTime(s.created)}
                        </span>
                        <span
                          className={
                            'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ' +
                            (s.auto
                              ? 'bg-chrome-surface-2 text-chrome-muted'
                              : 'bg-chrome-accent-soft text-chrome-accent-600')
                          }
                        >
                          {s.auto ? 'Auto' : 'Manuell'}
                        </span>
                      </div>
                      <div className="truncate text-[11px] text-chrome-faint">
                        {s.label ? `${fmtTime(s.created)} · ` : ''}
                        {s.slide_count} {s.slide_count === 1 ? 'Folie' : 'Folien'} · {fmtSize(s.size)}
                      </div>
                    </div>
                    <button
                      onClick={() => onRestore(s)}
                      className="flex h-7 items-center gap-1 rounded-md border border-chrome-border px-2 text-[12px] font-medium text-chrome-secondary transition-colors hover:border-chrome-accent hover:text-chrome-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
                      title="Diesen Stand wiederherstellen"
                    >
                      <Icon name="settings_backup_restore" size={15} />
                      Wiederherstellen
                    </button>
                    <button
                      onClick={() => onDelete(s)}
                      className="flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-danger/10 hover:text-chrome-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-danger/40"
                      title="Snapshot löschen"
                      aria-label="Snapshot löschen"
                    >
                      <Icon name="delete" size={16} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {canSnapshot && snapshots.length > 0 && (
            <p className="text-[11px] text-chrome-faint">
              Snapshots liegen lokal (max. 50 je Präsentation); beim Speichern wird automatisch einer
              angelegt, sofern sich etwas geändert hat.
            </p>
          )}
        </div>
      )}
    </Modal>
  )
}

function Notice({ icon, children }: { icon: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col items-center gap-2 py-8 text-center">
      <Icon name={icon} size={30} weight={300} className="text-chrome-faint" />
      <p className="max-w-[26rem] text-[13px] text-chrome-secondary">{children}</p>
    </div>
  )
}
