/**
 * Cursor SDK host — the in-app chat's agent lives here, in a Node sidecar.
 *
 * The React UI never imports `@cursor/sdk`. One agent per open presentation;
 * close disposes it. Every create / resume carries the tool allowlist from
 * `buildChatAgentOptions` (writes go through MCP, never builtin edit/write).
 */

import { spawn } from 'node:child_process'
import * as fs from 'node:fs'
import * as path from 'node:path'
import {
  Agent,
  Cursor,
  CursorAgentError,
  FileCredentialStore,
  JsonlLocalAgentStore,
  type SDKAgent,
  type SDKMessage,
  type Run,
} from '@cursor/sdk'
import {
  buildChatAgentOptions,
  DEFAULT_CHAT_MODEL_ID,
  mergeMcpChildEnv,
  quoteStdioCommand,
} from '../src/lib/chat/chatAgentOptions'
import { normalizeChatModel } from '../src/lib/chat/chatModels'
import { describeChatTool, mergeStreamText, upsertToolChip } from '../src/lib/chat/chatStream'
import type {
  ChatAnchor,
  ChatAttachment,
  ChatFileRef,
  ChatMode,
  ChatModelInfo,
  ChatModelParam,
  ChatSendResult,
  ChatSessionResult,
  ChatSessionsSnapshot,
  ChatStatus,
  ChatStreamEvent,
  ChatToolChip,
  ChatTurn,
} from '../src/lib/chat/chatTypes'
import {
  activateSession,
  addSession,
  closeOpenTab,
  emptyChatIndex,
  historyMetas,
  openMetas,
  parseChatIndex,
  pinOpenTab,
  removeSession,
  titleFromUserText,
  touchSession,
  type ChatSessionIndex,
} from '../src/lib/chat/chatSessions'

const AGENT_ID_FILE = 'agent-id'
const TRANSCRIPT_FILE = 'transcript.json'
const INDEX_FILE = 'chats.json'
const SETTINGS_FILE = 'chat-settings.json'
const MAX_TRANSCRIPT = 80
const BUSY = 'busy-switch'
const NO_DECK = 'no-project'

type SdkImagePayload = { data: string; mimeType: string }

type Bound = {
  cwd: string
  deckKey: string
}

let sdkConfigured = false
let agent: SDKAgent | null = null
let agentDeckKey: string | null = null
let currentRun: Run | null = null
let cancelRequested = false
let transcript: ChatTurn[] = []
let sessionIndex: ChatSessionIndex = emptyChatIndex()
let indexDeckKey: string | null = null
let bound: Bound | null = null
let emitSink: ((event: ChatStreamEvent) => void) | null = null

function configDir(): string {
  const fromEnv = process.env.SLIDEO_CONFIG_DIR
  if (fromEnv) return fromEnv
  const home = process.env.HOME || process.env.USERPROFILE || ''
  if (process.platform === 'darwin') return path.join(home, 'Library', 'Application Support', 'slideo')
  if (process.platform === 'win32') return path.join(process.env.APPDATA || home, 'slideo')
  return path.join(home, '.config', 'slideo')
}

function slideoExe(): string {
  return process.env.SLIDEO_EXE || 'slideo'
}

export function setEmitSink(sink: ((event: ChatStreamEvent) => void) | null): void {
  emitSink = sink
}

function credentialStore(): FileCredentialStore {
  return new FileCredentialStore(path.join(configDir(), 'cursor-sdk', 'auth.json'))
}

async function loadApiKey(): Promise<string | undefined> {
  const creds = await credentialStore().load()
  return creds?.apiKey
}

function ensureSdkConfigured(): void {
  if (sdkConfigured) return
  Cursor.configure({ local: { useHttp1ForAgent: true } })
  sdkConfigured = true
}

function agentDir(deckKey: string): string {
  return path.join(configDir(), 'chat', deckKey)
}

function indexPath(deckKey: string): string {
  return path.join(agentDir(deckKey), INDEX_FILE)
}

function settingsPath(): string {
  return path.join(configDir(), SETTINGS_FILE)
}

