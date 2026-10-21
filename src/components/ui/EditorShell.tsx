import { useEffect, useRef, useState } from 'react'
import {
  useLayoutStore,
  CANVAS_MIN,
  INSPECTOR_MIN,
  CHAT_MIN,
} from '@/store/layout'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { t } from '@/i18n'
import { Icon } from './Icon'
import { Splitter } from './Splitter'
import { SourceInspector } from '@/components/editor/SourceInspector'
import { SlideFilmstrip } from '@/components/editor/SlideFilmstrip'
import { ZoneToolbar } from '@/components/editor/ZoneToolbar'
import { PreviewPane } from '@/components/preview/PreviewPane'
import { ChatPanel } from '@/components/chat/ChatPanel'

const SPLIT_W = 6
const RAIL_W = 36

/**
 * Canvas-first-Arbeitsfläche: Bühne (eine Folie) · Chat rechts · Filmstrip unten.
 * Quellen-Inspector optional links der Bühne. Folien-Tools gelten nur für die
 * offene Folie; Brand Kit bleibt deck-weit in der Topbar.
 */
export function EditorShell() {
  const showInspector = useLayoutStore((s) => s.showInspector)
  const inspectorWidth = useLayoutStore((s) => s.inspectorWidth)
  const showChat = useLayoutStore((s) => s.showChat)
  const chatWidth = useLayoutStore((s) => s.chatWidth)
  const nudgeInspector = useLayoutStore((s) => s.nudgeInspector)
  const nudgeChat = useLayoutStore((s) => s.nudgeChat)
  const toggleChat = useLayoutStore((s) => s.toggleChat)
  const toggleInspector = useLayoutStore((s) => s.toggleInspector)

  const presentation = usePresentationStore((s) => s.presentation)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const previewEdit = useUiStore((s) => s.previewEdit)
  const togglePreviewEdit = useUiStore((s) => s.togglePreviewEdit)

  const ref = useRef<HTMLDivElement>(null)
  const [avail, setAvail] = useState(() =>
    typeof window !== 'undefined' ? window.innerWidth : 1200,
  )
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver((entries) => {
      const w = entries[0]?.contentRect.width
      if (w) setAvail(w)
    })
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  let iFixed = showInspector ? inspectorWidth : 0
  let cFixed = showChat ? chatWidth : 0
  const rails = showChat ? 0 : RAIL_W
  const splits = (iFixed > 0 ? SPLIT_W : 0) + (cFixed > 0 ? SPLIT_W : 0)
  let over = iFixed + cFixed + rails + splits + CANVAS_MIN - avail
  if (over > 0 && cFixed > 0) {
    const cut = Math.min(over, Math.max(0, cFixed - CHAT_MIN))
    cFixed -= cut
    over -= cut
  }
  if (over > 0 && iFixed > 0) {
    iFixed -= Math.min(over, Math.max(0, iFixed - INSPECTOR_MIN))
  }

  const zone =
    presentation &&
    (presentation.zones.find((z) => z.id === activeZoneId) ??
      [...presentation.zones].sort((a, b) => a.order - b.order)[0])

  return (
    <div ref={ref} className="flex min-h-0 flex-1 overflow-hidden">
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {showInspector && (
            <>
              <div className="min-h-0 shrink-0" style={{ width: iFixed }}>
                <SourceInspector />
              </div>
              <Splitter
                onDelta={(dx) => nudgeInspector(dx)}
                ariaLabel={t('ui.shell.resizeInspector')}
              />
            </>
          )}
          <div className="flex min-h-0 min-w-0 flex-1 flex-col">
            {zone && (
              <div className="flex min-h-9 shrink-0 flex-wrap items-center gap-1.5 border-b border-chrome-border bg-chrome-surface px-2.5 py-1">
                <ZoneToolbar zone={zone} />
                <button
                  type="button"
                  onClick={togglePreviewEdit}
                  aria-pressed={previewEdit}
                  title={t('present.preview.directEditHint')}
                  className={
                    'flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
                    (previewEdit
                      ? 'bg-chrome-accent-soft text-chrome-accent-600'
                      : 'text-chrome-muted hover:bg-chrome-surface-2 hover:text-chrome-text')
                  }
                >
                  <Icon name="arrow_selector_tool" size={15} weight={400} />
                  {t('present.preview.directEdit')}
                </button>
                <button
                  type="button"
                  onClick={toggleInspector}
                  aria-pressed={showInspector}
                  title={t('ui.shell.sourceHint')}
                  className={
                    'flex h-7 items-center gap-1.5 rounded-md px-2 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
                    (showInspector
                      ? 'bg-chrome-accent-soft text-chrome-accent-600'
                      : 'text-chrome-muted hover:bg-chrome-surface-2 hover:text-chrome-text')
                  }
                >
                  <Icon name="code" size={15} weight={400} />
                  {t('ui.shell.source')}
                </button>
              </div>
            )}
            <div className="min-h-0 min-w-0 flex-1">
              <PreviewPane />
            </div>
          </div>
        </div>
        <SlideFilmstrip />
      </div>

      {showChat && (
        <Splitter onDelta={(dx) => nudgeChat(-dx)} ariaLabel={t('ui.shell.resizeChat')} />
      )}
      <div
        className={
          'min-h-0 shrink-0 border-l border-chrome-border' + (showChat ? '' : ' hidden')
        }
        style={showChat ? { width: cFixed } : undefined}
        aria-hidden={!showChat}
      >
        <ChatPanel onCollapse={toggleChat} />
      </div>
      {!showChat && (
        <CollapsedRail
          side="right"
          icon="chat"
          label={t('chat.title')}
          onExpand={toggleChat}
        />
      )}
    </div>
  )
}

function CollapsedRail({
  side,
  icon,
  label,
  onExpand,
}: {
  side: 'left' | 'right'
  icon: string
  label: string
  onExpand: () => void
}) {
  const border = side === 'left' ? 'border-r' : 'border-l'
  return (
    <button
      onClick={onExpand}
      title={t('ui.shell.expand', { name: label })}
      aria-label={t('ui.shell.expand', { name: label })}
      className={
        'group flex w-9 shrink-0 flex-col items-center gap-2 bg-chrome-bg py-2 text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-chrome-accent/40 ' +
        border +
        ' border-chrome-border'
      }
    >
      <span className="flex h-7 w-7 items-center justify-center">
        <Icon name={icon} size={18} />
      </span>
      <span className="mt-1 select-none text-[10px] font-semibold uppercase tracking-wider text-chrome-faint [writing-mode:vertical-rl] group-hover:text-chrome-muted">
        {label}
      </span>
    </button>
  )
}
