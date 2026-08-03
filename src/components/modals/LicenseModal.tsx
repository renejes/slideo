import { useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { useUiStore } from '@/store/ui'
import { useLicenseStore } from '@/store/license'
import { notify } from '@/store/toast'
import { describeError } from '@/lib/tauri'
import { t } from '@/i18n'
import { T } from '@/i18n/T'

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
        notify(t('modal.license.activated'), 'success')
        closeModal()
      } else {
        setError(t('modal.license.activationFailed'))
      }
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function onBuy() {
    try {
      await openCheckout()
    } catch (e) {
      notify(t('modal.license.checkoutFailed', { error: describeError(e) }), 'error')
    }
  }

  async function onDeactivate() {
    setBusy(true)
    try {
      await deactivate()
      notify(t('modal.license.deviceReleased'), 'success')
    } catch (e) {
      notify(t('modal.license.releaseFailed', { error: describeError(e) }), 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <Modal
      title={t('modal.license.title')}
      onClose={closeModal}
      width="w-[32rem]"
      footer={
        <button className={modalGhostBtn} onClick={closeModal}>
          {t('common.close')}
        </button>
      }
    >
      {licensed ? (
        <div className="flex flex-col gap-4 py-1">
          <div className="flex items-center gap-2 rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2.5">
            <Icon name="check_circle" size={20} className="text-chrome-accent-600" />
            <div className="min-w-0">
              <p className="text-[13px] font-medium text-chrome-text">
                {t('modal.license.activeTitle')}
              </p>
              <p className="truncate text-[12px] text-chrome-muted">
                {status?.key_display
                  ? t('modal.license.keyLabel', { key: status.key_display })
                  : t('modal.license.activatedNoKey')}
                {' · '}
                {status?.expires_at
                  ? t('modal.license.validUntil', { date: status.expires_at.slice(0, 10) })
                  : t('modal.license.perpetual')}
              </p>
            </div>
          </div>
          <p className="text-[12px] leading-relaxed text-chrome-muted">
            {t('modal.license.boundHint')}
          </p>
          <div className="flex gap-2">
            <button className={modalGhostBtn} onClick={() => void recheck()} disabled={busy}>
              <Icon name="repeat" size={16} />
              {t('modal.license.recheck')}
            </button>
            <button
              className={modalGhostBtn + ' text-chrome-danger hover:bg-chrome-danger/10'}
              onClick={onDeactivate}
              disabled={busy}
            >
              {t('modal.license.release')}
            </button>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-4 py-1">
          {!configured && (
            <div className="rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2 text-[12px] text-chrome-secondary">
              <T
                k="modal.license.unconfigured"
                slots={[
                  <strong className="font-medium text-chrome-text">
                    {t('modal.license.unconfiguredEmphasis')}
                  </strong>,
                ]}
              />
            </div>
          )}

          {status?.state === 'upgrade_required' && (
            <div className="rounded-lg border border-chrome-warn/40 bg-chrome-warn/5 px-3 py-2 text-[12px] text-chrome-warn">
              {t('modal.license.upgradeRequired')}
            </div>
          )}

          <div>
            <p className="mb-1.5 text-[13px] font-medium text-chrome-text">
              {t('modal.license.enterKey')}
            </p>
            <p className="mb-2 text-[12px] leading-relaxed text-chrome-muted">
              {t('modal.license.enterKeyHint')}
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
              {busy ? t('modal.license.activating') : t('modal.license.activate')}
            </button>
            <span className="text-[12px] text-chrome-faint">{t('modal.license.or')}</span>
            <button className={modalGhostBtn} onClick={onBuy} disabled={!checkoutAvailable}>
              <Icon name="sell" size={16} />
              {t('modal.license.buy')}
            </button>
          </div>
        </div>
      )}
    </Modal>
  )
}