function readSettings(): { modelId: string; modelParams: ChatModelParam[] } {
  try {
    const raw = JSON.parse(fs.readFileSync(settingsPath(), 'utf-8')) as Record<string, unknown>
    const modelId = typeof raw.modelId === 'string' && raw.modelId.trim() ? raw.modelId : DEFAULT_CHAT_MODEL_ID
    const modelParams = Array.isArray(raw.modelParams)
      ? raw.modelParams.filter(
          (p): p is ChatModelParam =>
            !!p && typeof p === 'object' && typeof (p as ChatModelParam).id === 'string' && typeof (p as ChatModelParam).value === 'string',
        )
      : []
    return { modelId, modelParams }
  } catch {
    return { modelId: DEFAULT_CHAT_MODEL_ID, modelParams: [] }
  }
}

function writeSettings(modelId: string, modelParams: ChatModelParam[]): void {
  try {
    fs.mkdirSync(configDir(), { recursive: true })
    fs.writeFileSync(settingsPath(), JSON.stringify({ modelId, modelParams }, null, 2), 'utf-8')
  } catch {
    /* best-effort */
  }
}

function getChatModelId(): string {
  return readSettings().modelId
}

function getChatModelParams(): ChatModelParam[] {
  return readSettings().modelParams
}

function safeSessionFileId(id: string): string {
  return id.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'chat'
}

function transcriptPathFor(deckKey: string, sessionId: string): string {
  return path.join(agentDir(deckKey), 'transcripts', `${safeSessionFileId(sessionId)}.json`)
}

function snapshotSessions(): ChatSessionsSnapshot {
  return {
    activeId: sessionIndex.activeId,
    open: openMetas(sessionIndex),
    all: historyMetas(sessionIndex),
  }
}

function writeIndex(deckKey: string): void {
  try {
    const dir = agentDir(deckKey)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(indexPath(deckKey), JSON.stringify(sessionIndex), 'utf-8')
    if (sessionIndex.activeId) writeStoredAgentId(deckKey, sessionIndex.activeId)
  } catch {
    /* best-effort */
  }
}

function persistTranscript(deckKey: string): void {
  const id = sessionIndex.activeId
  if (!id) return
  try {
    const file = transcriptPathFor(deckKey, id)
    fs.mkdirSync(path.dirname(file), { recursive: true })
    const trimmed = transcript.slice(-MAX_TRANSCRIPT)
    fs.writeFileSync(file, JSON.stringify(trimmed), 'utf-8')
  } catch {
    /* best-effort */
  }
}

function readTurnsFile(file: string): ChatTurn[] {
  try {
    if (!fs.existsSync(file)) return []
    const parsed = JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .filter(
        (t): t is ChatTurn =>
          !!t &&
          typeof t === 'object' &&
          (t.role === 'user' || t.role === 'assistant') &&
          typeof t.text === 'string',
      )
      .map((t) => ({
        ...t,
        tools: t.tools?.map((c) => ({
          id: c.id || c.name,
          name: c.name,
          status: c.status,
          detail: c.detail,
        })),
      }))
  } catch {
    return []
  }
}

function loadTranscript(deckKey: string, sessionId: string): ChatTurn[] {
  const modernPath = transcriptPathFor(deckKey, sessionId)
  if (fs.existsSync(modernPath)) return readTurnsFile(modernPath)
  return []
}

function ensureSessionIndex(deckKey: string): ChatSessionIndex {
  if (indexDeckKey === deckKey) return sessionIndex
  indexDeckKey = deckKey
  try {
    const file = indexPath(deckKey)
    if (fs.existsSync(file)) {
      const parsed = parseChatIndex(JSON.parse(fs.readFileSync(file, 'utf-8')) as unknown)
      if (parsed && (parsed.chats.length > 0 || parsed.activeId)) {
        sessionIndex = parsed
        return sessionIndex
      }
    }
  } catch {
    /* migrate */
  }

  const legacyId = readStoredAgentId(deckKey)
  const legacyTurns = readTurnsFile(path.join(agentDir(deckKey), TRANSCRIPT_FILE))
  if (legacyId || legacyTurns.length > 0) {
    const id = legacyId || `legacy-${Date.now()}`
    const now = Date.now()
    sessionIndex = addSession(emptyChatIndex(), {
      id,
      title: titleFromUserText(legacyTurns.find((t) => t.role === 'user')?.text ?? '', ''),
      createdAt: now,
      updatedAt: now,
    })
    transcript = legacyTurns
    persistTranscript(deckKey)
    writeIndex(deckKey)
    try {
      const legacy = path.join(agentDir(deckKey), TRANSCRIPT_FILE)
      if (fs.existsSync(legacy)) fs.unlinkSync(legacy)
    } catch {
      /* already copied */
    }
    return sessionIndex
  }

  sessionIndex = emptyChatIndex()
  return sessionIndex
}

