import { describe, it, expect, afterEach } from 'vitest'
import { de } from './de'
import { en } from './en'
import { applyLocale, getLocale, t, tp, localeTag, type Locale } from './index'

// ---------------------------------------------------------------------------
// Was dieser Test NICHT prüft: dass beide Kataloge dieselben Schlüssel haben.
// Das erledigt `tsc --noEmit` bereits schärfer und früher — `en.ts` ist als
// `Record<I18nKey, string>` typisiert, jede Bereichsdatei zusätzlich gegen ihr
// deutsches Gegenstück. Eine fehlende Übersetzung ist ein Compile-Fehler mit
// Zeilenangabe, kein Testfehler.
//
// Hier stehen die Dinge, die ein Typ NICHT sehen kann.
// ---------------------------------------------------------------------------

const CATALOGS: Record<Locale, Record<string, string>> = { de, en }

/** Alle `{platzhalter}` eines Textes, sortiert. */
function slots(value: string): string[] {
  return (value.match(/\{(\w+)\}/g) ?? []).sort()
}

afterEach(() => applyLocale('de'))

describe('Katalog-Konsistenz', () => {
  it('kennt überhaupt Schlüssel (Schutz gegen leeres Grün)', () => {
    // Ohne das würde die ganze Suite auch dann grün, wenn der Katalog leer wäre:
    // alle anderen Prüfungen iterieren über die Schlüssel und wären trivial erfüllt.
    // Die Untergrenze liegt bewusst unter dem Ist-Stand, aber weit über null.
    expect(Object.keys(de).length).toBeGreaterThan(500)
  })

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}: kein leerer oder nur aus Leerraum bestehender Wert`, () => {
      const empty = Object.entries(catalog)
        .filter(([, v]) => v.trim() === '')
        .map(([k]) => k)
      expect(empty).toEqual([])
    })
  }

  it('beide Sprachen benutzen je Schlüssel dieselben Platzhalter', () => {
    // Fängt den häufigsten Übersetzungsfehler: die englische Fassung vergisst
    // `{count}` oder erfindet `{name}` — der Text rendert dann mit einer Lücke
    // oder mit sichtbaren geschweiften Klammern.
    const mismatched = Object.keys(de)
      .filter((k) => slots(de[k as keyof typeof de]).join() !== slots(en[k as keyof typeof en]).join())
      .map((k) => `${k}: de=[${slots(de[k as keyof typeof de])}] en=[${slots(en[k as keyof typeof en])}]`)
    expect(mismatched).toEqual([])
  })

  it('Plural-Schlüssel treten immer als Paar .one/.other auf', () => {
    const bases = new Set(
      Object.keys(de)
        .filter((k) => k.endsWith('.one') || k.endsWith('.other'))
        .map((k) => k.replace(/\.(one|other)$/, '')),
    )
    const incomplete = [...bases].filter((b) => !(`${b}.one` in de) || !(`${b}.other` in de))
    expect(incomplete).toEqual([])
  })

  for (const [locale, catalog] of Object.entries(CATALOGS)) {
    it(`${locale}: kein Wert enthält Backtick oder \${ (Template-Literal-Falle)`, () => {
      // Diese beiden Zeichenfolgen sind in Oberflächentext nie gewollt, aber in
      // diesem Projekt lethal: Teile des Katalogs landen in `renderer.ts` in
      // injizierten Skripten, die als Template-Literale gebaut werden. Ein
      // Backtick darin zerlegt das Literal — der Build bleibt grün, zur Laufzeit
      // stirbt der komplette Overlay-Layer. Genau das ist hier schon dreimal
      // passiert (siehe renderer.test.ts).
      const bad = Object.entries(catalog)
        .filter(([, v]) => v.includes('`') || v.includes('${'))
        .map(([k]) => k)
      expect(bad).toEqual([])
    })
  }
})

describe('t()', () => {
  it('liefert den deutschen Text als Default', () => {
    expect(getLocale()).toBe('de')
    expect(t('common.cancel')).toBe('Abbrechen')
  })

  it('folgt der aktiven Sprache', () => {
    applyLocale('en')
    expect(t('common.cancel')).toBe('Cancel')
  })

  it('ersetzt Platzhalter und lässt unbekannte stehen', () => {
    expect(t('common.slideCount.other', { count: 7 })).toBe('7 Folien')
    // Ein nicht übergebener Platzhalter darf nicht zu "undefined" werden —
    // sichtbares `{count}` ist als Fehlerbild deutlich weniger schlimm.
    expect(t('common.slideCount.other')).toBe('{count} Folien')
  })
})

describe('tp()', () => {
  it('wählt Singular und Plural nach den Regeln der Sprache', () => {
    expect(tp('common.slideCount', 1)).toBe('1 Folie')
    expect(tp('common.slideCount', 0)).toBe('0 Folien')
    expect(tp('common.slideCount', 12)).toBe('12 Folien')
    applyLocale('en')
    expect(tp('common.slideCount', 1)).toBe('1 slide')
    expect(tp('common.slideCount', 0)).toBe('0 slides')
  })
})

describe('localeTag()', () => {
  it('liefert ein für Intl brauchbares Tag', () => {
    expect(localeTag('de')).toBe('de-DE')
    expect(localeTag('en')).toBe('en-US')
  })
})
