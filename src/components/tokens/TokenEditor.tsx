import { useRef } from 'react'
import {
  TOKEN_FIELDS,
  TRANSITIONS,
  SYSTEM_FONTS,
  LOGO_POSITIONS,
  type TransitionKind,
  type LogoPosition,
} from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { PRESETS, type Preset } from '@/lib/presets'
import { contrastRatio, rateContrast } from '@/lib/contrast'
import { Icon } from '@/components/ui/Icon'

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

      <div className="overflow-y-auto">
        <ThemePicker />

        <div className="flex flex-col gap-2.5 px-3 pb-4">
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
                  list={field.kind === 'font' ? 'slideo-fonts' : undefined}
                  onChange={(e) => setToken(field.key, e.target.value)}
                  className="w-full rounded-md border border-chrome-border bg-white px-2 py-1.5 font-mono text-[12px] text-chrome-text transition-colors focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
                />
              </div>
            </label>
          )
        })}
        </div>

        <FontsSection />
        <LogoSection />
        <ContrastCheck />
        <TransitionPicker />
      </div>
    </div>
  )
}

// Custom-Fonts (Spec §19.4): Upload + Auswahlliste (datalist) für die Font-Felder.
function FontsSection() {
  const presentation = usePresentationStore((s) => s.presentation)
  const addFont = usePresentationStore((s) => s.addFont)
  const fileRef = useRef<HTMLInputElement>(null)
  const uploaded = presentation?.fonts ?? []
  const families = Array.from(new Set([...uploaded.map((f) => f.family), ...SYSTEM_FONTS]))

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') addFont(reader.result, file.name)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-t border-chrome-border px-3 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
          Schriften
        </span>
        <button
          onClick={() => fileRef.current?.click()}
          className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-chrome-accent-600 transition-colors hover:bg-chrome-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          title="Schriftdatei (woff2/woff/ttf/otf) hochladen"
        >
          <Icon name="upload" size={15} weight={400} />
          Hochladen
        </button>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept=".woff2,.woff,.ttf,.otf,font/*"
        onChange={onPick}
        className="hidden"
      />
      {uploaded.length > 0 ? (
        <div className="flex flex-col gap-1">
          {uploaded.map((f) => (
            <div key={f.asset} className="flex items-center gap-1.5 text-[12px] text-chrome-secondary">
              <Icon name="font_download" size={14} weight={400} className="text-chrome-faint" />
              <span className="truncate" style={{ fontFamily: `'${f.family}'` }}>
                {f.family}
              </span>
            </div>
          ))}
        </div>
      ) : (
        <p className="text-[11px] text-chrome-faint">
          Eigene Schrift hochladen → erscheint in „Überschrift-/Fließtext-Font".
        </p>
      )}
      {/* Auswahlliste für die Font-Token-Felder (System + hochgeladen). */}
      <datalist id="slideo-fonts">
        {families.map((fam) => (
          <option key={fam} value={fam} />
        ))}
      </datalist>
    </div>
  )
}

// Marken-Logo (Spec §19.4): Upload + Position; erscheint auf jeder Folie.
function LogoSection() {
  const presentation = usePresentationStore((s) => s.presentation)
  const assets = usePresentationStore((s) => s.assets)
  const setLogo = usePresentationStore((s) => s.setLogo)
  const setLogoPosition = usePresentationStore((s) => s.setLogoPosition)
  const clearLogo = usePresentationStore((s) => s.clearLogo)
  const fileRef = useRef<HTMLInputElement>(null)
  const logo = presentation?.meta.logo
  const src = logo ? assets[logo.asset] : undefined

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      if (typeof reader.result === 'string') setLogo(reader.result)
    }
    reader.readAsDataURL(file)
  }

  return (
    <div className="border-t border-chrome-border px-3 py-3">
      <div className="mb-1.5 flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
          Logo
        </span>
        {logo ? (
          <button
            onClick={clearLogo}
            className="rounded-md px-1.5 py-1 text-[12px] text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-danger focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            Entfernen
          </button>
        ) : (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-chrome-accent-600 transition-colors hover:bg-chrome-accent-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
            title="Logo-Bild hochladen (PNG/SVG mit Transparenz empfohlen)"
          >
            <Icon name="upload" size={15} weight={400} />
            Hochladen
          </button>
        )}
      </div>
      <input ref={fileRef} type="file" accept="image/*" onChange={onPick} className="hidden" />
      {logo && src ? (
        <div className="flex items-center gap-2">
          <span className="flex h-8 w-14 shrink-0 items-center justify-center overflow-hidden rounded border border-chrome-border bg-chrome-surface-2">
            <img src={src} alt="" className="max-h-7 max-w-[3rem] object-contain" />
          </span>
          <select
            value={logo.position}
            onChange={(e) => setLogoPosition(e.target.value as LogoPosition)}
            className="h-7 flex-1 cursor-pointer rounded-md border border-chrome-border bg-white pl-2 pr-1 text-[12px] text-chrome-secondary transition-colors hover:border-chrome-border-strong focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
          >
            {LOGO_POSITIONS.map((pos) => (
              <option key={pos.value} value={pos.value}>
                {pos.label}
              </option>
            ))}
          </select>
        </div>
      ) : (
        <p className="text-[11px] text-chrome-faint">
          Logo-Bild hochladen → erscheint dezent auf jeder Folie (auch im Export).
        </p>
      )}
    </div>
  )
}

