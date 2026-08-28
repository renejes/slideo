import { describe, expect, it } from 'vitest'
import {
  buildChatAgentOptions,
  CHAT_DISALLOWED_TOOLS,
  CHAT_TOOLS,
  DEFAULT_CHAT_MODEL_ID,
  mergeMcpChildEnv,
  posixQuote,
  quoteStdioCommand,
} from './chatAgentOptions'
import { describeChatTool, mergeStreamText, shortToolName, upsertToolChip } from './chatStream'
import { formatTokenCount, normalizeChatModel } from './chatModels'
import {
  activateSession,
  addSession,
  closeOpenTab,
  emptyChatIndex,
  historyMetas,
  MAX_OPEN_CHAT_TABS,
  parseChatIndex,
  pinOpenTab,
  removeSession,
  titleFromUserText,
  touchSession,
} from './chatSessions'
import { occurrenceInPrefix } from './insertAnchor'

describe('buildChatAgentOptions', () => {
  const opts = buildChatAgentOptions({
    projectDir: '/tmp/slideo-chat-test',
    mcp: {
      command: '/tmp/slideo',
      args: ['mcp'],
      env: { HOME: '/Users/r' },
    },
    modelId: '',
  })

  it('setzt cwd, Default-Modell und stdio-MCP', () => {
    expect(opts.local.cwd).toBe('/tmp/slideo-chat-test')
    expect(opts.model.id).toBe(DEFAULT_CHAT_MODEL_ID)
    expect(opts.mcpServers.slideo.type).toBe('stdio')
    expect(opts.mcpServers.slideo.command).toBe('/tmp/slideo')
    expect(opts.mcpServers.slideo.args).toEqual(['mcp'])
    expect(opts.mcpServers.slideo.cwd).toBe('/tmp/slideo-chat-test')
  })

  it('erlaubt MCP-Lesen und verbietet Shell/Write', () => {
    expect(opts.tools).toContain('mcp')
    for (const name of CHAT_TOOLS) {
      expect(opts.tools).toContain(name)
    }
    const toolNames = opts.tools as readonly string[]
    for (const forbidden of ['shell', 'edit', 'write', 'task'] as const) {
      expect(toolNames).not.toContain(forbidden)
    }
    for (const name of CHAT_DISALLOWED_TOOLS) {
      expect(opts.disallowedTools).toContain(name)
    }
  })

  it('lädt keine user settingSources (kein zweites ~/.cursor/mcp.json)', () => {
    expect((opts as unknown as Record<string, unknown>).settingSources).toBeUndefined()
  })

  it('trimmt die Modell-ID und fällt auf den Default zurück', () => {
    const trimmed = buildChatAgentOptions({
      projectDir: '/tmp/p',
      mcp: { command: 'x', args: ['mcp'], env: {} },
      modelId: '  composer-2.5  ',
    })
    expect(trimmed.model.id).toBe('composer-2.5')
  })
})

describe('mergeStreamText', () => {
  it('akzeptiert Deltas und Snapshots', () => {
    expect(mergeStreamText('', 'H')).toBe('H')
    expect(mergeStreamText('H', 'i')).toBe('Hi')
    expect(mergeStreamText('Hi', 'Hi there')).toBe('Hi there')
    expect(mergeStreamText('Hi there', 'Hi')).toBe('Hi there')
    expect(mergeStreamText('bekom', 'fen?')).toBe('bekomfen?')
    expect(mergeStreamText('Hello', 'Hello')).toBe('Hello')
    expect(mergeStreamText('Ich les', 'lese')).toBe('Ich lese')
    expect(mergeStreamText('fü', 'füge')).toBe('füge')
  })
})

describe('tool chips', () => {
  it('kürzt MCP-Präfixe und liest CallMcpTool', () => {
    expect(shortToolName('slideo_get_zone')).toBe('get_zone')
    expect(
      describeChatTool({
        id: 'c1',
        name: 'CallMcpTool',
        args: {
          server: 'slideo',
          toolName: 'slideo_set_zone_markdown',
          arguments: { id: 'zone-1' },
        },
      }).name,
    ).toBe('set_zone_markdown')
    expect(
      describeChatTool({
        id: 'c1',
        name: 'CallMcpTool',
        args: {
          server: 'slideo',
          toolName: 'slideo_set_zone_markdown',
          arguments: { id: 'zone-1' },
        },
      }).detail,
    ).toBe('zone-1')
    const chips = upsertToolChip([], { id: 'c1', name: 'get_zone', status: 'running' })
    expect(upsertToolChip(chips, { id: 'c1', name: 'get_zone', status: 'completed' })[0].status).toBe(
      'completed',
    )
  })
})

