import { useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { claudePrompt, copyText } from '@/lib/onboarding'
import { Icon } from './Icon'

const SEEN_KEY = 'slideo.onboardingSeen'

function alreadySeen(): boolean {
  try {
    return localStorage.getItem(SEEN_KEY) === '1'
  } catch {
    return false
  }
}

// Einmaliger Hinweis über der Editor-Fläche, sobald ein Deck existiert: erklärt die
// Kern-These (Claude baut die Folien) und bietet einen fertigen Prompt zum Kopieren.
// Wird nach „Verstanden" dauerhaft ausgeblendet (localStorage). Reines UI.
export function OnboardingNudge() {
  const title = usePresentationStore((s) => s.presentation?.meta.title ?? '')
  const openModal = useUiStore((s) => s.openModal)
  const [dismissed, setDismissed] = useState(alreadySeen)

  if (dismissed) return null

  function dismiss() {
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* ignore */
    }
    setDismissed(true)
  }

  async function copyPrompt() {
    const ok = await copyText(claudePrompt(title))
    notify(ok ? 'Prompt kopiert — in Claude Desktop einfügen.' : 'Kopieren nicht möglich.', ok ? 'success' : 'error')
  }

  return (
    <div className="flex shrink-0 items-center gap-3 border-b border-chrome-border bg-chrome-accent-soft px-4 py-2">
      <Icon name="auto_awesome" size={17} weight={400} className="shrink-0 text-chrome-accent-600" />
      <p className="min-w-0 flex-1 text-[12px] leading-snug text-chrome-text">
        <span className="font-medium">Claude baut deine Folien.</span>{' '}
        <span className="text-chrome-secondary">
          Öffne Claude Desktop und beschreib dein Thema — oder kopier dir einen fertigen Prompt.
        </span>
      </p>
      <button
        onClick={copyPrompt}
        className="flex shrink-0 items-center gap-1.5 rounded-md bg-chrome-accent-600 px-2.5 py-1 text-[12px] font-medium text-white transition-colors hover:bg-[#2553c9]"
      >
        <Icon name="content_copy" size={14} weight={400} />
        Prompt kopieren
      </button>
      <button
        onClick={() => openModal('help')}
        className="shrink-0 rounded-md px-2 py-1 text-[12px] font-medium text-chrome-accent-600 transition-colors hover:bg-white/40"
      >
        Wie das geht?
      </button>
      <button
        onClick={dismiss}
        title="Hinweis ausblenden"
        aria-label="Hinweis ausblenden"
        className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-white/40 hover:text-chrome-text"
      >
        <Icon name="close" size={15} weight={400} />
      </button>
    </div>
  )
}
