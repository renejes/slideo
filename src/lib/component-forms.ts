// Formularschema der Komponenten-Palette (Spec §18.7).
//
// WICHTIG — KEINE Generator-Duplikation: Das HTML wird ausschließlich vom
// Rust-Generator erzeugt (src-tauri/src/components.rs, via Tauri-Command
// `render_component`). Hier steht nur, WELCHE Eingabefelder die Palette pro
// Komponententyp anzeigt und WIE daraus das `params`-Objekt für den Generator
// gebaut wird (reine UI-Belange ohne Rust-Äquivalent). Der Katalog (welche
// Typen es gibt, Label, Beschreibung) kommt zur Laufzeit aus `list_components`
// (Rust = Single Source). Fehlt zu einem Typ hier ein Schema, bietet die Palette
// „mit Standardwerten einfügen" (der Rust-Generator füllt Platzhalter).
//
// Die Defaults unten sind UI-Seed-Werte (damit Formular + Vorschau sofort sinnvoll
// aussehen); sie spiegeln grob die Rust-Fallbacks, müssen aber nicht identisch sein.
//
// Alle sichtbaren Texte kommen aus dem Katalog (i18n/{de,en}/components.ts). Die
// Auswertung passiert beim Laden des Moduls, also in der Sprache des laufenden
// Fensters — die Seed-Werte landen als INHALT in der Folie und sind danach
// eingefroren (siehe docs/wording.md). NICHT übersetzt werden Werte, die als
// API-Wert an den Rust-Generator gehen: `key`, `options[].value`, die Icon-Namen
// aus ICON_NAMES (dort IST `label` der API-Wert) und die Select-Defaults.

import { t } from '@/i18n'

export type FieldType = 'text' | 'textarea' | 'number' | 'select'

export interface FieldDef {
  key: string
  label: string
  type: FieldType
  placeholder?: string
  default?: string
  options?: { value: string; label: string }[]
}

/** Wiederholbares Datensatz-Feld (Tabelle), z.B. Chart-Datenpunkte. */
export interface ItemsDef {
  label: string
  addLabel: string
  /** Spalten je Zeile. */
  fields: FieldDef[]
  /** Diese Spalten als Zahl ins params-Objekt schreiben. */
  numericKeys?: string[]
  seed: Record<string, string>[]
}

/** Eine Spalte des Vergleichs (Titel + Zeilen als String-Liste). */
export interface ColumnDef {
  key: 'left' | 'right'
  titleLabel: string
  titlePlaceholder: string
  listLabel: string
  seedTitle: string
  seedItems: string[]
}

export interface ComponentForm {
  /** Skalare Felder auf oberster Ebene. */
  fields?: FieldDef[]
  /** Diese skalaren Felder als Zahl ins params-Objekt schreiben. */
  numericFieldKeys?: string[]
  /** Optionales Tabellen-Feld. */
  items?: ItemsDef
  /** Vergleichs-Spalten (genau 'left' + 'right'). */
  columns?: ColumnDef[]
}

/** Material-Symbol je Komponententyp (Katalog-Karten). Fallback: 'widgets'. */
export const COMPONENT_ICONS: Record<string, string> = {
  stat_cards: 'dashboard',
  bar_chart: 'bar_chart',
  line_chart: 'show_chart',
  donut_chart: 'donut_large',
  progress: 'linear_scale',
  quote: 'format_quote',
  timeline: 'timeline',
  comparison: 'compare_arrows',
  callout: 'campaign',
  icon: 'emoji_symbols',
  toc: 'toc',
  data_table: 'table_chart',
  big_number: 'tag',
  feature_grid: 'grid_view',
  process_steps: 'linear_scale',
  pricing: 'sell',
  gallery: 'collections',
}

/**
 * Deutsche Anzeige-Texte (Label + Beschreibung) je Komponententyp für die
 * MENSCHLICHE Palette-UI. Der Rust-`list_components`-Katalog ist auf Englisch
 * (AI-facing, MCP-Localization) und bleibt Single Source für Typenliste, Params
 * und Fallback. Hier überschreiben wir nur die Anzeige für den (deutschen)
 * Editor. Fehlt ein Typ (neue Rust-Komponente) → Fallback auf den englischen
 * Rust-Text, damit sie trotzdem erscheint.
 *
 * Nachtrag i18n: die Überlagerung ist jetzt zweisprachig (Name aus historischen
 * Gründen). Auf Englisch ist sie inhaltlich redundant — der Katalog spiegelt dort
 * bewusst wortgleich components.rs, damit die Anzeige nicht je nach Sprache aus
 * zwei verschiedenen Quellen kommt.
 */
