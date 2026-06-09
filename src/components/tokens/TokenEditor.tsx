import { TOKEN_FIELDS } from '@/types'
import { usePresentationStore } from '@/store/presentation'

// Sidebar zum Bearbeiten der Design Tokens (CSS Custom Properties).
export function TokenEditor() {
  const presentation = usePresentationStore((s) => s.presentation)
  const setToken = usePresentationStore((s) => s.setToken)
  const resetTokens = usePresentationStore((s) => s.resetTokens)

  if (!presentation) return null
  const tokens = presentation.tokens

  return (
    <div className="flex h-full flex-col">
      <div className="flex items-center justify-between px-3 py-2">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
          Design-Tokens
        </span>
        <button
          onClick={resetTokens}
          className="rounded-md px-2 py-1 text-[12px] text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title="Alle Tokens zurücksetzen"
        >
          Zurücksetzen
        </button>
      </div>

      <div className="flex flex-col gap-2.5 overflow-y-auto px-3 pb-4">
        {TOKEN_FIELDS.map((field) => {
          const value = tokens[field.key] ?? ''
          return (
            <label key={field.key} className="flex flex-col gap-1">
              <span className="text-[11px] font-medium text-chrome-muted">{field.label}</span>
              <div className="flex items-center gap-2">
                {field.kind === 'color' && (
                  <input
                    type="color"
                    value={normalizeColor(value)}
                    onChange={(e) => setToken(field.key, e.target.value)}
                    className="h-7 w-7 shrink-0 cursor-pointer rounded-md border border-chrome-border bg-white p-0.5"
                    aria-label={`${field.label} Farbe`}
                  />
                )}
                <input
                  type="text"
                  value={value}
                  onChange={(e) => setToken(field.key, e.target.value)}
                  className="w-full rounded-md border border-chrome-border bg-white px-2 py-1.5 font-mono text-[12px] text-chrome-text transition-colors focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
                />
              </div>
            </label>
          )
        })}
      </div>
    </div>
  )
}

/** Color-Input erwartet `#rrggbb`; nicht-hex Werte werden auf Schwarz abgebildet. */
function normalizeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : '#000000'
}
