// Onboarding-Helfer (Bereich 1 der Workflow-Optimierung).
//
// Slideos Kern-These: ein KI-Agent (ein beliebiger MCP-Client, z.B. Claude Desktop
// oder Codex CLI) baut das Deck über den MCP-Server, der Mensch editiert drüber.
// Damit der erste Eindruck das vermittelt, bietet das Onboarding einen **fertigen
// Beispiel-Prompt** zum Kopieren — die „…und jetzt?"-Lücke nach dem Anlegen eines Decks.

/** Titel, die kein Thema sind — daraus darf kein Prompt „über …" gebaut werden. */
const PLACEHOLDER_TITLES = ['meine präsentation', 'unbenannt', 'neue präsentation', 'praesentation']

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
  const thema = isPlaceholder ? '[dein Thema]' : `„${clean}“`
  return (
    `Baue in Slideo eine Präsentation über ${thema}. ` +
    `Erstelle 6–8 klare Folien — eine Kernaussage pro Folie, in Markdown. ` +
    `Nutze die Design-Tokens, passende Layouts und fertige Komponenten und halte ` +
    `alles in der 1280×720-Safe-Area. Die Folien erscheinen live in Slideo, während du baust.`
  )
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
