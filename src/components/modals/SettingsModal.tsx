import { useCallback, useEffect, useRef, useState } from 'react'
import { Modal, modalGhostBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { useSettingsStore } from '@/store/settings'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { isTauri } from '@/lib/tauri'
import { pickDirectory } from '@/lib/dialog'
import { mediaKind, parseDataUri } from '@/lib/assets'
import {
  getMcpStatus,
  setMcpTarget,
  type McpStatus,
  type McpTarget,
} from '@/lib/mcp-registration'
import { McpTargetCards, mcpTargetLabel } from '@/components/ui/McpTargetCards'

const APP_VERSION = '0.1.0'

// Einstellungen — bewusst als Shell angelegt, wird nach und nach gefüllt.
export function SettingsModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const defaultProjectDir = useSettingsStore((s) => s.defaultProjectDir)
  const setDefaultProjectDir = useSettingsStore((s) => s.setDefaultProjectDir)
  const tauri = isTauri()

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

        {/* Assets */}
        <Section title="Assets">
          <AssetManager />
        </Section>

        {/* Platzhalter für künftige Bereiche */}
        <Section title="Bald verfügbar">
          <p className="py-1 text-[12px] text-chrome-muted">
            Weitere Einstellungen (Theme, Fonts) folgen hier nach und nach.
          </p>
        </Section>

        {/* Über */}
        <Section title="Über">
          <div className="flex flex-col gap-1 py-1 text-[12px] text-chrome-muted">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-chrome-accent-600 text-[11px] font-bold text-white">
                S
              </span>
              <span className="text-[13px] font-medium text-chrome-text">Slideo</span>
              <span>v{APP_VERSION}</span>
            </div>
            <p>Lokal, code-frei, MCP-nativ. KI-Anbindung via MCP-Server (Claude Desktop).</p>
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
        Wo soll sich Slideo als MCP-Server anmelden? Es ist immer genau{' '}
        <span className="text-chrome-secondary">ein Ziel aktiv</span> — die anderen werden
        automatisch abgemeldet.
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

function AssetManager() {
  const assets = usePresentationStore((s) => s.assets)
  const hasPresentation = usePresentationStore((s) => s.presentation !== null)
  const addAssetToLibrary = usePresentationStore((s) => s.addAssetToLibrary)
  const removeAsset = usePresentationStore((s) => s.removeAsset)
  const fileRef = useRef<HTMLInputElement>(null)
  const entries = Object.entries(assets)

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') addAssetToLibrary(reader.result)
      }
      reader.readAsDataURL(file)
    })
  }

  if (!hasPresentation) {
    return <p className="py-1 text-[12px] text-chrome-muted">Erst eine Präsentation öffnen/anlegen.</p>
  }

  return (
    <div className="flex flex-col gap-3 py-1">
      <div className="flex items-center justify-between">
        <p className="max-w-[22rem] text-[12px] text-chrome-muted">
          Hinterlege Bilder, Videos oder Audio, die du (oder die KI per{' '}
          <code className="font-mono">list_assets</code>) als{' '}
          <code className="font-mono">assets/&lt;name&gt;</code> einbinden kannst.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          onChange={onPick}
          className="hidden"
        />
        <button className={modalGhostBtn} onClick={() => fileRef.current?.click()}>
          Hinzufügen
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="text-[12px] text-chrome-faint">Noch keine Assets.</p>
      ) : (
        <div className="grid grid-cols-2 gap-2">
          {entries.map(([name, dataUri]) => (
            <div
              key={name}
              className="group flex items-center gap-2 rounded-lg border border-chrome-border p-1.5"
            >
              <AssetThumb name={name} dataUri={dataUri} />
              <code className="min-w-0 flex-1 truncate font-mono text-[11px] text-chrome-secondary">
                {name}
              </code>
              <button
                onClick={() => removeAsset(name)}
                className="rounded p-1 text-chrome-faint transition-colors hover:bg-chrome-danger/10 hover:text-chrome-danger"
                title="Asset entfernen"
                aria-label="Asset entfernen"
              >
                <Icon name="delete" size={15} weight={400} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

function AssetThumb({ name, dataUri }: { name: string; dataUri: string }) {
  const kind = mediaKind(parseDataUri(dataUri).mime)
  const cls = 'h-9 w-9 shrink-0 rounded object-cover'
  if (kind === 'image') return <img src={dataUri} alt={name} className={cls} />
  if (kind === 'video') return <video src={dataUri} muted className={cls} />
  return (
    <div className={`${cls} flex items-center justify-center bg-chrome-surface-2 text-chrome-muted`}>
      <Icon name={kind === 'audio' ? 'music_note' : 'description'} size={18} weight={400} />
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
