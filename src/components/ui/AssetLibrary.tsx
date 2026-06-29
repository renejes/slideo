import { useRef } from 'react'
import { usePresentationStore } from '@/store/presentation'
import { parseDataUri, mediaKind } from '@/lib/assets'
import { Icon } from './Icon'

// Wiederverwendbare Asset-Bibliothek (Bereich 2 der Workflow-Optimierung).
// Genutzt in den Einstellungen (verwalten) UND im AssetManagerModal (verwalten/pick).
// Mit `onPick` wird jede Kachel klickbar → fügt das Asset ein (pick-Modus).
export function AssetLibrary({ onPick }: { onPick?: (name: string) => void }) {
  const assets = usePresentationStore((s) => s.assets)
  const hasPresentation = usePresentationStore((s) => s.presentation !== null)
  const addAssetToLibrary = usePresentationStore((s) => s.addAssetToLibrary)
  const removeAsset = usePresentationStore((s) => s.removeAsset)
  const fileRef = useRef<HTMLInputElement>(null)
  const entries = Object.entries(assets)
  const picking = !!onPick

  // Batch-Import: Mehrfachauswahl, jede Datei → Data-URI → Library.
  function onImport(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? [])
    e.target.value = ''
    files.forEach((file) => {
      const reader = new FileReader()
      reader.onload = () => {
        if (typeof reader.result === 'string') addAssetToLibrary(reader.result)
      }
      reader.readAsDataURL(file)
    })
  }

  if (!hasPresentation) {
    return <p className="py-1 text-[12px] text-chrome-muted">Erst eine Präsentation öffnen/anlegen.</p>
  }

  return (
    <div className="flex min-h-0 flex-col gap-3">
      <div className="flex items-center justify-between gap-2">
        <p className="min-w-0 text-[12px] leading-snug text-chrome-muted">
          {picking ? (
            'Asset anklicken zum Einfügen — oder neue importieren (Mehrfachauswahl).'
          ) : (
            <>
              Bilder, Videos & Audio — auch von der KI per{' '}
              <code className="font-mono">list_assets</code> als{' '}
              <code className="font-mono">assets/&lt;name&gt;</code> nutzbar.
            </>
          )}
        </p>
        <input
          ref={fileRef}
          type="file"
          accept="image/*,video/*,audio/*"
          multiple
          onChange={onImport}
          className="hidden"
        />
        <button
          onClick={() => fileRef.current?.click()}
          className="flex shrink-0 items-center gap-1.5 rounded-lg bg-chrome-accent-600 px-3 py-1.5 text-[12px] font-medium text-white transition-colors hover:bg-[#2553c9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
        >
          <Icon name="upload" size={15} weight={400} />
          Importieren
        </button>
      </div>

      {entries.length === 0 ? (
        <p className="rounded-lg border border-dashed border-chrome-border py-8 text-center text-[12px] text-chrome-faint">
          Noch keine Assets — importiere welche (Mehrfachauswahl möglich).
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
          {entries.map(([name, dataUri]) => (
            <AssetTile
              key={name}
              name={name}
              dataUri={dataUri}
              onPick={onPick}
              onRemove={() => removeAsset(name)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

function AssetTile({
  name,
  dataUri,
  onPick,
  onRemove,
}: {
  name: string
  dataUri: string
  onPick?: (name: string) => void
  onRemove: () => void
}) {
  const kind = mediaKind(parseDataUri(dataUri).mime)

  const preview = (
    <div className="flex h-20 w-full items-center justify-center overflow-hidden rounded-md bg-chrome-surface-2">
      {kind === 'image' ? (
        <img src={dataUri} alt={name} className="h-full w-full object-cover" />
      ) : kind === 'video' ? (
        <video src={dataUri} muted className="h-full w-full object-cover" />
      ) : (
        <Icon
          name={kind === 'audio' ? 'music_note' : 'description'}
          size={24}
          weight={400}
          className="text-chrome-muted"
        />
      )}
    </div>
  )

  return (
    <div className="group relative flex flex-col rounded-lg border border-chrome-border p-1.5">
      {onPick ? (
        <button
          onClick={() => onPick(name)}
          title={`Einfügen: ${name}`}
          className="flex flex-col gap-1 rounded-md text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
        >
          {preview}
          <code className="truncate font-mono text-[11px] text-chrome-secondary">{name}</code>
        </button>
      ) : (
        <div className="flex flex-col gap-1">
          {preview}
          <code className="truncate font-mono text-[11px] text-chrome-secondary">{name}</code>
        </div>
      )}
      <button
        onClick={onRemove}
        title="Asset entfernen"
        aria-label="Asset entfernen"
        className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-md bg-white/85 text-chrome-faint opacity-0 shadow-sm transition-opacity hover:bg-chrome-danger/10 hover:text-chrome-danger focus-visible:opacity-100 group-hover:opacity-100"
      >
        <Icon name="delete" size={14} weight={400} />
      </button>
    </div>
  )
}
