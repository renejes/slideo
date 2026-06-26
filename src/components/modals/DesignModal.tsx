import { Modal } from '@/components/ui/Modal'
import { useUiStore } from '@/store/ui'
import { TokenEditor } from '@/components/tokens/TokenEditor'

// Design-Overlay (Editor-Cleanup): der frühere „Design"-Tab der linken Sidebar lebt
// jetzt als deck-weites Modal (geöffnet über den Topbar-„Design"-Button). Reicht den
// unveränderten TokenEditor (Theme/Tokens/Schriften/Logo/Übergänge) durch — bei sehr
// vielen Tokens scrollt der gedeckelte Container.
export function DesignModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  return (
    <Modal title="Design" onClose={closeModal} width="w-[32rem]">
      {/* Horizontales Modal-Polster zurücknehmen → die Brand-Kit-Abschnitte (mit eigenen
          1px-Trennlinien) spannen die volle Panel-Breite; vertikales py-4 bleibt als Luft. */}
      <div className="-mx-5 max-h-[72vh] overflow-y-auto">
        <TokenEditor />
      </div>
    </Modal>
  )
}
