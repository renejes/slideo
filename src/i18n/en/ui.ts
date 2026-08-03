// English catalogue — src/components/ui/* + CloseGuard + ErrorBoundary.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/ui').ui

export const ui: Record<Keys, string> = {
  'ui.unsavedChanges': 'Unsaved changes',

  // --- Topbar ---------------------------------------------------------------
  'ui.topbar.titleHint': 'Presentation title — click to rename',
  'ui.topbar.titleAria': 'Presentation title',
  'ui.topbar.new': 'New',
  'ui.topbar.open': 'Open',
  'ui.topbar.saveHint': 'Save: {path}\nWith Shift/Alt: Save as … (Cmd/Ctrl+Shift+S)',
  'ui.topbar.saveAsHint': 'Save as …',
  'ui.topbar.export': 'Export',
  'ui.topbar.exportHint':
    'Export — HTML, PDF or PowerPoint (each with a note on what it loses)',
  'ui.topbar.design': 'Design',
  'ui.topbar.designHint': 'Design — theme, colors, fonts, logo & slide transitions',
  'ui.topbar.media': 'Media',
  'ui.topbar.mediaHint': 'Media library — import and manage images, video & audio',
  'ui.topbar.find': 'Find & Replace',
  'ui.topbar.findHint': 'Find & Replace (Cmd/Ctrl+F)',
  'ui.topbar.history': 'Version history',
  'ui.topbar.historyHint': 'Version history — restore a local snapshot',
  'ui.topbar.help': 'Help',
  'ui.topbar.helpHint': 'Help — how Slideo works with your AI agent',
  'ui.topbar.settings': 'Settings',
  'ui.topbar.present': 'Present',

  // --- MCP target cards -----------------------------------------------------
  'ui.mcp.hint.desktop': 'claude_desktop_config.json',
  'ui.mcp.hint.meta': 'localhost:3663 · aggregator proxy',
  'ui.mcp.hint.claude': '~/.claude.json · user scope',
  'ui.mcp.avail.desktop.yes': 'Installed',
  'ui.mcp.avail.desktop.no': 'Not installed',
  'ui.mcp.avail.meta.yes': 'Running',
  'ui.mcp.avail.meta.no': 'Not reachable',
  'ui.mcp.avail.claude.yes': 'Detected',
  'ui.mcp.avail.claude.no': 'Not detected',
  'ui.mcp.active': 'Active',
  'ui.mcp.switching': 'Switching…',

  // --- Connection chip (AI channel) ----------------------------------------
  'ui.chip.agoSec': '{n} s ago',
  'ui.chip.agoMin': '{n} min ago',
  'ui.chip.agoHour': '{n} h ago',
  'ui.chip.disconnected': 'AI not connected',
  'ui.chip.connected': 'AI connected',
  'ui.chip.idle': 'AI {ago}',
  'ui.chip.titleNever':
    'No AI tool has reached Slideo since it started.\n' +
    'Careful: your MCP client lists the tools as available even when Slideo is not running — ' +
    'only the first real call reveals it.\nClick to set it up.',
  'ui.chip.titleLast': 'Last call: {tool} ({ago})',
  'ui.chip.titleVersion': 'Connector version {version}',

  // --- Onboarding nudge -----------------------------------------------------
  'ui.nudge.headline': 'Your AI agent builds your slides.',
  'ui.nudge.body':
    'Open your MCP client (e.g. Claude Desktop, Codex CLI) and describe your topic — or grab a ready-made prompt.',
  'ui.nudge.copy': 'Copy prompt',
  'ui.nudge.copied': 'Prompt copied — paste it into your AI agent.',
  'ui.nudge.copyFailed': 'Copying failed.',
  'ui.nudge.how': 'How does this work?',
  'ui.nudge.dismiss': 'Hide this note',

  // --- Media library --------------------------------------------------------
  'ui.assets.noPresentation': 'Open or create a presentation first.',
  'ui.assets.pickHint': 'Click a file to insert it — or import new ones (multi-select).',
  'ui.assets.libraryHint': 'Images, video & audio — the AI can use them via {0} as {1}.',
  'ui.assets.import': 'Import',
  'ui.assets.empty': 'No media yet — import some (multi-select works).',
  'ui.assets.insert': 'Insert: {name}',
  'ui.assets.remove': 'Remove file',
  'ui.assets.removeConfirm': 'Remove "{name}"? (Undo with Cmd/Ctrl+Z)',
  'ui.assets.removeUsed.one':
    '"{name}" is used in {count} place in this presentation.\n\nRemove it anyway? (Undo with Cmd/Ctrl+Z)',
  'ui.assets.removeUsed.other':
    '"{name}" is used in {count} places in this presentation.\n\nRemove it anyway? (Undo with Cmd/Ctrl+Z)',

  // --- License bar ----------------------------------------------------------
  'ui.license.state.revoked': 'License revoked — Slideo is read-only.',
  'ui.license.state.expired': 'License expired — Slideo is read-only.',
  'ui.license.state.upgrade_required':
    'Your license covers an older version of Slideo — an upgrade is required (read-only).',
  'ui.license.state.trial_expired':
    'Trial over — Slideo is read-only (opening & exporting still work).',
  'ui.license.trialDays.one': 'Trial: {count} day left.',
  'ui.license.trialDays.other': 'Trial: {count} days left.',
  'ui.license.buy': 'Buy Slideo',
  'ui.license.activate': 'Activate license',
  'ui.license.buyFailed': 'Could not open the purchase page: {error}',
  'ui.license.buyFailedUnconfigured':
    'Could not open the purchase page (licensing is not configured yet): {error}',

  // --- Editor shell (columns) ----------------------------------------------
  'ui.shell.editor': 'Editor',
  'ui.shell.preview': 'Preview',
  'ui.shell.collapse': 'Collapse {name}',
  'ui.shell.expand': 'Show {name}',
  'ui.shell.resizePreview': 'Resize preview',

  // --- Close guard ----------------------------------------------------------
  'ui.closeGuard.body':
    'This presentation has unsaved changes. Do you want to save them before closing?',
  'ui.closeGuard.discard': 'Don’t save',

  // --- Error boundary -------------------------------------------------------
  'ui.error.title': 'This view could not be displayed',
  'ui.error.body':
    'Your presentation is not lost — it is still on disk. The most likely cause is a damaged or hand-edited {0} file.',
  'ui.error.reload': 'Reload the app',
}
