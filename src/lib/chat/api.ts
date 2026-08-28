import { t } from '@/i18n'
import { describeError, isTauri } from '@/lib/tauri'
import type {
  ChatModelParam,
  ChatSendRequest,
  ChatSendResult,
  ChatSessionResult,
  ChatSessionsSnapshot,
  ChatStatus,
  ChatTurn,
  ChatModelInfo,
} from './chatTypes'

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) {
    throw new Error('desktop-only')
  }
  const { invoke: inv } = await import('@tauri-apps/api/core')
  return inv<T>(cmd, args)
}

/** Host-Kurzcodes und `slideo:<code>` → Anzeigetext. */
export function displayChatError(raw: unknown): string {
  if (raw instanceof Error) return displayChatError(raw.message)
  if (typeof raw !== 'string') return displayChatError(String(raw))
  switch (raw) {
    case 'busy-switch':
    case 'run-in-progress':
      return t('chat.busySwitch')
    case 'no-project':
      return t('chat.noProjectTitle')
    case 'not-signed-in':
      return t('chat.signInTitle')
    case 'empty-message':
      return t('chat.errorPrefix')
    case 'expired':
      return t('chat.expired')
    case 'desktop-only':
      return t('chat.desktopOnly')
    default:
      return describeError(raw)
  }
}

export function chatStatus(): Promise<ChatStatus> {
  return invoke<ChatStatus>('chat_status')
}

export function chatLogin(): Promise<{ ok: boolean; error?: string; email?: string }> {
  return invoke('chat_login')
}

export function chatLogout(): Promise<{ ok: boolean }> {
  return invoke('chat_logout')
}

export function chatSetModel(
  modelId: string,
  params?: ChatModelParam[],
): Promise<{ ok: boolean; modelId: string }> {
  return invoke('chat_set_model', { modelId, params: params ?? null })
}

export function chatModels(): Promise<ChatModelInfo[]> {
  return invoke<ChatModelInfo[]>('chat_models')
}

export function chatHistory(): Promise<ChatTurn[]> {
  return invoke<ChatTurn[]>('chat_history')
}

export function chatSessions(): Promise<ChatSessionsSnapshot> {
  return invoke<ChatSessionsSnapshot>('chat_sessions')
}

export function chatNew(): Promise<ChatSessionResult> {
  return invoke<ChatSessionResult>('chat_new')
}

export function chatSwitch(id: string): Promise<ChatSessionResult> {
  return invoke<ChatSessionResult>('chat_switch', { id })
}

export function chatCloseTab(id: string): Promise<ChatSessionResult> {
  return invoke<ChatSessionResult>('chat_close_tab', { id })
}

export function chatDelete(id: string): Promise<ChatSessionResult> {
  return invoke<ChatSessionResult>('chat_delete', { id })
}

export function chatCancel(): Promise<{ ok: boolean }> {
  return invoke('chat_cancel')
}

export function chatBind(filePath: string | null): Promise<{ ok: boolean }> {
  return invoke('chat_bind', { filePath })
}

export function chatSend(payload: ChatSendRequest): Promise<ChatSendResult> {
  return invoke<ChatSendResult>('chat_send', { payload })
}
