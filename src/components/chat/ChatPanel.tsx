import { useCallback, useEffect, useMemo, useRef, useState, type KeyboardEvent, type ReactNode } from 'react'
import { Icon } from '@/components/ui/Icon'
import { t } from '@/i18n'
import {
  chatBind,
  chatCancel,
  chatCloseTab,
  chatDelete,
  chatHistory,
  chatLogin,
  chatModels,
  chatNew,
  chatSend,
  chatSessions,
  chatSetModel,
  chatStatus,
  chatSwitch,
  displayChatError,
} from '@/lib/chat/api'
import { isFastParam, isThinkingParam, normalizeChatModel, paramValue, upsertParam } from '@/lib/chat/chatModels'
import { shortToolName } from '@/lib/chat/chatStream'
import type {
  ChatAttachment,
  ChatFileRef,
  ChatModelInfo,
  ChatModelParam,
  ChatSessionMeta,
  ChatSessionResult,
} from '@/lib/chat/chatTypes'
import { isTauri } from '@/lib/tauri'
import { flushMcpSync } from '@/lib/mcp-bridge'
import { useChatStore } from '@/store/chat'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'

const STALL_AFTER_SEC = 45

function mimeFromName(name: string): string {
  const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
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

function sessionTitle(title: string): string {
  return title.trim() || t('chat.newChat')
}

function chipPreview(text: string): string {
  const one = text.replace(/\s+/g, ' ').trim()
  return one.length > 72 ? `${one.slice(0, 72)}…` : one
}

function ChatMarkdown({ text }: { text: string }) {
  const lines = text.split('\n')
  return (
    <div className="whitespace-pre-wrap break-words leading-snug">
      {lines.map((line, i) => (
        <span key={i}>
          {i > 0 && <br />}
          {renderInline(line)}
        </span>
      ))}
    </div>
  )
}

function renderInline(line: string): ReactNode[] {
  const parts: ReactNode[] = []
  const re = /(\*\*[^*]+\*\*|`[^`]+`)/g
  let last = 0
  let i = 0
  let m: RegExpExecArray | null
  while ((m = re.exec(line))) {
    if (m.index > last) parts.push(line.slice(last, m.index))
    const token = m[0]
    if (token.startsWith('**')) {
      parts.push(
        <strong key={i} className="font-semibold">
          {token.slice(2, -2)}
        </strong>,
      )
    } else {
      parts.push(
        <code key={i} className="rounded bg-chrome-surface-2 px-1 font-mono text-[12px]">
          {token.slice(1, -1)}
        </code>,
      )
    }
    i += 1
    last = m.index + token.length
  }
  if (last < line.length) parts.push(line.slice(last))
  return parts
}

export function ChatPanel() {
  const presentation = usePresentationStore((s) => s.presentation)
  const filePath = usePresentationStore((s) => s.filePath)
  const openModal = useUiStore((s) => s.openModal)
  const chat = useChatStore()
  const tauri = isTauri()

  const threadEl = useRef<HTMLDivElement>(null)
  const menuRoot = useRef<HTMLDivElement>(null)
  const historyRoot = useRef<HTMLDivElement>(null)
  const [loggingIn, setLoggingIn] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [elapsedSec, setElapsedSec] = useState(0)
  const [quietSec, setQuietSec] = useState(0)
  const [models, setModels] = useState<ChatModelInfo[]>([])
  const [mentionIndex, setMentionIndex] = useState(0)
  const sendTicket = useRef(0)

  const slideMentions: ChatFileRef[] = useMemo(() => {
    if (!presentation) return []
    return presentation.zones.map((z) => ({ file: z.id, label: z.label || z.id }))
  }, [presentation])

  const mentionQuery = useMemo(() => {
    const m = chat.draft.match(/(^|\s)@([^\s]*)$/)
    return m ? (m[2] ?? '').toLowerCase() : null
  }, [chat.draft])

  const mentionHits = useMemo(() => {
    if (mentionQuery === null) return [] as ChatFileRef[]
    const q = mentionQuery
    return slideMentions
      .filter((f) => !q || f.file.toLowerCase().includes(q) || f.label.toLowerCase().includes(q))
      .slice(0, 12)
  }, [mentionQuery, slideMentions])

  const refreshStatus = useCallback(async () => {
    if (!tauri) return
    const s = useChatStore.getState()
    try {
      s.setStatus(await chatStatus())
    } catch (e) {
      s.setStatus(null)
      s.setLastError(displayChatError(e))
    }
  }, [tauri])

  const refreshModels = useCallback(async () => {
    if (!tauri || !useChatStore.getState().status?.loggedIn) {
      setModels([])
      return
    }
    try {
      const list = await chatModels()
      setModels(Array.isArray(list) ? list : [])
    } catch {
      setModels([])
    }
  }, [tauri])

  const refreshHistory = useCallback(async () => {
    if (!tauri) return
    try {
      const turns = await chatHistory()
      if (Array.isArray(turns)) useChatStore.getState().setTurns(turns)
    } catch {
      /* keep local */
    }
  }, [tauri])

  const hasDeck = !!presentation

  const refreshSessions = useCallback(async () => {
    const s = useChatStore.getState()
    if (!tauri || !hasDeck) {
      s.setSessions({ activeId: null, open: [], all: [] })
      return
    }
    try {
      const snap = await chatSessions()
      if (snap && Array.isArray(snap.open) && Array.isArray(snap.all)) s.setSessions(snap)
    } catch {
      /* keep local */
    }
  }, [tauri, hasDeck])

  useEffect(() => {
    if (!tauri || !hasDeck) return
    void chatBind(filePath).then(() => {
      void refreshStatus().then(() => void refreshModels())
      if (!useChatStore.getState().streaming) {
        void refreshHistory()
        void refreshSessions()
      }
    })
  }, [tauri, hasDeck, filePath, refreshStatus, refreshModels, refreshHistory, refreshSessions])

  useEffect(() => {
    if (!tauri) return
    let unlisten: (() => void) | undefined
    void import('@tauri-apps/api/event').then(({ listen }) =>
      listen<import('@/lib/chat/chatTypes').ChatStreamEvent>('chat:event', (e) => {
        useChatStore.getState().applyEvent(e.payload)
      }).then((fn) => {
        unlisten = fn
      }),
    )
    return () => unlisten?.()
  }, [tauri])

  useEffect(() => {
    const el = threadEl.current
    if (!el) return
    el.scrollTop = el.scrollHeight
  }, [chat.turns, chat.streaming])

  useEffect(() => {
    if (!chat.streaming) {
      setElapsedSec(0)
      setQuietSec(0)
      return
    }
    const started = Date.now()
    const id = window.setInterval(() => {
      setElapsedSec(Math.floor((Date.now() - started) / 1000))
      const last = useChatStore.getState().lastActivityAt
      setQuietSec(last ? Math.floor((Date.now() - last) / 1000) : Math.floor((Date.now() - started) / 1000))
    }, 1000)
    return () => window.clearInterval(id)
  }, [chat.streaming])

  useEffect(() => {
    function onPointer(e: PointerEvent) {
      if (menuOpen && menuRoot.current && !menuRoot.current.contains(e.target as Node)) setMenuOpen(false)
      if (historyOpen && historyRoot.current && !historyRoot.current.contains(e.target as Node)) {
        setHistoryOpen(false)
      }
    }
    window.addEventListener('pointerdown', onPointer)
    return () => window.removeEventListener('pointerdown', onPointer)
  }, [menuOpen, historyOpen])

  function applySessionResult(res: ChatSessionResult): void {
    if (res.sessions) chat.setSessions(res.sessions)
    if (Array.isArray(res.turns)) {
      chat.setTurns(res.turns.map((turn) => ({ ...turn, tools: turn.tools?.map((c) => ({ ...c })) })))
    }
    chat.setDraft('')
    chat.setPendingFiles([])
    chat.setPendingAttachments([])
    useChatStore.setState({ pendingAnchors: [] })
    chat.setUsageLine('')
    chat.setLastError(res.ok ? '' : displayChatError(res.error || 'error'))
  }

  async function signIn(): Promise<void> {
    if (!tauri) {
      chat.setLastError(t('chat.desktopOnly'))
      return
    }
    setLoggingIn(true)
    chat.setLastError('')
    try {
      const res = await chatLogin()
      if (!res?.ok) chat.setLastError(displayChatError(res?.error || t('chat.loginFailed')))
      await refreshStatus()
      await refreshModels()
    } finally {
      setLoggingIn(false)
    }
  }

  function pickMention(file: ChatFileRef): void {
    chat.setDraft(chat.draft.replace(/@([^\s]*)$/, `@${file.file} `))
    if (!chat.pendingFiles.some((f) => f.file === file.file)) {
      chat.setPendingFiles([...chat.pendingFiles, file])
    }
    setMentionIndex(0)
  }

  function mentionsFromDraft(): ChatFileRef[] {
    const names = new Set(slideMentions.map((f) => f.file))
    const found: ChatFileRef[] = []
    for (const m of chat.draft.matchAll(/(?:^|\s)@([^\s]+)/g)) {
      const name = m[1]
      if (name && names.has(name) && !found.some((f) => f.file === name)) {
        const hit = slideMentions.find((f) => f.file === name)
        found.push(hit ?? { file: name, label: name })
      }
    }
    return found
  }

  const canSend = !!(
    chat.draft.trim() ||
    chat.pendingAttachments.length ||
    chat.pendingFiles.length ||
    chat.pendingAnchors.length
  )

  async function send(): Promise<void> {
    if (!canSend || chat.streaming) return
    if (!tauri) {
      chat.setLastError(t('chat.desktopOnly'))
      return
    }
    await refreshStatus()
    const status = useChatStore.getState().status
    if (!status?.loggedIn || status.expired) return
    if (!presentation) return

    const text = chat.draft.trim()
    const anchors = chat.pendingAnchors.slice()
    const files = [
      ...chat.pendingFiles,
      ...mentionsFromDraft().filter((f) => !chat.pendingFiles.some((p) => p.file === f.file)),
    ]
    const attachments = chat.pendingAttachments.slice()
    chat.setDraft('')
    useChatStore.setState({ pendingAnchors: [] })
    chat.setPendingFiles([])
    chat.setPendingAttachments([])
    chat.setLastError('')
    chat.setStreaming(true)
    chat.bumpActivity()
    const userText = text || attachments.map((a) => a.name).join(', ')
    chat.setTurns([
      ...useChatStore.getState().turns,
      { id: `u-${Date.now()}`, role: 'user', text: userText },
      { id: `a-${Date.now()}`, role: 'assistant', text: '' },
    ])

    const ticket = ++sendTicket.current
    flushMcpSync()
    try {
      const res = await chatSend({
        text,
        mode: useChatStore.getState().mode,
        anchors,
        files,
        attachments,
      })
      if (ticket !== sendTicket.current) return
      if (!res?.ok) {
        failSend(text, anchors, files, attachments, res?.error || t('chat.errorPrefix'))
      } else {
        void refreshSessions()
      }
    } catch (err) {
      if (ticket !== sendTicket.current) return
      failSend(text, anchors, files, attachments, err)
    }
  }

  function failSend(
    text: string,
    anchors: typeof chat.pendingAnchors,
    files: ChatFileRef[],
    attachments: ChatAttachment[],
    message: unknown,
  ): void {
    chat.setStreaming(false)
    chat.setLastError(displayChatError(message))
    chat.setTurns(useChatStore.getState().turns.slice(0, -2))
    chat.setDraft(text)
    useChatStore.setState({ pendingAnchors: anchors })
    chat.setPendingFiles(files)
    chat.setPendingAttachments(attachments)
  }

  async function newSession(): Promise<void> {
    setHistoryOpen(false)
    if (chat.streaming) {
      chat.setLastError(t('chat.busySwitch'))
      return
    }
    const optimistic: ChatSessionMeta = {
      id: `pending-${Date.now()}`,
      title: '',
      createdAt: Date.now(),
      updatedAt: Date.now(),
    }
    chat.setTurns([])
    chat.setLastError('')
    chat.setSessions({
      activeId: optimistic.id,
      open: [optimistic, ...chat.sessions.open.filter((s) => s.id !== chat.sessions.activeId)].slice(0, 7),
      all: [optimistic, ...chat.sessions.all],
    })
    try {
      applySessionResult(await chatNew())
    } catch (err) {
      chat.setLastError(displayChatError(err))
      await refreshSessions()
      await refreshHistory()
    }
  }

  async function switchSession(id: string): Promise<void> {
    setHistoryOpen(false)
    if (id === chat.sessions.activeId) return
    if (chat.streaming) {
      chat.setLastError(t('chat.busySwitch'))
      return
    }
    chat.setTurns([])
    try {
      applySessionResult(await chatSwitch(id))
    } catch (err) {
      chat.setLastError(displayChatError(err))
    }
  }

  async function closeTab(id: string): Promise<void> {
    if (chat.streaming && id === chat.sessions.activeId) {
      chat.setLastError(t('chat.busySwitch'))
      return
    }
    try {
      applySessionResult(await chatCloseTab(id))
    } catch (err) {
      chat.setLastError(displayChatError(err))
    }
  }

  async function deleteSession(id: string): Promise<void> {
    if (chat.streaming && id === chat.sessions.activeId) {
      chat.setLastError(t('chat.busySwitch'))
      return
    }
    try {
      applySessionResult(await chatDelete(id))
    } catch (err) {
      chat.setLastError(displayChatError(err))
    }
  }

  async function cancel(): Promise<void> {
    sendTicket.current += 1
    chat.setStreaming(false)
    const last = chat.turns.at(-1)
    if (last?.role === 'assistant' && !last.text && !last.thinking && !(last.tools && last.tools.length)) {
      chat.setTurns(chat.turns.slice(0, -1))
    }
    try {
      await chatCancel()
    } catch {
      /* UI is already unlocked */
    }
  }

  function onComposerKey(e: KeyboardEvent<HTMLTextAreaElement>): void {
    if (mentionQuery !== null && mentionHits.length > 0) {
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setMentionIndex((i) => (i + 1) % mentionHits.length)
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setMentionIndex((i) => (i - 1 + mentionHits.length) % mentionHits.length)
        return
      }
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault()
        pickMention(mentionHits[mentionIndex] ?? mentionHits[0]!)
        return
      }
      if (e.key === 'Escape') {
        e.preventDefault()
        chat.setDraft(chat.draft.replace(/@([^\s]*)$/, ''))
        return
      }
    }
    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing && !e.altKey && !e.metaKey && !e.ctrlKey) {
      e.preventDefault()
      void send()
    }
  }

  async function persistModel(id: string, params: ChatModelParam[]): Promise<void> {
    await chatSetModel(id, params)
    await refreshStatus()
  }

  const catalog = models.length > 0
    ? models
    : chat.status?.modelId
      ? [normalizeChatModel({ id: chat.status.modelId, displayName: chat.status.modelId })]
      : []
  const currentParams = chat.status?.modelParams ?? []
  const selectedModel = catalog.find((m) => m.id === chat.status?.modelId) ?? catalog[0] ?? null
  const loggedIn = !!chat.status?.loggedIn
  const expired = !!chat.status?.expired
  const lastAssistant = [...chat.turns].reverse().find((x) => x.role === 'assistant') ?? null
  const runningTool = lastAssistant?.tools?.find((c) => c.status === 'running') ?? null
  const stalling = chat.streaming && quietSec >= STALL_AFTER_SEC
  const modeLabel = chat.mode === 'plan' ? t('chat.modePlan') : t('chat.modeAgent')

  function paramsMatch(a: ChatModelParam[], b: ChatModelParam[]): boolean {
    if (a.length !== b.length) return false
    const map = new Map(b.map((p) => [p.id, p.value]))
    return a.every((p) => map.get(p.id) === p.value)
  }

  const activeVariantName =
    selectedModel?.variants.find((v) => paramsMatch(v.params, currentParams))?.displayName ??
    selectedModel?.variants.find((v) => v.isDefault)?.displayName ??
    ''
  const showVariantSelect = !!selectedModel && selectedModel.variants.length > 0 && selectedModel.parameters.length === 0

  async function attachFiles(): Promise<void> {
    if (!tauri) return
    const { open } = await import('@tauri-apps/plugin-dialog')
    const selected = await open({
      multiple: true,
      filters: [{ name: t('chat.attachFiles'), extensions: ['pdf', 'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'md', 'txt'] }],
    })
    const paths = Array.isArray(selected) ? selected : selected ? [selected] : []
    const next = [...chat.pendingAttachments]
    for (const p of paths.slice(0, 8)) {
      if (next.some((x) => x.path === p)) continue
      next.push({ path: p, name: p.replace(/^.*[/\\]/, ''), mime: mimeFromName(p) })
    }
    chat.setPendingAttachments(next.slice(0, 8))
    setMenuOpen(false)
  }

  const btn =
    'flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40'
  const primary =
    'rounded-lg bg-chrome-accent-600 px-3.5 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2553c9] disabled:cursor-default disabled:opacity-45'

  return (
    <aside className="flex h-full min-h-0 flex-col bg-chrome-bg text-[13px] text-chrome-text" aria-label={t('chat.title')}>
      <header className="relative flex h-9 shrink-0 items-center justify-between gap-2 border-b border-chrome-border px-3">
        <strong className="text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
          {t('chat.title')}
        </strong>
        {loggedIn && presentation && !expired && (
          <div className="relative flex gap-0.5" ref={historyRoot}>
            <button
              type="button"
              className={btn + (historyOpen ? ' bg-chrome-surface-2' : '')}
              onClick={() => setHistoryOpen((v) => !v)}
              title={t('chat.chatHistory')}
              aria-label={t('chat.chatHistory')}
            >
              <Icon name="history" size={16} />
            </button>
            <button
              type="button"
              className={btn}
              onClick={() => void newSession()}
              title={t('chat.newChat')}
              aria-label={t('chat.newChat')}
            >
              <Icon name="add" size={16} />
            </button>
            {historyOpen && (
              <div className="absolute right-0 top-[calc(100%+4px)] z-20 max-h-72 w-60 overflow-auto rounded-lg border border-chrome-border bg-chrome-surface p-1 shadow-card">
                {chat.sessions.all.length === 0 ? (
                  <p className="px-2.5 py-2 text-[12px] text-chrome-muted">{t('chat.historyEmpty')}</p>
                ) : (
                  chat.sessions.all.map((session) => (
                    <div
                      key={session.id}
                      className={
                        'flex items-center gap-0.5 rounded-md ' +
                        (session.id === chat.sessions.activeId ? 'bg-chrome-accent/10' : '')
                      }
                    >
                      <button
                        type="button"
                        className="min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[12px] hover:text-chrome-text"
                        onClick={() => void switchSession(session.id)}
                      >
                        {sessionTitle(session.title)}
                      </button>
                      <button
                        type="button"
                        className="flex h-6 w-6 shrink-0 items-center justify-center rounded text-chrome-faint hover:bg-chrome-surface-2 hover:text-chrome-text"
                        onClick={() => void deleteSession(session.id)}
                        title={t('chat.deleteChat')}
                        aria-label={t('chat.deleteChat')}
                      >
                        <Icon name="close" size={14} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            )}
          </div>
        )}
      </header>

      {!tauri ? (
        <div className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-[15px] font-semibold">{t('chat.signInTitle')}</h3>
          <p className="mb-3 text-chrome-muted">{t('chat.desktopOnly')}</p>
        </div>
      ) : !loggedIn ? (
        <div className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-[15px] font-semibold">{t('chat.signInTitle')}</h3>
          <p className="mb-3 leading-snug text-chrome-muted">{t('chat.signInBody')}</p>
          <button className={primary} onClick={() => void signIn()} disabled={loggingIn}>
            {t('chat.signIn')}
          </button>
          <button
            type="button"
            className="mt-2.5 block text-chrome-accent-600 hover:underline"
            onClick={() => openModal('settings')}
          >
            {t('chat.openSettings')}
          </button>
          {chat.lastError && <p className="mt-2 text-[12px] text-chrome-danger">{displayChatError(chat.lastError)}</p>}
        </div>
      ) : expired ? (
        <div className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-[15px] font-semibold">{t('chat.expired')}</h3>
          <button className={primary} onClick={() => void signIn()} disabled={loggingIn}>
            {t('chat.signIn')}
          </button>
          <button
            type="button"
            className="mt-2.5 block text-chrome-accent-600 hover:underline"
            onClick={() => openModal('settings')}
          >
            {t('chat.openSettings')}
          </button>
        </div>
      ) : !presentation ? (
        <div className="flex-1 overflow-auto p-4">
          <h3 className="mb-2 text-[15px] font-semibold">{t('chat.noProjectTitle')}</h3>
          <p className="mb-3 leading-snug text-chrome-muted">{t('chat.noProjectBody')}</p>
          {chat.status?.email && (
            <p className="text-chrome-muted">{t('chat.signedInAs', { email: chat.status.email })}</p>
          )}
        </div>
      ) : (
        <>
          <div ref={threadEl} className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-3.5">
            {chat.turns.length === 0 && (
              <p className="text-chrome-muted">{t('chat.emptyHint')}</p>
            )}
            {chat.turns.map((turn) => (
              <article
                key={`${chat.sessions.activeId ?? ''}:${turn.id}`}
                className={
                  'rounded-lg border px-2.5 py-2 ' +
                  (turn.role === 'user'
                    ? 'border-chrome-accent/25 bg-chrome-accent/10'
                    : 'border-chrome-border bg-chrome-surface')
                }
              >
                {(turn.thinking || (chat.streaming && turn.id === lastAssistant?.id)) && (
                  <details
                    className="mb-1.5 text-[11px] text-chrome-muted"
                    open={chat.streaming && turn.id === lastAssistant?.id}
                  >
                    <summary className="cursor-pointer">
                      {t('chat.thinking')}
                      {chat.streaming && turn.id === lastAssistant?.id && elapsedSec > 0
                        ? ` · ${elapsedSec}s`
                        : ''}
                    </summary>
                    {turn.thinking && (
                      <p className="mt-1.5 whitespace-pre-wrap text-[12px] text-chrome-muted">{turn.thinking}</p>
                    )}
                  </details>
                )}
                {turn.tools && turn.tools.length > 0 && (
                  <ul className="mb-1.5 flex flex-wrap gap-1">
                    {turn.tools.map((tool) => (
                      <li
                        key={tool.id || tool.name}
                        className={
                          'rounded-full px-2 py-0.5 text-[11px] ' +
                          (tool.status === 'running'
                            ? 'bg-chrome-accent/15 text-chrome-accent-600'
                            : tool.status === 'error'
                              ? 'bg-red-50 text-red-700'
                              : 'bg-chrome-surface-2 text-chrome-muted')
                        }
                      >
                        {tool.detail
                          ? `${shortToolName(tool.name)} · ${tool.detail}`
                          : shortToolName(tool.name)}
                      </li>
                    ))}
                  </ul>
                )}
                {turn.text ? (
                  <ChatMarkdown text={turn.text} />
                ) : turn.role === 'assistant' && chat.streaming && turn.id === lastAssistant?.id ? (
                  <div className="italic text-chrome-muted">
                    {runningTool
                      ? t('chat.usingTool', { name: shortToolName(runningTool.name) })
                      : elapsedSec > 0
                        ? t('chat.workingElapsedSec', { s: elapsedSec })
                        : t('chat.workingElapsed')}
                  </div>
                ) : null}
              </article>
            ))}
            {stalling && <p className="text-[12px] text-amber-700">{t('chat.stallHint')}</p>}
            {chat.lastError && <p className="text-[12px] text-chrome-danger">{displayChatError(chat.lastError)}</p>}
          </div>

          <div className="shrink-0 border-t border-chrome-border bg-chrome-surface px-2.5 pb-2.5 pt-2">
            {(chat.pendingAnchors.length > 0 ||
              chat.pendingFiles.length > 0 ||
              chat.pendingAttachments.length > 0) && (
              <ul className="mb-1.5 flex flex-wrap gap-1.5">
                {chat.pendingAttachments.map((chip, i) => (
                  <li
                    key={chip.path}
                    className="flex max-w-full items-center gap-1 rounded-md bg-chrome-accent/10 px-2 py-0.5 text-[12px]"
                    title={chip.path}
                  >
                    <span className="truncate">{chip.name}</span>
                    <button
                      type="button"
                      aria-label={t('chat.removeChip')}
                      onClick={() =>
                        chat.setPendingAttachments(chat.pendingAttachments.filter((_, j) => j !== i))
                      }
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </li>
                ))}
                {chat.pendingFiles.map((chip, i) => (
                  <li
                    key={chip.file}
                    className="flex max-w-full items-center gap-1 rounded-md bg-chrome-accent/10 px-2 py-0.5 text-[12px]"
                    title={chip.file}
                  >
                    <span className="truncate">@{chip.label}</span>
                    <button
                      type="button"
                      aria-label={t('chat.removeChip')}
                      onClick={() => chat.setPendingFiles(chat.pendingFiles.filter((_, j) => j !== i))}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </li>
                ))}
                {chat.pendingAnchors.map((chip, i) => (
                  <li
                    key={`${chip.file}-${i}`}
                    className="flex max-w-full items-center gap-1 rounded-md bg-chrome-accent/10 px-2 py-0.5 text-[12px]"
                    title={chip.selectionText}
                  >
                    <span className="truncate">{chipPreview(chip.selectionText)}</span>
                    <button
                      type="button"
                      aria-label={t('chat.removeChip')}
                      onClick={() =>
                        useChatStore.setState({
                          pendingAnchors: chat.pendingAnchors.filter((_, j) => j !== i),
                        })
                      }
                    >
                      <Icon name="close" size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {mentionQuery !== null && (
              <ul className="mb-1.5 max-h-40 overflow-auto rounded-lg border border-chrome-border bg-chrome-surface p-1">
                {mentionHits.length === 0 ? (
                  <li className="px-2 py-1.5 text-[12px] text-chrome-muted">{t('chat.mentionEmpty')}</li>
                ) : (
                  mentionHits.map((hit, i) => (
                    <li key={hit.file}>
                      <button
                        type="button"
                        className={
                          'block w-full rounded-md px-2 py-1 text-left text-[12px] ' +
                          (i === mentionIndex ? 'bg-chrome-accent/10' : 'hover:bg-chrome-surface-2')
                        }
                        onClick={() => pickMention(hit)}
                      >
                        {hit.label}
                      </button>
                    </li>
                  ))
                )}
              </ul>
            )}
            <textarea
              value={chat.draft}
              onChange={(e) => chat.setDraft(e.target.value)}
              onKeyDown={onComposerKey}
              placeholder={t('chat.composerPlaceholder')}
              rows={3}
              disabled={chat.streaming}
              className="w-full resize-none rounded-lg border border-chrome-border px-2 py-2 leading-snug outline-none focus:border-chrome-accent focus:ring-2 focus:ring-chrome-accent/30 disabled:opacity-60"
            />
            <div className="mt-2 flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <div className="relative" ref={menuRoot}>
                  <button
                    type="button"
                    className="rounded-md border border-chrome-border bg-chrome-surface px-2.5 py-1 text-[12px] hover:border-chrome-border-strong"
                    aria-expanded={menuOpen}
                    aria-haspopup="menu"
                    onClick={() => {
                      setMenuOpen((v) => !v)
                      if (!menuOpen) void refreshStatus().then(() => refreshModels())
                    }}
                  >
                    {modeLabel}
                    <Icon name="expand_more" size={14} className="ml-0.5 inline align-middle" />
                  </button>
                  {menuOpen && (
                    <div
                      role="menu"
                      className="absolute bottom-[calc(100%+6px)] left-0 z-20 flex w-60 flex-col gap-2 rounded-[10px] border border-chrome-border bg-chrome-surface p-2.5 shadow-card"
                    >
                      <label className="flex flex-col gap-1 text-[11px] text-chrome-muted">
                        {t('chat.modeLabel')}
                        <select
                          value={chat.mode}
                          onChange={(e) => chat.setMode(e.target.value === 'plan' ? 'plan' : 'agent')}
                          className="rounded-md border border-chrome-border bg-chrome-surface px-1.5 py-1 text-[12px] text-chrome-text"
                        >
                          <option value="agent">{t('chat.modeAgent')}</option>
                          <option value="plan">{t('chat.modePlan')}</option>
                        </select>
                      </label>
                      <label className="flex flex-col gap-1 text-[11px] text-chrome-muted">
                        {t('chat.cursorModel')}
                        <select
                          value={chat.status?.modelId ?? ''}
                          onChange={(e) => {
                            const id = e.target.value
                            const model = catalog.find((m) => m.id === id)
                            const def = model?.variants.find((v) => v.isDefault) ?? model?.variants[0]
                            void persistModel(id, def?.params ?? [])
                          }}
                          className="rounded-md border border-chrome-border bg-chrome-surface px-1.5 py-1 text-[12px] text-chrome-text"
                        >
                          {catalog.map((m) => (
                            <option key={m.id} value={m.id}>
                              {m.displayName}
                            </option>
                          ))}
                        </select>
                      </label>
                      {showVariantSelect && selectedModel && (
                        <label className="flex flex-col gap-1 text-[11px] text-chrome-muted">
                          {t('chat.cursorVariant')}
                          <select
                            value={activeVariantName}
                            onChange={(e) => {
                              const variant = selectedModel.variants.find((v) => v.displayName === e.target.value)
                              if (variant) void persistModel(chat.status?.modelId ?? selectedModel.id, variant.params)
                            }}
                            className="rounded-md border border-chrome-border bg-chrome-surface px-1.5 py-1 text-[12px] text-chrome-text"
                          >
                            {selectedModel.variants.map((v) => (
                              <option key={v.displayName} value={v.displayName}>
                                {v.displayName}
                              </option>
                            ))}
                          </select>
                        </label>
                      )}
                      {selectedModel?.parameters.map((p) =>
                        p.values.length > 0 ? (
                          <label key={p.id} className="flex flex-col gap-1 text-[11px] text-chrome-muted">
                            {isFastParam(p)
                              ? t('chat.fastLabel')
                              : isThinkingParam(p)
                                ? t('chat.cursorThinking')
                                : p.displayName}
                            <select
                              value={paramValue(currentParams, p.id, p.values[0]!.value)}
                              onChange={(e) => {
                                if (!chat.status) return
                                void persistModel(chat.status.modelId, upsertParam(currentParams, p.id, e.target.value))
                              }}
                              className="rounded-md border border-chrome-border bg-chrome-surface px-1.5 py-1 text-[12px] text-chrome-text"
                            >
                              {p.values.map((v) => (
                                <option key={v.value} value={v.value}>
                                  {v.displayName}
                                </option>
                              ))}
                            </select>
                          </label>
                        ) : null,
                      )}
                      {chat.usageLine && (
                        <p className="text-[11px] text-chrome-muted">{t('chat.contextUsed', { n: chat.usageLine })}</p>
                      )}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-chrome-border text-chrome-muted hover:border-chrome-accent hover:text-chrome-accent-600"
                  onClick={() => void attachFiles()}
                  title={t('chat.attachFiles')}
                  aria-label={t('chat.attachFiles')}
                >
                  <Icon name="attach_file" size={16} />
                </button>
              </div>
              {chat.streaming ? (
                <button type="button" className={primary} onClick={() => void cancel()}>
                  {t('chat.cancel')}
                </button>
              ) : (
                <button type="button" className={primary} onClick={() => void send()} disabled={!canSend}>
                  {t('chat.send')}
                </button>
              )}
            </div>
          </div>
          {chat.sessions.open.length > 0 && (
            <nav
              className="flex shrink-0 gap-0.5 overflow-x-auto border-t border-chrome-border bg-chrome-bg px-2 py-1"
              aria-label={t('chat.chatHistory')}
            >
              {chat.sessions.open.map((session) => (
                <div
                  key={session.id}
                  className={
                    'flex max-w-[140px] shrink-0 items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[11px] ' +
                    (session.id === chat.sessions.activeId
                      ? 'border-chrome-border bg-chrome-surface text-chrome-text'
                      : 'border-transparent text-chrome-muted hover:bg-chrome-surface-2')
                  }
                >
                  <button
                    type="button"
                    className="min-w-0 truncate"
                    title={sessionTitle(session.title)}
                    onClick={() => void switchSession(session.id)}
                  >
                    {sessionTitle(session.title)}
                  </button>
                  {chat.sessions.open.length > 1 && (
                    <button
                      type="button"
                      className="shrink-0 text-chrome-faint hover:text-chrome-text"
                      title={t('chat.closeTab')}
                      aria-label={t('chat.closeTab')}
                      onClick={() => void closeTab(session.id)}
                    >
                      <Icon name="close" size={12} />
                    </button>
                  )}
                </div>
              ))}
            </nav>
          )}
        </>
      )}
    </aside>
  )
}
