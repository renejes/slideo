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
  desktop: McpTargetState
  meta: McpTargetState
  claude: McpTargetState
  /** Letzter Registrierungsfehler (z.B. „Meta-MCP läuft nicht"), falls vorhanden. */
  lastError: string | null
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
