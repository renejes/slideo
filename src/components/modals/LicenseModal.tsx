import { useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { useUiStore } from '@/store/ui'
import { useLicenseStore } from '@/store/license'
import { notify } from '@/store/toast'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const inputClass =
  'w-full rounded-lg border border-chrome-border bg-white px-3 py-2 text-[13px] font-mono text-chrome-text ' +
  'placeholder:text-chrome-faint focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30'

export function LicenseModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const status = useLicenseStore((s) => s.status)
  const activate = useLicenseStore((s) => s.activate)
  const deactivate = useLicenseStore((s) => s.deactivate)
  const recheck = useLicenseStore((s) => s.recheck)
  const openCheckout = useLicenseStore((s) => s.openCheckout)

  const [key, setKey] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const licensed = status?.state === 'licensed'
  const configured = status?.configured ?? false
  const checkoutAvailable = status?.checkout_available ?? false

  async function onActivate() {
    setError(null)
    setBusy(true)
    try {
      const s = await activate(key.trim())
      if (s.state === 'licensed') {
        notify('Lizenz aktiviert — danke!', 'success')
        closeModal()
      } else {
        setError('Aktivierung nicht erfolgreich.')
      }
    } catch (e) {
      setError(errMsg(e))
    } finally {
      setBusy(false)
    }
  }

  async function onBuy() {
    try {
      await openCheckout()
    } catch (e) {
      notify(`Kauf-Seite konnte nicht geöffnet werden: ${errMsg(e)}`, 'error')
    }
  }

  async function onDeactivate() {
    setBusy(true)
    try {
      await deactivate()
      notify('Gerät freigegeben.', 'success')
    } catch (e) {
      notify(`Freigeben fehlgeschlagen: ${errMsg(e)}`, 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title="Slideo — Lizenz"
      onClose={closeModal}
      width="w-[32rem]"
      footer={
        <button className={modalGhostBtn} onClick={closeModal}>
          Schließen
        </button>
      }
    >
      {licensed ? (
        <div className="flex flex-col gap-4 py-1">
          <div className="flex items-center gap-2 rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2.5">
            <Icon name="check_circle" size={20} className="text-chrome-accent-600" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-chrome-text">Lizenz aktiv — vollständige Version</p>
              <p className="truncate text-[12px] text-chrome-muted">
                {status?.key_display ? `Schlüssel ${status.key_display}` : 'Lizenz aktiviert'}
                {status?.expires_at ? ` · gültig bis ${status.expires_at.slice(0, 10)}` : ' · unbefristet'}
              </p>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-chrome-muted">
            Diese Lizenz ist an dieses Gerät gebunden. Um sie auf einen anderen Rechner umzuziehen (dein
            Limit an Geräten ist erreicht), gib dieses Gerät frei — der Aktivierungs-Platz wird wieder frei.
          </p>
          <div className="flex gap-2">
            <button className={modalGhostBtn} onClick={() => void recheck()} disabled={busy}>
              <Icon name="repeat" size={16} />
              Erneut prüfen
            </button>
            <button
              className={modalGhostBtn + ' text-chrome-danger hover:bg-chrome-danger/10'}
              onClick={onDeactivate}
              disabled={busy}
            >
              Gerät freigeben
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-1">
          {!configured && (
            <div className="rounded-lg border border-chrome-warn/40 bg-chrome-warn/5 px-3 py-2 text-[12px] text-chrome-warn">
              Lizenzierung ist in diesem Build noch nicht konfiguriert (Polar-Verbindung fehlt). Kaufen &amp;
              Aktivieren sind erst nach der Einrichtung verfügbar.
            </div>
          )}

          {status?.state === 'upgrade_required' && (
            <div className="rounded-lg border border-chrome-warn/40 bg-chrome-warn/5 px-3 py-2 text-[12px] text-chrome-warn">
              Deine bestehende Lizenz gilt für eine ältere Slideo-Version. Kaufe das Upgrade für diese Version —
              oder gib unten einen für diese Version gültigen Schlüssel ein.
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-chrome-text">Lizenzschlüssel eingeben</p>
            <p className="mb-2 text-[12px] leading-relaxed text-chrome-muted">
              Nach dem Kauf findest du deinen Schlüssel im Polar-Kundenportal (Link in der Bestell-E-Mail).
              Kopiere ihn hierher.
            </p>
            <input
              value={key}
              onChange={(e) => setKey(e.target.value)}
              placeholder="SLIDEO-XXXXXXXX-XXXX-XXXX-…"
              className={inputClass}
              spellCheck={false}
              autoCapitalize="off"
              autoCorrect="off"
            />
            {error && <p className="mt-1.5 text-[12px] text-chrome-danger">{error}</p>}
          </div>

          <div className="flex items-center gap-2">
            <button
              className={modalPrimaryBtn}
              onClick={onActivate}
              disabled={busy || !configured || key.trim().length === 0}
            >
              <Icon name="check_circle" size={18} />
              {busy ? 'Aktiviere …' : 'Aktivieren'}
            </button>
            <span className="text-[12px] text-chrome-faint">oder</span>
            <button className={modalGhostBtn} onClick={onBuy} disabled={!checkoutAvailable}>
              <Icon name="sell" size={16} />
              Slideo kaufen
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