function emit(event: ChatStreamEvent): void {
  emitSink?.(event)
}

function readStoredAgentId(deckKey: string): string | null {
  try {
    const file = path.join(agentDir(deckKey), AGENT_ID_FILE)
    if (!fs.existsSync(file)) return null
    const id = fs.readFileSync(file, 'utf-8').trim()
    return id || null
  } catch {
    return null
  }
}

function writeStoredAgentId(deckKey: string, id: string): void {
  try {
    const dir = agentDir(deckKey)
    fs.mkdirSync(dir, { recursive: true })
    fs.writeFileSync(path.join(dir, AGENT_ID_FILE), id, 'utf-8')
  } catch {
    /* best-effort */
  }
}

async function resolveModelId(): Promise<string> {
  const stored = getChatModelId() || DEFAULT_CHAT_MODEL_ID
  try {
    const apiKey = await loadApiKey()
    const models = await Cursor.models.list(apiKey ? { apiKey } : undefined)
    if (!Array.isArray(models) || models.length === 0) return stored
    if (models.some((m) => m.id === stored)) return stored
    const fallback = models.find((m) => m.id === DEFAULT_CHAT_MODEL_ID) ?? models[0]
    if (fallback && fallback.id !== stored) writeSettings(fallback.id, getChatModelParams())
    return fallback.id
  } catch {
    return stored
  }
}

function modelSelection(modelId: string): { id: string; params?: ChatModelParam[] } {
  const params = getChatModelParams()
  return params.length > 0 ? { id: modelId, params } : { id: modelId }
}

function restrictionOptions(cwd: string) {
  const exe = slideoExe()
  const { command, args } =
    process.platform === 'win32' ? { command: exe, args: ['mcp'] } : quoteStdioCommand(exe, ['mcp'])
  return buildChatAgentOptions({
    projectDir: cwd,
    mcp: {
      command,
      args,
      env: mergeMcpChildEnv(process.env, {}),
    },
    modelId: getChatModelId() || DEFAULT_CHAT_MODEL_ID,
  })
}

async function disposeAgent(): Promise<void> {
  if (currentRun) {
    try {
      if (currentRun.supports('cancel')) await currentRun.cancel()
    } catch {
      /* ignore */
    }
    currentRun = null
  }
  if (agent) {
    try {
      await agent[Symbol.asyncDispose]()
    } catch {
      try {
        agent.close()
      } catch {
        /* ignore */
      }
    }
    agent = null
  }
  agentDeckKey = null
}

export async function disposeChatAgent(): Promise<void> {
  const key = agentDeckKey ?? bound?.deckKey
  if (key) persistTranscript(key)
  await disposeAgent()
  transcript = []
  sessionIndex = emptyChatIndex()
  indexDeckKey = null
}

async function createOptsFor(cwd: string, deckKey: string) {
  const modelId = await resolveModelId()
  const apiKey = await loadApiKey()
  const base = restrictionOptions(cwd)
  const store = new JsonlLocalAgentStore(agentDir(deckKey))
  return {
    ...base,
    model: modelSelection(modelId),
    name: 'Slideo',
    ...(apiKey ? { apiKey } : {}),
    local: { cwd, store, settingSources: [] as [] },
  }
}

