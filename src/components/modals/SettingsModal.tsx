import { useCallback, useEffect, useState } from 'react'
import { Modal, modalGhostBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { isTauri } from '@/lib/tauri'
import { pickDirectory } from '@/lib/dialog'
import {
  getMcpStatus,
  setMcpTarget,
  type McpStatus,
  type McpTarget,
} from '@/lib/mcp-registration'
import { McpTargetCards, mcpTargetLabel } from '@/components/ui/McpTargetCards'
import { AssetLibrary } from '@/components/ui/AssetLibrary'

// Einstellungen — bewusst als Shell angelegt, wird nach und nach gefüllt.
export function SettingsModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const openModal = useUiStore((s) => s.openModal)
  const defaultProjectDir = useSettingsStore((s) => s.defaultProjectDir)
  const setDefaultProjectDir = useSettingsStore((s) => s.setDefaultProjectDir)
  const tauri = isTauri()
  // Version zur Laufzeit aus der Tauri-Config statt hartkodiert (Befund S30: das
  // frühere `APP_VERSION = '0.1.0'` war eine dritte, driftende Wahrheit neben
  // package.json und tauri.conf.json).
  const [appVersion, setAppVersion] = useState<string | null>(null)
  useEffect(() => {
    if (!tauri) {
      setAppVersion('dev')
      return
    }
    void import('@tauri-apps/api/app')
      .then((m) => m.getVersion())
      .then(setAppVersion)
      .catch(() => setAppVersion(null))
  }, [tauri])

  async function choose() {
    const dir = await pickDirectory(defaultProjectDir)
    if (dir) setDefaultProjectDir(dir)
  }

  return (
    <Modal title="Einstellungen" onClose={closeModal} width="w-[34rem]">
      <div className="flex flex-col divide-y divide-chrome-border">
        {/* Allgemein */}
        <Section title="Allgemein">
          <Row
            label="Standard-Speicherort"
            hint="Vorausgewählter Ordner für neue Präsentationen."
          >
            {tauri ? (
              <div className="flex items-center gap-2">
                <span
                  className="max-w-[14rem] truncate text-[13px] text-chrome-text"
                  dir="rtl"
                  title={defaultProjectDir ?? ''}
                >
                  {defaultProjectDir || 'Desktop (Standard)'}
                </span>
                <button className={modalGhostBtn} onClick={choose}>
                  Ändern
                </button>
                {defaultProjectDir && (
                  <button
                    className="rounded-md p-1.5 text-chrome-muted hover:bg-chrome-surface-2 hover:text-chrome-text"
                    onClick={() => setDefaultProjectDir(null)}
                    title="Zurücksetzen"
                  >
                    <Icon name="close" size={16} weight={400} />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[12px] text-chrome-muted">Nur in der Desktop-App</span>
            )}
          </Row>
        </Section>

        {/* KI-Verbindung (MCP) */}
        <Section title="KI-Verbindung (MCP)">
          <McpConnection />
        </Section>

        {/* Assets — geteilt mit dem Asset-Manager (Topbar) */}
        <Section title="Assets">
          <AssetLibrary />
        </Section>

        {/* Lizenz — aus der Topbar hierher verschoben (Befund M55). */}
        <Section title="Lizenz">
          <button
            onClick={() => openModal('license')}
            className="flex w-full items-center gap-2 rounded-lg border border-chrome-border px-3 py-2 text-left text-[13px] text-chrome-secondary transition-colors hover:border-chrome-border-strong hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            <Icon name="sell" size={17} weight={400} className="text-chrome-muted" />
            Testphase, kaufen &amp; aktivieren
          </button>
        </Section>

        {/* Über. Die „Bald verfügbar"-Sektion ist entfallen (Befund M64): sie kündigte
            Theme und Fonts an, die längst im Design-Overlay leben — sie versprach also
            als Zukunft, was bereits ausgeliefert war. */}
        <Section title="Über">
          <div className="flex flex-col gap-1 py-1 text-[12px] text-chrome-muted">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-chrome-accent-600 text-[11px] font-bold text-white">
                S
              </span>
              <span className="text-[13px] font-medium text-chrome-text">Slideo</span>
              <span>v{appVersion ?? '…'}</span>
            </div>
            {/* Herstellerneutral (Befund M64): Slideo spricht MCP, nicht „Claude". */}
            <p>Lokal, code-frei, MCP-nativ — nutzbar mit jedem MCP-fähigen KI-Client.</p>
          </div>
        </Section>
      </div>
    </Modal>
  )
}

// Auswahl, wo sich Slideo als MCP-Server anmeldet. Genau ein Ziel ist aktiv;
// der Rust-Backend-Command registriert es und meldet die anderen ab.
function McpConnection() {
  const tauri = isTauri()
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<McpTarget | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await getMcpStatus())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tauri) void refresh()
    else setLoading(false)
  }, [tauri, refresh])

  async function choose(key: McpTarget) {
    if (busy || !status || key === status.target) return
    setBusy(key)
    try {
      const next = await setMcpTarget(key)
      setStatus(next)
      notify(`MCP-Ziel aktiv: ${mcpTargetLabel(key)}`, 'success')
    } catch (e) {
      notify(e instanceof Error ? e.message : String(e), 'error')
      // Realen Zustand zurückholen — der Wechsel wurde nicht übernommen.
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  if (!tauri)
    return <p className="py-1 text-[12px] text-chrome-muted">Nur in der Desktop-App verfügbar.</p>
  if (loading) return <p className="py-1 text-[12px] text-chrome-muted">Status wird geladen…</p>
  if (!status) return <p className="py-1 text-[12px] text-chrome-muted">Status nicht verfügbar.</p>

  return (
    <div className="flex flex-col gap-2.5 py-1">
      <p className="text-[12px] leading-relaxed text-chrome-muted">
        Slideo stellt deinem KI-Agenten (MCP-Client wie Claude Desktop, Codex CLI) seine Folien-Werkzeuge
        bereit. Wähle, wo sich Slideo registriert — es ist immer genau{' '}
        <span className="text-chrome-secondary">ein Ziel aktiv</span>, die anderen werden automatisch abgemeldet.
      </p>
      <McpTargetCards
        status={status}
        selected={status.target}
        busy={busy}
        disabled={!!busy}
        showActiveBadge
        onSelect={choose}
      />
      {status.lastError && (
        <div className="flex items-start gap-2 rounded-lg border border-chrome-warn/30 bg-chrome-warn-soft px-3 py-2">
          <Icon
            name="warning"
            size={16}
            weight={400}
            className="mt-0.5 shrink-0 text-chrome-warn"
          />
          <p className="text-[12px] leading-relaxed text-chrome-warn">{status.lastError}</p>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <div className="text-[13px] text-chrome-text">{label}</div>
        {hint && <div className="text-[11px] text-chrome-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
