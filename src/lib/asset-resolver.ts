// Auflösung von `assets/<name>` → Data-URI, NUR für die Anzeige im Editor
// (der Tiptap-Bild-Knoten zeigt das Bild, das gespeicherte Markdown bleibt
// `assets/<name>`). Bewusst ohne Store-Import, um Zyklen zu vermeiden — der
// Store registriert den Resolver beim Start (setAssetResolver).

let resolver: (name: string) => string | undefined = () => undefined

export function setAssetResolver(fn: (name: string) => string | undefined): void {
  resolver = fn
}

/** Gibt die Data-URI zu einem `assets/<name>`-Verweis zurück, sonst undefined. */
export function resolveAsset(name: string): string | undefined {
  return resolver(name)
}
