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
  editorCollapsed: boolean
  previewCollapsed: boolean
  /** Inkrementelles Skalieren über die Splitter (dx in px). */
  nudge: (which: 'sidebar' | 'preview', dx: number) => void
  toggleSidebar: () => void
  toggleEditor: () => void
  togglePreview: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      sidebarWidth: SIDEBAR_DEFAULT,
      previewWidth: PREVIEW_DEFAULT,
      sidebarCollapsed: false,
      editorCollapsed: false,
      previewCollapsed: false,
      nudge: (which, dx) =>
        set((s) =>
          which === 'sidebar'
            ? { sidebarWidth: clamp(s.sidebarWidth + dx, SIDEBAR_MIN, SIDEBAR_MAX) }
            : { previewWidth: clamp(s.previewWidth + dx, PREVIEW_MIN, PREVIEW_MAX) },
        ),
      // Mindestens ein Bereich bleibt offen — das Einklappen des letzten offenen
      // Bereichs wird ignoriert (sonst gäbe es eine leere Arbeitsfläche).
      toggleSidebar: () =>
        set((s) =>
          !s.sidebarCollapsed && s.editorCollapsed && s.previewCollapsed
            ? s
            : { sidebarCollapsed: !s.sidebarCollapsed },
        ),
      toggleEditor: () =>
        set((s) =>
          !s.editorCollapsed && s.sidebarCollapsed && s.previewCollapsed
            ? s
            : { editorCollapsed: !s.editorCollapsed },
        ),
      togglePreview: () =>
        set((s) =>
          !s.previewCollapsed && s.sidebarCollapsed && s.editorCollapsed
            ? s
            : { previewCollapsed: !s.previewCollapsed },
        ),
    }),
    {
      name: 'slideo-layout',
      version: 1,
      // Persistierte Breiten beim Laden einmalig re-clampen (alte/korrupte Stände aus
      // localStorage können sonst out-of-range sein; nudge clampt nur live). Die
      // Action-Funktionen kommen aus `current`.
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutState>
        return {
          ...current,
          ...p,
          sidebarWidth: clamp(p.sidebarWidth ?? current.sidebarWidth, SIDEBAR_MIN, SIDEBAR_MAX),
          previewWidth: clamp(p.previewWidth ?? current.previewWidth, PREVIEW_MIN, PREVIEW_MAX),
        }
      },
    },
  ),
)
