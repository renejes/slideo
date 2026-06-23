import { create } from 'zustand'

export type ModalKind = 'new' | 'settings' | 'find' | 'components' | 'history'

/** Editor-Ansicht: visueller Folien-Editor oder textuelle Gliederung (Spec §19.9). */
export type EditorView = 'slides' | 'outline'

interface UiState {
  modal: ModalKind | null
  openModal: (modal: ModalKind) => void
  closeModal: () => void
  editorView: EditorView
  setEditorView: (view: EditorView) => void
}

// Globaler UI-Zustand für Overlays/Modals.
export const useUiStore = create<UiState>((set) => ({
  modal: null,
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
  editorView: 'slides',
  setEditorView: (editorView) => set({ editorView }),
}))
