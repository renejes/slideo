import { describe, it, expect } from 'vitest'
import { splitMarkdownBlocks, setBlockImageWidth } from './markdown-tiptap'
import { classifyPreviewChange } from './preview-diff'
import { applyElementOp, safeGoto } from './dom-edit'
import { parseBlocks } from './pptx'
import { samplePrompt } from './onboarding'
import type { Presentation, Zone, AssetMap } from '@/types'
import { DEFAULT_TOKENS, DEFAULT_ZONE_STYLE, FILE_FORMAT_VERSION } from '@/types'

// Reine Funktionen der Render-/Edit-/Export-Pipeline. Sie tragen die riskantesten
// Invarianten der App (Blockindizes, Patch-Entscheidungen, DOM-Pfade) und hatten
// bis zum Review 2026-08 keinerlei Abdeckung.

function zone(p: Partial<Zone> = {}): Zone {
  return {
    id: p.id ?? 'z1',
    label: p.label ?? 'Slide 1',
    order: p.order ?? 0,
    content_type: p.content_type ?? 'markdown',
    markdown: p.markdown ?? '# A',
    html: p.html ?? null,
    custom_css: p.custom_css ?? '',
    style: { ...DEFAULT_ZONE_STYLE, ...(p.style ?? {}) },
    notes: p.notes ?? '',
    reveal: p.reveal,
  }
}

function deck(zones: Zone[]): Presentation {
  return {
    version: FILE_FORMAT_VERSION,
    meta: { title: 'T', created: 'c', modified: 'm' },
    tokens: { ...DEFAULT_TOKENS },
    zones,
  }
}