// WCAG-Kontrast der wichtigsten Token-Kombinationen (Spec §19.7).
function ContrastCheck() {
  const presentation = usePresentationStore((s) => s.presentation)
  const tokens = presentation?.tokens
  if (!tokens) return null
  const checks = [
    { label: 'Text / Hintergrund', fg: tokens['color-text'], bg: tokens['color-bg'] },
    { label: 'Akzent / Hintergrund', fg: tokens['color-accent'], bg: tokens['color-bg'] },
  ]
  return (
    <div className="border-t border-chrome-border px-3 py-3">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
        Kontrast (WCAG)
      </span>
      <div className="flex flex-col gap-1.5">
        {checks.map((c) => {
          const ratio = contrastRatio(c.fg, c.bg)
          const rating = ratio != null ? rateContrast(ratio) : null
          return (
            <div key={c.label} className="flex items-center gap-2 text-[12px]">
              <span className="truncate text-chrome-secondary">{c.label}</span>
              <span className="ml-auto shrink-0 tabular-nums text-chrome-muted">
                {ratio != null ? `${ratio.toFixed(1)}:1` : '—'}
              </span>
              {rating && (
                <span
                  className={
                    'shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold ' +
                    (rating.pass
                      ? 'bg-emerald-50 text-emerald-700'
                      : 'bg-chrome-warn-soft text-chrome-warn')
                  }
                  title={rating.pass ? 'Erfüllt WCAG AA' : 'Unter WCAG AA (4.5:1) für normalen Text'}
                >
                  {rating.label}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

// Deck-weiter Folienübergang (Spec §18.3) — wirkt im Präsentationsmodus & HTML-Export.
function TransitionPicker() {
  const presentation = usePresentationStore((s) => s.presentation)
  const setTransition = usePresentationStore((s) => s.setTransition)
  const transition = presentation?.meta.transition
  const kind: TransitionKind = transition?.kind ?? 'none'
  const duration = transition?.duration_ms ?? 500

  return (
    <div className="border-t border-chrome-border px-3 py-3">
      <span className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
        Übergang
      </span>
      <select
        value={kind}
        onChange={(e) => setTransition(e.target.value as TransitionKind, duration)}
        className="w-full rounded-md border border-chrome-border bg-white px-2 py-1.5 text-[12px] text-chrome-text transition-colors focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
      >
        {TRANSITIONS.map((t) => (
          <option key={t.value} value={t.value}>
            {t.label}
          </option>
        ))}
      </select>
      {kind !== 'none' && (
        <label className="mt-2 flex items-center justify-between gap-2 text-[11px] text-chrome-muted">
          Dauer (ms)
          <input
            type="number"
            min={0}
            step={50}
            value={duration}
            onChange={(e) => setTransition(kind, Math.max(0, Number(e.target.value) || 0))}
            className="w-20 rounded-md border border-chrome-border bg-white px-2 py-1 text-right font-mono text-[12px] text-chrome-text transition-colors focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
          />
        </label>
      )}
      <p className="mt-1.5 text-[11px] text-chrome-faint">
        Gilt für den Präsentationsmodus und den HTML-Export.
      </p>
    </div>
  )
}

// Theme-Picker: kuratierte Token-Bündel mit einem Klick anwenden.
function ThemePicker() {
  const applyPreset = usePresentationStore((s) => s.applyPreset)

  return (
    <div className="px-3 pb-3">
      <span className="mb-1.5 block text-[11px] font-medium text-chrome-muted">Themes</span>
      <div className="grid grid-cols-2 gap-1.5">
        {PRESETS.map((preset) => (
          <button
            key={preset.name}
            onClick={() => applyPreset(preset.name)}
            title={preset.description}
            className="flex items-center gap-2 rounded-lg border border-chrome-border bg-chrome-surface px-2 py-1.5 text-left transition-colors hover:border-chrome-border-strong hover:bg-chrome-surface-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            <Swatch preset={preset} />
            <span className="truncate text-[12px] font-medium text-chrome-text">{preset.label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

/** Mini-Vorschau eines Presets: Hintergrund mit Primär- und Akzent-Punkt. */
function Swatch({ preset }: { preset: Preset }) {
  const t = preset.tokens
  return (
    <span
      className="flex h-6 w-6 shrink-0 items-center justify-center gap-0.5 rounded-md border border-chrome-border"
      style={{ background: t['color-bg'] }}
    >
      <span className="h-2 w-2 rounded-full" style={{ background: t['color-primary'] }} />
      <span className="h-2 w-2 rounded-full" style={{ background: t['color-accent'] }} />
    </span>
  )
}

/** Color-Input erwartet `#rrggbb`; nicht-hex Werte werden auf Schwarz abgebildet. */
function normalizeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value.trim()) ? value.trim() : '#000000'
}