describe('normalizeChatModel', () => {
  it('ergänzt Fast nur bei Composer', () => {
    const composer = normalizeChatModel({ id: 'composer-2.5', displayName: 'Composer 2.5' })
    expect(composer.parameters.some((p) => p.id === 'fast')).toBe(true)
    const gpt = normalizeChatModel({ id: 'gpt-5.4', displayName: 'GPT' })
    expect(gpt.parameters.some((p) => p.id === 'fast')).toBe(false)
    const already = normalizeChatModel({
      id: 'composer-2.5',
      parameters: [{ id: 'fast', displayName: 'Fast', values: [{ value: 'true', displayName: 'Fast' }] }],
    })
    expect(already.parameters.filter((p) => p.id === 'fast')).toHaveLength(1)
    expect(formatTokenCount(12400)).toBe('12.4k')
    expect(formatTokenCount(0)).toBe('')
  })
})

describe('stdio quoting + env', () => {
  it('quotet Pfade mit Leerzeichen für bash -c', () => {
    expect(posixQuote('/Library/Application Support/x')).toBe("'/Library/Application Support/x'")
    const wrapped = quoteStdioCommand('/Library/Application Support/Slideo/slideo', ['mcp'])
    expect(wrapped.command).toBe('/bin/bash')
    expect(wrapped.args[0]).toBe('-c')
    expect(wrapped.args[1]).toContain('Application Support')
    expect(quoteStdioCommand('/usr/bin/slideo', ['mcp'])).toEqual({
      command: '/usr/bin/slideo',
      args: ['mcp'],
    })
  })

  it('erhält HOME/PATH und streicht ELECTRON_RUN_AS_NODE', () => {
    const childEnv = mergeMcpChildEnv(
      { HOME: '/Users/r', PATH: '/bin', ELECTRON_RUN_AS_NODE: '1', EMPTY: undefined },
      { EXTRA: '1' },
    )
    expect(childEnv.HOME).toBe('/Users/r')
    expect(childEnv.EXTRA).toBe('1')
    expect(childEnv.ELECTRON_RUN_AS_NODE).toBeUndefined()
  })
})

describe('chat sessions', () => {
  it('aktiviert, pinnt, schließt und löscht', () => {
    expect(titleFromUserText('  Cover   dunkler  ', 'New chat')).toBe('Cover dunkler')
    expect(titleFromUserText('x'.repeat(50), 'New chat').endsWith('…')).toBe(true)
    expect(titleFromUserText('   ', 'New chat')).toBe('New chat')

    let index = addSession(emptyChatIndex(), { id: 'a', title: 'A', createdAt: 1, updatedAt: 1 })
    index = addSession(index, { id: 'b', title: 'B', createdAt: 2, updatedAt: 2 })
    expect(index.activeId).toBe('b')
    expect(index.openIds).toEqual(['b', 'a'])

    index = activateSession(index, 'a')
    expect(index.activeId).toBe('a')
    expect(index.openIds[0]).toBe('a')

    index = touchSession(index, 'a', { title: 'Cover', updatedAt: 9 })
    expect(index.chats.find((c) => c.id === 'a')?.title).toBe('Cover')
    expect(historyMetas(index)[0].id).toBe('a')

    index = closeOpenTab(index, 'a')
    expect(index.activeId).toBe('b')
    expect(index.openIds).not.toContain('a')

    const many = Array.from({ length: MAX_OPEN_CHAT_TABS + 3 }, (_, i) => ({
      id: `c${i}`,
      title: `C${i}`,
      createdAt: i,
      updatedAt: i,
    }))
    let capped = emptyChatIndex()
    for (const s of many) capped = addSession(capped, s)
    expect(capped.openIds).toHaveLength(MAX_OPEN_CHAT_TABS)
    expect(capped.openIds[0]).toBe(many[many.length - 1].id)

    const parsed = parseChatIndex({
      activeId: 'missing',
      openIds: ['b', 'nope'],
      chats: [{ id: 'b', title: 'B', createdAt: 1, updatedAt: 1 }],
    })
    expect(parsed?.activeId).toBe('b')
    expect(parsed?.openIds).toEqual(['b'])

    index = removeSession(
      addSession(emptyChatIndex(), { id: 'z', title: '', createdAt: 0, updatedAt: 0 }),
      'z',
    )
    expect(index.activeId).toBe(null)
    expect(index.chats).toHaveLength(0)
    expect(pinOpenTab(emptyChatIndex(), 'ghost').openIds).toEqual([])
  })
})

describe('occurrenceInPrefix', () => {
  it('zählt die aktuelle Markierung 1-basiert', () => {
    expect(occurrenceInPrefix('', 'hello')).toBe(1)
    expect(occurrenceInPrefix('hello … ', 'hello')).toBe(2)
    expect(occurrenceInPrefix('', '')).toBe(1)
  })
})
