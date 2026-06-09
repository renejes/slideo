import { useToastStore, type ToastType } from '@/store/toast'
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
      {toasts.map((t) => (
        <div
          key={t.id}
          className="pointer-events-auto flex items-start gap-2.5 rounded-xl border border-chrome-border bg-chrome-surface px-3.5 py-3 shadow-pop"
          role="status"
        >
          <Icon name={ICON[t.type]} size={18} weight={400} className={ACCENT[t.type]} />
          <span className="flex-1 text-[13px] leading-snug text-chrome-text">{t.message}</span>
          <button
            onClick={() => dismiss(t.id)}
            className="rounded text-chrome-faint transition-colors hover:text-chrome-secondary"
            aria-label="Schließen"
          >
            <Icon name="close" size={16} weight={400} />
          </button>
        </div>
      ))}
    </div>
  )
}
