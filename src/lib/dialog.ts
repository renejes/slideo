import { isTauri } from './tauri'

// Native Bestätigungsdialoge. In Tauris WKWebView ist window.prompt nicht
// verfügbar und window.confirm unzuverlässig — daher den Dialog-Plugin nutzen.
export async function confirmDialog(message: string, title = 'Slideo'): Promise<boolean> {
  if (isTauri()) {
    const { ask } = await import('@tauri-apps/plugin-dialog')
    return ask(message, { title, kind: 'warning' })
  }
  return window.confirm(message)
}

/** Öffnet einen nativen Ordner-Auswahldialog. Gibt den Pfad zurück (oder null). */
export async function pickDirectory(defaultPath?: string | null): Promise<string | null> {
  if (!isTauri()) return null
  const { open } = await import('@tauri-apps/plugin-dialog')
  const selected = await open({
    directory: true,
    multiple: false,
    defaultPath: defaultPath ?? undefined,
  })
  return typeof selected === 'string' ? selected : null
}

/** Liefert den Desktop-Ordner des Nutzers (oder null außerhalb von Tauri). */
export async function getDesktopDir(): Promise<string | null> {
  if (!isTauri()) return null
  try {
    const { desktopDir } = await import('@tauri-apps/api/path')
    return await desktopDir()
  } catch {
    return null
  }
}

/** Verbindet Ordner + Dateiname plattformkorrekt. */
export async function joinPath(dir: string, file: string): Promise<string> {
  if (isTauri()) {
    const { join } = await import('@tauri-apps/api/path')
    return join(dir, file)
  }
  return `${dir.replace(/[/\\]$/, '')}/${file}`
}
