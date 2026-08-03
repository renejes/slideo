import { describe, it, expect } from 'vitest'
import { normalizePresentation } from './normalize'
import { renderFullPage } from './renderer'
import { DEFAULT_TOKENS } from '@/types'

// Befund M49/M50/S8: nichts validierte ein geladenes Deck. Der Renderer
// dereferenziert `zone.style.layout` unbedingt → eine defekte oder von Hand
// editierte `.slideo` ergab einen weißen Bildschirm (ohne ErrorBoundary im Baum).
// Diese Suite fixiert die Leitlinie: auffüllen, klemmen, sortieren — nie verwerfen.

describe('normalizePresentation', () => {
  it('füllt ein komplett leeres Objekt zu einem renderbaren Deck auf', () => {
    const { presentation } = normalizePresentation({})
    expect(presentation.zones).toHaveLength(1)
    expect(presentation.meta.title).toBe('Unbenannt')
    expect(presentation.tokens['color-bg']).toBe(DEFAULT_TOKENS['color-bg'])
    // Der eigentliche Test: es geht durch den Renderer, ohne zu werfen.
    expect(() => renderFullPage(presentation, {})).not.toThrow()
  })

  it('übersteht null/undefined ohne zu werfen', () => {
    expect(() => normalizePresentation(null)).not.toThrow()
    expect(() => normalizePresentation(undefined)).not.toThrow()
  })

  it('ersetzt einen unbekannten Layout-Wert durch den Default (S8)', () => {
    // `layout: "banana"` erzeugte class="layout-banana" → still ungestylte Folie.
    const { presentation } = normalizePresentation({
      zones: [{ id: 'a', style: { layout: 'banana', text_align: 'diagonal' } }],
    })
    expect(presentation.zones[0].style.layout).toBe('center')
    expect(presentation.zones[0].style.text_align).toBe('left')
  })

  it('behält gültige Layouts unangetastet', () => {
    const { presentation } = normalizePresentation({
      zones: [{ id: 'a', style: { layout: 'split', text_align: 'center' } }],
    })
    expect(presentation.zones[0].style.layout).toBe('split')
    expect(presentation.zones[0].style.text_align).toBe('center')
  })

  it('sortiert nach order und renummeriert lückenlos', () => {
    const { presentation } = normalizePresentation({
      zones: [
        { id: 'b', order: 7 },
        { id: 'a', order: 2 },
        { id: 'c', order: 99 },
      ],
    })
    expect(presentation.zones.map((z) => z.id)).toEqual(['a', 'b', 'c'])
    expect(presentation.zones.map((z) => z.order)).toEqual([0, 1, 2])
  })

  it('vergibt fehlende Zonen-IDs, statt die Folie zu verwerfen', () => {
    const { presentation } = normalizePresentation({ zones: [{ markdown: '# A' }] })
    expect(presentation.zones[0].id).toMatch(/[0-9a-f-]{36}/)
    expect(presentation.zones[0].markdown).toBe('# A')
  })

  it('bewahrt unbekannte Felder (Vorwärtskompatibilität ist Kernentscheidung)', () => {
    const { presentation } = normalizePresentation({
      zones: [{ id: 'a', zukunftsfeld: 42 }],
      meta: { title: 'T', experiment: true },
      obenDrauf: 'bleibt',
    })
    expect((presentation as unknown as Record<string, unknown>).obenDrauf).toBe('bleibt')
    expect((presentation.zones[0] as unknown as Record<string, unknown>).zukunftsfeld).toBe(42)
    expect((presentation.meta as unknown as Record<string, unknown>).experiment).toBe(true)
  })

  it('erkennt eine neuere Hauptversion (M50 — version wurde geschrieben, nie gelesen)', () => {
    expect(normalizePresentation({ version: '2.0' }).fromNewerVersion).toBe(true)
    expect(normalizePresentation({ version: '1.0' }).fromNewerVersion).toBe(false)
    expect(normalizePresentation({ version: '1.7' }).fromNewerVersion).toBe(false)
    // Unsinn in `version` darf nicht dazu führen, dass gar nichts mehr öffnet.
    expect(normalizePresentation({ version: 'kaputt' }).fromNewerVersion).toBe(false)
  })

  it('macht ein Deck mit kaputten Zonen renderbar statt weiß', () => {
    const { presentation } = normalizePresentation({
      zones: [null, { id: 'x', style: null }, { id: 'y', markdown: 42 }],
    })
    expect(() => renderFullPage(presentation, {})).not.toThrow()
    expect(presentation.zones).toHaveLength(3)
  })
})
