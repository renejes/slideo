import { Modal, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { samplePrompt, copyText } from '@/lib/onboarding'

// Onboarding-Hilfe: erklärt die Kern-These (ein KI-Agent baut das Deck via MCP,
// der Mensch editiert drüber) in 4 Schritten + bietet einen Beispiel-Prompt zum
// Kopieren. Reines UI; öffenbar über den „?"-Knopf in der Topbar / EmptyState.
const STEPS: { icon: string; title: string; body: string }[] = [
  {
    icon: 'dashboard',
    title: '1 · Deck anlegen',
    body: 'Vorlage wählen oder leer starten. Slideo ist Editor & Player — die Folien baut die KI.',
  },
  {
    icon: 'hub',
    title: '2 · KI-Agent verbinden',
    body: 'Einen MCP-Client öffnen (z.B. Claude Desktop, Codex CLI, …). Falls noch nicht aktiv: Einstellungen → KI-Verbindung (MCP).',
  },
  {
    icon: 'auto_awesome',
    title: '3 · Thema beschreiben',
    body: 'Im KI-Agent z.B.: „Erstelle 6 Folien über [Thema] in Slideo.“ Er nutzt Slideos 35 Folien-Werkzeuge.',
  },
  {
    icon: 'arrow_selector_tool',
    title: '4 · Live verfeinern',
    body: 'Die Folien erscheinen sofort. Du editierst direkt in der Vorschau: Text, Bilder, Verschieben, Verlinken.',
  },
]

export function HelpModal() {
  const closeModal = useUiStore((s) => s.closeModal)

  async function copyExample() {
    const ok = await copyText(samplePrompt('dein Thema'))
    notify(ok ? 'Beispiel-Prompt kopiert — in deinen KI-Agent einfügen.' : 'Kopieren nicht möglich.', ok ? 'success' : 'error')
  }

  return (
    <Modal
      title="Wie Slideo mit deinem KI-Agent arbeitet"
      onClose={closeModal}
      width="w-[34rem]"
      footer={
        <button className={modalPrimaryBtn} onClick={closeModal}>
          Verstanden
        </button>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-chrome-secondary">
          Slideo läuft lokal und hat <span className="font-medium text-chrome-text">keine eigene KI</span>.
          Die Präsentation baut <span className="font-medium text-chrome-text">dein KI-Agent</span> über den
          MCP-Server (ein beliebiger MCP-Client — z.B. Claude Desktop, Codex CLI) — du verfeinerst sie hier.
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
                <div className="text-[13px] font-semibold text-chrome-text">{s.title}</div>
                <div className="text-[12px] leading-relaxed text-chrome-muted">{s.body}</div>
              </div>
            </li>
          ))}
        </ol>

        <button
          onClick={copyExample}
          className="flex items-center justify-center gap-1.5 rounded-lg border border-chrome-border px-3 py-2 text-[12px] font-medium text-chrome-secondary transition-colors hover:border-chrome-border-strong hover:text-chrome-text"
        >
          <Icon name="content_copy" size={15} weight={400} />
          Beispiel-Prompt kopieren
        </button>
      </div>
    </Modal>
  )
}
