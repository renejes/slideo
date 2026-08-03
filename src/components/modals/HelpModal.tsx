import { Modal, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { samplePrompt, copyText } from '@/lib/onboarding'
import { t, type I18nKey } from '@/i18n'
import { T } from '@/i18n/T'

// Onboarding-Hilfe: erklärt die Kern-These (ein KI-Agent baut das Deck via MCP,
// der Mensch editiert drüber) in 4 Schritten + bietet einen Beispiel-Prompt zum
// Kopieren. Reines UI; öffenbar über den „?"-Knopf in der Topbar / EmptyState.
const STEPS: { icon: string; title: I18nKey; body: I18nKey }[] = [
  {
    icon: 'dashboard',
    title: 'modal.help.step1.title',
    body: 'modal.help.step1.body',
  },
  {
    icon: 'hub',
    title: 'modal.help.step2.title',
    body: 'modal.help.step2.body',
  },
  {
    icon: 'auto_awesome',
    title: 'modal.help.step3.title',
    // Bewusst ohne Zahl (Befund M1/S30): eine hartkodierte Tool-Zahl driftet still von
    // `tools::tool_schemas()` weg — hier stand 35, während es 37 waren. Wo die Zahl
    // wirklich hilft (Setup-Modal), kommt sie jetzt zur Laufzeit aus `mcp_status`.
    body: 'modal.help.step3.body',
  },
  {
    icon: 'arrow_selector_tool',
    title: 'modal.help.step4.title',
    body: 'modal.help.step4.body',
  },
]

export function HelpModal() {
  const closeModal = useUiStore((s) => s.closeModal)

  async function copyExample() {
    // Leerer Titel → samplePrompt() setzt den lokalisierten Themen-Platzhalter ein.
    // Ein hartkodiertes „dein Thema" stünde sonst auch in englischer Oberfläche da.
    const ok = await copyText(samplePrompt(''))
    notify(
      ok ? t('modal.help.promptCopied') : t('modal.copyFailed'),
      ok ? 'success' : 'error',
    )
  }

  return (
    <Modal
      title={t('modal.help.title')}
      onClose={closeModal}
      width="w-[34rem]"
      footer={
        <button className={modalPrimaryBtn} onClick={closeModal}>
          {t('modal.gotIt')}
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-chrome-secondary">
          <T
            k="modal.help.intro"
            slots={[
              <span className="font-medium text-chrome-text">{t('modal.help.introNoAi')}</span>,
              <span className="font-medium text-chrome-text">{t('modal.help.introAgent')}</span>,
            ]}
          />
        </p>

        <ol className="flex flex-col gap-2">
          {STEPS.map((s) => (
            <li
              key={s.title}
              className="flex items-start gap-3 rounded-xl border border-chrome-border bg-chrome-surface-2 px-3.5 py-2.5"
            >
              <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-chrome-accent-soft text-chrome-accent-600">
                <Icon name={s.icon} size={17} weight={400} />
              </span>
              <div className="min-w-0">
                <div className="text-[13px] font-semibold text-chrome-text">{t(s.title)}</div>
                <div className="text-[12px] leading-relaxed text-chrome-muted">{t(s.body)}</div>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={copyExample}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-chrome-border px-3 py-2 text-[12px] font-medium text-chrome-secondary transition-colors hover:border-chrome-border-strong hover:text-chrome-text"
        >
          <Icon name="content_copy" size={15} weight={400} />
          {t('modal.help.copyPrompt')}
        </button>
      </div>
    </Modal>
  )
}