async function bindAgent(
  cwd: string,
  deckKey: string,
  sessionId?: string,
  opts?: { forceCreate?: boolean },
): Promise<SDKAgent> {
  ensureSdkConfigured()
  ensureSessionIndex(deckKey)
  const want = opts?.forceCreate ? undefined : (sessionId ?? sessionIndex.activeId ?? undefined)
  if (!opts?.forceCreate && agent && agentDeckKey === deckKey && want && agent.agentId === want) {
    return agent
  }

  if (agent && agentDeckKey === deckKey) persistTranscript(deckKey)
  await disposeAgent()
  transcript = want ? loadTranscript(deckKey, want) : []

  const createOpts = await createOptsFor(cwd, deckKey)

  if (want) {
    try {
      const resumed = await Agent.resume(want, createOpts)
      agent = resumed
      agentDeckKey = deckKey
      sessionIndex = activateSession(sessionIndex, resumed.agentId)
      writeIndex(deckKey)
      return resumed
    } catch {
      /* create fresh */
    }
  }

  const created = await Agent.create(createOpts)
  agent = created
  agentDeckKey = deckKey
  const now = Date.now()
  const existing = sessionIndex.chats.find((c) => c.id === created.agentId)
  if (!existing) {
    sessionIndex = addSession(sessionIndex, {
      id: created.agentId,
      title: '',
      createdAt: now,
      updatedAt: now,
    })
  } else {
    sessionIndex = activateSession(sessionIndex, created.agentId)
  }
  persistTranscript(deckKey)
  writeIndex(deckKey)
  return created
}

function formatAnchors(anchors: ChatAnchor[]): string {
  if (anchors.length === 0) return ''
  const blocks = anchors.map((a, i) => {
    const excerpt = a.selectionText.length > 800 ? `${a.selectionText.slice(0, 800)}…` : a.selectionText
    return [`Selection ${i + 1} in ${a.file} (${a.nodeType}, occurrence ${a.occurrence}):`, excerpt].join('\n')
  })
  return [
    '',
    'The user marked the following passage(s). Call get_zone (or the matching Slideo MCP tool) before acting on "this" / "here".',
    ...blocks,
  ].join('\n')
}

function formatFiles(files: ChatFileRef[]): string {
  if (files.length === 0) return ''
  return [
    '',
    'The user attached or @-mentioned these slides or files. Use Slideo MCP (get_zone, list_zones, set_zone_markdown / set_zone_html) or the read tool before answering about them:',
    ...files.map((f) => `- ${f.label} (${f.file})`),
  ].join('\n')
}

function mimeFromName(name: string): string {
  const ext = path.extname(name).toLowerCase()
  switch (ext) {
    case '.png':
      return 'image/png'
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg'
    case '.gif':
      return 'image/gif'
    case '.webp':
      return 'image/webp'
    case '.svg':
      return 'image/svg+xml'
    case '.pdf':
      return 'application/pdf'
    case '.txt':
      return 'text/plain'
    case '.md':
      return 'text/markdown'
    default:
      return 'application/octet-stream'
  }
}

function uniqueDest(dest: string): string {
  if (!fs.existsSync(dest)) return dest
  const ext = path.extname(dest)
  const base = dest.slice(0, dest.length - ext.length)
  let i = 2
  while (fs.existsSync(`${base}-${i}${ext}`)) i += 1
  return `${base}-${i}${ext}`
}

function isPathWithin(src: string, root: string): boolean {
  const rel = path.relative(path.resolve(root), path.resolve(src))
  return rel === '' || (!rel.startsWith('..') && !path.isAbsolute(rel))
}

async function stageAttachments(
  cwd: string,
  items: ChatAttachment[],
): Promise<{ files: ChatFileRef[]; images: SdkImagePayload[] }> {
  const files: ChatFileRef[] = []
  const images: SdkImagePayload[] = []
  if (items.length === 0) return { files, images }

  const destDir = path.join(cwd, '.slideo-chat-in')
  fs.mkdirSync(destDir, { recursive: true })

  for (const item of items.slice(0, 8)) {
    const src = item.path
    if (!src || !fs.existsSync(src)) continue
    let dest = src
    try {
      if (!isPathWithin(src, cwd)) {
        const safeName = (item.name || path.basename(src)).replace(/[^\w.\-]+/g, '_').slice(0, 80) || 'file'
        dest = uniqueDest(path.join(destDir, safeName))
        fs.copyFileSync(src, dest)
      }
    } catch {
      continue
    }
    const rel = path.relative(cwd, dest).split(path.sep).join('/')
    files.push({ file: rel, label: item.name || path.basename(dest) })
    const mime = item.mime || mimeFromName(item.name || src)
    if (mime.startsWith('image/') && mime !== 'image/svg+xml') {
      try {
        const buf = fs.readFileSync(src)
        if (buf.length > 0 && buf.length <= 4 * 1024 * 1024) {
          images.push({ data: buf.toString('base64'), mimeType: mime })
        }
      } catch {
        /* mention-only */
      }
    }
  }
  return { files, images }
}

