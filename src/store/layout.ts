import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Editor-Shell-Layout: zwei frei skalierbare + einzeln einklappbare Spalten
// (Editor · Vorschau). Breite der Vorschau + Einklapp-Zustand werden persistiert
// (localStorage). Die frühere linke Folienliste/Sidebar ist entfallen (Editor-Cleanup):
// Umsortieren + Folien-Überblick laufen über die Editor-Karten selbst.

export const PREVIEW_MIN = 280
export const PREVIEW_MAX = 820
export const PREVIEW_DEFAULT = 460
/** Mindestbreite, die dem Editor in der Mitte erhalten bleiben soll. */
export const EDITOR_MIN = 320

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface LayoutState {
  previewWidth: number
  editorCollapsed: boolean
  previewCollapsed: boolean
  /** Inkrementelles Skalieren der Vorschau über den Splitter (dx in px). */
  nudge: (dx: number) => void
  toggleEditor: () => void
  togglePreview: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      previewWidth: PREVIEW_DEFAULT,
      editorCollapsed: false,
      previewCollapsed: false,
      nudge: (dx) =>
        set((s) => ({ previewWidth: clamp(s.previewWidth + dx, PREVIEW_MIN, PREVIEW_MAX) })),
      // Mindestens ein Bereich bleibt offen — das Einklappen des letzten offenen
      // Bereichs wird ignoriert (sonst gäbe es eine leere Arbeitsfläche).
      toggleEditor: () =>
        set((s) => (!s.editorCollapsed && s.previewCollapsed ? s : { editorCollapsed: !s.editorCollapsed })),
      togglePreview: () =>
        set((s) => (!s.previewCollapsed && s.editorCollapsed ? s : { previewCollapsed: !s.previewCollapsed })),
    }),
    {
      name: 'slideo-layout',
      version: 2,
      // v1 → v2: die linke Sidebar entfiel. Nur die noch genutzten Felder übernehmen
      // (verwirft alte sidebar*-Keys) — `merge` re-clampt/guarded anschließend.
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        return {
          previewWidth: p.previewWidth,
          editorCollapsed: p.editorCollapsed,
          previewCollapsed: p.previewCollapsed,
        }
      },
      // Persistierte Breite beim Laden einmalig re-clampen (alte/korrupte Stände aus
      // localStorage können out-of-range sein) + Garantie „mind. ein Bereich offen".
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutState>
        let editorCollapsed = p.editorCollapsed ?? current.editorCollapsed
        let previewCollapsed = p.previewCollapsed ?? current.previewCollapsed
        if (editorCollapsed && previewCollapsed) editorCollapsed = false
        return {
          ...current,
          previewWidth: clamp(p.previewWidth ?? current.previewWidth, PREVIEW_MIN, PREVIEW_MAX),
          editorCollapsed,
          previewCollapsed,
        }
      },
    },
  ),
)
