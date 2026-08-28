// Deutscher Katalog — In-App-Cursor-Chat (ChatPanel, Settings → Cursor).

export const chat = {
  'chat.title': 'Chat',
  'chat.toggle': 'Chat ein-/ausblenden (Cmd/Strg+J)',
  'chat.insertIntoChat': 'In Chat einfügen',

  'chat.signInTitle': 'Mit Cursor anmelden',
  'chat.signInBody':
    'Der Chat in der App nutzt dein Cursor-Konto. Slideo bleibt kostenlos — die Nutzung geht auf dein Cursor-Abo.',
  'chat.signIn': 'Anmelden',
  'chat.signOut': 'Abmelden',
  'chat.signedInAs': 'Angemeldet als {email}',
  'chat.signedIn': 'Angemeldet',
  'chat.expiresInDays.one': 'Key läuft in {count} Tag ab',
  'chat.expiresInDays.other': 'Key läuft in {count} Tagen ab',
  'chat.expired': 'Key abgelaufen, logge dich bitte erneut ein.',
  'chat.openSettings': 'Einstellungen öffnen',
  'chat.disclaimer':
    'Die Nutzung geht auf dein Cursor-Abo. Slideo verkauft keine Tokens und betreibt kein eigenes Modell. Cursor kann Nutzungsdaten gemäß seiner Datenschutzerklärung erheben.',

  'chat.noProjectTitle': 'Präsentation öffnen, um zu chatten',
  'chat.noProjectBody':
    'Lege eine Präsentation an oder öffne eine. Der Agent arbeitet an diesem Deck — er legt selbst keine Dateien an.',

  'chat.composerPlaceholder': 'Frag etwas…  Mit @ eine Folie nennen',
  'chat.send': 'Senden',
  'chat.cancel': 'Stopp',
  'chat.sending': 'Arbeitet…',
  'chat.workingElapsed': 'Arbeitet…',
  'chat.workingElapsedSec': 'Arbeitet · {s}s',
  'chat.usingTool': '{name}…',
  'chat.stallHint': 'Läuft noch, aber seit einer Weile ohne neues Signal. Stopp, wenn das feststeckt.',
  'chat.modeAgent': 'Agent',
  'chat.modePlan': 'Plan',
  'chat.modeLabel': 'Modus',
  'chat.fastLabel': 'Fast',
  'chat.attachFiles': 'Dateien anhängen…',
  'chat.contextUsed': 'Kontext: {n}',
  'chat.removeChip': 'Entfernen',
  'chat.thinking': 'Denkt nach',
  'chat.emptyHint': 'Beschreib, was du brauchst. Mit @ zeigst du auf eine Folie.',
  'chat.mentionEmpty': 'Keine passenden Folien',
  'chat.errorPrefix': 'Senden fehlgeschlagen',
  'chat.loginFailed': 'Anmeldung nicht abgeschlossen.',
  'chat.desktopOnly': 'Der In-App-Chat läuft nur in der Desktop-App (npm run tauri:dev).',

  'chat.cursorSection': 'Cursor',
  'chat.cursorStatusLoggedOut': 'Nicht angemeldet',
  'chat.cursorStatusLoggedIn': 'Angemeldet',
  'chat.cursorModel': 'Modell',
  'chat.cursorChatHint':
    'Modell, Fast und Thinking-Aufwand stellst du im Chat-Dropdown neben Agent / Plan ein.',
  'chat.cursorVariant': 'Tempo',
  'chat.cursorThinking': 'Thinking-Aufwand',

  'chat.newChat': 'Neuer Chat',
  'chat.chatHistory': 'Chatverlauf',
  'chat.closeTab': 'Tab schließen',
  'chat.deleteChat': 'Chat löschen',
  'chat.historyEmpty': 'Noch keine Chats in dieser Präsentation.',
  'chat.busySwitch': 'Stopp die aktuelle Antwort, bevor du den Chat wechselst.',
} as const