function assistantText(msg: SDKMessage): string {
  if (msg.type !== 'assistant') return ''
  const parts = msg.message.content
  if (!Array.isArray(parts)) return ''
  return parts
    .filter((p): p is { type: 'text'; text: string } => p.type === 'text' && typeof p.text === 'string')
    .map((p) => p.text)
    .join('')
}

function recordTool(
  turn: ChatTurn,
  input: { id?: string; name?: string; args?: unknown; status: ChatToolChip['status'] },
): void {
  const described = describeChatTool({ id: input.id, name: input.name, args: input.args })
  turn.tools = upsertToolChip(turn.tools ?? [], {
    id: described.id,
    name: described.name,
    status: input.status,
    detail: described.detail,
  })
  emit({
    kind: 'tool',
    id: described.id,
    name: described.name,
    status: input.status,
    detail: described.detail,
  })
}

function toolCallFields(raw: unknown): {
  id?: string
  name?: string
  args?: unknown
  status?: 'running' | 'completed' | 'error'
} {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : null
  if (!rec) return {}
  const nested = rec['toolCall']
  const tool = nested && typeof nested === 'object' ? (nested as Record<string, unknown>) : rec
  const statusRaw = rec['status'] ?? tool['status']
  const status =
    statusRaw === 'completed' || statusRaw === 'error' || statusRaw === 'running' ? statusRaw : undefined
  return {
    id:
      typeof rec['callId'] === 'string'
        ? rec['callId']
        : typeof rec['call_id'] === 'string'
          ? rec['call_id']
          : undefined,
    name:
      typeof tool['name'] === 'string' ? tool['name'] : typeof rec['name'] === 'string' ? rec['name'] : undefined,
    args: tool['args'] ?? tool['arguments'] ?? tool['input'] ?? rec['args'],
    status,
  }
}

function applyInteractionDelta(
  turn: ChatTurn,
  update: { type: string } & Record<string, unknown>,
  seen: { text: boolean; thinking: boolean; tools: boolean },
): void {
  switch (update.type) {
    case 'text-delta': {
      const text = typeof update.text === 'string' ? update.text : ''
      if (!text) return
      seen.text = true
      turn.text = mergeStreamText(turn.text, text)
      emit({ kind: 'assistant-delta', text })
      return
    }
    case 'thinking-delta': {
      const text = typeof update.text === 'string' ? update.text : ''
      if (!text) return
      seen.thinking = true
      turn.thinking = mergeStreamText(turn.thinking ?? '', text)
      emit({ kind: 'thinking', text })
      return
    }
    case 'tool-call-started':
    case 'partial-tool-call':
    case 'tool-call-completed': {
      seen.tools = true
      const fields = toolCallFields(update)
      const status =
        update.type === 'tool-call-completed' ? (fields.status === 'error' ? 'error' : 'completed') : 'running'
      recordTool(turn, { id: fields.id, name: fields.name, args: fields.args, status })
      return
    }
    default:
      return
  }
}

