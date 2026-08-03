import { Icon } from './Icon'
import { useUiStore } from '@/store/ui'
import { useLicenseStore } from '@/store/license'
import { notify } from '@/store/toast'

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
    ? status.state === 'revoked'
      ? 'Lizenz widerrufen — Slideo ist schreibgeschützt.'
      : status.state === 'expired'
        ? 'Lizenz abgelaufen — Slideo ist schreibgeschützt.'
        : status.state === 'upgrade_required'
          ? 'Deine Lizenz gilt für eine ältere Slideo-Version — Upgrade nötig (schreibgeschützt).'
          : 'Testphase abgelaufen — Slideo ist schreibgeschützt (Öffnen & Exportieren bleibt möglich).'
    : `Testphase: noch ${days} ${days === 1 ? 'Tag' : 'Tage'}.`

  async function buy() {
    try {
      await openCheckout()
    } catch (e) {
      notify(
        `Kauf-Seite konnte nicht geöffnet werden${
          !status?.checkout_available ? ' (Lizenzierung noch nicht konfiguriert)' : ''
        }: ${e instanceof Error ? e.message : String(e)}`,
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
            Slideo kaufen
          </button>
        )}
        <button
          onClick={() => openModal('license')}
          className="rounded-md border border-chrome-border bg-white/60 px-2.5 py-1 text-[12px] font-medium text-chrome-secondary transition-colors hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
        >
          Lizenz aktivieren
        </button>
      </div>
    </div>
  )
}
