import { useEffect, useState } from 'react'
import { Modal, modalGhostBtn, modalPrimaryBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { usePresentationStore } from '@/store/presentation'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import { isTauri, pickSavePath } from '@/lib/tauri'
import { confirmDialog, getDesktopDir, joinPath, pickDirectory } from '@/lib/dialog'
import { TEMPLATES, findTemplate } from '@/lib/templates'
import { t } from '@/i18n'
import { T } from '@/i18n/T'

function safeFileName(name: string): string {
  const cleaned = name
    .trim()
    .replace(/[^\w\d\-. äöüÄÖÜß]+/g, '')
    .replace(/\s+/g, '-')
    .toLowerCase()
  return cleaned || 'praesentation'
}

// Modal: fragt Projektname + Speicherort ab und legt die Präsentation an
// (in Tauri direkt als .slideo an den gewählten Ort gespeichert).
export function NewPresentationModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const newPresentation = usePresentationStore((s) => s.newPresentation)
  const savePresentation = usePresentationStore((s) => s.savePresentation)
  const isDirty = usePresentationStore((s) => s.isDirty)
  const hasPresentation = usePresentationStore((s) => s.presentation !== null)
  const defaultProjectDir = useSettingsStore((s) => s.defaultProjectDir)
  const setDefaultProjectDir = useSettingsStore((s) => s.setDefaultProjectDir)

  const tauri = isTauri()
  const [name, setName] = useState(t('modal.new.defaultName'))
  const [templateId, setTemplateId] = useState('blank')
  const [location, setLocation] = useState<string | null>(defaultProjectDir)
  const [busy, setBusy] = useState(false)

  // Voreinstellung des Speicherorts: zuletzt genutzt, sonst Desktop.
  useEffect(() => {
    if (location || !tauri) return
    void getDesktopDir().then((dir) => dir && setLocation(dir))
  }, [location, tauri])

  async function chooseLocation() {
    const dir = await pickDirectory(location)
    if (dir) {
      setLocation(dir)
      setDefaultProjectDir(dir)
    }
  }

  async function create() {
    if (busy) return
    setBusy(true)
    try {
      if (hasPresentation && isDirty) {
        const ok = await confirmDialog(t('modal.new.unsavedConfirm'))
        if (!ok) return // Modal bleibt offen
      }

      // Ziel ZUERST bestimmen (Befund B1): früher baute das Modal den Pfad selbst
      // (`joinPath(ordner, safeFileName(name) + '.slideo')`) und rief savePresentation
      // direkt — ohne Existenzprüfung. Der Writer renamed unbedingt drüber, und weil
      // das Namensfeld mit „Meine Präsentation" vorbelegt ist, war die Kollision
      // deterministisch: zweimal „Neu" bestätigen = erstes Deck weg, mit grünem
      // „Gespeichert."-Toast. Der native Speichern-Dialog übernimmt jetzt sowohl die
      // Überschreib-Rückfrage als auch die korrekte Behandlung von Umlauten im
      // Dateinamen (nebenbei Befund L12: „Jahresrückblick" wurde zu „jahresr-ckblick").
      let path: string | null = null
      if (tauri) {
        const suggestion = location
          ? await joinPath(location, `${safeFileName(name)}.slideo`)
          : `${safeFileName(name)}.slideo`
        path = await pickSavePath(suggestion)
        if (!path) return // Dialog abgebrochen → Modal bleibt offen, nichts passiert
      }

      // Erst wenn das Ziel feststeht, den Store anfassen — und den Rückgabewert prüfen
      // (Befund H14: im read-only-Zustand lehnte newPresentation ab, create() lief
      // trotzdem weiter und speicherte das ALTE Deck unter dem neuen Namen).
      if (!newPresentation(name || t('modal.new.untitled'), findTemplate(templateId))) return

      if (path) {
        const dir = path.replace(/[/\\][^/\\]*$/, '')
        if (dir) setDefaultProjectDir(dir)
        await savePresentation(path)
      }
    } finally {
      setBusy(false)
    }
    closeModal()
  }

  return (
    <Modal
      title={t('modal.new.title')}
      onClose={closeModal}
      footer={
        <>
          <button className={modalGhostBtn} onClick={closeModal}>
            {t('common.cancel')}
          </button>
          <button className={modalPrimaryBtn} onClick={create} disabled={busy}>
            <Icon name="add" size={18} />
            {t('modal.new.create')}
          </button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-chrome-secondary">
            {t('modal.new.projectName')}
          </span>
          <input
            autoFocus
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void create()}
            className="rounded-lg border border-chrome-border bg-white px-3 py-2 text-[14px] text-chrome-text focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-chrome-secondary">
            {t('modal.new.template')}
          </span>
          <div className="grid grid-cols-2 gap-1.5">
            {/* `tpl` statt `t` — der Kurzname würde sonst die i18n-`t()` verdecken. */}
            {TEMPLATES.map((tpl) => (
              <button
                key={tpl.id}
                onClick={() => setTemplateId(tpl.id)}
                title={tpl.description}
                className={
                  'flex flex-col items-start gap-0.5 rounded-lg border px-2.5 py-2 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
                  (templateId === tpl.id
                    ? 'border-chrome-accent bg-chrome-accent-soft'
                    : 'border-chrome-border hover:border-chrome-border-strong')
                }
              >
                <span className="text-[13px] font-medium text-chrome-text">{tpl.label}</span>
                <span className="text-[11px] leading-snug text-chrome-muted">
                  {tpl.description}
                </span>
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-col gap-1.5">
          <span className="text-[12px] font-medium text-chrome-secondary">
            {t('modal.new.location')}
          </span>
          {tauri ? (
            <div className="flex items-center gap-2">
              <div className="flex min-w-0 flex-1 items-center gap-2 rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2">
                <Icon name="folder" size={17} weight={400} className="text-chrome-muted" />
                <span
                  className="truncate text-[13px] text-chrome-text"
                  dir="rtl"
                  title={location ?? ''}
                >
                  {location || t('modal.new.locationFallback')}
                </span>
              </div>
              <button className={modalGhostBtn} onClick={chooseLocation}>
                {t('modal.new.choose')}
              </button>
            </div>
          ) : (
            <p className="rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2 text-[12px] text-chrome-muted">
              {t('modal.new.locationBrowserHint')}
            </p>
          )}
          {tauri && (
            <span className="text-[11px] text-chrome-muted">
              <T
                k="modal.new.createHint"
                slots={[
                  <code className="font-mono">{safeFileName(name)}.slideo</code>,
                ]}
              />
            </span>
          )}
        </div>
      </div>
    </Modal>
  )
}