async function pumpRun(
  run: Run,
  deckKey: string,
  assistantId: string,
  seen: { text: boolean; thinking: boolean; tools: boolean },
): Promise<void> {
  const turn = transcript.find((t) => t.id === assistantId)
  try {
    for await (const msg of run.stream()) {
      if (msg.type === 'assistant') {
        if (seen.text) continue
        const chunk = assistantText(msg)
        if (chunk && turn) {
          turn.text = mergeStreamText(turn.text, chunk)
          emit({ kind: 'assistant', text: turn.text })
        }
      } else if (msg.type === 'thinking') {
        if (seen.thinking) continue
        const chunk = msg.text ?? ''
        if (chunk && turn) {
          turn.thinking = mergeStreamText(turn.thinking ?? '', chunk)
          emit({ kind: 'thinking', text: chunk })
        }
      } else if (msg.type === 'tool_call' && turn) {
        if (seen.tools) continue
        const fields = toolCallFields(msg)
        recordTool(turn, {
          id: fields.id,
          name: fields.name ?? msg.name,
          args: fields.args,
          status: fields.status ?? msg.status,
        })
      } else if (msg.type === 'usage') {
        const u = msg.usage as {
          inputTokens?: number
          outputTokens?: number
          promptTokens?: number
          completionTokens?: number
          totalTokens?: number
        }
        emit({
          kind: 'usage',
          inputTokens: u.inputTokens ?? u.promptTokens,
          outputTokens: u.outputTokens ?? u.completionTokens,
          totalTokens: u.totalTokens,
        })
      }
    }
    const result = await run.wait()
    if (turn && typeof result.result === 'string' && result.result.trim()) {
      turn.text = result.result
      emit({ kind: 'assistant', text: result.result })
    }
    if (result.status === 'error') {
      emit({ kind: 'done', status: 'error', error: result.error?.message ?? 'Run failed' })
    } else {
      emit({ kind: 'done', status: result.status })
    }
    if (agent) {
      try {
        const usage = await agent.getUsage()
        emit({
          kind: 'usage',
          inputTokens: usage.usage.inputTokens,
          outputTokens: usage.usage.outputTokens,
          totalTokens: usage.usage.totalTokens,
        })
      } catch {
        /* usage is advisory */
      }
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    emit({ kind: 'error', message })
    emit({ kind: 'done', status: 'error', error: message })
  } finally {
    currentRun = null
    persistTranscript(deckKey)
  }
}

function openUrl(url: string): void {
  const cmd = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'cmd' : 'xdg-open'
  const args = process.platform === 'win32' ? ['/c', 'start', '', url] : [url]
  spawn(cmd, args, { detached: true, stdio: 'ignore' }).unref()
}

export async function bindDeck(input: { cwd: string; deckKey: string }): Promise<{ ok: boolean }> {
  const cwd = input.cwd.trim()
  const deckKey = input.deckKey.trim() || 'untitled'
  if (!cwd) return { ok: false }
  if (bound && bound.deckKey === deckKey && bound.cwd === cwd) return { ok: true }
  if (bound && bound.deckKey !== deckKey) {
    persistTranscript(bound.deckKey)
    await disposeAgent()
    transcript = []
    sessionIndex = emptyChatIndex()
    indexDeckKey = null
  }
  bound = { cwd, deckKey }
  ensureSessionIndex(deckKey)
  if (sessionIndex.activeId) transcript = loadTranscript(deckKey, sessionIndex.activeId)
  return { ok: true }
}

export async function getChatStatus(): Promise<ChatStatus> {
  ensureSdkConfigured()
  const modelId = getChatModelId() || DEFAULT_CHAT_MODEL_ID
  const store = credentialStore()
  try {
    const status = await Cursor.auth.status({ store })
    if (status.status === 'logged-in') {
      const expiresAt = status.apiKeyExpiresAtMs
      return {
        loggedIn: true,
        email: status.email,
        expiresAt,
        expired: typeof expiresAt === 'number' && expiresAt < Date.now(),
        projectBound: !!bound,
        modelId,
        modelParams: getChatModelParams(),
        running: !!currentRun,
      }
    }
  } catch {
    /* logged out */
  }
  return {
    loggedIn: false,
    projectBound: !!bound,
    modelId,
    modelParams: getChatModelParams(),
    running: !!currentRun,
  }
}

export async function loginChat(): Promise<{ ok: boolean; error?: string; email?: string }> {
  ensureSdkConfigured()
  try {
    const result = await Cursor.auth.login({
      store: credentialStore(),
      openBrowser: (url) => {
        openUrl(url)
      },
      apiKeyName: 'Slideo',
    })
    return { ok: true, email: result.email }
  } catch (err) {
    const message = err instanceof CursorAgentError || err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}

export async function logoutChat(): Promise<{ ok: boolean }> {
  try {
    await Cursor.auth.logout({ store: credentialStore() })
  } catch {
    /* still drop the agent */
  }
  await disposeChatAgent()
  return { ok: true }
}

export function setChatModel(modelId: string, params?: ChatModelParam[]): { ok: boolean; modelId: string } {
  const id = modelId.trim() || DEFAULT_CHAT_MODEL_ID
  writeSettings(id, params ?? [])
  return { ok: true, modelId: id }
}

export async function listChatModels(): Promise<ChatModelInfo[]> {
  ensureSdkConfigured()
  try {
    const apiKey = await loadApiKey()
    const models = await Cursor.models.list(apiKey ? { apiKey } : undefined)
    return models.map((m) =>
      normalizeChatModel({
        id: m.id,
        displayName: m.displayName || m.id,
        parameters: (m.parameters ?? []).map((p) => ({
          id: p.id,
          displayName: p.displayName || p.id,
          values: (p.values ?? []).map((v) => ({
            value: v.value,
            displayName: v.displayName || v.value,
          })),
        })),
        variants: (m.variants ?? []).map((v) => ({
          displayName: v.displayName,
          description: v.description,
          isDefault: v.isDefault,
          params: (v.params ?? []).map((p) => ({ id: p.id, value: p.value })),
        })),
      }),
    )
  } catch {
    return []
  }
}

export function getChatHistory(): ChatTurn[] {
  const key = bound?.deckKey
  if (key) {
    ensureSessionIndex(key)
    if (sessionIndex.activeId && transcript.length === 0) {
      transcript = loadTranscript(key, sessionIndex.activeId)
    }
  }
  return transcript.slice()
}

export function getChatSessions(): ChatSessionsSnapshot {
  const key = bound?.deckKey
  if (key) {
    ensureSessionIndex(key)
    if (sessionIndex.chats.length === 0 && agent && agentDeckKey === key) {
      const now = Date.now()
      sessionIndex = addSession(sessionIndex, {
        id: agent.agentId,
        title: titleFromUserText(transcript.find((t) => t.role === 'user')?.text ?? '', ''),
        createdAt: now,
        updatedAt: now,
      })
      writeIndex(key)
    }
  }
  return snapshotSessions()
}

function busySwitch(): ChatSessionResult {
  return {
    ok: false,
    error: BUSY,
    sessions: snapshotSessions(),
    turns: transcript.slice(),
  }
}

function needBound(): ChatSessionResult | null {
  if (!bound) {
    return { ok: false, error: NO_DECK, sessions: snapshotSessions(), turns: [] }
  }
  return null
}

export async function newChatSession(): Promise<ChatSessionResult> {
  const missing = needBound()
  if (missing) return missing
  const { cwd, deckKey } = bound!
  if (currentRun) return busySwitch()
  ensureSdkConfigured()
  ensureSessionIndex(deckKey)
  if (sessionIndex.activeId && transcript.length === 0 && agent) {
    return { ok: true, sessions: snapshotSessions(), turns: [] }
  }
  persistTranscript(deckKey)
  try {
    await bindAgent(cwd, deckKey, undefined, { forceCreate: true })
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message, sessions: snapshotSessions(), turns: [] }
  }
  return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() }
}

