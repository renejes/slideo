import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { Icon } from './Icon'
import { McpStatusChip } from './McpStatusChip'

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
  const saveAs = usePresentationStore((s) => s.savePresentationAsDialog)
  const setTitle = usePresentationStore((s) => s.setPresentationTitle)
  const setMode = usePresentationStore((s) => s.setMode)
  const openModal = useUiStore((s) => s.openModal)
  const openAssets = useUiStore((s) => s.openAssets)

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
          {/* Titel inline umbenennbar (Review 2026-08, Befund H8): bis dahin konnte
              NUR die KI das Deck umbenennen (`set_presentation_title`) — der Mensch
              hatte kein UI dafür, obwohl der Titel Export-Dateinamen, Standalone-
              <title>, Print und PPTX treibt. */}
          <input
            value={presentation.meta.title}
            onChange={(e) => setTitle(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === 'Escape') e.currentTarget.blur()
            }}
            title="Titel der Präsentation — zum Umbenennen klicken"
            aria-label="Titel der Präsentation"
            spellCheck={false}
            className="min-w-0 max-w-[22rem] flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-chrome-secondary outline-none transition-colors hover:border-chrome-border focus:border-chrome-accent focus:bg-white focus:text-chrome-text focus:ring-2 focus:ring-chrome-accent/30"
          />
          {isDirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-chrome-warn"
              title="Ungespeicherte Änderungen"
            />
          )}
        </div>
      )}

      {/* Verbindungs-Chip (Befund B8) — links neben den Aktionen, damit er im Blick
          ist, ohne mit ihnen zu konkurrieren. */}
      <div className="ml-auto flex items-center gap-2 pr-1">
        <McpStatusChip />
      </div>

      <div className="flex items-center gap-0.5">
        <button onClick={() => openModal('new')} className={ghost}>
          <Icon name="add" size={18} />
          Neu
        </button>
        <button onClick={() => openDialog()} className={ghost} disabled={!tauri} title={fileHint}>
          <Icon name="folder_open" size={18} />
          Öffnen
        </button>
        <button
          onClick={(e) => (e.shiftKey || e.altKey ? void saveAs() : void save())}
          className={ghost}
          disabled={!presentation || !tauri}
          title={
            fileHint ??
            (filePath
              ? `Speichern: ${filePath}\nMit Shift/Alt: Speichern unter … (Cmd/Strg+Shift+S)`
              : 'Speichern unter …')
          }
        >
          <Icon name="save" size={18} />
          Speichern
        </button>
        {/* EIN Export-Knopf statt drei (Review 2026-08, Befund M55/H24). Die drei
            Formate standen gleichwertig nebeneinander, obwohl die Treue zwischen
            ihnen steil abfällt (HTML ≫ PDF ≫ PPTX) — der Nutzer erfuhr den Verlust
            erst beim Empfänger. Und „Teilen" hieß hier HTML-Export, im
            Präsentationsmodus dagegen Projektorfenster. */}
        <button
          onClick={() => openModal('export')}
          className={ghost}
          disabled={!presentation}
          title="Exportieren — HTML, PDF oder PowerPoint (mit Hinweis, was jeweils verloren geht)"
        >
          <Icon name="ios_share" size={18} />
          Exportieren
        </button>

        <span className="mx-1 h-5 w-px bg-chrome-border" />

        <button
          onClick={() => openModal('design')}
          className={ghost}
          disabled={!presentation}
          title="Design — Theme, Farben, Schriften, Logo & Folien-Übergänge"
        >
          <Icon name="palette" size={18} />
          Design
        </button>

        <button
          onClick={() => openAssets('manage')}
          className={ghost}
          disabled={!presentation}
          title="Asset-Verwaltung — Bilder, Videos & Audio importieren und verwalten"
        >
          <Icon name="perm_media" size={18} />
          Medien
        </button>

        <button
          onClick={() => openModal('find')}
          className={ghost + ' !px-2'}
          disabled={!presentation}
          title="Suchen & Ersetzen (Cmd/Ctrl+F)"
          aria-label="Suchen & Ersetzen"
        >
          <Icon name="search" size={18} />
        </button>
        <button
          onClick={() => openModal('history')}
          className={ghost + ' !px-2'}
          disabled={!presentation}
          title="Versionsverlauf — lokale Snapshots wiederherstellen"
          aria-label="Versionsverlauf"
        >
          <Icon name="history" size={18} />
        </button>
        {/* Der Lizenz-Knopf ist hier entfallen (Befund M55): er war dauerhaft
            sichtbar, aber nur in Trial/abgelaufen/widerrufen relevant — und genau
            dann bietet die LicenseBar direkt darunter bereits „Lizenz aktivieren".
            Erreichbar bleibt er über die Einstellungen. */}
        <button
          onClick={() => openModal('help')}
          className={ghost + ' !px-2'}
          title="Hilfe — wie Slideo mit deinem KI-Agenten arbeitet"
          aria-label="Hilfe"
        >
          <Icon name="help" size={18} />
        </button>
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
