import { memo, useRef, useState, lazy, Suspense } from 'react'
import type { Zone } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { t, tp } from '@/i18n'
import { T } from '@/i18n/T'
import { TiptapEditor } from './TiptapEditor'
import { Icon } from '@/components/ui/Icon'

// CodeMirror-basierte Editoren lazy laden (Audit P8): CodeMirror wird nur für HTML-Zonen
// bzw. das (standardmäßig eingeklappte) Custom-CSS-Panel gebraucht — reine Markdown-Decks
// laden den Chunk nie. Der Tiptap-Editor bleibt eager (jede Markdown-Folie braucht ihn sofort).
const HtmlEditor = lazy(() => import('./HtmlEditor').then((m) => ({ default: m.HtmlEditor })))
const CssEditor = lazy(() => import('./CssEditor').then((m) => ({ default: m.CssEditor })))

/** Platzhalter, solange ein lazy CodeMirror-Editor-Chunk lädt (i.d.R. ein Frame). */
function EditorFallback() {
  return <div className="h-24 animate-pulse rounded-lg bg-chrome-surface-2" />
}

interface ZoneCardProps {
  zone: Zone
}

// Quellen-Inspector für genau eine Folie: Markdown/HTML + CSS + Notizen.
// Umsortieren läuft über den Filmstrip; Folien-Tools sitzen in der Bühnen-Toolbar.
function ZoneCardBase({ zone }: ZoneCardProps) {
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const updateZoneMarkdown = usePresentationStore((s) => s.updateZoneMarkdown)
  const updateZoneHtml = usePresentationStore((s) => s.updateZoneHtml)

  const isHtml = zone.content_type === 'html'
  const overflowPx = useUiStore((s) => s.overflowZones[zone.id] ?? 0)

  const [dragOver, setDragOver] = useState(false)
  const dragDepth = useRef(0)

  function hasFiles(e: React.DragEvent) {
    return Array.from(e.dataTransfer.types).includes('Files')
  }
  function onDragEnter(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current += 1
    setDragOver(true)
  }
  function onDragOver(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    e.dataTransfer.dropEffect = 'copy'
  }
  function onDragLeave(e: React.DragEvent) {
    if (!hasFiles(e)) return
    dragDepth.current = Math.max(0, dragDepth.current - 1)
    if (dragDepth.current === 0) setDragOver(false)
  }
  async function onDrop(e: React.DragEvent) {
    if (!hasFiles(e)) return
    e.preventDefault()
    dragDepth.current = 0
    setDragOver(false)
    setActiveZone(zone.id)
    await dropMediaOnZone(zone.id, e.dataTransfer.files)
  }

  return (
    <div
      id={`card-${zone.id}`}
      onDragEnter={onDragEnter}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className="relative flex min-h-0 flex-1 flex-col overflow-hidden bg-chrome-surface"
    >
      {dragOver && (
        <div className="pointer-events-none absolute inset-0 z-20 flex items-center justify-center border-2 border-dashed border-chrome-accent bg-chrome-accent-soft/85">
          <span className="flex items-center gap-1.5 text-[13px] font-semibold text-chrome-accent-600">
            <Icon name="image" size={18} weight={400} />
            {t('editor.card.dropMedia')}
          </span>
        </div>
      )}

      {overflowPx > 0 && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-chrome-warn/15 bg-chrome-warn-soft px-4 py-1.5 text-[12px]">
          <Icon name="warning" size={14} weight={500} className="text-chrome-warn" />
          <span className="font-semibold text-chrome-warn">{t('editor.card.overflowTitle')}</span>
          <span className="text-chrome-warn/70">
            {t('editor.card.overflowDetail', { px: overflowPx })}
          </span>
        </div>
      )}

      {isHtml && (
        <div className="flex shrink-0 items-center gap-1.5 border-b border-chrome-warn/15 bg-chrome-warn-soft px-4 py-1.5 text-[12px]">
          <Icon name="bolt" size={14} weight={500} className="text-chrome-warn" />
          <span className="font-semibold text-chrome-warn">{t('editor.card.htmlBadge')}</span>
          <span className="text-chrome-warn/70">{t('editor.card.htmlHint')}</span>
        </div>
      )}

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="px-4 py-3.5">
          {isHtml ? (
            <Suspense fallback={<EditorFallback />}>
              <HtmlEditor
                zoneId={zone.id}
                initialHtml={zone.html ?? ''}
                onChange={(value) => updateZoneHtml(zone.id, value)}
                onFocus={() => setActiveZone(zone.id)}
              />
            </Suspense>
          ) : (
            <TiptapEditor
              zoneId={zone.id}
              initialMarkdown={zone.markdown}
              onChange={(value) => updateZoneMarkdown(zone.id, value)}
              onFocus={() => setActiveZone(zone.id)}
            />
          )}
        </div>
        <CssPanel zone={zone} />
        <NotesPanel zone={zone} />
      </div>
    </div>
  )
}