export async function switchChatSession(id: string): Promise<ChatSessionResult> {
  const missing = needBound()
  if (missing) return missing
  const { cwd, deckKey } = bound!
  if (currentRun) return busySwitch()
  const want = id.trim()
  if (!want) return { ok: false, error: 'Missing chat id.', sessions: snapshotSessions(), turns: transcript.slice() }
  ensureSdkConfigured()
  ensureSessionIndex(deckKey)
  if (sessionIndex.activeId === want && agent && agentDeckKey === deckKey) {
    sessionIndex = pinOpenTab(sessionIndex, want)
    writeIndex(deckKey)
    return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() }
  }
  persistTranscript(deckKey)
  await disposeAgent()
  sessionIndex = activateSession(sessionIndex, want)
  writeIndex(deckKey)
  transcript = loadTranscript(deckKey, want)
  try {
    await bindAgent(cwd, deckKey, want)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message, sessions: snapshotSessions(), turns: transcript.slice() }
  }
  return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() }
}

export async function closeChatTab(id: string): Promise<ChatSessionResult> {
  const missing = needBound()
  if (missing) return missing
  const { deckKey } = bound!
  if (currentRun && sessionIndex.activeId === id) return busySwitch()
  ensureSessionIndex(deckKey)
  if (sessionIndex.openIds.length <= 1 && sessionIndex.activeId === id) {
    return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() }
  }
  persistTranscript(deckKey)
  const wasActive = sessionIndex.activeId === id
  sessionIndex = closeOpenTab(sessionIndex, id)
  writeIndex(deckKey)
  if (!wasActive) return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() }
  if (!sessionIndex.activeId) return newChatSession()
  return switchChatSession(sessionIndex.activeId)
}

