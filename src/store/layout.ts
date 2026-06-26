import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Editor-Shell-Layout: frei skalierbare + einklappbare Spalten (Sidebar · Editor ·
// Vorschau). Breiten + Einklapp-Zustand werden persistiert (localStorage).

export const SIDEBAR_MIN = 180
export const SIDEBAR_MAX = 440
export const SIDEBAR_DEFAULT = 240
export const PREVIEW_MIN = 280
export const PREVIEW_MAX = 820
export const PREVIEW_DEFAULT = 460
/** Mindestbreite, die dem Editor in der Mitte erhalten bleiben soll. */
export const EDITOR_MIN = 320

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface LayoutState {
  sidebarWidth: number
  previewWidth: number
  sidebarCollapsed: boolean
  previewCollapsed: boolean
  /** Inkrementelles Skalieren über die Splitter (dx in px). */
  nudge: (which: 'sidebar' | 'preview', dx: number) => void
  toggleSidebar: () => void
  togglePreview: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_DEFAULT,
      previewWidth: PREVIEW_DEFAULT,
      sidebarCollapsed: false,
      previewCollapsed: false,
      nudge: (which, dx) =>
        set((s) =>
          which === 'sidebar'
            ? { sidebarWidth: clamp(s.sidebarWidth + dx, SIDEBAR_MIN, SIDEBAR_MAX) }
            : { previewWidth: clamp(s.previewWidth + dx, PREVIEW_MIN, PREVIEW_MAX) },
        ),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      togglePreview: () => set((s) => ({ previewCollapsed: !s.previewCollapsed })),
    }),
    { name: 'slideo-layout' },
  ),
)
