import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import vm from 'node:vm'
import { renderFullPage, renderStandalonePage, renderPrintPage, renderSingleZonePage, scopeCss } from './renderer'
import type { Presentation, Zone } from '@/types'
import { DEFAULT_TOKENS, DEFAULT_ZONE_STYLE, FILE_FORMAT_VERSION } from '@/types'
import { applyLocale } from '@/i18n'

// ---------------------------------------------------------------------------
// Der eigentliche Grund für dieses File (Review 2026-08, Befund S3):
//
// ~1100 Zeilen der heikelsten Logik der App (navScript/editScript/patchScript)
// leben als Template-Literal-Strings. `tsc --noEmit` und `vite build` sehen sie
// NIE — ein rohes `\n` oder ein Backtick darin tötet zur Laufzeit den kompletten
// Overlay, während der Build grün bleibt. Genau das ist schon einmal passiert.
//
// Diese Suite evaluiert die Skripte deshalb so, wie `node --check` es täte:
// `new vm.Script(src)` ist ein echter Top-Level-Parse ohne Ausführung.
// ---------------------------------------------------------------------------

function zone(partial: Partial<Zone> = {}): Zone {
  return {
    id: partial.id ?? '11111111-1111-4111-8111-111111111111',
    label: partial.label ?? 'Slide 1',
    order: partial.order ?? 0,
    content_type: partial.content_type ?? 'markdown',
    markdown: partial.markdown ?? '# Titel\n\nEin Absatz mit `code` und **fett**.',
    html: partial.html ?? null,
    custom_css: partial.custom_css ?? '',
    style: { ...DEFAULT_ZONE_STYLE, ...(partial.style ?? {}) },
    notes: partial.notes ?? '',
    reveal: partial.reveal,
  }
}

function deck(): Presentation {
  return {
    version: FILE_FORMAT_VERSION,
    meta: {
      title: 'Test-Deck',
      created: '2026-01-01T00:00:00Z',
      modified: '2026-01-01T00:00:00Z',
      transition: { kind: 'auto', duration_ms: 400 },
    },
    tokens: { ...DEFAULT_TOKENS },
    zones: [
      zone(),
      zone({
        id: '22222222-2222-4222-8222-222222222222',
        label: 'Slide 2',
        order: 1,
        content_type: 'html',
        html: '<div data-id="box" style="position:absolute;left:10%;top:20%">Hallo</div>',
      }),
      zone({
        id: '33333333-3333-4333-8333-333333333333',
        label: 'Slide 3',
        order: 2,
        markdown: 'Links\n\n+++\n\nRechts',
        style: { ...DEFAULT_ZONE_STYLE, layout: 'split' },
        reveal: 'steps',
      }),
    ],
  }
}

/** Alle `<script>`-Inhalte einer gerenderten Seite. */
function extractScripts(html: string): string[] {
  const out: string[] = []
  const re = /<script(?![^>]*\bsrc=)[^>]*>([\s\S]*?)<\/script>/g
  let m: RegExpExecArray | null
  while ((m = re.exec(html)) !== null) {
    if (m[1].trim()) out.push(m[1])
  }
  return out
}

// Jede Kombination, die die App tatsächlich rendert — als Thunk, damit sie je
// Sprache neu ausgewertet wird.
const VARIANTS: { name: string; render: () => string }[] = [
  { name: 'Vorschau (editable+directEdit)', render: () => renderFullPage(deck(), { editable: true, directEdit: true }) },
  { name: 'Vorschau (editable, ohne directEdit)', render: () => renderFullPage(deck(), { editable: true, directEdit: false }) },
  { name: 'Präsentation (present)', render: () => renderFullPage(deck(), { present: true }) },
  { name: 'Anzeige (nicht editierbar)', render: () => renderFullPage(deck(), {}) },
  { name: 'Standalone-Export', render: () => renderStandalonePage(deck(), {}) },
  { name: 'Print', render: () => renderPrintPage(deck(), {}) },
  { name: 'Einzelfolie (Thumbnail/Speaker)', render: () => renderSingleZonePage(deck(), deck().zones[0], {}) },
]

