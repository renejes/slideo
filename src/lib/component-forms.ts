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
}

/** Icon-Namen der Rust-`icon`-Komponente (für das Auswahl-Feld). */
export const ICON_NAMES = [
  'check', 'close', 'arrow_right', 'arrow_up', 'plus', 'minus', 'star', 'heart',
  'bolt', 'circle', 'check_circle', 'shield', 'info', 'warning', 'lightbulb',
]

const TOKEN_COLORS: { value: string; label: string }[] = [
  { value: 'var(--color-accent)', label: 'Akzent' },
  { value: 'var(--color-primary)', label: 'Primär' },
  { value: 'var(--color-secondary)', label: 'Sekundär' },
  { value: 'var(--color-text)', label: 'Text' },
]

export const COMPONENT_FORMS: Record<string, ComponentForm> = {
  stat_cards: {
    items: {
      label: 'Kennzahlen',
      addLabel: 'Kennzahl',
      fields: [
        { key: 'value', label: 'Wert', type: 'text', placeholder: '98%' },
        { key: 'label', label: 'Beschriftung', type: 'text', placeholder: 'Zufriedenheit' },
      ],
      seed: [
        { value: '98%', label: 'Zufriedenheit' },
        { value: '3.2x', label: 'Wachstum' },
        { value: '12k', label: 'Nutzer' },
      ],
    },
  },

  bar_chart: {
    fields: [{ key: 'max', label: 'Maximum (optional, sonst automatisch)', type: 'number', placeholder: 'auto' }],
    numericFieldKeys: ['max'],
    items: {
      label: 'Balken',
      addLabel: 'Balken',
      fields: [
        { key: 'label', label: 'Label', type: 'text', placeholder: 'Q1' },
        { key: 'value', label: 'Wert', type: 'number', placeholder: '40' },
      ],
      numericKeys: ['value'],
      seed: [
        { label: 'Q1', value: '40' },
        { label: 'Q2', value: '65' },
        { label: 'Q3', value: '80' },
        { label: 'Q4', value: '100' },
      ],
    },
  },

  line_chart: {
    items: {
      label: 'Datenpunkte',
      addLabel: 'Punkt',
      fields: [
        { key: 'label', label: 'Label', type: 'text', placeholder: 'Jan' },
        { key: 'value', label: 'Wert', type: 'number', placeholder: '12' },
      ],
      numericKeys: ['value'],
      seed: [
        { label: 'Jan', value: '12' },
        { label: 'Feb', value: '19' },
        { label: 'Mär', value: '15' },
        { label: 'Apr', value: '27' },
        { label: 'Mai', value: '34' },
      ],
    },
  },

  donut_chart: {
    items: {
      label: 'Segmente',
      addLabel: 'Segment',
      fields: [
        { key: 'label', label: 'Label', type: 'text', placeholder: 'Direkt' },
        { key: 'value', label: 'Wert', type: 'number', placeholder: '45' },
      ],
      numericKeys: ['value'],
      seed: [
        { label: 'Direkt', value: '45' },
        { label: 'Suche', value: '30' },
        { label: 'Social', value: '25' },
      ],
    },
  },

  progress: {
    items: {
      label: 'Fortschrittsbalken',
      addLabel: 'Balken',
      fields: [
        { key: 'label', label: 'Label', type: 'text', placeholder: 'Design' },
        { key: 'percent', label: 'Prozent (0–100)', type: 'number', placeholder: '90' },
      ],
      numericKeys: ['percent'],
      seed: [
        { label: 'Design', percent: '90' },
        { label: 'Entwicklung', percent: '70' },
        { label: 'Test', percent: '45' },
      ],
    },
  },

  quote: {
    fields: [
      {
        key: 'text',
        label: 'Zitat',
        type: 'textarea',
        default: 'Großartige Ideen brauchen Mut, nicht Erlaubnis.',
      },
      { key: 'author', label: 'Quelle', type: 'text', default: 'Unbekannt' },
    ],
  },

  timeline: {
    items: {
      label: 'Stationen',
      addLabel: 'Station',
      fields: [
        { key: 'title', label: 'Titel', type: 'text', placeholder: '2024' },
        { key: 'text', label: 'Text', type: 'text', placeholder: 'Gründung' },
      ],
      seed: [
        { title: '2024', text: 'Gründung' },
        { title: '2025', text: 'Erste 1.000 Nutzer' },
        { title: '2026', text: 'Internationaler Start' },
      ],
    },
  },

  comparison: {
    columns: [
      {
        key: 'left',
        titleLabel: 'Linke Spalte — Titel',
        titlePlaceholder: 'Vorher',
        listLabel: 'Punkte (eine Zeile = ein Punkt)',
        seedTitle: 'Vorher',
        seedItems: ['Manuelle Prozesse', 'Hohe Fehlerquote', 'Langsam'],
      },
      {
        key: 'right',
        titleLabel: 'Rechte Spalte — Titel',
        titlePlaceholder: 'Nachher',
        listLabel: 'Punkte (eine Zeile = ein Punkt)',
        seedTitle: 'Nachher',
        seedItems: ['Automatisiert', 'Zuverlässig', 'Schnell'],
      },
    ],
  },

  callout: {
    fields: [
      { key: 'title', label: 'Titel', type: 'text', default: 'Wichtig' },
      { key: 'text', label: 'Text', type: 'textarea', default: 'Die zentrale Botschaft dieser Folie.' },
    ],
  },

  icon: {
    fields: [
      {
        key: 'name',
        label: 'Symbol',
        type: 'select',
        default: 'check',
        options: ICON_NAMES.map((n) => ({ value: n, label: n })),
      },
      { key: 'label', label: 'Beschriftung (optional)', type: 'text', placeholder: 'z.B. Sicher' },
      { key: 'color', label: 'Farbe', type: 'select', default: 'var(--color-accent)', options: TOKEN_COLORS },
      { key: 'size', label: 'Größe (rem)', type: 'number', default: '6' },
    ],
    numericFieldKeys: ['size'],
  },

  toc: {
    items: {
      label: 'Einträge',
      addLabel: 'Eintrag',
      fields: [
        { key: 'label', label: 'Beschriftung', type: 'text', placeholder: 'Einleitung' },
        // target = 1-basierte Foliennummer (einfachster Fall) ODER Zonen-ID
        // (umsortier-fest). Das navScript löst beides zur Zielfolie auf (Spec §23).
        { key: 'target', label: 'Ziel (Foliennummer oder Zonen-ID)', type: 'text', placeholder: '2' },
      ],
      seed: [
        { label: 'Einleitung', target: '2' },
        { label: 'Hauptteil', target: '3' },
        { label: 'Fazit', target: '4' },
      ],
    },
  },
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
