import { create } from 'zustand'

export type ModalKind = 'new' | 'settings' | 'find' | 'components' | 'history' | 'design'

/**
 * „Klick → Quelle" (Spec §20): markiert eine Quell-Range im HTML-Editor der
 * gegebenen Zone. `nonce` triggert das erneute Anspringen auch bei gleicher Range.
 */
export interface HtmlReveal {
  zoneId: string
  from: number
  to: number
  /** true = CodeMirror fokussieren; false = nur markieren/scrollen (Direktbearbeiten
   *  lässt den Fokus im Vorschau-Iframe, damit dessen Tastatur-Ops weiterlaufen). */
  focusEditor: boolean
  nonce: number
}

interface UiState {
  modal: ModalKind | null
  openModal: (modal: ModalKind) => void
  closeModal: () => void
  /** Direktbearbeiten in der Vorschau (Auswahl-Layer für HTML-Zonen, Spec §20). */
  previewEdit: boolean
  setPreviewEdit: (on: boolean) => void
  togglePreviewEdit: () => void
  /** Aktuelle „Klick → Quelle"-Markierung (oder null). */
  htmlReveal: HtmlReveal | null
  setHtmlReveal: (reveal: { zoneId: string; from: number; to: number; focusEditor?: boolean }) => void
}

// Globaler UI-Zustand für Overlays/Modals.
export const useUiStore = create<UiState>((set) => ({
  modal: null,
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  previewEdit: false,
  setPreviewEdit: (previewEdit) => set({ previewEdit }),
  togglePreviewEdit: () => set((s) => ({ previewEdit: !s.previewEdit })),
  htmlReveal: null,
  setHtmlReveal: ({ zoneId, from, to, focusEditor = false }) =>
    set((s) => ({
      htmlReveal: { zoneId, from, to, focusEditor, nonce: (s.htmlReveal?.nonce ?? 0) + 1 },
    })),
}))