/** Dateien auf die aktive Folie legen (Canvas, Inspector, Filmstrip-Chrome). */
export async function dropMediaOnZone(zoneId: string, list: FileList | File[]): Promise<void> {
  const all = Array.from(list)
  const files = all.filter((f) => /^(image|video|audio)\//.test(f.type))
  if (files.length === 0) {
    if (all.length > 0) notify(t('editor.card.mediaTypeOnly'), 'info')
    return
  }
  const add = usePresentationStore.getState().addMediaToZone
  let failed = 0
  for (const f of files) {
    try {
      add(zoneId, await fileToDataUri(f))
    } catch {
      failed++
    }
  }
  if (failed > 0) notify(tp('editor.card.mediaReadFailed', failed), 'error')
}

/** Liest eine Datei als Data-URI (für den Drag&Drop-Import). */
export function fileToDataUri(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () =>
      typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('read failed'))
    reader.onerror = () => reject(reader.error ?? new Error('read failed'))
    reader.readAsDataURL(file)
  })
}

function CssPanel({ zone }: { zone: Zone }) {
  const updateZoneCss = usePresentationStore((s) => s.updateZoneCss)
  const cssValue = zone.custom_css ?? ''
  const hasCss = !!cssValue.trim()
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-chrome-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-chrome-muted transition-colors hover:text-chrome-text"
      >
        <Icon name={open ? 'expand_more' : 'chevron_right'} size={16} weight={400} />
        <Icon name="format_paint" size={15} weight={400} />
        {t('editor.card.cssTitle')}
        {hasCss && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-chrome-accent-600"
            title={t('editor.card.cssActive')}
          />
        )}
        <span className="ml-auto text-[11px] text-chrome-faint">{t('editor.card.cssScope')}</span>
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          <Suspense fallback={<EditorFallback />}>
            <CssEditor initialCss={cssValue} onChange={(value) => updateZoneCss(zone.id, value)} />
          </Suspense>
          <p className="mt-1.5 text-[11px] text-chrome-faint">
            <T
              k="editor.card.cssHint"
              slots={[
                <code className="font-mono">h1 {'{'} letter-spacing: -.02em {'}'}</code>,
                <code className="font-mono">var(--color-accent)</code>,
              ]}
            />
          </p>
        </div>
      )}
    </div>
  )
}

function NotesPanel({ zone }: { zone: Zone }) {
  const updateZoneNotes = usePresentationStore((s) => s.updateZoneNotes)
  const notes = zone.notes ?? ''
  const hasNotes = !!notes.trim()
  const [open, setOpen] = useState(false)

  return (
    <div className="border-t border-chrome-border">
      <button
        onClick={() => setOpen((o) => !o)}
        className="flex w-full items-center gap-1.5 px-4 py-2 text-[12px] font-medium text-chrome-muted transition-colors hover:text-chrome-text"
      >
        <Icon name={open ? 'expand_more' : 'chevron_right'} size={16} weight={400} />
        <Icon name="sticky_note_2" size={15} weight={400} />
        {t('editor.card.notesTitle')}
        {hasNotes && (
          <span
            className="h-1.5 w-1.5 rounded-full bg-chrome-accent-600"
            title={t('editor.card.notesPresent')}
          />
        )}
        <span className="ml-auto text-[11px] text-chrome-faint">{t('editor.card.notesScope')}</span>
      </button>
      {open && (
        <div className="px-4 pb-3.5">
          <textarea
            value={notes}
            onChange={(e) => updateZoneNotes(zone.id, e.target.value)}
            placeholder={t('editor.card.notesPlaceholder')}
            rows={3}
            className="w-full resize-y rounded-lg border border-chrome-border bg-chrome-bg px-3 py-2 text-[13px] leading-relaxed text-chrome-text placeholder:text-chrome-faint focus:border-chrome-accent focus:outline-none focus:ring-1 focus:ring-chrome-accent/30"
          />
        </div>
      )}
    </div>
  )
}

export const ZoneCard = memo(ZoneCardBase)
