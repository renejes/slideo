import { t, type I18nKey } from '@/i18n'
import { Icon } from './Icon'
import type { McpStatus, McpTarget } from '@/lib/mcp-registration'

// Geteilte Ziel-Karten für die MCP-Registrierung — genutzt von der Einstellungen-
// Sektion (sofortiges Umschalten) und vom Erststart-Modal (lokale Vorauswahl,
// Bestätigung per Footer-Button). Rein präsentational; die Lade-/Wechsel-Logik
// liegt beim jeweiligen Aufrufer.
//
// `label` ist ein Eigenname (Produktname) und bleibt darum im Code; der `hintKey`
// zeigt in den Katalog, weil die Zeile beschreibenden Text enthält.

export const MCP_TARGETS: { key: McpTarget; label: string; icon: string; hintKey: I18nKey }[] = [
  { key: 'desktop', label: 'Claude Desktop', icon: 'computer', hintKey: 'ui.mcp.hint.desktop' },
  { key: 'meta', label: 'Meta-MCP', icon: 'hub', hintKey: 'ui.mcp.hint.meta' },
  { key: 'claude', label: 'Claude Code', icon: 'terminal', hintKey: 'ui.mcp.hint.claude' },
]

export function mcpTargetLabel(key: McpTarget): string {
  return MCP_TARGETS.find((target) => target.key === key)?.label ?? key
}

function availLabel(key: McpTarget, available: boolean): string {
  // Der zusammengesetzte Schlüssel ist typgeprüft: `McpTarget` × yes|no ergibt
  // genau die sechs Katalog-Einträge.
  return t(`ui.mcp.avail.${key}.${available ? 'yes' : 'no'}`)
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
      {MCP_TARGETS.map((target) => {
        const st = status[target.key]
        const isSelected = selected === target.key
        const isBusy = busy === target.key
        return (
          <button
            key={target.key}
            onClick={() => onSelect(target.key)}
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
              name={target.icon}
              size={20}
              weight={400}
              className={isSelected ? 'text-chrome-accent-600' : 'text-chrome-faint'}
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5">
                <span className="text-[13px] font-medium text-chrome-text">{target.label}</span>
                {showActiveBadge && isSelected && (
                  <span className="rounded bg-chrome-accent-600 px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                    {t('ui.mcp.active')}
                  </span>
                )}
              </span>
              <span className="block truncate font-mono text-[11px] text-chrome-muted">
                {t(target.hintKey)}
              </span>
            </span>
            <span
              className={`shrink-0 text-[11px] ${
                isBusy
                  ? 'text-chrome-muted'
                  : target.key === 'meta' && !st.available
                    ? 'text-chrome-warn'
                    : 'text-chrome-faint'
              }`}
            >
              {isBusy ? t('ui.mcp.switching') : availLabel(target.key, st.available)}
            </span>
          </button>
        )
      })}
    </div>
  )
}
