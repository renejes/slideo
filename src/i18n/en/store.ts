// English catalogue — src/store/* + App.tsx — vor allem die 59 notify()-Meldungen.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/store').store

export const store: Record<Keys, string> = {
  // ── License gate ────────────────────────────────────────────────────────────
  'store.readOnly.edit':
    'Your trial has ended — Slideo is read-only. Activate a license to keep editing.',
  'store.readOnly.new':
    'Your trial has ended — activate a license to create new presentations.',
  'store.readOnly.restore': 'Your trial has ended — restoring is read-only.',

  // ── Content defaults ────────────────────────────────────────────────────────
  // Written once, at creation time, into the `.slideo` file — see the German
  // catalogue for why `Slide N` and `(Kopie)` are deliberately not here.
  'store.newDeck.untitled': 'Untitled',
  'store.newDeck.firstSlide': '# {title}\n\nYour first slide. Take it from here.',
  'store.htmlStarter.title': 'Interactive slide',
  'store.htmlStarter.body': 'Any HTML, CSS &amp; JavaScript you like.',

  // ── Open / save ─────────────────────────────────────────────────────────────
  'store.open.newerVersion':
    'This file comes from a newer version of Slideo — it opens as well as it can, but anything unfamiliar may be missing.',
  'store.open.ok': 'Presentation opened.',
  'store.open.failed': 'Could not open: {error}',
  'store.save.ok': 'Saved.',
  'store.save.failed': 'Could not save: {error}',

  // ── Export ──────────────────────────────────────────────────────────────────
  'store.export.htmlOk': 'Exported as HTML — plays in any browser.',
  'store.export.failed': 'Export failed: {error}',
  'store.export.pdfOpened':
    'Opened in your browser — choose “Print → Save as PDF” there (Cmd/Ctrl+P).',
  'store.export.pdfDialog': 'Print dialog opened — choose “Save as PDF”.',
  'store.export.pdfFailed': 'PDF export failed: {error}',
  'store.export.pptxOk': 'Exported as PowerPoint (.pptx).',
  'store.export.pptxDownloaded': 'PPTX downloaded.',
  'store.export.pptxFailed': 'PPTX export failed: {error}',

  // ── Media / brand ───────────────────────────────────────────────────────────
  'store.font.added': 'Font “{family}” added — pick it in the font selector.',
  'store.logo.set': 'Logo set — it now appears on every slide.',
  'store.media.needsHtmlSlide':
    'Video/audio saved — embed it on an HTML slide (the “HTML” toggle).',
  'store.media.imageInserted': 'Image inserted.',
  'store.media.inserted': 'Media inserted.',

  // ── Themes ──────────────────────────────────────────────────────────────────
  'store.preset.notFound': 'Theme “{name}” not found.',
  'store.preset.applied': 'Theme “{name}” applied.',

  // ── Version history ─────────────────────────────────────────────────────────
  'store.history.desktopOnly': 'Version history is only available in the desktop app.',
  'store.history.saveFirst': 'Save the presentation first (Cmd/Ctrl+S).',
  'store.history.created': 'Snapshot created.',
  'store.history.unchanged': 'Nothing has changed since the last snapshot.',
  'store.history.createFailed': 'Snapshot failed: {error}',
  'store.history.restored': 'Snapshot restored — save to keep it (Cmd/Ctrl+S).',
  'store.restore.failed': 'Restore failed: {error}',

  // ── MCP ─────────────────────────────────────────────────────────────────────
  'store.mcp.opened': 'Presentation opened by the AI.',
  'store.mcp.created': 'New presentation created by the AI.',

  // ── Crash recovery ──────────────────────────────────────────────────────────
  'store.recovery.restored': 'Work recovered — save to keep it (Cmd/Ctrl+S).',
  'store.recovery.restoredUnsaved':
    'Work recovered — not saved anywhere yet, please save it (Cmd/Ctrl+S).',

  // ── App.tsx ─────────────────────────────────────────────────────────────────
  'app.errorBoundary.presentation': 'Presentation mode could not be started',
  'app.recovery.title': 'Unsaved work found',
  'app.recovery.body':
    'The last session did not close properly.\n\n“{title}” · {slides} · last changed {when}\nFile: {file}\n\nRestore this state?',
  'app.recovery.unknownTime': 'unknown',
  'app.recovery.neverSaved': 'never saved',
  'app.empty.title': 'Welcome to Slideo',
  'app.empty.intro': 'Create a new presentation, or open an existing {0} file.',
  'app.empty.agent': 'an AI agent',
  'app.empty.ai':
    'The slides are built by {0} over MCP (Claude Desktop, Codex CLI and others) — you refine them here.',
  'app.empty.how': 'How does it work?',
  'app.empty.new': 'New presentation',
  'app.empty.open': 'Open',
  'app.empty.recent': 'Recently opened',
}
