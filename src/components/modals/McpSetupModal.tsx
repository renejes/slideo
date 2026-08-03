import { useEffect, useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { McpTargetCards, mcpTargetLabel } from '@/components/ui/McpTargetCards'
import { notify } from '@/store/toast'
import { Icon } from '@/components/ui/Icon'
import { copyText } from '@/lib/onboarding'
import {
  getMcpStatus,
  setMcpTarget,
  type McpStatus,
  type McpTarget,
} from '@/lib/mcp-registration'
import { describeError } from '@/lib/tauri'
import { t } from '@/i18n'
import { T } from '@/i18n/T'

// Erststart-Auswahl der MCP-Verbindung. Erscheint, solange noch kein Ziel gewählt
// wurde (Backend-Status `configured === false`). Slideo registriert sich bewusst
// ERST nach „Aktivieren" — vorher wird nichts eingetragen.

export function McpSetupModal({ onClose }: { onClose: () => void }) {
  /** Beispielfrage fürs Erfolgspanel — bewusst kurz und ohne Slideo-Jargon. */
  const exampleAsk = t('modal.mcpSetup.exampleAsk')
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [pick, setPick] = useState<McpTarget | null>(null)
  const [submitting, setSubmitting] = useState(false)
  /** Gesetztes Ziel nach erfolgreicher Aktivierung → Erfolgspanel (Befund B6). */
  const [done, setDone] = useState<McpTarget | null>(null)

  useEffect(() => {
    void getMcpStatus().then((s) => {
      setStatus(s)
      if (s) setPick(s.target) // empfohlener Default vorausgewählt
    })
  }, [])

  async function activate() {
    if (!pick || submitting) return
    setSubmitting(true)
    try {
      await setMcpTarget(pick)
      // Statt Toast + Modal zu (Review 2026-08, Befund B6): auf das Erfolgspanel
      // umschalten. Ein grep über src/ und src-tauri/src/ nach „Neustart|restart"
      // ergab NULL Treffer — die Anforderung stand nur in CLAUDE.md, also für
      // Entwickler. MCP-Clients lesen `mcpServers` aber beim START. Der reale
      // Erstlauf war deshalb: aktivieren → Prompt einfügen → „Ich habe keine
      // Slideo-Tools" → Ende, ohne Hinweis irgendwo.
      setDone(pick)
    } catch (e) {
      // z.B. Meta-MCP nicht erreichbar — Modal offen lassen, anderes Ziel wählbar.
      notify(describeError(e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Erfolgspanel: der EINE Schritt, der bisher komplett fehlte (Befund B6).
  if (done) {
    return (
      <Modal
        title={t('modal.mcpSetup.doneTitle')}
        onClose={onClose}
        width="w-[32rem]"
        footer={
          <button className={modalPrimaryBtn} onClick={onClose}>
            {t('modal.gotIt')}
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-chrome-warn/30 bg-chrome-warn-soft px-3 py-2.5">
            <Icon name="warning" size={18} weight={400} className="mt-0.5 shrink-0 text-chrome-warn" />
            <p className="text-[13px] leading-relaxed text-chrome-warn">
              <T
                k="modal.mcpSetup.restartBody"
                slots={[
                  <span className="font-semibold">
                    {t('modal.mcpSetup.restartNow', { target: mcpTargetLabel(done) })}
                  </span>,
                ]}
              />
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-chrome-secondary">
            {t('modal.mcpSetup.askExample')}
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2.5">
            <code className="flex-1 font-mono text-[12px] leading-relaxed text-chrome-text">
              {exampleAsk}
            </code>
            <button
              onClick={() =>
                void copyText(exampleAsk).then((ok) =>
                  notify(
                    ok ? t('modal.mcpSetup.copied') : t('modal.copyFailed'),
                    ok ? 'success' : 'error',
                  ),
                )
              }
              title={t('modal.mcpSetup.copy')}
              aria-label={t('modal.mcpSetup.copy')}
              className="shrink-0 rounded-md p-1 text-chrome-muted transition-colors hover:bg-chrome-surface hover:text-chrome-text"
            >
              <Icon name="content_copy" size={16} weight={400} />
            </button>
          </div>
          <p className="text-[12px] leading-relaxed text-chrome-muted">
            {t('modal.mcpSetup.statusHint')}
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title={t('modal.mcpSetup.title')}
      onClose={onClose}
      width="w-[32rem]"
      footer={
        <>
          <button className={modalGhostBtn} onClick={onClose} disabled={submitting}>
            {t('modal.mcpSetup.notNow')}
          </button>
          <button className={modalPrimaryBtn} onClick={activate} disabled={!pick || submitting}>
            {submitting ? t('modal.mcpSetup.activating') : t('modal.mcpSetup.activate')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-chrome-secondary">
          <T
            k="modal.mcpSetup.intro"
            slots={[
              <span className="font-medium text-chrome-text">
                {t('modal.mcpSetup.introServer')}
              </span>,
              <span className="font-medium text-chrome-text">
                {t('modal.mcpSetup.introTools', { count: status?.toolCount ?? 37 })}
              </span>,
              <span className="font-medium text-chrome-text">
                {t('modal.mcpSetup.introChoice')}
              </span>,
            ]}
          />
        </p>
        {status ? (
          <McpTargetCards
            status={status}
            selected={pick ?? status.target}
            disabled={submitting}
            onSelect={setPick}
          />
        ) : (
          <p className="py-2 text-[12px] text-chrome-muted">{t('modal.mcpStatusLoading')}</p>
        )}
        <p className="text-[11px] text-chrome-muted">{t('modal.mcpSetup.changeLater')}</p>
      </div>
    </Modal>
  )
}
