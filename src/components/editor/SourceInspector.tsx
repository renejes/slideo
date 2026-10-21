import { usePresentationStore } from '@/store/presentation'
import { useLayoutStore } from '@/store/layout'
import { t } from '@/i18n'
import { Icon } from '@/components/ui/Icon'
import { ZoneCard } from './ZoneCard'

/** Optionaler Quellen-Inspector: Markdown/HTML der aktiven Folie. */
export function SourceInspector() {
  const presentation = usePresentationStore((s) => s.presentation)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const toggleInspector = useLayoutStore((s) => s.toggleInspector)

  if (!presentation) return null
  const zone =
    presentation.zones.find((z) => z.id === activeZoneId) ??
    [...presentation.zones].sort((a, b) => a.order - b.order)[0] ??
    null

  return (
    <div className="flex h-full min-h-0 flex-col border-r border-chrome-border bg-chrome-surface">
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-chrome-muted">
        <Icon name="code" size={15} weight={400} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">
          {t('ui.shell.source')}
        </span>
        <button
          type="button"
          onClick={toggleInspector}
          title={t('ui.shell.collapse', { name: t('ui.shell.source') })}
          aria-label={t('ui.shell.collapse', { name: t('ui.shell.source') })}
          className="ml-auto flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
        >
          <Icon name="chevron_left" size={18} />
        </button>
      </div>
      {zone ? (
        <ZoneCard zone={zone} />
      ) : (
        <p className="px-4 py-6 text-[13px] text-chrome-muted">{t('editor.inspector.empty')}</p>
      )}
    </div>
  )
}
