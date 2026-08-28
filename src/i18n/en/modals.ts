// English catalogue — src/components/modals/*.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/modals').modals

export const modals: Record<Keys, string> = {
  // ── Shared across at least two modals ────────────────────────────────────
  'modal.gotIt': 'Got it',
  'modal.desktopOnly': 'Only available in the desktop app.',
  'modal.copyFailed': 'Could not copy.',
  'modal.mcpStatusLoading': 'Loading status…',

  // ── SettingsModal ────────────────────────────────────────────────────────
  'modal.settings.title': 'Settings',
  'modal.settings.general': 'General',
  'modal.settings.language': 'Interface language',
  'modal.settings.languageHint': 'The language of the slides is set in the design overlay.',
  'modal.settings.languageRestart': 'applies after restart',
  'modal.settings.defaultDir': 'Default location',
  'modal.settings.defaultDirHint': 'Preselected folder for new presentations.',
  'modal.settings.defaultDirFallback': 'Desktop (default)',
  'modal.settings.change': 'Change',
  'modal.settings.mcp': 'AI connection (MCP)',
  'modal.settings.assets': 'Media',
  'modal.settings.license': 'License',
  'modal.settings.licenseAction': 'Trial, buy & activate',
  'modal.settings.about': 'About',
  'modal.settings.version': 'v{version}',
  'modal.settings.aboutTagline':
    'Local, code-free, MCP-native — works with any MCP-capable AI client.',
  'modal.settings.mcpTargetActive': 'MCP target active: {target}',
  'modal.settings.mcpStatusUnavailable': 'Status unavailable.',
  'modal.settings.mcpIntro':
    'Slideo hands its slide tools to your AI agent (an MCP client such as Claude Desktop or Codex CLI). Pick where Slideo registers — {0}, the others are unregistered automatically.',
  'modal.settings.mcpIntroEmphasis': 'exactly one target is ever active',
  'modal.settings.otherClient': 'Another MCP client',
  'modal.settings.otherClientHint':
    "Cursor, Windsurf, Zed, LM Studio, Codex CLI and the like you set up yourself — drop this snippet into the client's {0} section and restart it.",
  'modal.settings.copyConfig': 'Copy configuration',
  'modal.settings.configCopied': 'Configuration copied.',

  // ── LicenseModal ─────────────────────────────────────────────────────────
  'modal.license.title': 'Slideo — License',
  'modal.license.activeTitle': 'License active — full version',
  'modal.license.keyLabel': 'Key {key}',
  'modal.license.activatedNoKey': 'License activated',
  'modal.license.validUntil': 'valid until {date}',
  'modal.license.perpetual': 'perpetual',
  'modal.license.boundHint':
    'This license is tied to this device. To move it to another computer (you have used up your device limit), release this device — the activation slot frees up again.',
  'modal.license.recheck': 'Check again',
  'modal.license.release': 'Release device',
  'modal.license.unconfigured':
    'Licensing is not configured in this build yet (the Polar connection is missing). Buying and activating become available once it is set up — {0} and never expires.',
  'modal.license.unconfiguredEmphasis': 'Slideo stays fully usable until then',
  'modal.license.upgradeRequired':
    'Your license covers an older version of Slideo. Buy the upgrade for this version — or enter a key below that is valid for it.',
  'modal.license.enterKey': 'Enter license key',
  'modal.license.enterKeyHint':
    'After your purchase you will find your key in the Polar customer portal (the link is in your order email). Copy it in here.',
  'modal.license.activating': 'Activating …',
  'modal.license.activate': 'Activate',
  'modal.license.or': 'or',
  'modal.license.buy': 'Buy Slideo',
  'modal.license.activated': 'License activated — thank you!',
  'modal.license.activationFailed': 'Activation was not successful.',
  'modal.license.checkoutFailed': 'Could not open the purchase page: {error}',
  'modal.license.deviceReleased': 'Device released.',
  'modal.license.releaseFailed': 'Could not release the device: {error}',

  // ── McpSetupModal ────────────────────────────────────────────────────────
  'modal.mcpSetup.title': 'Connect your AI agent (MCP)',
  'modal.mcpSetup.intro':
    'Slideo is an {0} and hands your AI agent {1} (e.g. Claude Desktop, Codex CLI) — the agent builds and edits your presentation, Slideo shows it live. Pick where Slideo registers (only {2}, and never more than one target).',
  'modal.mcpSetup.introServer': 'MCP server',
  'modal.mcpSetup.introTools': '{count} slide tools',
  'modal.mcpSetup.introChoice': 'once you have chosen',
  'modal.mcpSetup.notNow': 'Not now',
  'modal.mcpSetup.activating': 'Activating…',
  'modal.mcpSetup.activate': 'Activate',
  'modal.mcpSetup.changeLater':
    'You can change this any time in Settings under “AI connection (MCP)”.',
  'modal.mcpSetup.doneTitle': 'Almost there — one restart to go',
  'modal.mcpSetup.restartBody':
    '{0} MCP clients only read their server list at startup — until then your agent cannot see Slideo.',
  'modal.mcpSetup.restartNow': 'Restart {target} once now.',
  'modal.mcpSetup.askExample': 'Then simply ask it there, for example:',
  'modal.mcpSetup.exampleAsk': 'Which Slideo tools do you have? Build me a test slide with them.',
  'modal.mcpSetup.copy': 'Copy',
  'modal.mcpSetup.copied': 'Copied.',
  'modal.mcpSetup.statusHint':
    'The dot at the top right of the bar tells you whether it worked: it flips to “AI connected” as soon as the first call reaches Slideo.',

  // ── HelpModal ────────────────────────────────────────────────────────────
  'modal.help.title': 'How Slideo works with your AI agent',
  'modal.help.intro':
    'Slideo runs locally and has {0}. Your presentation is built by {1} through the MCP server (any MCP client — e.g. Claude Desktop, Codex CLI) — you refine it here.',
  'modal.help.introNoAi': 'no AI of its own',
  'modal.help.introAgent': 'your AI agent',
  'modal.help.step1.title': '1 · Create a presentation',
  'modal.help.step1.body':
    'Pick a template or start blank. Slideo is editor and player — the slides come from the AI.',
  'modal.help.step2.title': '2 · Connect your AI agent',
  'modal.help.step2.body':
    'In Slideo itself: the chat pane at the bottom (Cmd/Ctrl+J) with your Cursor account. Or open an MCP client (Claude Desktop, Codex CLI, …) — Settings → AI connection (MCP).',
  'modal.help.step3.title': '3 · Describe your topic',
  'modal.help.step3.body':
    'In the chat or your AI agent, say something like: “Create 6 slides about [topic] in Slideo.” It will reach for Slideo’s slide tools.',
  'modal.help.step4.title': '4 · Refine live',
  'modal.help.step4.body':
    'The slides show up instantly. You edit right in the preview: text, images, moving, linking.',
  'modal.help.copyPrompt': 'Copy example prompt',
  'modal.help.promptCopied': 'Example prompt copied — paste it into your AI agent.',

  // ── ExportModal ──────────────────────────────────────────────────────────
  'modal.export.title': 'Export',
  'modal.export.intro':
    'The formats differ in fidelity — here is what each one loses in this presentation.',
  'modal.export.html.title': 'HTML — self-contained file',
  'modal.export.html.lead':
    'Highest fidelity. Runs offline in any browser, with keyboard navigation, transitions and builds.',
  'modal.export.html.media': 'All media is embedded — the file can get large.',
  'modal.export.html.notes':
    'Speaker notes are NOT included (they would be visible in the shared presentation).',
  'modal.export.pdf.title': 'PDF — for printing and sending',
  'modal.export.pdf.lead':
    'One slide per page, 16:9. Opens the print view in your default browser.',
  'modal.export.pdf.margins':
    'In the print dialog choose “Margins: none” and switch off headers and footers — otherwise the file path ends up on every slide.',
  'modal.export.pdf.builds.one': '{count} slide with builds shows all its points at once.',
  'modal.export.pdf.builds.other': '{count} slides with builds show all their points at once.',
  'modal.export.pptx.title': 'PowerPoint (.pptx) — stays editable',
  'modal.export.pptx.lead':
    'Native reconstruction: real text boxes, images and theme colors, editable in PowerPoint.',
  'modal.export.pptx.htmlZones':
    '{count} of {total} slides are HTML and get flattened to plain text (charts and components are lost).',
  'modal.export.pptx.split.one':
    '{count} two-column slide with an image — the layout is approximated.',
  'modal.export.pptx.split.other':
    '{count} two-column slides with images — the layout is approximated.',
  'modal.export.pptx.notes': 'Speaker notes ({count}) are carried over.',
  'modal.export.pptx.css': 'Custom CSS and transitions are not carried over.',

  // ── NewPresentationModal ─────────────────────────────────────────────────
  'modal.new.title': 'New presentation',
  'modal.new.create': 'Create',
  'modal.new.defaultName': 'My presentation',
  'modal.new.untitled': 'Untitled',
  'modal.new.unsavedConfirm':
    'There are unsaved changes. Create a new presentation anyway?',
  'modal.new.projectName': 'Project name',
  'modal.new.template': 'Template',
  'modal.new.location': 'Location',
  'modal.new.locationFallback': 'Last used folder',
  'modal.new.choose': 'Choose…',
  'modal.new.locationBrowserHint':
    'Choosing a location works in the desktop app only. The presentation is created in memory; save it later via “Save”.',
  'modal.new.createHint':
    '“Create” opens the save dialog — prefilled with {0} in this folder. You can still change the name and location there.',

  // ── FindReplaceModal ─────────────────────────────────────────────────────
  'modal.findReplace.title': 'Find & replace',
  'modal.findReplace.replaceAll': 'Replace all',
  'modal.findReplace.find': 'Find',
  'modal.findReplace.replaceWith': 'Replace with',
  'modal.findReplace.enterTerm': 'Enter a search term …',
  'modal.findReplace.matches.one': '{count} match in the entire presentation',
  'modal.findReplace.matches.other': '{count} matches in the entire presentation',
  'modal.findReplace.replaced.one': '{count} occurrence replaced.',
  'modal.findReplace.replaced.other': '{count} occurrences replaced.',
  'modal.findReplace.noMatches': 'No matches.',
}
