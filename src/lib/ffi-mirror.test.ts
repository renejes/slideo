import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { DEFAULT_TOKENS } from '@/types'
import { PRESETS } from './presets'
import { safeGoto } from './dom-edit'

// ---------------------------------------------------------------------------
// Befund S10 (Review 2026-08): mehrere Konstanten und Prädikate leben doppelt —
// einmal in TypeScript, einmal in Rust — und die einzige Absicherung war bisher
// ein Kommentar („Beim Ändern beide Seiten anpassen"). Diese Suite macht daraus
// eine Assertion. Sie liest die Rust-Quelle als Text; das ist bewusst simpel
// gehalten, damit sie ohne Rust-Toolchain im normalen `npm test` läuft.
// ---------------------------------------------------------------------------

// process.cwd() ist beim Vitest-Lauf die Projektwurzel (vitest.config.ts liegt dort).
const rust = (rel: string) => readFileSync(resolve(process.cwd(), 'src-tauri/src', rel), 'utf8')

/** Extrahiert alle `"key": "value"`-Paare aus einem Rust-`json!`-Block. */
function jsonPairs(block: string): Record<string, string> {
  const out: Record<string, string> = {}
  const re = /"([a-z-]+)"\s*:\s*"([^"]*)"/g
  let m: RegExpExecArray | null
  while ((m = re.exec(block)) !== null) out[m[1]] = m[2]
  return out
}

describe('DEFAULT_TOKENS: types/index.ts ↔ tools.rs default_tokens()', () => {
  it('beide Seiten definieren dieselben Tokens mit denselben Werten', () => {
    const src = rust('tools.rs')
    const start = src.indexOf('pub fn default_tokens()')
    expect(start, 'default_tokens() in tools.rs nicht gefunden').toBeGreaterThan(-1)
    const block = src.slice(start, src.indexOf('\n}', start))
    const rustTokens = jsonPairs(block)

    expect(Object.keys(rustTokens).sort()).toEqual(Object.keys(DEFAULT_TOKENS).sort())
    for (const [k, v] of Object.entries(DEFAULT_TOKENS)) {
      expect(rustTokens[k], `Token „${k}" weicht ab`).toBe(v)
    }
  })
})

describe('PRESETS: presets.ts ↔ presets.rs', () => {
  const src = rust('presets.rs')

  it('beide Seiten kennen dieselben Preset-Namen in derselben Reihenfolge', () => {
    const names = [...src.matchAll(/"name"\s*:\s*"([^"]+)"/g)].map((m) => m[1])
    expect(names).toEqual(PRESETS.map((p) => p.name))
  })

  it('jedes Preset trägt auf beiden Seiten identische Tokens', () => {
    // label/description dürfen abweichen: die Rust-Seite ist AI-facing englisch,
    // die TS-Seite treibt den deutschen Theme-Picker (bewusste Entscheidung).
    for (const preset of PRESETS) {
      const at = src.indexOf(`"name": "${preset.name}"`)
      expect(at, `Preset „${preset.name}" fehlt in presets.rs`).toBeGreaterThan(-1)
      const tokensAt = src.indexOf('"tokens"', at)
      const block = src.slice(tokensAt, src.indexOf('}', src.indexOf('{', tokensAt)))
      const rustTokens = jsonPairs(block)
      for (const [k, v] of Object.entries(preset.tokens)) {
        expect(rustTokens[k], `Preset „${preset.name}", Token „${k}" weicht ab`).toBe(v)
      }
    }
  })
})

describe('safeGoto ↔ safe_goto (dom-edit.ts ↔ components.rs)', () => {
  it('die Rust-Seite filtert dieselbe Zeichenklasse und kappt bei 64', () => {
    const src = rust('components.rs')
    const at = src.indexOf('fn safe_goto')
    expect(at, 'safe_goto in components.rs nicht gefunden').toBeGreaterThan(-1)
    const block = src.slice(at, at + 400)
    expect(block, "Rust erlaubt nicht mehr genau '-' | '_' | ':'").toContain(
      "matches!(c, '-' | '_' | ':')",
    )
    expect(block).toContain('is_ascii_alphanumeric')
    expect(block, 'Rust kappt nicht mehr bei 64').toContain('.take(64)')
  })

  it('die TS-Seite verhält sich auf denselben Eingaben identisch zur Rust-Spezifikation', () => {
    // Referenzimplementierung der Rust-Regel, direkt aus deren Zeichenklasse.
    const rustEquivalent = (t: string) =>
      [...t].filter((c) => /[A-Za-z0-9]/.test(c) || c === '-' || c === '_' || c === ':').slice(0, 64).join('')
    for (const probe of ['zone-1', 'a"><script>', 'ü#ä!x', 'A'.repeat(100), '', 'a:b_c-d']) {
      expect(safeGoto(probe), `Abweichung bei „${probe}"`).toBe(rustEquivalent(probe))
    }
  })
})
