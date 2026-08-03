import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { t } from '@/i18n'
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
  const fileHint = tauri ? undefined : t('common.desktopOnlyHint')

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
            title={t('ui.topbar.titleHint')}
            aria-label={t('ui.topbar.titleAria')}
            spellCheck={false}
            className="min-w-0 max-w-[22rem] flex-1 truncate rounded border border-transparent bg-transparent px-1 py-0.5 text-chrome-secondary outline-none transition-colors hover:border-chrome-border focus:border-chrome-accent focus:bg-white focus:text-chrome-text focus:ring-2 focus:ring-chrome-accent/30"
          />
          {isDirty && (
            <span
              className="h-1.5 w-1.5 shrink-0 rounded-full bg-chrome-warn"
              title={t('ui.unsavedChanges')}
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
          {t('ui.topbar.new')}
        </button>
        <button onClick={() => openDialog()} className={ghost} disabled={!tauri} title={fileHint}>
          <Icon name="folder_open" size={18} />
          {t('ui.topbar.open')}
        </button>
        <button
          onClick={(e) => (e.shiftKey || e.altKey ? void saveAs() : void save())}
          className={ghost}
          disabled={!presentation || !tauri}
          title={
            fileHint ??
            (filePath
              ? t('ui.topbar.saveHint', { path: filePath })
              : t('ui.topbar.saveAsHint'))
          }
        >
          <Icon name="save" size={18} />
          {t('common.save')}
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
          title={t('ui.topbar.exportHint')}
        >
          <Icon name="ios_share" size={18} />
          {t('ui.topbar.export')}
        </button>

        <span className="mx-1 h-5 w-px bg-chrome-border" />

        <button
          onClick={() => openModal('design')}
          className={ghost}
          disabled={!presentation}
          title={t('ui.topbar.designHint')}
        >
          <Icon name="palette" size={18} />
          {t('ui.topbar.design')}
        </button>

        <button
          onClick={() => openAssets('manage')}
          className={ghost}
          disabled={!presentation}
          title={t('ui.topbar.mediaHint')}
        >
          <Icon name="perm_media" size={18} />
          {t('ui.topbar.media')}
        </button>

        <button
          onClick={() => openModal('find')}
          className={ghost + ' !px-2'}
          disabled={!presentation}
          title={t('ui.topbar.findHint')}
          aria-label={t('ui.topbar.find')}
        >
          <Icon name="search" size={18} />
        </button>
        <button
          onClick={() => openModal('history')}
          className={ghost + ' !px-2'}
          disabled={!presentation}
          title={t('ui.topbar.historyHint')}
          aria-label={t('ui.topbar.history')}
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
          title={t('ui.topbar.helpHint')}
          aria-label={t('ui.topbar.help')}
        >
          <Icon name="help" size={18} />
        </button>
        <button
          onClick={() => openModal('settings')}
          className={ghost + ' !px-2'}
          title={t('ui.topbar.settings')}
          aria-label={t('ui.topbar.settings')}
        >
          <Icon name="settings" size={18} />
        </button>

        <button
          onClick={() => setMode('presentation')}
          className={primary + ' ml-1.5'}
          disabled={!presentation}
        >
          <Icon name="play_arrow" size={18} fill weight={400} />
          {t('ui.topbar.present')}
        </button>
      </div>
    </header>
  )
}