export const COMPONENT_CATALOG_DE: Record<string, { label: string; description: string }> = {
  // Schlüssel ausgeschrieben statt per Template-Literal zusammengesetzt: nur so
  // prüft `tsc` sie gegen `I18nKey` (ein Tippfehler wäre sonst erst zur Laufzeit
  // sichtbar — und in Produktion still).
  stat_cards: { label: t('comp.catalog.stat_cards.label'), description: t('comp.catalog.stat_cards.description') },
  bar_chart: { label: t('comp.catalog.bar_chart.label'), description: t('comp.catalog.bar_chart.description') },
  line_chart: { label: t('comp.catalog.line_chart.label'), description: t('comp.catalog.line_chart.description') },
  donut_chart: { label: t('comp.catalog.donut_chart.label'), description: t('comp.catalog.donut_chart.description') },
  progress: { label: t('comp.catalog.progress.label'), description: t('comp.catalog.progress.description') },
  quote: { label: t('comp.catalog.quote.label'), description: t('comp.catalog.quote.description') },
  timeline: { label: t('comp.catalog.timeline.label'), description: t('comp.catalog.timeline.description') },
  comparison: { label: t('comp.catalog.comparison.label'), description: t('comp.catalog.comparison.description') },
  callout: { label: t('comp.catalog.callout.label'), description: t('comp.catalog.callout.description') },
  icon: { label: t('comp.catalog.icon.label'), description: t('comp.catalog.icon.description') },
  toc: { label: t('comp.catalog.toc.label'), description: t('comp.catalog.toc.description') },
  data_table: { label: t('comp.catalog.data_table.label'), description: t('comp.catalog.data_table.description') },
  big_number: { label: t('comp.catalog.big_number.label'), description: t('comp.catalog.big_number.description') },
  feature_grid: { label: t('comp.catalog.feature_grid.label'), description: t('comp.catalog.feature_grid.description') },
  process_steps: { label: t('comp.catalog.process_steps.label'), description: t('comp.catalog.process_steps.description') },
  pricing: { label: t('comp.catalog.pricing.label'), description: t('comp.catalog.pricing.description') },
  gallery: { label: t('comp.catalog.gallery.label'), description: t('comp.catalog.gallery.description') },
}

/** Icon-Namen der Rust-`icon`-Komponente (für das Auswahl-Feld). */
export const ICON_NAMES = [
  'check', 'close', 'arrow_right', 'arrow_up', 'plus', 'minus', 'star', 'heart',
  'bolt', 'circle', 'check_circle', 'shield', 'info', 'warning', 'lightbulb',
]

const TOKEN_COLORS: { value: string; label: string }[] = [
  { value: 'var(--color-accent)', label: t('comp.form.color.accent') },
  { value: 'var(--color-primary)', label: t('comp.form.color.primary') },
  { value: 'var(--color-secondary)', label: t('comp.form.color.secondary') },
  { value: 'var(--color-text)', label: t('comp.form.color.text') },
]

