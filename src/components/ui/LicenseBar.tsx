import { Icon } from './Icon'
import { useUiStore } from '@/store/ui'
import { useLicenseStore } from '@/store/license'
import { notify } from '@/store/toast'
import { t, tp, type I18nKey } from '@/i18n'
import { describeError, type LicenseStatus } from '@/lib/tauri'

// Schreibgeschützte Zustände → Katalog-Schlüssel. Die Enum-Werte selbst kommen aus
// Rust (license.rs) und bleiben unverändert; übersetzt wird nur der Satz. Alles,
// was hier nicht steht (heute: `trial_expired`), fällt auf den Trial-Satz zurück —
// wie zuvor der letzte Zweig der Ternary-Kette.
const READ_ONLY_MESSAGE: Partial<Record<LicenseStatus['state'], I18nKey>> = {
  revoked: 'ui.license.state.revoked',
  expired: 'ui.license.state.expired',
  upgrade_required: 'ui.license.state.upgrade_required',
}

// Schmale Leiste unter der Topbar: Trial-Countdown bzw. Read-only-Hinweis nach Ablauf.
// Blendet sich bei aktiver Lizenz (und im Browser-Dev) komplett aus.
export function LicenseBar() {
  const status = useLicenseStore((s) => s.status)
  const openCheckout = useLicenseStore((s) => s.openCheckout)
  const openModal = useUiStore((s) => s.openModal)

  // `unconfigured` (Polar-Werte noch Platzhalter) und `unknown` (license_status
  // fehlgeschlagen) sind keine Nutzer-Zustände: beide erlauben volles Bearbeiten
  // (Befund B9/S27) — dann darf die Leiste auch nichts fordern, wofür es keinen
  // Weg gibt. Sie bleibt deshalb aus.
  if (!status || status.state === 'licensed') return null
  if (status.state === 'unconfigured' || status.state === 'unknown') return null

  const readOnly = !status.editing_allowed // trial_expired | revoked | expired
  const days = status.trial_days_left ?? 0
  const urgentTrial = status.state === 'trial' && days <= 5

  const message = readOnly
    ? t(READ_ONLY_MESSAGE[status.state] ?? 'ui.license.state.trial_expired')
    : tp('ui.license.trialDays', days)

  async function buy() {
    try {
      await openCheckout()
    } catch (e) {
      const error = describeError(e)
      notify(
        status?.checkout_available
          ? t('ui.license.buyFailed', { error })
          : t('ui.license.buyFailedUnconfigured', { error }),
        'error',
      )
    }
  }

  const tone = readOnly || urgentTrial
  const barClass = tone
    ? 'border-chrome-warn/30 bg-chrome-warn/[0.06] text-chrome-warn'
    : 'border-chrome-border bg-chrome-surface-2 text-chrome-secondary'

  return (
    <div
      className={`flex shrink-0 items-center gap-2 border-b px-3 py-1.5 text-[12px] ${barClass}`}
      role="status"
    >
      <Icon name={readOnly ? 'error' : 'info'} size={16} className="shrink-0" />
      <span className="min-w-0 truncate font-medium">{message}</span>
      <div className="ml-auto flex shrink-0 items-center gap-1.5">
        {status.checkout_available && (
          <button
            onClick={buy}
            className="flex items-center gap-1 rounded-md bg-chrome-accent-600 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[#2553c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            <Icon name="sell" size={14} />
            {t('ui.license.buy')}
          </button>
        )}
        <button
          onClick={() => openModal('license')}
          className="rounded-md border border-chrome-border bg-white/60 px-2.5 py-1 text-[12px] font-medium text-chrome-secondary transition-colors hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
        >
          {t('ui.license.activate')}
        </button>
      </div>
    </div>
  )
}
