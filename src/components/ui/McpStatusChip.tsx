import { useEffect, useState } from 'react'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { t } from '@/i18n'
import { getMcpActivity, type McpActivity } from '@/lib/mcp-registration'

// Verbindungs-Anzeige für den KI-Kanal (Review 2026-08, Befund B8).
//
// Die MCP-Verbindung war prinzipiell unbeobachtbar: der IPC-Server trackte keine
// Session, das Frontend zeigte nichts, und — der eigentliche Fallstrick — der
// `slideo mcp`-Prozess beantwortet `initialize`/`tools/list` LOKAL. Der KI-Client
// meldet also „38 Tools, gesund", auch wenn Slideo gar nicht läuft; erst der erste
// echte Tool-Call scheitert. Der realistische Erststart war deshalb: konfigurieren →
// Prompt einfügen → „Ich habe keine Slideo-Tools" → Ende, ohne jeden Anhaltspunkt.
//
// Dieser Chip zeigt bewusst NICHT „registriert" (das hieße nur „wir haben eine Zeile
// in eine JSON geschrieben"), sondern wann zuletzt wirklich ein Tool ausgeführt wurde.

/** Nach dieser Ruhe gilt die Verbindung als „nicht mehr frisch". */
const FRESH_MS = 90_000
const POLL_MS = 5_000

function ago(ms: number): string {
  const s = Math.max(0, Math.round(ms / 1000))
  if (s < 60) return t('ui.chip.agoSec', { n: s })
  const m = Math.round(s / 60)
  if (m < 60) return t('ui.chip.agoMin', { n: m })
  return t('ui.chip.agoHour', { n: Math.round(m / 60) })
}

export function McpStatusChip() {
  const openModal = useUiStore((s) => s.openModal)
  const [activity, setActivity] = useState<McpActivity | null>(null)
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    if (!isTauri()) return
    let alive = true
    const tick = () => {
      setNow(Date.now())
      void getMcpActivity()
        .then((a) => {
          if (alive) setActivity(a)
        })
        .catch(() => {})
    }
    tick()
    const id = setInterval(tick, POLL_MS)
    return () => {
      alive = false
      clearInterval(id)
    }
  }, [])

  if (!isTauri()) return null

  const since = activity ? now - activity.at_ms : Infinity
  const fresh = since < FRESH_MS
  // Drei Zustände statt zwei: „noch nie" ist etwas anderes als „stumm geworden".
  const label = !activity
    ? t('ui.chip.disconnected')
    : fresh
      ? t('ui.chip.connected')
      : t('ui.chip.idle', { ago: ago(since) })
  const title = !activity
    ? t('ui.chip.titleNever')
    : t('ui.chip.titleLast', { tool: activity.tool, ago: ago(since) }) +
      (activity.client_version
        ? '\n' + t('ui.chip.titleVersion', { version: activity.client_version })
        : '')

  return (
    <button
      onClick={() => openModal('settings')}
      title={title}
      aria-label={label}
      className={
        'flex shrink-0 items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium ' +
        'transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
        (fresh
          ? 'border-chrome-accent/30 bg-chrome-accent-soft text-chrome-accent-600'
          : 'border-chrome-border text-chrome-faint hover:text-chrome-secondary')
      }
    >
      <span
        className={
          'h-1.5 w-1.5 rounded-full ' + (fresh ? 'bg-chrome-accent-600' : 'bg-chrome-border-strong')
        }
      />
      {label}
    </button>
  )
}
