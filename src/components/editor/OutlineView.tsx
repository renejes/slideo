import { useEffect, useState } from 'react'
import type { Zone } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { hasHeading, parseOutline, recombineOutline } from '@/lib/outline'
import { Icon } from '@/components/ui/Icon'

/**
 * Strukturelle Aktion (Reorder/Einfügen/Löschen) aus der Gliederung: vorher den
 * Fokus aus dem Textfeld nehmen. Sonst bleibt im WKWebView der Fokus im
 * Input/Textarea (ein Button-Klick fokussiert dort nicht), und der globale
 * Cmd/Z-Undo-Guard (App.tsx) würde die Aktion fälschlich als „im Editor" werten
 * und das native Feld-Undo statt des Store-Undos auslösen.
 */
function runStructural(fn: () => void) {
  ;(document.activeElement as HTMLElement | null)?.blur()
  fn()
}

// Outline-Modus (Spec §19.9): alle Folientexte als editierbare Gliederung.
// Bearbeitet ausschließlich das bestehende Markdown (Titel = erste Überschrift,
// Rumpf = Rest) — verlustfreier Round-Trip, kein Datenmodell-Eingriff.
export function OutlineView() {
  const presentation = usePresentationStore((s) => s.presentation)
  const reorderZones = usePresentationStore((s) => s.reorderZones)
  const createZone = usePresentationStore((s) => s.createZone)

  if (!presentation) return null
  const zones = [...presentation.zones].sort((a, b) => a.order - b.order)

  function move(index: number, dir: -1 | 1) {
    const ids = zones.map((z) => z.id)
    const j = index + dir
    if (j < 0 || j >= ids.length) return
    ;[ids[index], ids[j]] = [ids[j], ids[index]]
    runStructural(() => reorderZones(ids))
  }

  return (
    <div className="h-full overflow-y-auto bg-chrome-bg">
      <div className="mx-auto flex max-w-3xl flex-col gap-3 px-6 py-7">
        <header className="mb-1">
          <h1 className="text-[15px] font-semibold tracking-tight text-chrome-text">Gliederung</h1>
          <p className="mt-0.5 text-[12px] text-chrome-muted">
            Alle Folientexte als Liste — Titel + Inhalt (Markdown) direkt bearbeiten. Änderungen
            wirken sofort in den Folien.
          </p>
        </header>

        {zones.length === 0 && (
          <p className="rounded-xl border border-dashed border-chrome-border-strong px-4 py-6 text-center text-[13px] text-chrome-muted">
            Noch keine Folien.
          </p>
        )}

        {zones.map((zone, index) => (
          <OutlineRow
            key={zone.id}
            zone={zone}
            index={index}
            total={zones.length}
            onMoveUp={() => move(index, -1)}
            onMoveDown={() => move(index, 1)}
          />
        ))}

        <button
          onClick={() => runStructural(() => createZone(zones[zones.length - 1]?.id))}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-dashed border-chrome-border-strong py-3 text-[13px] font-medium text-chrome-muted transition-colors hover:border-chrome-accent hover:bg-chrome-accent-soft hover:text-chrome-accent-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
        >
          <Icon name="add" size={18} />
          Slide hinzufügen
        </button>
      </div>
    </div>
  )
}

const iconBtn =
  'flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors ' +
  'hover:bg-chrome-surface-2 hover:text-chrome-text focus:outline-none focus-visible:ring-2 ' +
  'focus-visible:ring-chrome-accent/40 disabled:cursor-not-allowed disabled:opacity-30 ' +
  'disabled:hover:bg-transparent disabled:hover:text-chrome-muted'

