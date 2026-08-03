/// <reference types="vite/client" />

// Die Standard-Typdeklaration des Vite-Templates, die in diesem Projekt fehlte.
// Ohne sie ist `import.meta.env` untypisiert — aufgefallen beim i18n-Umbau, wo
// `t()` einen unbekannten Schlüssel in der Entwicklung laut wirft und in der
// ausgelieferten App still auf Deutsch zurückfällt (src/i18n/index.ts).

/**
 * Der Literal-Scanner liegt als reines ESM-Skript unter `scripts/` (außerhalb von
 * `tsconfig.include`), damit er auch ohne Build direkt per `node` läuft. Für den
 * Vitest-Aufruf in `src/i18n/scan.test.ts` braucht er hier eine Typangabe.
 */
declare module '*/check-i18n.mjs' {
  export interface I18nFinding {
    file: string
    line: number
    kind: string
    text: string
    context: string
  }
  export function scanForUntranslated(cwd?: string): I18nFinding[]
}