export async function deleteChatSession(id: string): Promise<ChatSessionResult> {
  const missing = needBound()
  if (missing) return missing
  const { deckKey } = bound!
  if (currentRun && sessionIndex.activeId === id) return busySwitch()
  ensureSessionIndex(deckKey)
  persistTranscript(deckKey)
  const wasActive = sessionIndex.activeId === id
  try {
    const file = transcriptPathFor(deckKey, id)
    if (fs.existsSync(file)) fs.unlinkSync(file)
  } catch {
    /* ignore */
  }
  sessionIndex = removeSession(sessionIndex, id)
  writeIndex(deckKey)
  if (sessionIndex.chats.length === 0) return newChatSession()
  if (wasActive && sessionIndex.activeId) return switchChatSession(sessionIndex.activeId)
  return { ok: true, sessions: snapshotSessions(), turns: transcript.slice() }
}

export async function cancelChat(): Promise<{ ok: boolean }> {
  cancelRequested = true
  if (currentRun) {
    try {
      if (currentRun.supports('cancel')) await currentRun.cancel()
    } catch {
      /* ignore */
    }
  }
  emit({ kind: 'done', status: 'cancelled' })
  return { ok: true }
}

export async function sendChat(input: {
  text: string
  mode?: ChatMode
  anchors?: ChatAnchor[]
  files?: ChatFileRef[]
  attachments?: ChatAttachment[]
}): Promise<ChatSendResult> {
  if (!bound) return { ok: false, error: NO_DECK }
  if (currentRun) return { ok: false, error: 'run-in-progress' }
  const { cwd, deckKey } = bound

  ensureSdkConfigured()
  const auth = await Cursor.auth.status({ store: credentialStore() })
  if (auth.status !== 'logged-in') return { ok: false, error: 'not-signed-in' }
  if (typeof auth.apiKeyExpiresAtMs === 'number' && auth.apiKeyExpiresAtMs < Date.now()) {
    return { ok: false, error: 'expired' }
  }

  cancelRequested = false

  const staged = await stageAttachments(cwd, input.attachments ?? [])
  const files = [...(input.files ?? []), ...staged.files]
  const text = input.text.trim() || (files.length || (input.anchors?.length ?? 0) ? '(see attached files)' : '')
  if (!text) return { ok: false, error: 'empty-message' }

  let boundAgent: SDKAgent
  try {
    boundAgent = await bindAgent(cwd, deckKey)
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }

  const modelId = await resolveModelId()
  const restriction = restrictionOptions(cwd)
  const userText = `${text}${formatAnchors(input.anchors ?? [])}${formatFiles(files)}`

  const userTurn: ChatTurn = { id: `u-${Date.now()}`, role: 'user', text: userText }
  const assistantTurn: ChatTurn = { id: `a-${Date.now()}`, role: 'assistant', text: '' }
  transcript.push(userTurn, assistantTurn)
  persistTranscript(deckKey)
  if (sessionIndex.activeId) {
    const existing = sessionIndex.chats.find((c) => c.id === sessionIndex.activeId)
    sessionIndex = touchSession(sessionIndex, sessionIndex.activeId, {
      title: existing?.title || titleFromUserText(text, ''),
      updatedAt: Date.now(),
    })
    writeIndex(deckKey)
  }

  try {
    const payload = staged.images.length > 0 ? { text: userText, images: staged.images } : userText
    const seen = { text: false, thinking: false, tools: false }
    const run = await boundAgent.send(payload, {
      model: modelSelection(modelId),
      mcpServers: restriction.mcpServers,
      mode: input.mode === 'plan' ? 'plan' : 'agent',
      onDelta: ({ update }) => {
        applyInteractionDelta(assistantTurn, update as { type: string } & Record<string, unknown>, seen)
      },
      onStep: () => {
        emit({ kind: 'heartbeat' })
      },
    })
    currentRun = run
    if (cancelRequested) {
      try {
        if (run.supports('cancel')) await run.cancel()
      } catch {
        /* already requested */
      }
    }
    void pumpRun(run, deckKey, assistantTurn.id, seen)
    return { ok: true, runId: run.id, agentId: boundAgent.agentId }
  } catch (err) {
    transcript.pop()
    transcript.pop()
    persistTranscript(deckKey)
    const message = err instanceof CursorAgentError || err instanceof Error ? err.message : String(err)
    return { ok: false, error: message }
  }
}
