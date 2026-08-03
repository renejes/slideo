import { de } from './de'
import { en } from './en'

// -----------------------------------------------------------------------------
// i18n-Kern (Review 2026-08, Entscheidung E2 vom 2026-08-03).
//
// Deutsch bleibt die Default-Sprache der Oberfläche; Englisch ist in den
// Einstellungen wählbar. Bewusst KEINE Bibliothek (i18next & Co.), aus zwei
// projektspezifischen Gründen:
//
//  1. `t()` muss OHNE React-Kontext funktionieren. Die meisten Meldungen der App
//     entstehen im Zustand-Store (`store/presentation.ts`, 35 Toasts) und im
//     Renderer (`lib/renderer.ts`, injiziertes Iframe-Skript) — beide haben
//     keinen React-Baum über sich. Ein Modul-Singleton ist dort schlicht das
//     einfachere Werkzeug als ein Instanz-Handoff.
//  2. Der Katalog muss `as const` sein, damit `keyof typeof de` den Schlüsseltyp
//     ableitet. Damit erzwingt `tsc --noEmit` — der erste Schritt von
//     `npm run build` — sowohl gültige Schlüssel an jeder Aufrufstelle als auch
//     die VOLLSTÄNDIGKEIT des englischen Katalogs (siehe `en.ts`). Eine
//     Bibliothek müsste man dafür erst konfigurieren, ohne etwas zu gewinnen.
//
// Der Umfang trägt das: nur 2 Sprachen, ~10 Plural-Stellen, 2 Formatier-Stellen,
// kein Lazy-Loading (Desktop-App, alles gebundelt).
// -----------------------------------------------------------------------------

export type Locale = 'de' | 'en'

/** Auswählbare Sprachen inkl. Anzeigename (in der jeweiligen Sprache selbst). */
export const LOCALES: { value: Locale; label: string }[] = [
  { value: 'de', label: 'Deutsch' },
  { value: 'en', label: 'English' },
]

/**
 * Jeder gültige Katalog-Schlüssel. Abgeleitet aus dem DEUTSCHEN Katalog — der ist
 * die Quelle, `en.ts` muss sich daran messen lassen.
 */
export type I18nKey = keyof typeof de

/**
 * Plural-Basisschlüssel: alles, wovon es eine `.other`-Variante gibt.
 * `tp('history.snapshots', n)` ist damit typgeprüft, ohne dass man den
 * zusammengesetzten Schlüssel jemals von Hand schreibt.
 */
export type PluralKey = {
  [K in I18nKey]: K extends `${infer Base}.other` ? Base : never
}[I18nKey]

const STORAGE_KEY = 'slideo-locale'

const CATALOGS: Record<Locale, Record<string, string>> = { de, en }

function readStored(): Locale | null {
  try {
    const v = localStorage.getItem(STORAGE_KEY)
    return v === 'de' || v === 'en' ? v : null
  } catch {
    // Kein localStorage (SSR-artige Kontexte, Tests, gesperrter Speicher) → Default.
    return null
  }
}

// Die aktive Sprache wird beim Laden des Moduls aus dem Speicher gesetzt.
//
// Das löst nebenbei ein reales Problem: das Projektor-Fenster ist ein eigener
// WebView ohne App-Store und ohne MCP-Bridge (`main.tsx`). Weil es dieselbe
// Origin und damit denselben localStorage hat, bekommt es die Sprache
// automatisch richtig — ganz ohne fensterübergreifende Zustandssynchronisation.
let active: Locale = readStored() ?? 'de'

/** Sprache, in der die laufende Fensterinstanz gerendert ist. */
export function getLocale(): Locale {
  return active
}

/**
 * Setzt die aktive Sprache SOFORT — ohne sie zu speichern.
 *
 * Die Einstellungen rufen das bewusst NICHT auf: ein Wechsel wirkt dort erst
 * nach einem Neustart (siehe `setStoredLocale`/`localeNeedsRestart`). Das ist
 * eine Produktentscheidung, keine technische Grenze — fünf Stellen halten die
 * Sprache heute noch nicht nach (Tiptap-Placeholder wird einmalig in
 * `useEditor()` konfiguriert; die drei Render-`useMemo` in PresentationMode,
 * ProjectorView und SlidePreview; `classifyPreviewChange`). Sind die verdrahtet,
 * genügt ein Aufruf hier plus ein Re-Render, um live umzuschalten.
 *
 * Genutzt wird die Funktion heute von den Tests, die beide Kataloge durch
 * dieselben Render-Pfade schicken müssen.
 */
export function applyLocale(locale: Locale): void {
  active = locale
}

/** Sprache, die beim nächsten Start gilt (= das, was in den Einstellungen steht). */
export function getStoredLocale(): Locale {
  return readStored() ?? 'de'
}

/** Sprachwahl merken. Wirkt erst beim nächsten Start — siehe `localeNeedsRestart`. */
export function setStoredLocale(locale: Locale): void {
  try {
    localStorage.setItem(STORAGE_KEY, locale)
  } catch {
    // Nicht persistierbar: die Wahl gilt dann nur bis zum Schließen. Kein Grund
    // zu scheitern — die Oberfläche bleibt in der aktiven Sprache benutzbar.
  }
}

/** true, wenn die gewählte Sprache erst nach einem Neustart greift. */
export function localeNeedsRestart(): boolean {
  return getStoredLocale() !== active
}

/** Ersetzt `{name}`-Platzhalter. Unbekannte Namen bleiben unangetastet stehen. */
function format(raw: string, params: Record<string, string | number>): string {
  return raw.replace(/\{(\w+)\}/g, (whole, name: string) =>
    name in params ? String(params[name]) : whole,
  )
}

/**
 * Übersetzt einen Schlüssel.
 *
 * Statische Schlüssel kann es zur Laufzeit nicht verfehlen (`tsc` prüft sie gegen
 * `I18nKey`, und `en.ts` ist über `Record<…>` vollständigkeitsgeprüft). Der
 * Fallback greift nur für dynamisch zusammengesetzte Schlüssel: in der Entwicklung
 * laut, in der ausgelieferten App still auf Deutsch zurück. Ein Wurf in Produktion
 * würde in `renderer.ts` nicht ein Label kosten, sondern den gesamten
 * Overlay-Layer.
 */
export function t(key: I18nKey, params?: Record<string, string | number>): string {
  const raw = CATALOGS[active][key] ?? (de as Record<string, string>)[key]
  if (raw === undefined) {
    if (import.meta.env.DEV) throw new Error(`[i18n] Unbekannter Schlüssel: ${key}`)
    return key
  }
  return params ? format(raw, params) : raw
}

/**
 * Übersetzt eine gezählte Angabe. `count` steht im Text als `{count}` bereit.
 *
 * Ersetzt die ~10 handgebauten Ternaries der Art `Folie${n === 1 ? '' : 'n'}` —
 * die sind nicht nur unübersetzbar, sie greppen sich auch nicht.
 */
export function tp(
  base: PluralKey,
  count: number,
  params?: Record<string, string | number>,
): string {
  const rule = new Intl.PluralRules(active).select(count)
  const exact = `${base}.${rule}`
  const key = (exact in CATALOGS[active] ? exact : `${base}.other`) as I18nKey
  return t(key, { count, ...params })
}

/**
 * Locale-Kennung für `Intl`-Formatierer und für das `lang`-Attribut.
 * (Für die Sprache eines DECKS gilt `meta.language`, nicht diese Funktion.)
 */
export function localeTag(locale: Locale = active): string {
  return locale === 'de' ? 'de-DE' : 'en-US'
}
