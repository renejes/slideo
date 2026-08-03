// English catalogue — Asset manager, crop, component palette, history and design modals.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/media').media

export const media: Record<Keys, string> = {
  // --- Media library ----------------------------------------------------------
  'media.assets.pickTitle': 'Insert media',
  'media.assets.manageTitle': 'Media library',

  // --- Image crop -------------------------------------------------------------
  'media.crop.title': 'Crop image',
  'media.crop.hint': 'Drag the frame, then “Crop”',
  'media.crop.apply': 'Crop',
  'media.crop.errNoSize': 'Cannot crop — the image size is unknown.',
  'media.crop.errNoCanvas': 'Cannot crop — no canvas context available.',
  'media.crop.errFailed': 'Crop failed — the image source could not be read.',
  'media.crop.errLoad': 'The image could not be loaded.',

  // --- Component palette ------------------------------------------------------
  'media.palette.title': 'Insert component',
  'media.palette.markdownNotice':
    'The active slide contains Markdown — the component is added as a new HTML slide.',
  'media.palette.insert': 'Insert',
  'media.palette.unavailable': 'The component palette is only available in the desktop app.',
  'media.palette.unavailableHint':
    'The component generator runs in the Rust backend (npm run tauri:dev).',
  'media.palette.preview': 'Preview',
  'media.palette.previewFrame': 'Component preview',
  'media.palette.defaults': 'This component is inserted with its default values.',
  'media.palette.itemFieldAria': '{label} (row {row})',
  'media.palette.removeRow': 'Remove row',
  'media.palette.removeRowAria': 'Remove row {row}',
  'media.palette.noItems': 'No entries — sample data will be used.',
  'media.palette.dataIdPlaceholder': 'optional — for auto-animate (transition “auto”)',
  'media.palette.dataIdAria': 'data-id for auto-animate (optional)',
  'media.palette.dataIdTitle':
    'Allowed: letters, digits, - _ : (max. 64). Other characters are stripped.',
  'media.palette.placementLabel': 'Insert',
  'media.palette.placeReplace': 'Into “{label}”',
  'media.palette.placeAppend': 'Append to “{label}”',
  'media.palette.placeNewAfter': 'As a new slide after “{label}”',
  'media.palette.placeNew': 'As a new slide',
  'media.palette.inserted': 'Component inserted.',
  'media.palette.insertFailed': 'Could not insert: {error}',

  // --- Version history --------------------------------------------------------
  'media.history.title': 'Version history',
  'media.history.unavailable': 'Version history is only available in the desktop app.',
  'media.history.needsSave':
    'Save the presentation first (Cmd/Ctrl+S) — from then on a snapshot is taken every time you save.',
  'media.history.labelAria': 'Label for this snapshot (optional)',
  'media.history.labelPlaceholder': 'Label (optional), e.g. “Before the rewrite”',
  'media.history.create': 'Snapshot',
  'media.history.empty': 'No snapshots yet. One is taken automatically when you save.',
  'media.history.auto': 'Auto',
  'media.history.manual': 'Manual',
  'media.history.restore': 'Restore',
  'media.history.restoreTitle': 'Restore this version',
  'media.history.deleteSnapshot': 'Delete snapshot',
  'media.history.footnote':
    'Snapshots are kept locally (max. 50 per presentation); saving takes one automatically whenever something changed.',
  'media.history.confirmRestore':
    'Restore the snapshot from {time}? It replaces the current state (undo with Cmd/Ctrl+Z; save afterwards to keep it).',
  'media.history.confirmDelete': 'Delete this snapshot for good? This cannot be undone.',

  // --- Design overlay ---------------------------------------------------------
  'media.design.title': 'Design',
}
