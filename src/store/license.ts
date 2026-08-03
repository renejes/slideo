import { create } from 'zustand'
import {
  isTauri,
  licenseStatus,
  licenseActivate,
  licenseRecheck,
  licenseDeactivate,
  licenseOpenCheckout,
  type LicenseStatus,
} from '@/lib/tauri'

// Im reinen Browser-Dev (npm run dev) gibt es kein Backend → nicht blockieren.
const DEV_STATUS: LicenseStatus = {
  state: 'licensed',
  editing_allowed: true,
  configured: false,
  checkout_available: false,
  trial_days_left: null,
  key_display: null,
  expires_at: null,
}

/**
 * Fallback INNERHALB der Desktop-App, wenn `license_status` fehlschlägt
 * (Review 2026-08, Befund S27). Vorher wurde hier DEV_STATUS gesetzt — mit
 * `state: 'licensed'`: eine umbenannte Command oder ein transienter Invoke-Fehler
 * machte die App still vollständig lizenziert UND blendete die Lizenz-Bar aus.
 * Das war der undokumentierte Fail-open-Pfad.
 *
 * Jetzt: Bearbeiten bleibt erlaubt (niemanden wegen eines Backend-Fehlers
 * aussperren — dieselbe Haltung wie bei Offline), aber der Zustand ist
 * **sichtbar unbekannt** statt fälschlich „licensed".
 */
const UNKNOWN_STATUS: LicenseStatus = {
  state: 'unknown',
  editing_allowed: true,
  configured: false,
  checkout_available: false,
  trial_days_left: null,
  key_display: null,
  expires_at: null,
}

interface LicenseState {
  status: LicenseStatus | null
  loaded: boolean
  load: () => Promise<void>
  activate: (key: string) => Promise<LicenseStatus>
  deactivate: () => Promise<LicenseStatus>
  recheck: () => Promise<void>
  openCheckout: () => Promise<void>
  /** Ob Bearbeiten/Erstellen erlaubt ist. Vor dem Laden (status null) NICHT sperren. */
  editingAllowed: () => boolean
}

export const useLicenseStore = create<LicenseState>((set, get) => ({
  status: null,
  loaded: false,

  load: async () => {
    if (!isTauri()) {
      set({ status: DEV_STATUS, loaded: true })
      return
    }
    try {
      const s = await licenseStatus()
      set({ status: s, loaded: true })
      // Aktivierte Lizenz im Hintergrund online re-validieren (offline = No-op).
      void licenseRecheck()
        .then((s2) => set({ status: s2 }))
        .catch(() => {})
    } catch (e) {
      // Command (noch) nicht vorhanden o.ä. → nicht blockieren, aber ehrlich sein (S27).
      console.error('[slideo] license_status fehlgeschlagen:', e)
      set({ status: UNKNOWN_STATUS, loaded: true })
    }
  },

  activate: async (key) => {
    const s = await licenseActivate(key)
    set({ status: s })
    return s
  },

  deactivate: async () => {
    const s = await licenseDeactivate()
    set({ status: s })
    return s
  },

  recheck: async () => {
    if (!isTauri()) return
    try {
      const s = await licenseRecheck()
      set({ status: s })
    } catch {
      /* offline / kein Backend → still */
    }
  },

  openCheckout: () => licenseOpenCheckout(),

  editingAllowed: () => get().status?.editing_allowed ?? true,
}))
