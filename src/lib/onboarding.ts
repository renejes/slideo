import { t } from '@/i18n'

// Onboarding-Helfer (Bereich 1 der Workflow-Optimierung).
//
// Slideos Kern-These: ein KI-Agent (ein beliebiger MCP-Client, z.B. Claude Desktop
// oder Codex CLI) baut das Deck über den MCP-Server, der Mensch editiert drüber.
// Damit der erste Eindruck das vermittelt, bietet das Onboarding einen **fertigen
// Beispiel-Prompt** zum Kopieren — die „…und jetzt?"-Lücke nach dem Anlegen eines Decks.

/**
 * Titel, die kein Thema sind — daraus darf kein Prompt „über …" gebaut werden.
 *
 * Die Liste vergleicht auf ANZEIGETEXT und muss deshalb die Vorbelegungen ALLER
 * Sprachen führen: ein Deck kann auf Deutsch angelegt und in englischer
 * Oberfläche weiterbearbeitet worden sein (und umgekehrt). Der Vergleich läuft
 * kleingeschrieben — Groß-/Kleinschreibung der Vorbelegung ist egal.
 */
const PLACEHOLDER_TITLES = [
  'meine präsentation',
  'unbenannt',
  'neue präsentation',
  'praesentation',
  'my presentation',
  'untitled',
  'new presentation',
  // Bewusst NICHT: das blosse 'presentation' — anders als die uebrigen
  // Eintraege ist das kein Default der App, aber ein sehr plausibler echter
  // Deck-Titel. Es wuerde einem Nutzer sein Thema wegnehmen.
]

/**
 * Fertiger Beispiel-Prompt (für jeden MCP-KI-Agenten) für ein frisches Deck.
 *
 * Der frühere `templateLabel`-Parameter ist entfallen — er hatte nie einen Aufrufer
 * (Befund S30). Und der Titel wird jetzt geprüft (Befund M2): der Nudge reichte
 * `presentation.meta.title` durch, sodass mit der Vorbelegung wörtlich
 * „Baue in Slideo eine Präsentation über ‚Meine Präsentation'." in der Zwischenablage
 * landete — der allererste Eindruck vom Kernfeature.
 */
export function samplePrompt(title: string): string {
  const clean = (title || '').trim()
  const isPlaceholder = !clean || PLACEHOLDER_TITLES.includes(clean.toLowerCase())
  // Der Prompt folgt der UI-Sprache: der Mensch liest ihn, bevor er ihn absendet.
  // Auch die Anführungszeichen sind sprachabhängig (deutsch „…" vs. englisch “…”).
  const topic = isPlaceholder
    ? t('lib.onboarding.topicPlaceholder')
    : t('lib.onboarding.topicQuoted', { title: clean })
  return t('lib.onboarding.samplePrompt', { topic })
}

/** Kopiert Text in die Zwischenablage; true bei Erfolg. */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text)
    return true
  } catch {
    return false
  }
}
