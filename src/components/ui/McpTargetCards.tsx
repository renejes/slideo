import { Icon } from './Icon'
import type { McpStatus, McpTarget } from '@/lib/mcp-registration'

// Geteilte Ziel-Karten für die MCP-Registrierung — genutzt von der Einstellungen-
// Sektion (sofortiges Umschalten) und vom Erststart-Modal (lokale Vorauswahl,
// Bestätigung per Footer-Button). Rein präsentational; die Lade-/Wechsel-Logik
// liegt beim jeweiligen Aufrufer.

export const MCP_TARGETS: { key: McpTarget; label: string; icon: string; hint: string }[] = [
  { key: 'desktop', label: 'Claude Desktop', icon: 'computer', hint: 'claude_desktop_config.json' },
  { key: 'meta', label: 'Meta-MCP', icon: 'hub', hint: 'localhost:3663 · Aggregator-Proxy' },
  { key: 'claude', label: 'Claude Code', icon: 'terminal', hint: '~/.claude.json · User-Scope' },
]

export function mcpTargetLabel(key: McpTarget): string {
  return MCP_TARGETS.find((t) => t.key === key)?.label ?? key
}

function availLabel(key: McpTarget, available: boolean): string {
  if (available) return key === 'meta' ? 'Läuft' : key === 'desktop' ? 'Installiert' : 'Erkannt'
  return key === 'meta'
    ? 'Nicht erreichbar'
    : key === 'desktop'
      ? 'Nicht installiert'
      : 'Nicht erkannt'
}

interface McpTargetCardsProps {
  status: McpStatus
  /** Hervorgehobenes Ziel (aktiv in den Einstellungen bzw. lokale Auswahl im Modal). */
  selected: McpTarget
  /** Ziel, dessen Umschaltung gerade läuft (zeigt „Wechsle…"), oder null. */
  busy?: McpTarget | null
  /** Alle Karten deaktivieren (z.B. während eines laufenden Wechsels). */
  disabled?: boolean
  /** „Aktiv"-Badge auf der gewählten Karte zeigen (Einstellungen) — im Setup aus. */
  showActiveBadge?: boolean
  onSelect: (key: McpTarget) => void
}

export function McpTargetCards({
  status,
  selected,
  busy = null,
  disabled = false,
  showActiveBadge = false,
  onSelect,
}: McpTargetCardsProps) {
  return (
    <div className="flex flex-col gap-1.5">
      {MCP_TARGETS.map((t) => {
        const st = status[t.key]
        const isSelected = selected === t.key
        const isBusy = busy === t.key
        return (
          <button
            key={t.key}
            onClick={() => onSelect(t.key)}
            disabled={disabled}
            aria-pressed={isSelected}
            className={`flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 disabled:cursor-default ${
              isSelected
                ? 'border-chrome-accent bg-chrome-accent-soft'
                : 'border-chrome-border hover:border-chrome-border-strong disabled:hover:border-chrome-border'
            }`}
          >
            <span
              className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full border ${
                isSelected ? 'border-chrome-accent-600' : 'border-chrome-border-strong'
              }`}
            >
              {isSelected && <span className="h-2 w-2 rounded-full bg-chrome-accent-600" />}
            </span>
            <Icon
              name={t.icon}
              size={20}
              weight={400}
              className={isSelected ? 'text-chrome-accent-600' : 'text-chrome-faint'}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-chrome-text">{t.label}</span>
                {showActiveBadge && isSelected && (
                  <span className="rounded bg-chrome-accent-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    Aktiv
                  </span>
                )}
              </span>
              <span className="block truncate font-mono text-[11px] text-chrome-muted">
                {t.hint}
              </span>
            </span>
            <span
              className={`shrink-0 text-[11px] ${
                isBusy
                  ? 'text-chrome-muted'
                  : t.key === 'meta' && !st.available
                    ? 'text-chrome-warn'
                    : 'text-chrome-faint'
              }`}
            >
              {isBusy ? 'Wechsle…' : availLabel(t.key, st.available)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
