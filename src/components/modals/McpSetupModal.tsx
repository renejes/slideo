import { useEffect, useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { McpTargetCards, mcpTargetLabel } from '@/components/ui/McpTargetCards'
import { notify } from '@/store/toast'
import {
  getMcpStatus,
  setMcpTarget,
  type McpStatus,
  type McpTarget,
} from '@/lib/mcp-registration'

// Erststart-Auswahl der MCP-Verbindung. Erscheint, solange noch kein Ziel gewählt
// wurde (Backend-Status `configured === false`). Slideo registriert sich bewusst
// ERST nach „Aktivieren" — vorher wird nichts eingetragen.
export function McpSetupModal({ onClose }: { onClose: () => void }) {
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [pick, setPick] = useState<McpTarget | null>(null)
  const [submitting, setSubmitting] = useState(false)

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
      notify(`MCP-Ziel aktiv: ${mcpTargetLabel(pick)}`, 'success')
      onClose()
    } catch (e) {
      // z.B. Meta-MCP nicht erreichbar — Modal offen lassen, anderes Ziel wählbar.
      notify(e instanceof Error ? e.message : String(e), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <Modal
      title="MCP-Verbindung wählen"
      onClose={onClose}
      width="w-[32rem]"
      footer={
        <>
          <button className={modalGhostBtn} onClick={onClose} disabled={submitting}>
            Später
          </button>
          <button className={modalPrimaryBtn} onClick={activate} disabled={!pick || submitting}>
            {submitting ? 'Aktiviere…' : 'Aktivieren'}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <p className="text-[13px] leading-relaxed text-chrome-secondary">
          Slideo ist ein MCP-Server. Wähle, wo es sich anmeldet — Slideo trägt sich erst{' '}
          <span className="font-medium text-chrome-text">nach deiner Auswahl</span> ein, und
          immer nur bei genau einem Ziel.
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
