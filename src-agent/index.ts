/**
 * JSON-RPC 2.0 over stdin/stdout — one line per message.
 *
 * Rust (`chat.rs`) spawns this process and proxies Tauri commands here.
 * Stream events are notifications: `{ method: "event", params }`.
 */

import * as readline from 'node:readline'
import {
  bindDeck,
  cancelChat,
  closeChatTab,
  deleteChatSession,
  disposeChatAgent,
  getChatHistory,
  getChatSessions,
  getChatStatus,
  listChatModels,
  loginChat,
  logoutChat,
  newChatSession,
  sendChat,
  setChatModel,
  setEmitSink,
  switchChatSession,
} from './host'
import type { ChatModelParam } from '../src/lib/chat/chatTypes'

function write(obj: unknown): void {
  process.stdout.write(`${JSON.stringify(obj)}\n`)
}

function ok(id: number, result: unknown): void {
  write({ jsonrpc: '2.0', id, result })
}

function fail(id: number, message: string): void {
  write({ jsonrpc: '2.0', id, error: { code: -32000, message } })
}

setEmitSink((event) => {
  write({ jsonrpc: '2.0', method: 'event', params: event })
})

async function dispatch(method: string, params: Record<string, unknown>): Promise<unknown> {
  switch (method) {
    case 'status':
      return getChatStatus()
    case 'login':
      return loginChat()
    case 'logout':
      return logoutChat()
    case 'setModel': {
      const modelId = typeof params.modelId === 'string' ? params.modelId : ''
      const raw = params.params
      const modelParams = Array.isArray(raw)
        ? raw.filter(
            (p): p is ChatModelParam =>
              !!p &&
              typeof p === 'object' &&
              typeof (p as ChatModelParam).id === 'string' &&
              typeof (p as ChatModelParam).value === 'string',
          )
        : undefined
      return setChatModel(modelId, modelParams)
    }
    case 'models':
      return listChatModels()
    case 'history':
      return getChatHistory()
    case 'sessions':
      return getChatSessions()
    case 'new':
      return newChatSession()
    case 'switch':
      return switchChatSession(typeof params.id === 'string' ? params.id : '')
    case 'closeTab':
      return closeChatTab(typeof params.id === 'string' ? params.id : '')
    case 'delete':
      return deleteChatSession(typeof params.id === 'string' ? params.id : '')
    case 'cancel':
      return cancelChat()
    case 'bind':
      return bindDeck({
        cwd: typeof params.cwd === 'string' ? params.cwd : '',
        deckKey: typeof params.deckKey === 'string' ? params.deckKey : 'untitled',
      })
    case 'send':
      return sendChat({
        text: typeof params.text === 'string' ? params.text : '',
        mode: params.mode === 'plan' ? 'plan' : 'agent',
        anchors: Array.isArray(params.anchors) ? params.anchors : [],
        files: Array.isArray(params.files) ? params.files : [],
        attachments: Array.isArray(params.attachments) ? params.attachments : [],
      })
    default: {
      const _never: never = method as never
      void _never
      throw new Error(`Unknown method: ${method}`)
    }
  }
}

const rl = readline.createInterface({ input: process.stdin, crlfDelay: Infinity })

rl.on('line', (line) => {
  const trimmed = line.trim()
  if (!trimmed) return
  let msg: { id?: number; method?: string; params?: Record<string, unknown> }
  try {
    msg = JSON.parse(trimmed) as { id?: number; method?: string; params?: Record<string, unknown> }
  } catch {
    return
  }
  const id = typeof msg.id === 'number' ? msg.id : -1
  const method = typeof msg.method === 'string' ? msg.method : ''
  const params = msg.params && typeof msg.params === 'object' ? msg.params : {}
  void dispatch(method, params)
    .then((result) => ok(id, result))
    .catch((err: unknown) => fail(id, err instanceof Error ? err.message : String(err)))
})

process.on('SIGINT', () => {
  void disposeChatAgent().finally(() => process.exit(0))
})
process.on('SIGTERM', () => {
  void disposeChatAgent().finally(() => process.exit(0))
})
