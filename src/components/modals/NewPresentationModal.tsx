import { useEffect, useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { usePresentationStore } from '@/store/presentation'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { confirmDialog, getDesktopDir, joinPath, pickDirectory } from '@/lib/dialog'

function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\w\d\-. äöüÄÖÜß]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
  return cleaned || 'praesentation'
}

// Modal: fragt Projektname + Speicherort ab und legt die Präsentation an
// (in Tauri direkt als .slideo an den gewählten Ort gespeichert).
export function NewPresentationModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const newPresentation = usePresentationStore((s) => s.newPresentation)
  const savePresentation = usePresentationStore((s) => s.savePresentation)
  const isDirty = usePresentationStore((s) => s.isDirty)
  const hasPresentation = usePresentationStore((s) => s.presentation !== null)
  const defaultProjectDir = useSettingsStore((s) => s.defaultProjectDir)
  const setDefaultProjectDir = useSettingsStore((s) => s.setDefaultProjectDir)

  const tauri = isTauri()
  const [name, setName] = useState('Meine Präsentation')
  const [location, setLocation] = useState<string | null>(defaultProjectDir)
  const [busy, setBusy] = useState(false)

  // Voreinstellung des Speicherorts: zuletzt genutzt, sonst Desktop.
  useEffect(() => {
    if (location || !tauri) return
    void getDesktopDir().then((dir) => dir && setLocation(dir))
  }, [location, tauri])

  async function chooseLocation() {
    const dir = await pickDirectory(location)
    if (dir) {
      setLocation(dir)
      setDefaultProjectDir(dir)
    }
  }

  async function create() {
    if (busy) return
    setBusy(true)
    try {
      if (hasPresentation && isDirty) {
        const ok = await confirmDialog(
          'Es gibt ungespeicherte Änderungen. Neue Präsentation trotzdem anlegen?',
        )
        if (!ok) return // Modal bleibt offen
      }
      newPresentation(name || 'Unbenannt')

      if (tauri && location) {
        const path = await joinPath(location, `${safeFileName(name)}.slideo`)
        setDefaultProjectDir(location)
        await savePresentation(path)
      }
    } finally {
      setBusy(false)
    }
    closeModal()
  }

  return (
    <Modal
      title="Neue Präsentation"
      onClose={closeModal}
      footer={
        <>
          <button className={modalGhostBtn} onClick={closeModal}>
            Abbrechen
          </button>
          <button className={modalPrimaryBtn} onClick={create} disabled={busy}>
            <Icon name="add" size={18} />
            Erstellen
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-chrome-secondary">Projektname</span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
            className="rounded-lg border border-chrome-border bg-white px-3 py-2 text-[14px] text-chrome-text focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-chrome-secondary">Speicherort</span>
          {tauri ? (
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2">
                <Icon name="folder" size={17} weight={400} className="text-chrome-muted" />
                <span
                  className="truncate text-[13px] text-chrome-text"
                  dir="rtl"
                  title={location ?? ''}
                >
                  {location || 'Kein Ordner gewählt'}
                </span>
              </div>
              <button className={modalGhostBtn} onClick={chooseLocation}>
                Wählen…
              </button>
            </div>
          ) : (
            <p className="rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2 text-[12px] text-chrome-muted">
              Speicherort-Auswahl nur in der Desktop-App. Die Präsentation wird in-memory
              angelegt; speichern später per „Speichern".
            </p>
          )}
          {tauri && location && (
            <span className="text-[11px] text-chrome-muted">
              Gespeichert als <code className="font-mono">{safeFileName(name)}.slideo</code> in
              diesem Ordner.
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}
