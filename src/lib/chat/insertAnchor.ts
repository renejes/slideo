import { useChatStore } from '@/store/chat'
import { useLayoutStore } from '@/store/layout'
import type { ChatAnchor } from './chatTypes'

/** 1-basierter Index dieser Nadel im Prefix (wie Penwright). */
export function occurrenceInPrefix(prefix: string, needle: string): number {
  if (!needle) return 1
  let count = 0
  let idx = prefix.indexOf(needle)
  while (idx !== -1) {
    count += 1
    idx = prefix.indexOf(needle, idx + 1)
  }
  return count + 1
}

/** Markierten Text als Composer-Chip ablegen und den Chat öffnen. */
export function insertSelectionIntoChat(input: {
  file: string
  selectionText: string
  prefix: string
  nodeType: string
}): ChatAnchor | null {
  const selectionText = input.selectionText.trim()
  if (!selectionText) return null
  const anchorText = selectionText.length > 200 ? selectionText.slice(0, 200) : selectionText
  const anchor: ChatAnchor = {
    file: input.file,
    selectionText,
    anchorText,
    occurrence: occurrenceInPrefix(input.prefix, anchorText),
    nodeType: input.nodeType,
  }
  useChatStore.getState().addAnchor(anchor)
  useLayoutStore.getState().openChat()
  return anchor
}
