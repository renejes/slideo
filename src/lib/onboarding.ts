// Onboarding-Helfer (Bereich 1 der Workflow-Optimierung).
//
// Slideos Kern-These: ein KI-Agent (ein beliebiger MCP-Client, z.B. Claude Desktop
// oder Codex CLI) baut das Deck über den MCP-Server, der Mensch editiert drüber.
// Damit der erste Eindruck das vermittelt, bietet das Onboarding einen **fertigen
// Beispiel-Prompt** zum Kopieren — die „…und jetzt?"-Lücke nach dem Anlegen eines Decks.

/** Fertiger Beispiel-Prompt (für jeden MCP-KI-Agenten) für ein frisches Deck. */
export function samplePrompt(title: string, templateLabel?: string): string {
  const thema = (title || 'mein Thema').trim()
  const stil = templateLabel && templateLabel !== 'Leer' ? ` im Stil „${templateLabel}“` : ''
  return (
    `Baue in Slideo eine Präsentation über „${thema}“${stil}. ` +
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
