import { useEffect, useMemo, useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { isTauri, listComponents, renderComponent, type ComponentMeta } from '@/lib/tauri'
import { tokensToCssString } from '@/lib/tokens'
import {
  COMPONENT_FORMS,
  COMPONENT_ICONS,
  buildParams,
  emptyItemRow,
  initFormState,
  type ComponentForm,
  type FieldDef,
  type PaletteFormState,
} from '@/lib/component-forms'

type Placement = 'new' | 'append' | 'replace'

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

const inputClass =
  'w-full rounded-lg border border-chrome-border bg-white px-2.5 py-1.5 text-[13px] text-chrome-text ' +
  'placeholder:text-chrome-faint focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30'

// Komponenten-Palette (Spec §18.7): fügt token-bewusste HTML-Komponenten per Klick
// ein. Katalog + HTML kommen aus dem Rust-Generator (list_components/render_component) —
// keine TS-Duplikation; nur die Eingabe-Formulare leben im Frontend (component-forms.ts).
export function ComponentPaletteModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const presentation = usePresentationStore((s) => s.presentation)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const insertComponent = usePresentationStore((s) => s.insertComponent)
  const tokens = presentation?.tokens

  const tauri = isTauri()
  const [catalog, setCatalog] = useState<ComponentMeta[]>([])
  const [catalogError, setCatalogError] = useState<string | null>(null)
  const [selectedType, setSelectedType] = useState<string | null>(null)
  const [state, setState] = useState<PaletteFormState>(() => initFormState(undefined))
  const [previewHtml, setPreviewHtml] = useState('')
  const [previewError, setPreviewError] = useState<string | null>(null)
  // Optionales data-id für Auto-Animate (Übergang 'auto', Spec §19.1).
  const [dataId, setDataId] = useState('')

  // Katalog laden (Rust = Single Source der verfügbaren Komponenten).
  useEffect(() => {
    let cancelled = false
    listComponents()
      .then((list) => {
        if (cancelled) return
        setCatalog(list)
        setSelectedType((prev) => prev ?? list[0]?.type ?? null)
      })
      .catch((e) => {
        if (!cancelled) setCatalogError(errMsg(e))
      })
    return () => {
      cancelled = true
    }
  }, [])

  const form: ComponentForm | undefined = selectedType ? COMPONENT_FORMS[selectedType] : undefined

  // Formular bei Typwechsel mit Seed-Defaults neu initialisieren.
  useEffect(() => {
    setState(initFormState(form))
    setPreviewHtml('')
    setPreviewError(null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType])

  const params = useMemo(() => buildParams(form, state), [form, state])
  const paramsKey = useMemo(() => JSON.stringify(params), [params])

  // Live-Vorschau: gedrosselt über den Rust-Generator rendern.
  useEffect(() => {
    if (!selectedType || !tauri) return
    let cancelled = false
    const t = setTimeout(() => {
      renderComponent(selectedType, params, dataId)
        .then((html) => {
          if (cancelled) return
          setPreviewHtml(html)
          setPreviewError(null)
        })
        .catch((e) => {
          if (!cancelled) setPreviewError(errMsg(e))
        })
    }, 220)
    return () => {
      cancelled = true
      clearTimeout(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedType, paramsKey, tauri, dataId])

  // Vorschau-Iframe: Token-Variablen + Folien-Hintergrund, statisch (sandbox="").
  const srcDoc = useMemo(() => {
    const vars = tokens ? tokensToCssString(tokens) : ''
    return [
      '<!doctype html><html><head><meta charset="utf-8"><style>',
      `:root{\n${vars}\n}`,
      '*{box-sizing:border-box}html,body{margin:0}',
      'body{background:var(--color-bg);color:var(--color-text);font-family:var(--font-body),system-ui,-apple-system,sans-serif;',
      'padding:24px;display:flex;align-items:center;justify-content:center;min-height:100vh}',
      '.wrap{width:100%}</style></head><body><div class="wrap">',
      previewHtml,
      '</div></body></html>',
    ].join('')
  }, [previewHtml, tokens])

  // Platzierungs-Optionen abhängig vom Zustand der aktiven Zone.
  const active = presentation?.zones.find((z) => z.id === activeZoneId) ?? null
  const targetHasContent = active
    ? active.content_type === 'html'
      ? !!active.html?.trim()
      : !!active.markdown.trim()
    : false

  const placements = useMemo(() => {
    const list: { value: Placement; label: string }[] = []
    if (active && !targetHasContent) list.push({ value: 'replace', label: `In „${active.label}" einsetzen` })
    if (active && active.content_type === 'html' && targetHasContent)
      list.push({ value: 'append', label: `An „${active.label}" anhängen` })
    list.push({ value: 'new', label: active ? `Als neue Folie nach „${active.label}"` : 'Als neue Folie' })
    return list
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [active?.id, active?.content_type, active?.label, targetHasContent])

  const placementKey = placements.map((p) => p.value).join(',')
  const [placement, setPlacement] = useState<Placement>('new')
  // Kontextuellen Default setzen, wenn sich die verfügbaren Optionen ändern (= aktive
  // Zone wechselt): leere Zone → 'replace', HTML-Zone → 'append', sonst 'new'. Innerhalb
  // derselben Zone (Komponenten-Typ-Wechsel ändert placementKey nicht) bleibt die Wahl.
  useEffect(() => {
    setPlacement(placements[0].value)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [placementKey])

  // Hinweis: nicht-leere Markdown-Folie wird nicht überschrieben → neue Folie.
  const markdownNotice =
    active && active.content_type === 'markdown' && targetHasContent

  async function insert() {
    if (!selectedType) return
    try {
      const html = await renderComponent(selectedType, params, dataId)
      insertComponent({ targetZoneId: activeZoneId, placement, html })
      notify('Komponente eingefügt.', 'success')
      closeModal()
    } catch (e) {
      notify(`Einfügen fehlgeschlagen: ${errMsg(e)}`, 'error')
    }
  }

  function updateField(key: string, value: string) {
    setState((s) => ({ ...s, fields: { ...s.fields, [key]: value } }))
  }
  function updateItem(rowIdx: number, key: string, value: string) {
    setState((s) => ({ ...s, items: s.items.map((r, i) => (i === rowIdx ? { ...r, [key]: value } : r)) }))
  }
  function addItem() {
    if (!form?.items) return
    setState((s) => ({ ...s, items: [...s.items, emptyItemRow(form.items!)] }))
  }
  function removeItem(rowIdx: number) {
    setState((s) => ({ ...s, items: s.items.filter((_, i) => i !== rowIdx) }))
  }
  function updateColumn(key: 'left' | 'right', part: 'title' | 'lines', value: string) {
    setState((s) => ({ ...s, columns: { ...s.columns, [key]: { ...s.columns[key], [part]: value } } }))
  }

  return (
    <Modal
      title="Komponente einfügen"
      onClose={closeModal}
      width="w-[60rem]"
      footer={
        <>
          {markdownNotice && (
            <span className="mr-auto max-w-[24rem] text-[11px] leading-snug text-chrome-muted">
              Aktive Folie enthält Markdown — die Komponente wird als neue HTML-Folie eingefügt.
            </span>
          )}
          <button className={modalGhostBtn} onClick={closeModal}>
            Abbrechen
          </button>
          <button className={modalPrimaryBtn} onClick={insert} disabled={!selectedType || !tauri}>
            <Icon name="add" size={18} />
            Einfügen
          </button>
        </>
      }
    >
      {catalogError ? (
        <div className="flex flex-col items-center gap-2 py-10 text-center">
          <Icon name="widgets" size={32} weight={300} className="text-chrome-faint" />
          <p className="text-[13px] text-chrome-secondary">
            Die Komponenten-Palette ist nur in der Desktop-App verfügbar.
          </p>
          <p className="max-w-[28rem] text-[11px] text-chrome-faint">
            Der Komponenten-Generator läuft im Rust-Backend (npm run tauri:dev).
          </p>
        </div>
      ) : (
        <div className="flex h-[64vh] gap-4">
          {/* Katalog */}
          <div className="w-52 shrink-0 overflow-y-auto border-r border-chrome-border pr-3">
            <div className="flex flex-col gap-1">
              {catalog.length === 0 && (
                <p className="px-1 py-2 text-[12px] text-chrome-faint">Lädt …</p>
              )}
              {catalog.map((c) => (
                <button
                  key={c.type}
                  onClick={() => setSelectedType(c.type)}
                  title={c.description}
                  aria-pressed={selectedType === c.type}
                  className={
                    'flex items-center gap-2 rounded-lg px-2 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
                    (selectedType === c.type
                      ? 'bg-chrome-accent-soft text-chrome-accent-600'
                      : 'text-chrome-secondary hover:bg-chrome-surface-2 hover:text-chrome-text')
                  }
                >
                  <Icon
                    name={COMPONENT_ICONS[c.type] ?? 'widgets'}
                    size={18}
                    weight={400}
                    className="shrink-0"
                  />
                  <span className="min-w-0 truncate text-[13px] font-medium">{c.label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Form + Vorschau */}
          <div className="flex min-w-0 flex-1 flex-col gap-3">
            {/* Live-Vorschau */}
            <div className="shrink-0 overflow-hidden rounded-lg border border-chrome-border bg-chrome-surface-2">
              <div className="flex items-center justify-between border-b border-chrome-border px-3 py-1.5">
                <span className="text-[11px] font-medium uppercase tracking-wide text-chrome-faint">
                  Vorschau
                </span>
                {previewError && (
                  <span className="truncate text-[11px] text-chrome-danger" title={previewError}>
                    {previewError}
                  </span>
                )}
              </div>
              <iframe
                title="Komponenten-Vorschau"
                sandbox=""
                srcDoc={srcDoc}
                className="h-44 w-full border-0 bg-transparent"
              />
            </div>

            {/* Parameter-Formular */}
            <div className="min-h-0 flex-1 overflow-y-auto pr-1">
              {catalog.find((c) => c.type === selectedType) && (
                <p className="mb-3 text-[12px] leading-snug text-chrome-muted">
                  {catalog.find((c) => c.type === selectedType)?.description}
                </p>
              )}

              {!form && selectedType && (
                <p className="rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2 text-[12px] text-chrome-muted">
                  Diese Komponente wird mit Standardwerten eingefügt.
                </p>
              )}

              {/* Skalare Felder */}
              {form?.fields && form.fields.length > 0 && (
                <div className="flex flex-col gap-2.5">
                  {form.fields.map((f) => (
                    <ScalarField
                      key={f.key}
                      field={f}
                      value={state.fields[f.key] ?? ''}
                      onChange={(v) => updateField(f.key, v)}
                    />
                  ))}
                </div>
              )}

              {/* Tabellen-Feld */}
              {form?.items && (
                <div className="mt-1 flex flex-col gap-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[12px] font-medium text-chrome-secondary">
                      {form.items.label}
                    </span>
                    <button
                      onClick={addItem}
                      className="flex items-center gap-1 rounded-md px-1.5 py-1 text-[12px] text-chrome-accent-600 transition-colors hover:bg-chrome-accent-soft"
                    >
                      <Icon name="add" size={15} />
                      {form.items.addLabel}
                    </button>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    {state.items.map((row, i) => (
                      <div key={i} className="flex items-center gap-1.5">
                        {form.items!.fields.map((col) => (
                          <input
                            key={col.key}
                            value={row[col.key] ?? ''}
                            type={col.type === 'number' ? 'number' : 'text'}
                            placeholder={col.placeholder ?? col.label}
                            onChange={(e) => updateItem(i, col.key, e.target.value)}
                            className={inputClass}
                            aria-label={`${col.label} (Zeile ${i + 1})`}
                          />
                        ))}
                        <button
                          onClick={() => removeItem(i)}
                          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-danger/10 hover:text-chrome-danger"
                          title="Zeile entfernen"
                          aria-label={`Zeile ${i + 1} entfernen`}
                        >
                          <Icon name="close" size={15} />
                        </button>
                      </div>
                    ))}
                    {state.items.length === 0 && (
                      <p className="text-[11px] text-chrome-faint">
                        Keine Einträge — wird mit Beispieldaten gerendert.
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Vergleichs-Spalten */}
              {form?.columns && (
                <div className="mt-1 grid grid-cols-2 gap-3">
                  {form.columns.map((col) => (
                    <div key={col.key} className="flex flex-col gap-2">
                      <label className="flex flex-col gap-1">
                        <span className="text-[12px] font-medium text-chrome-secondary">
                          {col.titleLabel}
                        </span>
                        <input
                          value={state.columns[col.key].title}
                          placeholder={col.titlePlaceholder}
                          onChange={(e) => updateColumn(col.key, 'title', e.target.value)}
                          className={inputClass}
                        />
                      </label>
                      <label className="flex flex-col gap-1">
                        <span className="text-[11px] text-chrome-muted">{col.listLabel}</span>
                        <textarea
                          value={state.columns[col.key].lines}
                          rows={4}
                          onChange={(e) => updateColumn(col.key, 'lines', e.target.value)}
                          className={inputClass + ' resize-y font-mono'}
                        />
                      </label>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Platzierung + optionales data-id (Auto-Animate) */}
            <div className="shrink-0 border-t border-chrome-border pt-2.5">
              <div className="mb-2 flex items-center gap-2">
                <span className="text-[11px] font-medium uppercase tracking-wide text-chrome-faint">
                  data-id
                </span>
                <input
                  value={dataId}
                  onChange={(e) => setDataId(e.target.value.replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 64))}
                  placeholder="optional — für Auto-Animate (Übergang „auto“)"
                  aria-label="data-id für Auto-Animate (optional)"
                  title="Erlaubt: Buchstaben, Ziffern, - _ : (max. 64). Andere Zeichen werden entfernt."
                  className="min-w-0 flex-1 rounded-md border border-chrome-border bg-white px-2 py-1 text-[12px] text-chrome-text placeholder:text-chrome-faint focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
                />
              </div>
              <span className="mb-1.5 block text-[11px] font-medium uppercase tracking-wide text-chrome-faint">
                Einfügen
              </span>
              <div className="flex flex-wrap gap-1.5">
                {placements.map((p) => (
                  <button
                    key={p.value}
                    onClick={() => setPlacement(p.value)}
                    aria-pressed={placement === p.value}
                    className={
                      'rounded-md border px-2.5 py-1.5 text-[12px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
                      (placement === p.value
                        ? 'border-chrome-accent bg-chrome-accent-soft text-chrome-accent-600'
                        : 'border-chrome-border text-chrome-secondary hover:border-chrome-border-strong')
                    }
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}
    </Modal>
  )
}

function ScalarField({
  field,
  value,
  onChange,
}: {
  field: FieldDef
  value: string
  onChange: (v: string) => void
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-[12px] font-medium text-chrome-secondary">{field.label}</span>
      {field.type === 'textarea' ? (
        <textarea
          value={value}
          placeholder={field.placeholder}
          rows={3}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass + ' resize-y'}
        />
      ) : field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} className={inputClass}>
          {field.options?.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      ) : (
        <input
          value={value}
          type={field.type === 'number' ? 'number' : 'text'}
          placeholder={field.placeholder}
          onChange={(e) => onChange(e.target.value)}
          className={inputClass}
        />
      )}
    </label>
  )
}
