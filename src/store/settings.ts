import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Ein zuletzt geöffnetes Deck (Review 2026-08, Befund M22). */
export interface RecentDeck {
  path: string
  title: string
  /** ISO-Zeitstempel des letzten Öffnens/Speicherns. */
  at: string
}

const RECENT_CAP = 8

interface SettingsState {
  /** Standard-Speicherort für neue Präsentationen (zuletzt genutzter Ordner). */
  defaultProjectDir: string | null
  setDefaultProjectDir: (dir: string | null) => void
  /**
   * Zuletzt geöffnete Decks, neueste zuerst (Befund M22). Ohne das musste man am
   * Tag 2 den Finder durchsuchen: es gab keine Zuletzt-Liste, kein Reopen-Last-File
   * und keine `fileAssociations` (Doppelklick auf `.slideo` öffnete Slideo nicht).
   */
  recent: RecentDeck[]
  rememberRecent: (path: string, title: string) => void
  forgetRecent: (path: string) => void
  clearRecent: () => void
}

// Persistente App-Einstellungen (localStorage).
//
// `version`/`migrate` sind Pflicht (Befund S29): dieser Store hatte beides nicht,
// während `layout.ts` es nach genau einer Schemaänderung bekommen musste. Ein
// künftiges Umbenennen eines Feldes würde sonst eine kaputte, halb gelesene
// Einstellung hinterlassen.
export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      defaultProjectDir: null,
      setDefaultProjectDir: (dir) => set({ defaultProjectDir: dir }),

      recent: [],
      rememberRecent: (path, title) => {
        if (!path) return
        const now = new Date().toISOString()
        const rest = get().recent.filter((r) => r.path !== path)
        set({ recent: [{ path, title, at: now }, ...rest].slice(0, RECENT_CAP) })
      },
      forgetRecent: (path) => set({ recent: get().recent.filter((r) => r.path !== path) }),
      clearRecent: () => set({ recent: [] }),
    }),
    {
      name: 'slideo-settings',
      version: 1,
      migrate: (state, from) => {
        // v0 kannte nur `defaultProjectDir`; `recent` fehlt dort schlicht.
        const s = (state ?? {}) as Partial<SettingsState>
        if (from < 1) return { ...s, recent: [] } as SettingsState
        return s as SettingsState
      },
      merge: (persisted, current) => {
        // Defensiv gegen von Hand editierten/kaputten localStorage.
        const p = (persisted ?? {}) as Partial<SettingsState>
        return {
          ...current,
          ...p,
          recent: Array.isArray(p.recent)
            ? p.recent.filter((r) => r && typeof r.path === 'string').slice(0, RECENT_CAP)
            : [],
        }
      },
    },
  ),
)