export const COMPONENT_FORMS: Record<string, ComponentForm> = {
  stat_cards: {
    items: {
      label: t('comp.form.stat_cards.items'),
      addLabel: t('comp.form.stat_cards.addItem'),
      fields: [
        {
          key: 'value',
          label: t('comp.form.stat_cards.value'),
          type: 'text',
          placeholder: t('comp.form.stat_cards.valuePlaceholder'),
        },
        {
          key: 'label',
          label: t('comp.form.stat_cards.label'),
          type: 'text',
          placeholder: t('comp.form.stat_cards.labelPlaceholder'),
        },
      ],
      seed: [
        { value: t('comp.seed.stat_cards.1.value'), label: t('comp.seed.stat_cards.1.label') },
        { value: t('comp.seed.stat_cards.2.value'), label: t('comp.seed.stat_cards.2.label') },
        { value: t('comp.seed.stat_cards.3.value'), label: t('comp.seed.stat_cards.3.label') },
      ],
    },
  },

  bar_chart: {
    fields: [
      {
        key: 'max',
        label: t('comp.form.bar_chart.max'),
        type: 'number',
        placeholder: t('comp.form.bar_chart.maxPlaceholder'),
      },
    ],
    numericFieldKeys: ['max'],
    items: {
      label: t('comp.form.bar_chart.items'),
      addLabel: t('comp.form.bar_chart.addItem'),
      fields: [
        {
          key: 'label',
          label: t('comp.form.bar_chart.label'),
          type: 'text',
          placeholder: t('comp.form.bar_chart.labelPlaceholder'),
        },
        {
          key: 'value',
          label: t('comp.form.bar_chart.value'),
          type: 'number',
          placeholder: t('comp.form.bar_chart.valuePlaceholder'),
        },
      ],
      numericKeys: ['value'],
      seed: [
        { label: t('comp.seed.bar_chart.1.label'), value: t('comp.seed.bar_chart.1.value') },
        { label: t('comp.seed.bar_chart.2.label'), value: t('comp.seed.bar_chart.2.value') },
        { label: t('comp.seed.bar_chart.3.label'), value: t('comp.seed.bar_chart.3.value') },
        { label: t('comp.seed.bar_chart.4.label'), value: t('comp.seed.bar_chart.4.value') },
      ],
    },
  },

  line_chart: {
    items: {
      label: t('comp.form.line_chart.items'),
      addLabel: t('comp.form.line_chart.addItem'),
      fields: [
        {
          key: 'label',
          label: t('comp.form.line_chart.label'),
          type: 'text',
          placeholder: t('comp.form.line_chart.labelPlaceholder'),
        },
        {
          key: 'value',
          label: t('comp.form.line_chart.value'),
          type: 'number',
          placeholder: t('comp.form.line_chart.valuePlaceholder'),
        },
      ],
      numericKeys: ['value'],
      seed: [
        { label: t('comp.seed.line_chart.1.label'), value: t('comp.seed.line_chart.1.value') },
        { label: t('comp.seed.line_chart.2.label'), value: t('comp.seed.line_chart.2.value') },
        { label: t('comp.seed.line_chart.3.label'), value: t('comp.seed.line_chart.3.value') },
        { label: t('comp.seed.line_chart.4.label'), value: t('comp.seed.line_chart.4.value') },
        { label: t('comp.seed.line_chart.5.label'), value: t('comp.seed.line_chart.5.value') },
      ],
    },
  },

  donut_chart: {
    items: {
      label: t('comp.form.donut_chart.items'),
      addLabel: t('comp.form.donut_chart.addItem'),
      fields: [
        {
          key: 'label',
          label: t('comp.form.donut_chart.label'),
          type: 'text',
          placeholder: t('comp.form.donut_chart.labelPlaceholder'),
        },
        {
          key: 'value',
          label: t('comp.form.donut_chart.value'),
          type: 'number',
          placeholder: t('comp.form.donut_chart.valuePlaceholder'),
        },
      ],
      numericKeys: ['value'],
      seed: [
        { label: t('comp.seed.donut_chart.1.label'), value: t('comp.seed.donut_chart.1.value') },
        { label: t('comp.seed.donut_chart.2.label'), value: t('comp.seed.donut_chart.2.value') },
        { label: t('comp.seed.donut_chart.3.label'), value: t('comp.seed.donut_chart.3.value') },
      ],
    },
  },

  progress: {
    items: {
      label: t('comp.form.progress.items'),
      addLabel: t('comp.form.progress.addItem'),
      fields: [
        {
          key: 'label',
          label: t('comp.form.progress.label'),
          type: 'text',
          placeholder: t('comp.form.progress.labelPlaceholder'),
        },
        {
          key: 'percent',
          label: t('comp.form.progress.percent'),
          type: 'number',
          placeholder: t('comp.form.progress.percentPlaceholder'),
        },
      ],
      numericKeys: ['percent'],
      seed: [
        { label: t('comp.seed.progress.1.label'), percent: t('comp.seed.progress.1.percent') },
        { label: t('comp.seed.progress.2.label'), percent: t('comp.seed.progress.2.percent') },
        { label: t('comp.seed.progress.3.label'), percent: t('comp.seed.progress.3.percent') },
      ],
    },
  },

  quote: {
    fields: [
      {
        key: 'text',
        label: t('comp.form.quote.text'),
        type: 'textarea',
        default: t('comp.seed.quote.text'),
      },
      { key: 'author', label: t('comp.form.quote.author'), type: 'text', default: t('comp.seed.quote.author') },
    ],
  },

  timeline: {
    items: {
      label: t('comp.form.timeline.items'),
      addLabel: t('comp.form.timeline.addItem'),
      fields: [
        {
          key: 'title',
          label: t('comp.form.timeline.title'),
          type: 'text',
          placeholder: t('comp.form.timeline.titlePlaceholder'),
        },
        {
          key: 'text',
          label: t('comp.form.timeline.text'),
          type: 'text',
          placeholder: t('comp.form.timeline.textPlaceholder'),
        },
      ],
      seed: [
        { title: t('comp.seed.timeline.1.title'), text: t('comp.seed.timeline.1.text') },
        { title: t('comp.seed.timeline.2.title'), text: t('comp.seed.timeline.2.text') },
        { title: t('comp.seed.timeline.3.title'), text: t('comp.seed.timeline.3.text') },
      ],
    },
  },

  comparison: {
    columns: [
      {
        key: 'left',
        titleLabel: t('comp.form.comparison.left.title'),
        titlePlaceholder: t('comp.form.comparison.left.titlePlaceholder'),
        listLabel: t('comp.form.comparison.left.list'),
        seedTitle: t('comp.seed.comparison.left.title'),
        seedItems: [
          t('comp.seed.comparison.left.1'),
          t('comp.seed.comparison.left.2'),
          t('comp.seed.comparison.left.3'),
        ],
      },
      {
        key: 'right',
        titleLabel: t('comp.form.comparison.right.title'),
        titlePlaceholder: t('comp.form.comparison.right.titlePlaceholder'),
        listLabel: t('comp.form.comparison.right.list'),
        seedTitle: t('comp.seed.comparison.right.title'),
        seedItems: [
          t('comp.seed.comparison.right.1'),
          t('comp.seed.comparison.right.2'),
          t('comp.seed.comparison.right.3'),
        ],
      },
    ],
  },

  callout: {
    fields: [
      { key: 'title', label: t('comp.form.callout.title'), type: 'text', default: t('comp.seed.callout.title') },
      { key: 'text', label: t('comp.form.callout.text'), type: 'textarea', default: t('comp.seed.callout.text') },
    ],
  },

  icon: {
    fields: [
      {
        key: 'name',
        label: t('comp.form.icon.name'),
        type: 'select',
        default: 'check',
        // `label: n` ist hier KEIN Anzeigetext, sondern der Icon-Name selbst —
        // der Rust-Generator kennt genau diese Bezeichner.
        options: ICON_NAMES.map((n) => ({ value: n, label: n })),
      },
      {
        key: 'label',
        label: t('comp.form.icon.label'),
        type: 'text',
        placeholder: t('comp.form.icon.labelPlaceholder'),
      },
      {
        key: 'color',
        label: t('comp.form.icon.color'),
        type: 'select',
        default: 'var(--color-accent)',
        options: TOKEN_COLORS,
      },
      { key: 'size', label: t('comp.form.icon.size'), type: 'number', default: '6' },
    ],
    numericFieldKeys: ['size'],
  },

  toc: {
    items: {
      label: t('comp.form.toc.items'),
      addLabel: t('comp.form.toc.addItem'),
      fields: [
        {
          key: 'label',
          label: t('comp.form.toc.label'),
          type: 'text',
          placeholder: t('comp.form.toc.labelPlaceholder'),
        },
        // target = 1-basierte Foliennummer (einfachster Fall) ODER Zonen-ID
        // (umsortier-fest). Das navScript löst beides zur Zielfolie auf (Spec §23).
        {
          key: 'target',
          label: t('comp.form.toc.target'),
          type: 'text',
          placeholder: t('comp.form.toc.targetPlaceholder'),
        },
      ],
      seed: [
        { label: t('comp.seed.toc.1.label'), target: t('comp.seed.toc.1.target') },
        { label: t('comp.seed.toc.2.label'), target: t('comp.seed.toc.2.target') },
        { label: t('comp.seed.toc.3.label'), target: t('comp.seed.toc.3.target') },
      ],
    },
  },

  big_number: {
    fields: [
      { key: 'value', label: t('comp.form.big_number.value'), type: 'text', default: t('comp.seed.big_number.value') },
      { key: 'label', label: t('comp.form.big_number.label'), type: 'text', default: t('comp.seed.big_number.label') },
      {
        key: 'sub',
        label: t('comp.form.big_number.sub'),
        type: 'text',
        placeholder: t('comp.form.big_number.subPlaceholder'),
      },
    ],
  },

  feature_grid: {
    items: {
      label: t('comp.form.feature_grid.items'),
      addLabel: t('comp.form.feature_grid.addItem'),
      fields: [
        {
          key: 'icon',
          label: t('comp.form.feature_grid.icon'),
          type: 'select',
          default: 'star',
          options: ICON_NAMES.map((n) => ({ value: n, label: n })),
        },
        {
          key: 'title',
          label: t('comp.form.feature_grid.title'),
          type: 'text',
          placeholder: t('comp.form.feature_grid.titlePlaceholder'),
        },
        {
          key: 'text',
          label: t('comp.form.feature_grid.text'),
          type: 'text',
          placeholder: t('comp.form.feature_grid.textPlaceholder'),
        },
      ],
      seed: [
        { icon: 'bolt', title: t('comp.seed.feature_grid.1.title'), text: t('comp.seed.feature_grid.1.text') },
        { icon: 'shield', title: t('comp.seed.feature_grid.2.title'), text: t('comp.seed.feature_grid.2.text') },
        { icon: 'star', title: t('comp.seed.feature_grid.3.title'), text: t('comp.seed.feature_grid.3.text') },
      ],
    },
  },

  process_steps: {
    items: {
      label: t('comp.form.process_steps.items'),
      addLabel: t('comp.form.process_steps.addItem'),
      fields: [
        {
          key: 'title',
          label: t('comp.form.process_steps.title'),
          type: 'text',
          placeholder: t('comp.form.process_steps.titlePlaceholder'),
        },
        {
          key: 'text',
          label: t('comp.form.process_steps.text'),
          type: 'text',
          placeholder: t('comp.form.process_steps.textPlaceholder'),
        },
      ],
      seed: [
        { title: t('comp.seed.process_steps.1.title'), text: t('comp.seed.process_steps.1.text') },
        { title: t('comp.seed.process_steps.2.title'), text: t('comp.seed.process_steps.2.text') },
        { title: t('comp.seed.process_steps.3.title'), text: t('comp.seed.process_steps.3.text') },
      ],
    },
  },

  // data_table, pricing, gallery: bewusst KEIN Palette-Formular (verschachtelte
  // Arrays bzw. Asset-Auswahl) → die Palette fügt „mit Standardwerten" ein, der Mensch
  // verfeinert per §20; die KI füllt sie voll über MCP insert_component.
}