// Seit dem i18n-Umbau reicht EIN Durchlauf nicht mehr: die Beschriftungen der
// §20-Mini-Toolbar und der Tooltip des Drag-Griffs kommen aus dem Katalog. Ein
// Apostroph im englischen Text („Don't") würde in einem einfach gequoteten
// Attribut das Markup zerlegen — auf Deutsch bliebe die Suite grün. Also beide
// Sprachen durch dieselben sieben Render-Pfade.
for (const locale of ['de', 'en'] as const) {
  describe(`injizierte Iframe-Skripte: Syntax (${locale})`, () => {
    beforeEach(() => applyLocale(locale))
    afterEach(() => applyLocale('de'))

    for (const v of VARIANTS) {
      it(`${v.name} liefert nur parsebares JavaScript`, () => {
        const scripts = extractScripts(v.render())
        for (const [i, src] of scripts.entries()) {
          expect(
            () => new vm.Script(src, { filename: `${v.name}#${i}.js` }),
            `Skript ${i} in „${v.name}" (${locale}) ist syntaktisch kaputt`,
          ).not.toThrow()
        }
      })
    }

    it('die Editiermodi injizieren überhaupt Skripte (Schutz gegen leeres Grün)', () => {
      // Ohne diese Zusicherung würde die Suite auch dann grün, wenn die Skripte
      // gar nicht mehr injiziert werden — dann prüfte sie nichts.
      expect(extractScripts(renderFullPage(deck(), { editable: true, directEdit: true })).length).toBeGreaterThanOrEqual(3)
      expect(extractScripts(renderFullPage(deck(), { present: true })).length).toBeGreaterThanOrEqual(1)
    })

    it('die Katalogtexte kommen escaped im Markup an', () => {
      const html = renderFullPage(deck(), { editable: true, directEdit: true })
      // Der Drag-Griff-Tooltip läuft durch escapeAttr → kein nacktes ' oder " im Attribut.
      const handle = /<span class="slideo-drag"[^>]*title="([^"]*)"/.exec(html)
      expect(handle, 'Drag-Griff mit title nicht gefunden').not.toBeNull()
      expect(handle?.[1]).not.toMatch(/["']/)
      // Die Toolbar-Beschriftungen stehen als JSON im Skript, nicht als Attribut —
      // dort darf kein unescapetes </script und kein roher Zeilenumbruch stehen.
      const ui = /var UI = (\{.*?\});/.exec(html)
      expect(ui, 'UI-Objekt im editScript nicht gefunden').not.toBeNull()
      expect(ui?.[1]).not.toContain('</script')
      expect(() => JSON.parse(ui?.[1] ?? '')).not.toThrow()
    })
  })
}

describe('Renderer-Grundinvarianten', () => {
  it('nur In-App-Seiten tragen die strikte Folien-CSP, der Standalone-Export nicht (Audit S3)', () => {
    expect(renderFullPage(deck(), {})).toContain("connect-src 'none'")
    expect(renderStandalonePage(deck(), {})).not.toContain("connect-src 'none'")
  })

  it('jede Zone bekommt eine adressierbare Section (Grundlage §23 + Patch-Ziel §25)', () => {
    const html = renderFullPage(deck(), {})
    for (const z of deck().zones) expect(html).toContain(`id="zone-${z.id}"`)
  })
})

describe('scopeCss', () => {
  it('präfixt einfache Selektoren mit dem Zonen-Scope', () => {
    expect(scopeCss('h1 { color: red }', '#zone-a')).toContain('#zone-a h1')
  })

  it('scoped jeden Selektor einer Selektorliste einzeln', () => {
    const out = scopeCss('h1, h2 { color: red }', '#zone-a')
    expect(out).toContain('#zone-a h1')
    expect(out).toContain('#zone-a h2')
  })

  it('scoped rekursiv in @media hinein', () => {
    const out = scopeCss('@media (min-width: 10px) { p { color: red } }', '#zone-a')
    expect(out).toContain('@media (min-width: 10px)')
    expect(out).toContain('#zone-a p')
  })

  it('lässt @keyframes und @font-face unangetastet', () => {
    const out = scopeCss('@keyframes spin { from { opacity: 0 } to { opacity: 1 } }', '#zone-a')
    expect(out).toContain('@keyframes spin')
    expect(out).not.toContain('#zone-a from')
  })

  it('entfernt Kommentare und übersteht unbalancierte Klammern ohne Endlosschleife', () => {
    expect(scopeCss('/* weg */ p { color: red }', '#z')).not.toContain('weg')
    expect(() => scopeCss('p { color: red', '#z')).not.toThrow()
    expect(() => scopeCss('}}} p {}', '#z')).not.toThrow()
  })
})
