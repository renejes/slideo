import { useMemo, useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'

// Deck-weites Suchen & Ersetzen (Spec §19.9). Wirkt auf den Markdown- bzw.
// HTML-Inhalt aller Zonen (groß-/kleinschreibungsgenau, wie MCP replace_in_zone).
export function FindReplaceModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const presentation = usePresentationStore((s) => s.presentation)
  const replaceAllInDeck = usePresentationStore((s) => s.replaceAllInDeck)
  const [search, setSearch] = useState('')
  const [replace, setReplace] = useState('')

  const count = useMemo(() => {
    if (!search || !presentation) return 0
    return presentation.zones.reduce((acc, z) => {
      const text = z.content_type === 'html' ? (z.html ?? '') : z.markdown
      return acc + (text.split(search).length - 1)
    }, 0)
  }, [search, presentation])

  function doReplace() {
    if (!search) return
    const n = replaceAllInDeck(search, replace)
    notify(n > 0 ? `${n} Vorkommen ersetzt.` : 'Keine Treffer.', n > 0 ? 'success' : 'info')
    if (n > 0) closeModal()
  }

  const inputCls =
    'rounded-lg border border-chrome-border bg-white px-3 py-2 text-[14px] text-chrome-text focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30'

  return (
    <Modal
      title="Suchen & Ersetzen"
      onClose={closeModal}
      footer={
        <>
          <button className={modalGhostBtn} onClick={closeModal}>
            Abbrechen
          </button>
          <button className={modalPrimaryBtn} onClick={doReplace} disabled={!search || count === 0}>
            <Icon name="find_replace" size={18} />
            Alle ersetzen
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-chrome-secondary">Suchen nach</span>
          <input
            autoFocus
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doReplace()}
            className={inputCls}
          />
        </label>
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-chrome-secondary">Ersetzen durch</span>
          <input
            value={replace}
            onChange={(e) => setReplace(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && doReplace()}
            className={inputCls}
          />
        </label>
        <span className="text-[12px] text-chrome-muted">
          {search ? `${count} ${count === 1 ? 'Treffer' : 'Treffer'} im gesamten Deck` : 'Suchbegriff eingeben …'}
        </span>
      </div>
    </Modal>
  )
}
