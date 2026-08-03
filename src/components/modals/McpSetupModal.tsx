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

// Erststart-Auswahl der MCP-Verbindung. Erscheint, solange noch kein Ziel gewählt
// wurde (Backend-Status `configured === false`). Slideo registriert sich bewusst
// ERST nach „Aktivieren" — vorher wird nichts eingetragen.
/** Beispielfrage fürs Erfolgspanel — bewusst kurz und ohne Slideo-Jargon. */
const EXAMPLE_ASK = 'Welche Slideo-Werkzeuge hast du? Bau mir damit eine Testfolie.'

export function McpSetupModal({ onClose }: { onClose: () => void }) {
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
      notify(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  // Erfolgspanel: der EINE Schritt, der bisher komplett fehlte (Befund B6).
  if (done) {
    return (
      <Modal
        title="Fast fertig — einmal neu starten"
        onClose={onClose}
        width="w-[32rem]"
        footer={
          <button className={modalPrimaryBtn} onClick={onClose}>
            Verstanden
          </button>
        }
      >
        <div className="flex flex-col gap-3">
          <div className="flex items-start gap-2 rounded-lg border border-chrome-warn/30 bg-chrome-warn-soft px-3 py-2.5">
            <Icon name="warning" size={18} weight={400} className="mt-0.5 shrink-0 text-chrome-warn" />
            <p className="text-[13px] leading-relaxed text-chrome-warn">
              <span className="font-semibold">
                Starte {mcpTargetLabel(done)} jetzt einmal neu.
              </span>{' '}
              MCP-Clients lesen ihre Server-Liste nur beim Start — vorher sieht dein Agent
              Slideo nicht.
            </p>
          </div>
          <p className="text-[13px] leading-relaxed text-chrome-secondary">
            Danach dort einfach fragen, zum Beispiel:
          </p>
          <div className="flex items-start gap-2 rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2.5">
            <code className="flex-1 font-mono text-[12px] leading-relaxed text-chrome-text">
              {EXAMPLE_ASK}
            </code>
            <button
              onClick={() =>
                void copyText(EXAMPLE_ASK).then((ok) =>
                  notify(ok ? 'Kopiert.' : 'Kopieren nicht möglich.', ok ? 'success' : 'error'),
                )
              }
              title="Kopieren"
              aria-label="Kopieren"
              className="shrink-0 rounded-md p-1 text-chrome-muted transition-colors hover:bg-chrome-surface hover:text-chrome-text"
            >
              <Icon name="content_copy" size={16} weight={400} />
            </button>
          </div>
          <p className="text-[12px] leading-relaxed text-chrome-muted">
            Ob es geklappt hat, zeigt der Punkt oben rechts in der Leiste: er springt auf
            „KI verbunden", sobald der erste Aufruf Slideo erreicht.
          </p>
        </div>
      </Modal>
    )
  }

  return (
    <Modal
      title="KI-Agent verbinden (MCP)"
      onClose={onClose}
      width="w-[32rem]"
      footer={
        <>
          <button className={modalGhostBtn} onClick={onClose} disabled={submitting}>
            Jetzt nicht
          </button>
          <button className={modalPrimaryBtn} onClick={activate} disabled={!pick || submitting}>
            {submitting ? 'Aktiviere…' : 'Aktivieren'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-chrome-secondary">
          Slideo ist ein <span className="font-medium text-chrome-text">MCP-Server</span> und stellt deinem
          KI-Agenten{' '}
          <span className="font-medium text-chrome-text">
            {status?.toolCount ?? 37} Folien-Werkzeuge
          </span>{' '}
          bereit (z.B. Claude Desktop, Codex CLI) — der Agent baut & bearbeitet dein Deck, Slideo zeigt es live.
          Wähle, wo sich Slideo registriert (erst{' '}
          <span className="font-medium text-chrome-text">nach deiner Auswahl</span>, immer nur ein Ziel).
        </p>
        {status ? (
          <McpTargetCards
            status={status}
            selected={pick ?? status.target}
            disabled={submitting}
            onSelect={setPick}
          />
        ) : (
          <p className="py-2 text-[12px] text-chrome-muted">Status wird geladen…</p>
        )}
        <p className="text-[11px] text-chrome-muted">
          Lässt sich jederzeit in den Einstellungen unter „KI-Verbindung (MCP)" ändern.
        </p>
      </div>
    </Modal>
  )
}
