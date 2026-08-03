import { useToastStore, type ToastType } from '@/store/toast'
import { t } from '@/i18n'
import { Icon } from './Icon'

const ICON: Record<ToastType, string> = {
  info: 'info',
  success: 'check_circle',
  error: 'error',
}

const ACCENT: Record<ToastType, string> = {
  info: 'text-chrome-accent-600',
  success: 'text-emerald-600',
  error: 'text-chrome-danger',
}

// Toast-Stack unten rechts.
export function Toaster() {
  const toasts = useToastStore((s) => s.toasts)
  const dismiss = useToastStore((s) => s.dismiss)

  if (toasts.length === 0) return null

  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[60] flex w-80 max-w-[90vw] flex-col gap-2">
      {toasts.map((toast) => (
        <div
          key={toast.id}
          className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-chrome-border bg-chrome-surface px-3.5 py-3 shadow-pop"
          role="status"
        >
          <Icon name={ICON[toast.type]} size={18} weight={400} className={ACCENT[toast.type]} />
          <span className="flex-1 text-[13px] leading-snug text-chrome-text">{toast.message}</span>
          <button
            onClick={() => dismiss(toast.id)}
            className="rounded text-chrome-faint transition-colors hover:text-chrome-secondary"
            aria-label={t('common.close')}
          >
            <Icon name="close" size={16} weight={400} />
          </button>
        </div>
      ))}
    </div>
  )
}
