import { describe, it, expect } from 'vitest'
import { scanForUntranslated } from '../../scripts/check-i18n.mjs'

// Hängt das Literal-Gate an `npm run build` (= tsc && vitest && vite build).
// Ein Gate, das man extra aufrufen muss, wird nicht aufgerufen.
//
// Was der Scanner NICHT leisten kann: `.tsx` wird von keinem Rendering-Test
// erfasst (kein @testing-library im Projekt). Für die Komponenten sind daher
// `tsc` und dieser Scanner die einzige automatische Absicherung — der Rest ist
// der GUI-Durchlauf.
describe('Oberflächentext liegt im Katalog', () => {
  it('findet keine nicht migrierten Literale mehr', () => {
    const findings = scanForUntranslated(process.cwd())
    const report = findings
      .map((f) => `${f.file}:${f.line} [${f.kind}] ${f.text}`)
      .join('\n')
    expect(report, `\n${findings.length} nicht migrierte Fundstelle(n):\n${report}\n`).toBe('')
  })
})