// ---------------------------------------------------------------------------
describe('splitMarkdownBlocks', () => {
  it('trennt Top-Level-Blöcke und ist beim Rejoin verlustfrei', () => {
    const md = '# Titel\n\nEin Absatz.\n\n- a\n- b'
    const blocks = splitMarkdownBlocks(md)
    expect(blocks).toHaveLength(3)
    expect(blocks[0]).toBe('# Titel')
    expect(blocks[2]).toBe('- a\n- b')
  })

  it('behält mehrzeilige Blöcke zusammen (Codefence bleibt EIN Block)', () => {
    const blocks = splitMarkdownBlocks('```js\nconst a = 1\n\nconst b = 2\n```')
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain('const b = 2')
  })

  it('bewahrt Link-Referenz-Definitionen (Bug B10 aus dem Pre-Release-Review)', () => {
    // markdown-it konsumiert `[id]: url` in env.references und emittiert KEIN Token —
    // ohne die Orphan-Rettung ginge die Definition beim Split verloren.
    const md = 'Siehe [Doku][d].\n\n[d]: https://example.com'
    const blocks = splitMarkdownBlocks(md)
    expect(blocks.join('\n\n')).toContain('[d]: https://example.com')
  })

  it('liefert für leere Eingabe ein leeres Array, nie [""]', () => {
    expect(splitMarkdownBlocks('')).toEqual([])
    expect(splitMarkdownBlocks('   \n\n  ')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('setBlockImageWidth', () => {
  it('wandelt ein Markdown-Bild in ein <img> mit Breite', () => {
    expect(setBlockImageWidth('![Katze](assets/a.png)', '60%')).toBe(
      '<img src="assets/a.png" alt="Katze" style="width:60%">',
    )
  })

  it('ersetzt eine bestehende Breite, statt sie zu duplizieren', () => {
    const out = setBlockImageWidth('<img src="a.png" style="width:20%;border-radius:4px">', '80%')
    expect(out).toContain('width:80%')
    expect(out).not.toContain('width:20%')
    expect(out).toContain('border-radius:4px')
  })

  it('lässt Blöcke unverändert, in denen das Bild nicht am Anfang steht (bekannte Grenze H17)', () => {
    const block = 'Text davor ![x](a.png)'
    expect(setBlockImageWidth(block, '50%')).toBe(block)
  })
})

// ---------------------------------------------------------------------------
describe('classifyPreviewChange', () => {
  const assets: AssetMap = {}

  it('erster Render → full', () => {
    expect(classifyPreviewChange(null, deck([zone()]), null, assets, false, false).kind).toBe('full')
  })

  it('unveränderter Stand → none', () => {
    const a = deck([zone()])
    expect(classifyPreviewChange(a, a, assets, assets, false, false).kind).toBe('none')
  })

  it('Textänderung einer Zone → patch mit genau dieser Zonen-ID', () => {
    const a = deck([zone({ id: 'z1' }), zone({ id: 'z2', order: 1 })])
    const b = deck([zone({ id: 'z1', markdown: '# Neu' }), zone({ id: 'z2', order: 1 })])
    const r = classifyPreviewChange(a, b, assets, assets, false, false)
    expect(r.kind).toBe('patch')
    if (r.kind === 'patch') {
      expect(r.zoneIds).toEqual(['z1'])
      expect(r.tokens).toBeNull()
    }
  })

  it('Strukturänderung (Zone entfernt) → full', () => {
    const a = deck([zone({ id: 'z1' }), zone({ id: 'z2', order: 1 })])
    const b = deck([zone({ id: 'z1' })])
    expect(classifyPreviewChange(a, b, assets, assets, false, false).kind).toBe('full')
  })

  it('Reorder (gleiche Anzahl, andere IDs an den Positionen) → full', () => {
    const a = deck([zone({ id: 'z1' }), zone({ id: 'z2', order: 1 })])
    const b = deck([zone({ id: 'z2' }), zone({ id: 'z1', order: 1 })])
    expect(classifyPreviewChange(a, b, assets, assets, false, false).kind).toBe('full')
  })

  it('previewEdit-Toggle → full (die injizierten Skripte ändern sich)', () => {
    const a = deck([zone()])
    expect(classifyPreviewChange(a, a, assets, assets, false, true).kind).toBe('full')
  })

  it('neue Asset-Map-Identität → full', () => {
    const a = deck([zone()])
    expect(classifyPreviewChange(a, a, assets, { ...assets }, false, false).kind).toBe('full')
  })

  it('Token-Änderung → patch mit tokens', () => {
    const a = deck([zone()])
    const b = deck([zone()])
    b.tokens = { ...b.tokens, 'color-bg': '#fff' }
    const r = classifyPreviewChange(a, b, assets, assets, false, false)
    expect(r.kind).toBe('patch')
    if (r.kind === 'patch') expect(r.tokens?.['color-bg']).toBe('#fff')
  })

  it('ENTFERNTER Token-Key → full (Inline-Patch könnte ihn nicht löschen)', () => {
    const a = deck([zone()])
    a.tokens = { ...a.tokens, 'color-custom': '#123456' }
    const b = deck([zone()])
    expect(classifyPreviewChange(a, b, assets, assets, false, false).kind).toBe('full')
  })
})

// ---------------------------------------------------------------------------
describe('applyElementOp', () => {
  const html = '<div><p>eins</p><p>zwei</p></div>'

  it('löscht das adressierte Element über den Kind-Index-Pfad', () => {
    expect(applyElementOp(html, [0, 0], 'delete')).toBe('<div><p>zwei</p></div>')
  })

  it('dupliziert direkt hinter das Original', () => {
    const out = applyElementOp(html, [0, 0], 'duplicate')
    expect(out).toBe('<div><p>eins</p><p>eins</p><p>zwei</p></div>')
  })

  it('ist bei ungültigem Pfad ein No-op', () => {
    expect(applyElementOp(html, [0, 9], 'delete')).toBe(html)
    expect(applyElementOp(html, [7], 'delete')).toBe(html)
  })

  it('Stale-Pfad-Schutz: falsches expectTag ⇒ No-op (paralleler MCP-Umbau)', () => {
    expect(applyElementOp(html, [0, 0], 'delete', { expectTag: 'h1' })).toBe(html)
    expect(applyElementOp(html, [0, 0], 'delete', { expectTag: 'p' })).not.toBe(html)
  })

  it('editText säubert <script> weg und behält erlaubtes Inline-Markup', () => {
    const out = applyElementOp(html, [0, 0], 'editText', {
      html: 'a <strong>b</strong><script>alert(1)</script>',
    })
    expect(out).toContain('<strong>b</strong>')
    expect(out).not.toContain('alert(1)')
    expect(out).not.toContain('<script')
  })

  it('editText verweigert Container mit Block-Kindern (kein Flatten)', () => {
    const nested = '<div><div><p>x</p></div></div>'
    expect(applyElementOp(nested, [0, 0], 'editText', { html: 'platt' })).toBe(nested)
  })

  it('editText verweigert einen Block mit verschachteltem Bild (Bug B3 aus dem Pre-Release-Review)', () => {
    const withImg = '<div><p><a href="#"><img src="a.png"></a></p></div>'
    expect(applyElementOp(withImg, [0, 0], 'editText', { html: 'weg' })).toBe(withImg)
  })
})

// ---------------------------------------------------------------------------
describe('safeGoto (Spiegel von Rusts safe_goto)', () => {
  it('lässt nur [A-Za-z0-9-_:] durch', () => {
    expect(safeGoto('zone-1_a:b')).toBe('zone-1_a:b')
    expect(safeGoto('a"><script>')).toBe('ascript')
    expect(safeGoto('ü#ä!x')).toBe('x')
  })

  it('kappt bei 64 Zeichen', () => {
    expect(safeGoto('a'.repeat(100))).toHaveLength(64)
  })
})

// ---------------------------------------------------------------------------
describe('parseBlocks (PPTX-Export)', () => {
  it('erkennt Überschriftenebenen und Absätze', () => {
    const blocks = parseBlocks('# H1\n\n## H2\n\nText')
    expect(blocks.map((b) => b.kind)).toEqual(['h1', 'h2', 'p'])
    expect(blocks[0].text).toBe('H1')
  })

  it('erkennt Aufzählungs- und Nummernlisten getrennt', () => {
    expect(parseBlocks('- eins\n- zwei').map((b) => b.kind)).toEqual(['bullet', 'bullet'])
    expect(parseBlocks('1. eins\n2. zwei').map((b) => b.kind)).toEqual(['number', 'number'])
  })

  it('strippt Bilder und den +++-Spaltentrenner', () => {
    // Dokumentiert die bekannte Grenze H21: Bilder sind für parseBlocks unsichtbar,
    // deshalb verliert der Split-Zweig sie (separat behandelt in Maßnahme #22).
    expect(parseBlocks('![x](a.png)\n\nText').map((b) => b.text)).toEqual(['Text'])
    expect(parseBlocks('links\n\n+++\n\nrechts').map((b) => b.text)).toEqual(['links', 'rechts'])
  })

  it('lässt leere Eingabe leer', () => {
    expect(parseBlocks('')).toEqual([])
  })
})

// ---------------------------------------------------------------------------
describe('samplePrompt (Onboarding)', () => {
  it('setzt einen Platzhalter statt eines Unsinn-Themas, wenn der Titel die Vorbelegung ist (M2)', () => {
    const p = samplePrompt('Meine Präsentation')
    expect(p).toContain('[dein Thema]')
    expect(p).not.toContain('Meine Präsentation')
  })

  it('nutzt einen echten Titel als Thema', () => {
    expect(samplePrompt('Quartalsbericht Q3')).toContain('„Quartalsbericht Q3“')
  })

  it('fällt bei leerem Titel auf den Platzhalter zurück', () => {
    expect(samplePrompt('  ')).toContain('[dein Thema]')
  })
})
