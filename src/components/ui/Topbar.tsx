import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { Icon } from './Icon'

const ghost =
  'flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[13px] font-medium text-chrome-secondary ' +
  'transition-colors hover:bg-chrome-surface-2 focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-chrome-accent/40 disabled:cursor-not-allowed disabled:opacity-40 ' +
  'disabled:hover:bg-transparent'

const primary =
  'flex items-center gap-1.5 rounded-md bg-chrome-accent-600 px-3 py-1.5 text-[13px] font-medium ' +
  'text-white transition-colors hover:bg-[#2553c9] focus-visible:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-chrome-accent/40 disabled:cursor-not-allowed disabled:opacity-40 ' +
  'disabled:hover:bg-chrome-accent-600'

// Obere Leiste: Markenzeichen, Titel/Status, Datei-Aktionen, Präsentieren.
export function Topbar() {
  const presentation = usePresentationStore((s) => s.presentation)
  const isDirty = usePresentationStore((s) => s.isDirty)
  const filePath = usePresentationStore((s) => s.filePath)
  const openDialog = usePresentationStore((s) => s.openPresentationDialog)
  const save = usePresentationStore((s) => s.savePresentation)
  const setMode = usePresentationStore((s) => s.setMode)
  const openModal = useUiStore((s) => s.openModal)

  const tauri = isTauri()
  const fileHint = tauri ? undefined : 'Nur in der Desktop-App verfügbar (npm run tauri:dev)'

  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b border-chrome-border bg-chrome-surface px-3">
      {/* Markenzeichen */}
      <div className="flex items-center gap-2 pr-1">
        <span className="flex h-[22px] w-[22px] items-center justify-center rounded-[6px] bg-chrome-accent-600 text-[12px] font-bold leading-none text-white">
          S
        </span>
        <span className="text-[13px] font-semibold tracking-tight text-chrome-text">Slideo</span>
      </div>

      {presentation && (
        <div className="flex min-w-0 items-center gap-2 text-[13px]">
          <span className="text-chrome-faint">/</span>
          <span className="truncate text-chrome-secondary">{presentation.meta.title}</span>
          {isDirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-chrome-warn"
              title="Ungespeicherte Änderungen"
            />
          )}
        </div>
      )}

      <div className="ml-auto flex items-center gap-0.5">
        <button onClick={() => openModal('new')} className={ghost}>
          <Icon name="add" size={18} />
          Neu
        </button>
        <button onClick={() => openDialog()} className={ghost} disabled={!tauri} title={fileHint}>
          <Icon name="folder_open" size={18} />
          Öffnen
        </button>
        <button
          onClick={() => save()}
          className={ghost}
          disabled={!presentation || !tauri}
          title={fileHint ?? (filePath ? `Speichern: ${filePath}` : 'Speichern unter …')}
        >
          <Icon name="save" size={18} />
          Speichern
        </button>

        <span className="mx-1 h-5 w-px bg-chrome-border" />

        <button
          onClick={() => openModal('settings')}
          className={ghost + ' !px-2'}
          title="Einstellungen"
          aria-label="Einstellungen"
        >
          <Icon name="settings" size={18} />
        </button>

        <button
          onClick={() => setMode('presentation')}
          className={primary + ' ml-1.5'}
          disabled={!presentation}
        >
          <Icon name="play_arrow" size={18} fill weight={400} />
          Präsentieren
        </button>
      </div>
    </header>
  )
}
