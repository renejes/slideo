import { isTauri } from './tauri'

// Bridge zu den Rust-Commands der MCP-Ziel-Registrierung (Startauswahl).
// Slideo registriert sich als MCP-Server bei GENAU EINEM Ziel; die jeweils
// anderen werden deregistriert. Logik/Quelle der Wahrheit liegt in Rust
// (src-tauri/src/mcp_registration.rs) — hier nur dünne Wrapper.

export type McpTarget = 'desktop' | 'meta' | 'claude'

export interface McpTargetState {
  /** Ziel erreichbar/installiert (Meta-MCP: läuft; Claude: Config vorhanden). */
  available: boolean
  /** Slideo ist aktuell in diesem Ziel eingetragen. */
  registered: boolean
}

export interface McpStatus {
  /** Ob bereits eine Erstauswahl getroffen wurde. Ist false, ist `target` nur der empfohlene Default. */
  configured: boolean
  /** Aktuell gewähltes (bzw. bei !configured: empfohlenes) Ziel. */
  target: McpTarget
  /** Anzahl der MCP-Tools, zur Laufzeit aus `tools::tool_schemas()` abgeleitet
   *  (Befund M1: die Modals bewarben hartkodiert 35, real waren es 37). */
  toolCount: number
  desktop: McpTargetState
  meta: McpTargetState
  claude: McpTargetState
  /** Letzter Registrierungsfehler (z.B. „Meta-MCP läuft nicht"), falls vorhanden. */
  lastError: string | null
  /**
   * Fertiges `mcpServers`-Snippet für jeden anderen MCP-Client (Befund H4/S33).
   * Slideo registriert damit nichts — der Nutzer trägt es selbst ein. Hebt die
   * harte Drei-Ziele-Decke auf (Cursor, Windsurf, Zed, LM Studio, Codex CLI …).
   */
  genericConfig: { mcpServers: Record<string, { command: string; args: string[] }> } | null
}

/**
 * Zustand der LEBENDEN Verbindung (Befund B8) — im Unterschied zu `McpStatus`,
 * das nur meldet, ob Slideo irgendwo EINGETRAGEN ist. `null` = seit dem Start der
 * App hat noch kein Tool-Call die App erreicht.
 */
export interface McpActivity {
  tool: string
  at_ms: number
  client_version: string | null
}

/** Wann zuletzt wirklich ein MCP-Tool ausgeführt wurde. Null außerhalb von Tauri. */
export async function getMcpActivity(): Promise<McpActivity | null> {
  if (!isTauri()) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<McpActivity | null>('mcp_activity')
}

/** Aktuellen Status lesen (inkl. Live-Probe gegen Meta-MCP). Null außerhalb von Tauri. */
export async function getMcpStatus(): Promise<McpStatus | null> {
  if (!isTauri()) return null
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<McpStatus>('mcp_status')
}

/**
 * Aktives Ziel wechseln: registriert das Ziel und deregistriert die anderen.
 * Wirft bei Fehler (z.B. Meta-MCP nicht erreichbar) — dann bleibt alles unverändert.
 */
export async function setMcpTarget(target: McpTarget): Promise<McpStatus> {
  const { invoke } = await import('@tauri-apps/api/core')
  return invoke<McpStatus>('mcp_set_target', { target })
}
