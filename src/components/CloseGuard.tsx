import { useEffect, useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { isTauri } from '@/lib/tauri'
import { t } from '@/i18n'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'

// Schützt vor Datenverlust beim Schließen: bietet explizit Speichern an.
// In Tauri über onCloseRequested + 3-Knopf-Dialog, im Browser via beforeunload.
export function CloseGuard() {
  const [prompting, setPrompting] = useState(false)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!isTauri()) {
      const handler = (e: BeforeUnloadEvent) => {
        if (usePresentationStore.getState().isDirty) {
          e.preventDefault()
          e.returnValue = ''
        }
      }
      window.addEventListener('beforeunload', handler)
      return () => window.removeEventListener('beforeunload', handler)
    }

    let unlisten: (() => void) | undefined
    void (async () => {
      const { getCurrentWindow } = await import('@tauri-apps/api/window')
      unlisten = await getCurrentWindow().onCloseRequested((event) => {
        if (!usePresentationStore.getState().isDirty) return // sauber → einfach schließen
        event.preventDefault()
        setPrompting(true)
      })
    })()
    return () => unlisten?.()
  }, [])

  async function destroyWindow() {
    const { getCurrentWindow } = await import('@tauri-apps/api/window')
    await getCurrentWindow().destroy()
  }

  async function handleSave() {
    setBusy(true)
    try {
      await usePresentationStore.getState().savePresentation()
      if (!usePresentationStore.getState().isDirty) {
        await destroyWindow() // gespeichert → schließen
      } else {
        setPrompting(false) // Speichern abgebrochen → offen lassen
      }
    } finally {
      setBusy(false)
    }
  }

  async function handleDiscard() {
    setBusy(true)
    try {
      await destroyWindow()
    } finally {
      setBusy(false)
    }
  }

  if (!prompting) return null

  return (
    <Modal
      title={t('ui.unsavedChanges')}
      onClose={() => setPrompting(false)}
      footer={
        <>
          <button className={modalGhostBtn} onClick={() => setPrompting(false)} disabled={busy}>
            {t('common.cancel')}
          </button>
          <button className={modalGhostBtn} onClick={handleDiscard} disabled={busy}>
            {t('ui.closeGuard.discard')}
          </button>
          <button className={modalPrimaryBtn} onClick={handleSave} disabled={busy}>
            {t('common.save')}
          </button>
        </>
      }
    >
      <p className="text-[13px] leading-relaxed text-chrome-secondary">{t('ui.closeGuard.body')}</p>
    </Modal>
  )
}
