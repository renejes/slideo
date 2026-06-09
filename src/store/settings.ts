import { create } from 'zustand'
import { persist } from 'zustand/middleware'

interface SettingsState {
  /** Standard-Speicherort für neue Präsentationen (zuletzt genutzter Ordner). */
  defaultProjectDir: string | null
  setDefaultProjectDir: (dir: string | null) => void
}

// Persistente App-Einstellungen (localStorage). Wird nach und nach erweitert.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      defaultProjectDir: null,
      setDefaultProjectDir: (dir) => set({ defaultProjectDir: dir }),
    }),
    { name: 'slideo-settings' },
  ),
)
