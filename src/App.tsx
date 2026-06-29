import { useEffect, useState } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { startMcpBridge } from '@/lib/mcp-bridge'
import { getMcpStatus } from '@/lib/mcp-registration'
import { Icon } from '@/components/ui/Icon'
import { Toaster } from '@/components/ui/Toaster'
import { CloseGuard } from '@/components/CloseGuard'
import { Topbar } from '@/components/ui/Topbar'
import { NewPresentationModal } from '@/components/modals/NewPresentationModal'
import { SettingsModal } from '@/components/modals/SettingsModal'
import { McpSetupModal } from '@/components/modals/McpSetupModal'
import { FindReplaceModal } from '@/components/modals/FindReplaceModal'
import { ComponentPaletteModal } from '@/components/modals/ComponentPaletteModal'
import { HistoryModal } from '@/components/modals/HistoryModal'
import { DesignModal } from '@/components/modals/DesignModal'
import { EditorShell } from '@/components/ui/EditorShell'
import { OnboardingNudge } from '@/components/ui/OnboardingNudge'
import { HelpModal } from '@/components/modals/HelpModal'
import { AssetManagerModal } from '@/components/modals/AssetManagerModal'
import { PresentationMode } from '@/components/presentation/PresentationMode'

export default function App() {
  const presentation = usePresentationStore((s) => s.presentation)
  const mode = usePresentationStore((s) => s.mode)
  const save = usePresentationStore((s) => s.savePresentation)
  const undo = usePresentationStore((s) => s.undo)
  const modal = useUiStore((s) => s.modal)
  const openModal = useUiStore((s) => s.openModal)
  const [showMcpSetup, setShowMcpSetup] = useState(false)
  const [mcpUnconfigured, setMcpUnconfigured] = useState(false)
  const [mcpPrompted, setMcpPrompted] = useState(false)

  const openNew = () => openModal('new')

  // MCP-Status einmal holen (Tauri). Das Setup-Modal kommt aber NICHT auf der leeren
  // Startseite, sondern erst, wenn ein Deck existiert (Kontext für „KI-Agent verbinden")
  // — sonst überfällt es den Erststart ohne Bezug.
  useEffect(() => {
    if (!isTauri()) return
    let cancelled = false
    void getMcpStatus().then((s) => {
      if (!cancelled && s && !s.configured) setMcpUnconfigured(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Einmal nach dem ersten Deck zur MCP-Verbindung führen (falls noch nicht gewählt).
  useEffect(() => {
    if (mcpUnconfigured && presentation && !mcpPrompted) {
      setShowMcpSetup(true)
      setMcpPrompted(true)
    }
  }, [mcpUnconfigured, presentation, mcpPrompted])

  // Globale Shortcuts: Cmd/Ctrl+S speichern, Cmd/Ctrl+N neu, Cmd/Ctrl+Z rückgängig.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (!(e.metaKey || e.ctrlKey)) return
      const key = e.key.toLowerCase()
      if (key === 's') {
        e.preventDefault()
        void save()
      } else if (key === 'n') {
        e.preventDefault()
        openNew()
      } else if (key === 'f') {
        e.preventDefault()
        openModal('find')
      } else if (key === 'z' && !e.shiftKey) {
        // In Editoren (Tiptap/CodeMirror, Inputs) deren eigenes Undo nicht stören.
        const ae = document.activeElement as HTMLElement | null
        const inEditor =
          !!ae &&
          (ae.isContentEditable ||
            !!ae.closest('.cm-editor') ||
            ae.tagName === 'INPUT' ||
            ae.tagName === 'TEXTAREA')
        if (inEditor) return
        e.preventDefault()
        undo()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [save, undo])

  // Live-Bridge zum MCP-Server starten (No-op außerhalb von Tauri).
  useEffect(() => {
    let dispose: (() => void) | undefined
    void startMcpBridge().then((fn) => {
      dispose = fn
    })
    return () => dispose?.()
  }, [])

  if (mode === 'presentation' && presentation) {
    return (
      <>
        <PresentationMode />
        <Toaster />
        <CloseGuard />
      </>
    )
  }

  return (
    <div className="flex h-screen flex-col bg-chrome-bg text-chrome-text">
      <Topbar />
      {presentation ? (
        <div className="flex min-h-0 flex-1 flex-col">
          <OnboardingNudge />
          <EditorShell />
        </div>
      ) : (
        <EmptyState onNew={openNew} onHelp={() => openModal('help')} />
      )}
      {modal === 'new' && <NewPresentationModal />}
      {modal === 'settings' && <SettingsModal />}
      {modal === 'find' && <FindReplaceModal />}
      {modal === 'components' && <ComponentPaletteModal />}
      {modal === 'history' && <HistoryModal />}
      {modal === 'design' && <DesignModal />}
      {modal === 'help' && <HelpModal />}
      {modal === 'assets' && <AssetManagerModal />}
      {showMcpSetup && <McpSetupModal onClose={() => setShowMcpSetup(false)} />}
      <Toaster />
      <CloseGuard />
    </div>
  )
}

function EmptyState({ onNew, onHelp }: { onNew: () => void; onHelp: () => void }) {
  const openDialog = usePresentationStore((s) => s.openPresentationDialog)
  const tauri = isTauri()

  return (
    <div className="flex flex-1 items-center justify-center bg-chrome-bg p-6">
      <div className="w-[30rem] max-w-full rounded-2xl border border-chrome-border bg-chrome-surface p-9 text-center shadow-card">
        <div className="mx-auto mb-5 flex h-12 w-12 items-center justify-center rounded-xl bg-chrome-accent-600 text-xl font-bold text-white">
          S
        </div>
        <h1 className="mb-1.5 text-lg font-semibold tracking-tight text-chrome-text">
          Willkommen bei Slideo
        </h1>
        <p className="mx-auto mb-3 max-w-[24rem] text-[13px] leading-relaxed text-chrome-muted">
          Erstelle eine neue Präsentation oder öffne eine bestehende{' '}
          <code className="rounded bg-chrome-surface-2 px-1 py-0.5 font-mono text-[12px] text-chrome-secondary">
            .slideo
          </code>
          -Datei.
        </p>
        <p className="mx-auto mb-6 max-w-[26rem] text-[12px] leading-relaxed text-chrome-secondary">
          <Icon
            name="auto_awesome"
            size={13}
            weight={400}
            className="-mt-0.5 mr-1 inline align-middle text-chrome-accent-600"
          />
          Die Folien baut <span className="font-medium text-chrome-text">ein KI-Agent</span> über MCP
          (z.B. Claude Desktop, Codex CLI) — du verfeinerst sie hier.{' '}
          <button
            onClick={onHelp}
            className="font-medium text-chrome-accent-600 underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 rounded"
          >
            Wie funktioniert's?
          </button>
        </p>
        <div className="flex justify-center gap-2">
          <button
            onClick={onNew}
            className="flex items-center gap-1.5 rounded-lg bg-chrome-accent-600 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-[#2553c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            <Icon name="add" size={18} />
            Neue Präsentation
          </button>
          <button
            onClick={() => openDialog()}
            disabled={!tauri}
            title={tauri ? undefined : 'Nur in der Desktop-App verfügbar (npm run tauri:dev)'}
            className="flex items-center gap-1.5 rounded-lg border border-chrome-border px-4 py-2 text-[13px] font-medium text-chrome-secondary transition-colors hover:border-chrome-border-strong hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Icon name="folder_open" size={18} />
            Öffnen
          </button>
        </div>
      </div>
    </div>
  )
}
