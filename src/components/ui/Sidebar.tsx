import { useState } from 'react'
import { ZoneList } from './ZoneList'
import { Icon } from './Icon'
import { TokenEditor } from '@/components/tokens/TokenEditor'

type Tab = 'slides' | 'design'

// Linke Sidebar mit zwei Tabs (Unterstrich-Indikator, Penwright-Stil). Füllt ihre
// (von der EditorShell gesetzte) Spaltenbreite; `onCollapse` blendet sie ein.
export function Sidebar({ onCollapse }: { onCollapse?: () => void }) {
  const [tab, setTab] = useState<Tab>('slides')

  return (
    <aside className="flex h-full w-full flex-col border-r border-chrome-border bg-chrome-bg">
      <div className="flex h-9 shrink-0 items-stretch border-b border-chrome-border px-2">
        <TabButton active={tab === 'slides'} onClick={() => setTab('slides')}>
          Folien
        </TabButton>
        <TabButton active={tab === 'design'} onClick={() => setTab('design')}>
          Design
        </TabButton>
        {onCollapse && (
          <button
            onClick={onCollapse}
            title="Folienliste einklappen"
            aria-label="Folienliste einklappen"
            className="my-1.5 ml-auto flex w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            <Icon name="chevron_left" size={18} />
          </button>
        )}
      </div>
      <div className="min-h-0 flex-1">{tab === 'slides' ? <ZoneList /> : <TokenEditor />}</div>
    </aside>
  )
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={
        'relative px-3 text-[13px] font-medium transition-colors focus-visible:outline-none ' +
        (active ? 'text-chrome-text' : 'text-chrome-muted hover:text-chrome-secondary')
      }
    >
      {children}
      {active && (
        <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-chrome-accent-600" />
      )}
    </button>
  )
}
