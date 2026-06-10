import { useEffect } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { startMcpBridge } from '@/lib/mcp-bridge'
import { Icon } from '@/components/ui/Icon'
import { Toaster } from '@/components/ui/Toaster'
import { CloseGuard } from '@/components/CloseGuard'
import { Topbar } from '@/components/ui/Topbar'
import { NewPresentationModal } from '@/components/modals/NewPresentationModal'
import { SettingsModal } from '@/components/modals/SettingsModal'
import { FindReplaceModal } from '@/components/modals/FindReplaceModal'
import { Sidebar } from '@/components/ui/Sidebar'
import { EditorCanvas } from '@/components/editor/EditorCanvas'
import { PreviewPane } from '@/components/preview/PreviewPane'
import { PresentationMode } from '@/components/presentation/PresentationMode'

export default function App() {
  const presentation = usePresentationStore((s) => s.presentation)
  const mode = usePresentationStore((s) => s.mode)
  const save = usePresentationStore((s) => s.savePresentation)
  const undo = usePresentationStore((s) => s.undo)
  const modal = useUiStore((s) => s.modal)
  const openModal = useUiStore((s) => s.openModal)

  const openNew = () => openModal('new')

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
        <div className="flex min-h-0 flex-1">
          <Sidebar />
          <main className="flex min-h-0 flex-1">
            <div className="min-w-0 flex-1">
              <EditorCanvas />
            </div>
            <PreviewPane />
          </main>
        </div>
      ) : (
        <EmptyState onNew={openNew} />
      )}
      {modal === 'new' && <NewPresentationModal />}
      {modal === 'settings' && <SettingsModal />}
      {modal === 'find' && <FindReplaceModal />}
      <Toaster />
      <CloseGuard />
    </div>
  )
}

function EmptyState({ onNew }: { onNew: () => void }) {
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
        <p className="mx-auto mb-7 max-w-[24rem] text-[13px] leading-relaxed text-chrome-muted">
          Erstelle eine neue Präsentation oder öffne eine bestehende{' '}
          <code className="rounded bg-chrome-surface-2 px-1 py-0.5 font-mono text-[12px] text-chrome-secondary">
            .slideo
          </code>
          -Datei.
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
