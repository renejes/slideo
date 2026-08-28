// English catalogue — shared building blocks (button labels, status lines).
// A string that appears verbatim in more than one place belongs here, otherwise
// the translations drift apart.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/common').common

export const common: Record<Keys, string> = {
  'common.cancel': 'Cancel',
  'common.close': 'Close',
  'common.save': 'Save',
  'common.delete': 'Delete',
  'common.duplicate': 'Duplicate',
  'common.reset': 'Reset',
  'common.retry': 'Try again',
  'common.loading': 'Loading …',
  'common.desktopOnly': 'Desktop app only',
  'common.desktopOnlyHint': 'Only available in the desktop app (npm run tauri:dev)',
  'common.slideCount.one': '{count} slide',
  'common.slideCount.other': '{count} slides',

  // Error codes from the Rust backend (`src-tauri/src/errcode.rs`).
  // `{detail}` carries the untranslated extra (HTTP status, path, foreign error).
  'error.license.noConfigDir': 'No config directory found',
  'error.license.noParentDir': 'No parent folder',
  'error.license.networkActivate': 'Network error during activation: {detail}',
  'error.license.networkValidate': 'Network error during validation: {detail}',
  'error.license.networkDeactivate': 'Network error: {detail}',
  'error.license.deviceLimit':
    'Device limit reached. Release another device and try again.',
  'error.license.notFoundCheckKey': 'License key not found. Please check the key.',
  'error.license.notFound': 'License key not found.',
  'error.license.activateRejected': 'Activation rejected (HTTP {detail}).',
  'error.license.badResponse': 'Invalid response: {detail}',
  'error.license.activationIdMissing': 'Activation ID missing from the response',
  'error.license.validateFailed': 'Validation failed (HTTP {detail}).',
  'error.license.deactivateFailed': 'Deactivation failed (HTTP {detail}).',
  'error.license.notConfigured': 'Licensing is not configured yet.',
  'error.license.keyEmpty': 'Please enter a license key.',
  'error.license.notGranted': 'License not valid (status: {detail}).',
  'error.license.wrongVersion':
    'This key belongs to a different version of Slideo. Please buy the upgrade for this version.',
  'error.license.checkoutNotConfigured': 'The purchase link is not configured yet.',
  'error.mcp.metaSendFailed': 'Sending failed: {detail}',
  'error.mcp.metaReadFailed': 'Reading failed: {detail}',
  'error.mcp.metaBadResponse': 'Invalid HTTP response from Meta-MCP',
  'error.mcp.metaRegisterHttp': 'Meta-MCP /register replied with HTTP {detail}.',
  'error.mcp.noConfigDir': 'No config directory found.',
  'error.mcp.claudeDesktopMissing': 'Claude Desktop is not installed.',
  'error.mcp.noHomeDir': 'No home directory found.',
  'error.mcp.selfPathUnknown': 'Could not determine own executable path: {detail}',
  'error.present.noWindow': 'No slide window open',
  'error.present.noMonitor': 'No monitor found for the slide window',
  'error.cmd.openFailed': 'Could not open: {detail}',
  'error.chat.noConfigDir': 'No config directory found.',
  'error.chat.nodeMissing':
    'Node.js was not found. In-app chat needs Node ≥ 22 (on the PATH of tauri:dev).',
  'error.chat.hostMissing':
    'Chat host missing. Run “npm run agent:build” once and restart the app.',
  'error.chat.spawnFailed': 'Could not start the chat host: {detail}',
  'error.chat.rpc': 'Chat host is not responding.',
  'error.chat.rpcTimeout': 'Chat host timed out.',
}
