import { create } from 'zustand'

export type ToastType = 'info' | 'success' | 'error'

export interface Toast {
  id: string
  message: string
  type: ToastType
}

interface ToastState {
  toasts: Toast[]
  notify: (message: string, type?: ToastType) => void
  dismiss: (id: string) => void
}

// Schlankes, globales Benachrichtigungs-System (Save/Open-Feedback, Fehler).
export const useToastStore = create<ToastState>((set) => ({
  toasts: [],
  notify: (message, type = 'info') => {
    const id = crypto.randomUUID()
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }))
    const ttl = type === 'error' ? 6000 : 3200
    setTimeout(() => {
      set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }))
    }, ttl)
  },
  dismiss: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Bequemer Helfer für Nicht-React-Kontexte (z.B. Store-Actions). */
export function notify(message: string, type: ToastType = 'info') {
  useToastStore.getState().notify(message, type)
}
