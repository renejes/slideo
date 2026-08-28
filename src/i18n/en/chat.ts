// English catalogue — in-app Cursor chat (ChatPanel, Settings → Cursor).

type Keys = keyof typeof import('../de/chat').chat

export const chat: Record<Keys, string> = {
  'chat.title': 'Chat',
  'chat.toggle': 'Toggle chat (Cmd/Ctrl+J)',
  'chat.insertIntoChat': 'Insert into Chat',

  'chat.signInTitle': 'Sign in with Cursor',
  'chat.signInBody':
    'The in-app chat uses your Cursor account. Slideo stays free — usage is billed to your Cursor plan.',
  'chat.signIn': 'Sign in',
  'chat.signOut': 'Sign out',
  'chat.signedInAs': 'Signed in as {email}',
  'chat.signedIn': 'Signed in',
  'chat.expiresInDays.one': 'Key expires in {count} day',
  'chat.expiresInDays.other': 'Key expires in {count} days',
  'chat.expired': 'Key expired, please sign in again.',
  'chat.openSettings': 'Open Settings',
  'chat.disclaimer':
    'Usage goes to your Cursor subscription. Slideo does not sell tokens or run its own model. Cursor may collect usage data according to its privacy policy.',

  'chat.noProjectTitle': 'Open a presentation to chat',
  'chat.noProjectBody':
    'Create or open a presentation. The agent works on this deck — it cannot create files on its own.',

  'chat.composerPlaceholder': 'Ask anything…  Type @ to mention a slide',
  'chat.send': 'Send',
  'chat.cancel': 'Stop',
  'chat.sending': 'Working…',
  'chat.workingElapsed': 'Working…',
  'chat.workingElapsedSec': 'Working · {s}s',
  'chat.usingTool': '{name}…',
  'chat.stallHint': 'Still running, but no new output for a while. Stop if this looks stuck.',
  'chat.modeAgent': 'Agent',
  'chat.modePlan': 'Plan',
  'chat.modeLabel': 'Mode',
  'chat.fastLabel': 'Fast',
  'chat.attachFiles': 'Attach files…',
  'chat.contextUsed': 'Context: {n}',
  'chat.removeChip': 'Remove',
  'chat.thinking': 'Thinking',
  'chat.emptyHint': 'Describe what you need. Type @ to point at a slide.',
  'chat.mentionEmpty': 'No matching slides',
  'chat.errorPrefix': 'Could not send',
  'chat.loginFailed': 'Sign-in did not complete.',
  'chat.desktopOnly': 'In-app chat runs only in the desktop app (npm run tauri:dev).',

  'chat.cursorSection': 'Cursor',
  'chat.cursorStatusLoggedOut': 'Not signed in',
  'chat.cursorStatusLoggedIn': 'Signed in',
  'chat.cursorModel': 'Model',
  'chat.cursorChatHint': 'Pick the model, Fast, and thinking effort in the chat dropdown next to Agent / Plan.',
  'chat.cursorVariant': 'Speed',
  'chat.cursorThinking': 'Thinking effort',

  'chat.newChat': 'New chat',
  'chat.chatHistory': 'Chat history',
  'chat.closeTab': 'Close tab',
  'chat.deleteChat': 'Delete chat',
  'chat.historyEmpty': 'No chats in this presentation yet.',
  'chat.busySwitch': 'Stop the current reply before switching chats.',
}