/** Zustand eines Palette-Formulars. */
export interface PaletteFormState {
  fields: Record<string, string>
  items: Record<string, string>[]
  columns: Record<'left' | 'right', { title: string; lines: string }>
}

/** Leere Zeile für ein Tabellen-Feld (alle Spalten leer). */
export function emptyItemRow(spec: ItemsDef): Record<string, string> {
  return Object.fromEntries(spec.fields.map((f) => [f.key, '']))
}

/** Erzeugt den Anfangszustand (mit Seed-Defaults) für einen Komponententyp. */
export function initFormState(form: ComponentForm | undefined): PaletteFormState {
  const fields: Record<string, string> = {}
  for (const f of form?.fields ?? []) fields[f.key] = f.default ?? ''
  const items = form?.items ? form.items.seed.map((row) => ({ ...row })) : []
  const col = (key: 'left' | 'right') => form?.columns?.find((c) => c.key === key)
  return {
    fields,
    items,
    columns: {
      left: { title: col('left')?.seedTitle ?? '', lines: (col('left')?.seedItems ?? []).join('\n') },
      right: { title: col('right')?.seedTitle ?? '', lines: (col('right')?.seedItems ?? []).join('\n') },
    },
  }
}

/**
 * Baut aus dem Formularzustand das `params`-Objekt für `render_component`.
 * Leere skalare Felder werden weggelassen (→ Rust-Default greift); leere
 * Tabellenzeilen werden verworfen.
 */
