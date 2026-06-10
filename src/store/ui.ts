import { create } from 'zustand'

export type ModalKind = 'new' | 'settings' | 'find'

interface UiState {
  modal: ModalKind | null
  openModal: (modal: ModalKind) => void
  closeModal: () => void
}

// Globaler UI-Zustand für Overlays/Modals.
export const useUiStore = create<UiState>((set) => ({
  modal: null,
  openModal: (modal) => set({ modal }),
  closeModal: () => set({ modal: null }),
}))
