import { create } from 'zustand'
import { formatTokenCount } from '@/lib/chat/chatModels'
import { mergeStreamText, upsertToolChip } from '@/lib/chat/chatStream'
import type {
  ChatAnchor,
  ChatAttachment,
  ChatFileRef,
  ChatMode,
  ChatSessionsSnapshot,
  ChatStatus,
  ChatStreamEvent,
  ChatTurn,
} from '@/lib/chat/chatTypes'

export function applyChatEvent(
  turns: ChatTurn[],
  event: ChatStreamEvent,
): { turns: ChatTurn[]; streaming?: boolean; lastError?: string; usageLine?: string } {
  const lastIdx = [...turns].reverse().findIndex((t) => t.role === 'assistant')
  const last = lastIdx >= 0 ? turns[turns.length - 1 - lastIdx] : undefined
  switch (event.kind) {
    case 'assistant':
      if (!last) return { turns }
      return {
        turns: turns.map((t) => (t.id === last.id ? { ...t, text: event.text } : t)),
      }
    case 'assistant-delta':
      if (!last) return { turns }
      return {
        turns: turns.map((t) =>
          t.id === last.id ? { ...t, text: mergeStreamText(t.text, event.text) } : t,
        ),
      }
    case 'thinking':
      if (!last) return { turns }
      return {
        turns: turns.map((t) =>
          t.id === last.id
            ? { ...t, thinking: mergeStreamText(t.thinking ?? '', event.text) }
            : t,
        ),
      }
    case 'tool':
      if (!last) return { turns }
      return {
        turns: turns.map((t) =>
          t.id === last.id
            ? {
                ...t,
                tools: upsertToolChip(t.tools ?? [], {
                  id: event.id,
                  name: event.name,
                  status: event.status,
                  detail: event.detail,
                }),
              }
            : t,
        ),
      }
    case 'heartbeat':
      return { turns }
    case 'usage': {
      const total = formatTokenCount(event.totalTokens ?? 0)
      if (total) return { turns, usageLine: total }
      const bits: string[] = []
      if (event.inputTokens) bits.push(`${event.inputTokens}↓`)
      if (event.outputTokens) bits.push(`${event.outputTokens}↑`)
      return { turns, usageLine: bits.length ? bits.join(' ') : undefined }
    }
    case 'done':
      return { turns, streaming: false, lastError: event.error }
    case 'error':
      return { turns, streaming: false, lastError: event.message }
    default: {
      const _never: never = event
      void _never
      return { turns }
    }
  }
}

interface ChatUiState {
  turns: ChatTurn[]
  streaming: boolean
  pendingAnchors: ChatAnchor[]
  pendingFiles: ChatFileRef[]
  pendingAttachments: ChatAttachment[]
  draft: string
  mode: ChatMode
  status: ChatStatus | null
  lastError: string
  usageLine: string
  lastActivityAt: number
  sessions: ChatSessionsSnapshot
  setDraft: (draft: string) => void
  setMode: (mode: ChatMode) => void
  setStatus: (status: ChatStatus | null) => void
  setTurns: (turns: ChatTurn[]) => void
  setSessions: (sessions: ChatSessionsSnapshot) => void
  setStreaming: (streaming: boolean) => void
  setLastError: (lastError: string) => void
  setUsageLine: (usageLine: string) => void
  bumpActivity: () => void
  addAnchor: (anchor: ChatAnchor) => void
  setPendingFiles: (files: ChatFileRef[]) => void
  setPendingAttachments: (files: ChatAttachment[]) => void
  applyEvent: (event: ChatStreamEvent) => void
  reset: () => void
}

const emptySessions: ChatSessionsSnapshot = { activeId: null, open: [], all: [] }

export const useChatStore = create<ChatUiState>((set) => ({
  turns: [],
  streaming: false,
  pendingAnchors: [],
  pendingFiles: [],
  pendingAttachments: [],
  draft: '',
  mode: 'agent',
  status: null,
  lastError: '',
  usageLine: '',
  lastActivityAt: 0,
  sessions: emptySessions,
  setDraft: (draft) => set({ draft }),
  setMode: (mode) => set({ mode }),
  setStatus: (status) => set({ status }),
  setTurns: (turns) => set({ turns }),
  setSessions: (sessions) => set({ sessions }),
  setStreaming: (streaming) => set({ streaming }),
  setLastError: (lastError) => set({ lastError }),
  setUsageLine: (usageLine) => set({ usageLine }),
  bumpActivity: () => set({ lastActivityAt: Date.now() }),
  addAnchor: (anchor) =>
    set((s) => ({ pendingAnchors: [...s.pendingAnchors, anchor] })),
  setPendingFiles: (pendingFiles) => set({ pendingFiles }),
  setPendingAttachments: (pendingAttachments) => set({ pendingAttachments }),
  applyEvent: (event) =>
    set((s) => {
      const next = applyChatEvent(s.turns, event)
      return {
        turns: next.turns,
        streaming: next.streaming ?? s.streaming,
        lastError: next.lastError !== undefined ? next.lastError : s.lastError,
        usageLine: next.usageLine !== undefined ? next.usageLine : s.usageLine,
        lastActivityAt:
          event.kind === 'done' || event.kind === 'error' ? s.lastActivityAt : Date.now(),
      }
    }),
  reset: () =>
    set({
      turns: [],
      streaming: false,
      pendingAnchors: [],
      pendingFiles: [],
      pendingAttachments: [],
      draft: '',
      lastError: '',
      usageLine: '',
      lastActivityAt: 0,
      sessions: emptySessions,
    }),
}))