export function buildParams(form: ComponentForm | undefined, st: PaletteFormState): Record<string, unknown> {
  const params: Record<string, unknown> = {}
  if (!form) return params

  for (const f of form.fields ?? []) {
    const raw = (st.fields[f.key] ?? '').trim()
    if (raw === '') continue
    if (form.numericFieldKeys?.includes(f.key)) {
      const n = Number(raw)
      if (!Number.isNaN(n)) params[f.key] = n
    } else {
      params[f.key] = st.fields[f.key]
    }
  }

  if (form.items) {
    const spec = form.items
    params.items = st.items
      .filter((row) => spec.fields.some((c) => (row[c.key] ?? '').trim() !== ''))
      .map((row) => {
        const out: Record<string, unknown> = {}
        for (const c of spec.fields) {
          const raw = row[c.key] ?? ''
          if (spec.numericKeys?.includes(c.key)) {
            const n = Number(raw.trim())
            out[c.key] = Number.isNaN(n) ? 0 : n
          } else {
            out[c.key] = raw
          }
        }
        return out
      })
  }

  if (form.columns) {
    for (const c of form.columns) {
      const col = st.columns[c.key]
      params[c.key] = {
        title: col.title,
        items: col.lines
          .split('\n')
          .map((l) => l.trim())
          .filter((l) => l !== ''),
      }
    }
  }

  return params
}
