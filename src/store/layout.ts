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
export const CHAT_MIN = 160
export const CHAT_MAX = 520
export const CHAT_DEFAULT = 280

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface LayoutState {
  previewWidth: number
  editorCollapsed: boolean
  previewCollapsed: boolean
  showChat: boolean
  chatHeight: number
  /** Inkrementelles Skalieren der Vorschau über den Splitter (dx in px). */
  nudge: (dx: number) => void
  nudgeChat: (dy: number) => void
  toggleEditor: () => void
  togglePreview: () => void
  toggleChat: () => void
  openChat: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      previewWidth: PREVIEW_DEFAULT,
      editorCollapsed: false,
      previewCollapsed: false,
      showChat: true,
      chatHeight: CHAT_DEFAULT,
      nudge: (dx) =>
        set((s) => ({ previewWidth: clamp(s.previewWidth + dx, PREVIEW_MIN, PREVIEW_MAX) })),
      nudgeChat: (dy) =>
        set((s) => ({ chatHeight: clamp(s.chatHeight - dy, CHAT_MIN, CHAT_MAX) })),
      // Mindestens ein Bereich bleibt offen — das Einklappen des letzten offenen
      // Bereichs wird ignoriert (sonst gäbe es eine leere Arbeitsfläche).
      toggleEditor: () =>
        set((s) => (!s.editorCollapsed && s.previewCollapsed ? s : { editorCollapsed: !s.editorCollapsed })),
      togglePreview: () =>
        set((s) => (!s.previewCollapsed && s.editorCollapsed ? s : { previewCollapsed: !s.previewCollapsed })),
      toggleChat: () =>
        set((s) => ({
          showChat: !s.showChat,
          editorCollapsed: !s.showChat ? false : s.editorCollapsed,
        })),
      openChat: () => set({ showChat: true, editorCollapsed: false }),
    }),
    {
      name: 'slideo-layout',
      version: 3,
      // v1 → v2: Sidebar entfiel. v2 → v3: In-App-Chat (Höhe + Sichtbarkeit).
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        return {
          previewWidth: p.previewWidth,
          editorCollapsed: p.editorCollapsed,
          previewCollapsed: p.previewCollapsed,
          showChat: typeof p.showChat === 'boolean' ? p.showChat : true,
          chatHeight: typeof p.chatHeight === 'number' ? p.chatHeight : CHAT_DEFAULT,
        }
      },
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
          showChat: p.showChat ?? current.showChat,
          chatHeight: clamp(p.chatHeight ?? current.chatHeight, CHAT_MIN, CHAT_MAX),
        }
      },
      partialize: (s) => ({
        previewWidth: s.previewWidth,
        editorCollapsed: s.editorCollapsed,
        previewCollapsed: s.previewCollapsed,
        showChat: s.showChat,
        chatHeight: s.chatHeight,
      }),
    },
  ),
)
