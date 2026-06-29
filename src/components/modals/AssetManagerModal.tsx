import { Modal, modalGhostBtn } from '@/components/ui/Modal'
import { useUiStore } from '@/store/ui'
import { usePresentationStore } from '@/store/presentation'
import { AssetLibrary } from '@/components/ui/AssetLibrary'

// Asset-Verwaltung (Bereich 2). Zwei Modi (aus dem ui-Store):
//  - „manage": über den Topbar-Button — alle Medien importieren/verwalten/löschen.
//  - „pick": aus dem Zonen-Medien-Button — Auswahl fügt ins Ziel ein und schließt.
export function AssetManagerModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const mode = useUiStore((s) => s.assetMode)
  const pickZoneId = useUiStore((s) => s.assetPickZoneId)
  const insertAssetIntoZone = usePresentationStore((s) => s.insertAssetIntoZone)

  const picking = mode === 'pick'

  function handlePick(name: string) {
    if (pickZoneId) insertAssetIntoZone(pickZoneId, name)
    closeModal()
  }

  return (
    <Modal
      title={picking ? 'Medium einfügen' : 'Asset-Verwaltung'}
      onClose={closeModal}
      width="w-[38rem]"
      footer={
        <button className={modalGhostBtn} onClick={closeModal}>
          {picking ? 'Abbrechen' : 'Schließen'}
        </button>
      }
    >
      <AssetLibrary onPick={picking ? handlePick : undefined} />
    </Modal>
  )
}