function OutlineRow({
  zone,
  index,
  total,
  onMoveUp,
  onMoveDown,
}: {
  zone: Zone
  index: number
  total: number
  onMoveUp: () => void
  onMoveDown: () => void
}) {
  const updateZoneMarkdown = usePresentationStore((s) => s.updateZoneMarkdown)
  const deleteZone = usePresentationStore((s) => s.deleteZone)
  const createZone = usePresentationStore((s) => s.createZone)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const setEditorView = useUiStore((s) => s.setEditorView)

  const isHtml = zone.content_type === 'html'
  const isActive = activeZoneId === zone.id

  // Lokaler Editierzustand (wie TiptapEditor): der Markdown-Inhalt der Zone wird in
  // Titel/Rumpf zerlegt; geschrieben wird bei jeder Änderung. Externe Änderungen
  // (Undo, MCP, Editor) werden übernommen, sobald sie sich vom lokalen Stand
  // unterscheiden — sonst springt der Cursor beim Tippen.
  const [level, setLevel] = useState(() => parseOutline(zone.markdown).level)
  const [title, setTitle] = useState(() => parseOutline(zone.markdown).title)
  const [body, setBody] = useState(() => parseOutline(zone.markdown).body)

  useEffect(() => {
    if (isHtml) return
    if (recombineOutline({ level, title, body }) !== zone.markdown) {
      const p = parseOutline(zone.markdown)
      // Überschriften-Ebene nur übernehmen, wenn das Markdown wirklich eine
      // Überschrift hat — sonst die bisherige Ebene behalten (sonst würde ein
      // kurzzeitig titelloser Stand die Ebene auf 1 zurücksetzen, z.B. H3→H1).
      setLevel((prev) => (hasHeading(zone.markdown) ? p.level : prev))
      setTitle(p.title)
      setBody(p.body)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zone.markdown, isHtml])

  function onTitle(value: string) {
    setTitle(value)
    updateZoneMarkdown(zone.id, recombineOutline({ level, title: value, body }))
  }
  function onBody(value: string) {
    setBody(value)
    updateZoneMarkdown(zone.id, recombineOutline({ level, title, body: value }))
  }

  function openInEditor() {
    setActiveZone(zone.id)
    setEditorView('slides')
  }

  const bodyRows = Math.min(16, Math.max(2, body.split('\n').length))

  return (
    <div
      onMouseDown={() => setActiveZone(zone.id)}
      className={
        'overflow-hidden rounded-xl border bg-chrome-surface shadow-card transition-colors ' +
        (isHtml
          ? 'border-chrome-warn/30 '
          : isActive
            ? 'border-chrome-accent/60 ring-1 ring-chrome-accent/30 '
            : 'border-chrome-border hover:border-chrome-border-strong ')
      }
    >
      <div className="flex items-center gap-2 border-b border-chrome-border px-3 py-1.5">
        <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-chrome-surface-2 text-[11px] font-semibold tabular-nums text-chrome-muted">
          {index + 1}
        </span>
        <span className="truncate text-[12px] text-chrome-faint">{zone.label}</span>
        {isHtml && (
          <span className="flex items-center gap-1 rounded bg-chrome-warn-soft px-1.5 py-0.5 text-[10px] font-semibold text-chrome-warn">
            <Icon name="code" size={12} weight={500} />
            HTML
          </span>
        )}
        <div className="ml-auto flex items-center gap-0.5">
          <button onClick={onMoveUp} disabled={index === 0} className={iconBtn} title="Nach oben" aria-label="Folie nach oben">
            <Icon name="arrow_upward" size={16} weight={400} />
          </button>
          <button onClick={onMoveDown} disabled={index === total - 1} className={iconBtn} title="Nach unten" aria-label="Folie nach unten">
            <Icon name="arrow_downward" size={16} weight={400} />
          </button>
          <button onClick={openInEditor} className={iconBtn} title="Im Folien-Editor öffnen" aria-label="Im Folien-Editor öffnen">
            <Icon name="edit" size={16} weight={400} />
          </button>
          <button onClick={() => runStructural(() => createZone(zone.id))} className={iconBtn} title="Slide danach einfügen" aria-label="Slide danach einfügen">
            <Icon name="add" size={16} weight={400} />
          </button>
          <button
            onClick={() => runStructural(() => deleteZone(zone.id))}
            className={iconBtn + ' hover:!bg-chrome-danger/10 hover:!text-chrome-danger'}
            title="Slide löschen"
            aria-label="Slide löschen"
          >
            <Icon name="delete" size={16} weight={400} />
          </button>
        </div>
      </div>

      <div className="px-4 py-3">
        {isHtml ? (
          <div className="flex items-center gap-2 text-[13px] text-chrome-muted">
            <Icon name="bolt" size={15} weight={400} className="text-chrome-warn" />
            HTML-Folie — Inhalt im Folien-Editor bearbeiten.
            <button
              onClick={openInEditor}
              className="ml-1 text-[12px] font-medium text-chrome-accent-600 hover:underline"
            >
              Öffnen
            </button>
          </div>
        ) : (
          <>
            <input
              value={title}
              onChange={(e) => onTitle(e.target.value)}
              onFocus={() => setActiveZone(zone.id)}
              placeholder="Titel der Folie"
              className="w-full rounded-md border border-transparent bg-transparent px-1 py-0.5 text-[16px] font-semibold text-chrome-text placeholder:font-normal placeholder:text-chrome-faint focus:border-chrome-accent focus:bg-white focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
              aria-label={`Titel von ${zone.label}`}
            />
            <textarea
              value={body}
              onChange={(e) => onBody(e.target.value)}
              onFocus={() => setActiveZone(zone.id)}
              rows={bodyRows}
              spellCheck
              placeholder="Inhalt (Markdown) — z.B. - Stichpunkt"
              className="mt-1.5 w-full resize-y rounded-md border border-chrome-border bg-chrome-bg px-2.5 py-2 text-[13px] leading-relaxed text-chrome-text placeholder:text-chrome-faint focus:border-chrome-accent focus:bg-white focus:outline-none focus:ring-1 focus:ring-chrome-accent/30"
              aria-label={`Inhalt von ${zone.label}`}
            />
          </>
        )}
      </div>
    </div>
  )
}
