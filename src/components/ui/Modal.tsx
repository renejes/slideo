import { useEffect } from 'react'
import { t } from '@/i18n'
import { Icon } from './Icon'

interface ModalProps {
  title: string
  onClose: () => void
  children: React.ReactNode
  /** Optionaler Footer-Bereich (Buttons). */
  footer?: React.ReactNode
  width?: string
}

// Zugängliches Basis-Modal: Backdrop + Panel, Esc schließt, Backdrop-Klick schließt.
export function Modal({ title, onClose, children, footer, width = 'w-[30rem]' }: ModalProps) {
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-black/30 p-4"
      onMouseDown={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div
        className={`${width} max-w-full overflow-hidden rounded-2xl border border-chrome-border bg-chrome-surface shadow-pop`}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-chrome-border px-5 py-3.5">
          <h2 className="text-[15px] font-semibold tracking-tight text-chrome-text">{title}</h2>
          <button
            onClick={onClose}
            className="flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text"
            aria-label={t('common.close')}
          >
            <Icon name="close" size={18} weight={400} />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex justify-end gap-2 border-t border-chrome-border bg-chrome-bg px-5 py-3.5">
            {footer}
          </div>
        )}
      </div>
    </div>
  )
}

// Wiederverwendbare Button-Stile fürs Modal-Footer.
export const modalPrimaryBtn =
  'flex items-center gap-1.5 rounded-lg bg-chrome-accent-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2553c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 disabled:cursor-not-allowed disabled:opacity-40'
export const modalGhostBtn =
  'rounded-lg border border-chrome-border px-4 py-2 text-[13px] font-medium text-chrome-secondary transition-colors hover:border-chrome-border-strong hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40'
