import { create } from 'zustand'
import { persist } from 'zustand/middleware'

// Canvas-first-Shell: Bühne (elastisch) · optionaler Quellen-Inspector · Chat rechts.
// Filmstrip ist immer sichtbar (Folien-Sequenz). Breiten + Sichtbarkeit persistieren.

export const CANVAS_MIN = 360
export const INSPECTOR_MIN = 280
export const INSPECTOR_MAX = 560
export const INSPECTOR_DEFAULT = 380
export const CHAT_MIN = 240
export const CHAT_MAX = 520
export const CHAT_DEFAULT = 340

const clamp = (v: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, v))

interface LayoutState {
  showInspector: boolean
  inspectorWidth: number
  showChat: boolean
  chatWidth: number
  nudgeInspector: (dx: number) => void
  nudgeChat: (dx: number) => void
  toggleInspector: () => void
  openInspector: () => void
  toggleChat: () => void
  openChat: () => void
}

export const useLayoutStore = create<LayoutState>()(
  persist(
    (set) => ({
      showInspector: false,
      inspectorWidth: INSPECTOR_DEFAULT,
      showChat: true,
      chatWidth: CHAT_DEFAULT,
      nudgeInspector: (dx) =>
        set((s) => ({ inspectorWidth: clamp(s.inspectorWidth + dx, INSPECTOR_MIN, INSPECTOR_MAX) })),
      nudgeChat: (dx) =>
        set((s) => ({ chatWidth: clamp(s.chatWidth + dx, CHAT_MIN, CHAT_MAX) })),
      toggleInspector: () => set((s) => ({ showInspector: !s.showInspector })),
      openInspector: () => set({ showInspector: true }),
      toggleChat: () => set((s) => ({ showChat: !s.showChat })),
      openChat: () => set({ showChat: true }),
    }),
    {
      name: 'slideo-layout',
      version: 4,
      // v1 → v2: Sidebar entfiel. v2 → v3: In-App-Chat (Höhe). v3 → v4: Canvas-first
      // (Chat wird zur rechten Spalte, Editor zur optionalen Quelle, Vorschau = Bühne).
      migrate: (persisted) => {
        const p = (persisted ?? {}) as Record<string, unknown>
        const chatWidth =
          typeof p.chatWidth === 'number'
            ? p.chatWidth
            : typeof p.chatHeight === 'number'
              ? p.chatHeight
              : CHAT_DEFAULT
        return {
          showInspector: false,
          inspectorWidth:
            typeof p.inspectorWidth === 'number' ? p.inspectorWidth : INSPECTOR_DEFAULT,
          showChat: typeof p.showChat === 'boolean' ? p.showChat : true,
          chatWidth,
        }
      },
      merge: (persisted, current) => {
        const p = (persisted ?? {}) as Partial<LayoutState>
        return {
          ...current,
          showInspector: p.showInspector ?? current.showInspector,
          inspectorWidth: clamp(
            p.inspectorWidth ?? current.inspectorWidth,
            INSPECTOR_MIN,
            INSPECTOR_MAX,
          ),
          showChat: p.showChat ?? current.showChat,
          chatWidth: clamp(p.chatWidth ?? current.chatWidth, CHAT_MIN, CHAT_MAX),
        }
      },
      partialize: (s) => ({
        showInspector: s.showInspector,
        inspectorWidth: s.inspectorWidth,
        showChat: s.showChat,
        chatWidth: s.chatWidth,
      }),
    },
  ),
)
