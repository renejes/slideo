// Deutscher Katalog — Mehrfach genutzte Bausteine (Knopfbeschriftungen, Statuszeilen).
// Ein Text, der an mehr als einer Stelle woertlich vorkommt, gehoert hierher —
// sonst driften die Uebersetzungen auseinander.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const common = {
  'common.cancel': 'Abbrechen',
  'common.close': 'Schließen',
  'common.save': 'Speichern',
  'common.delete': 'Löschen',
  'common.duplicate': 'Duplizieren',
  'common.reset': 'Zurücksetzen',
  'common.retry': 'Erneut versuchen',
  'common.loading': 'Lädt …',
  'common.desktopOnly': 'Nur in der Desktop-App',
  'common.desktopOnlyHint': 'Nur in der Desktop-App verfügbar (npm run tauri:dev)',
  // Plural-Beispiel und zugleich echter Bedarf: die Folienzahl steht in
  // Verlaufsliste, Export-Dialog und Zuletzt-geöffnet-Liste.
  'common.slideCount.one': '{count} Folie',
  'common.slideCount.other': '{count} Folien',

  // ---------------------------------------------------------------------------
  // Fehlercodes vom Rust-Backend (`src-tauri/src/errcode.rs`).
  //
  // Nur die HANDLUNGSRELEVANTE Menge — Lizenz, MCP-Registrierung, Folien-Fenster.
  // Der Diagnose-Schwanz (Datei-I/O, History, Config-Pfade) bleibt drüben deutsche
  // Prosa und wird unverändert durchgereicht; er endet ohnehin meist auf einem
  // `std`/`reqwest`-Text, den niemand übersetzen kann.
  //
  // `{detail}` ist der unübersetzte Zusatz (HTTP-Status, Pfad, Fremdfehlertext).
  // Steht kein `{detail}` im Text, hängt describeError() ihn in Klammern an.
  // ---------------------------------------------------------------------------
  'error.license.noConfigDir': 'Kein Config-Verzeichnis gefunden',
  'error.license.noParentDir': 'Kein übergeordneter Ordner',
  'error.license.networkActivate': 'Netzwerkfehler bei der Aktivierung: {detail}',
  'error.license.networkValidate': 'Netzwerkfehler bei der Prüfung: {detail}',
  'error.license.networkDeactivate': 'Netzwerkfehler: {detail}',
  'error.license.deviceLimit':
    'Aktivierungslimit erreicht (max. Geräte). Gib ein anderes Gerät frei und versuche es erneut.',
  'error.license.notFoundCheckKey': 'Lizenzschlüssel nicht gefunden. Bitte den Schlüssel prüfen.',
  'error.license.notFound': 'Lizenzschlüssel nicht gefunden.',
  'error.license.activateRejected': 'Aktivierung abgelehnt (HTTP {detail}).',
  'error.license.badResponse': 'Ungültige Antwort: {detail}',
  'error.license.activationIdMissing': 'Aktivierungs-ID fehlt in der Antwort',
  'error.license.validateFailed': 'Prüfung fehlgeschlagen (HTTP {detail}).',
  'error.license.deactivateFailed': 'Deaktivierung fehlgeschlagen (HTTP {detail}).',
  'error.license.notConfigured': 'Lizenzierung ist noch nicht konfiguriert.',
  'error.license.keyEmpty': 'Bitte einen Lizenzschlüssel eingeben.',
  'error.license.notGranted': 'Lizenz nicht gültig (Status: {detail}).',
  'error.license.wrongVersion':
    'Dieser Schlüssel gehört zu einer anderen Slideo-Version. Bitte das Upgrade für diese Version kaufen.',
  'error.license.checkoutNotConfigured': 'Der Kauf-Link ist noch nicht konfiguriert.',
  'error.mcp.metaSendFailed': 'Senden fehlgeschlagen: {detail}',
  'error.mcp.metaReadFailed': 'Lesen fehlgeschlagen: {detail}',
  'error.mcp.metaBadResponse': 'Ungültige HTTP-Antwort von Meta-MCP',
  'error.mcp.metaRegisterHttp': 'Meta-MCP /register antwortete mit HTTP {detail}.',
  'error.mcp.noConfigDir': 'Kein Config-Verzeichnis gefunden.',
  'error.mcp.claudeDesktopMissing': 'Claude Desktop ist nicht installiert.',
  'error.mcp.noHomeDir': 'Kein Home-Verzeichnis gefunden.',
  'error.mcp.selfPathUnknown': 'Eigenen Pfad nicht ermittelbar: {detail}',
  'error.present.noWindow': 'Kein Folien-Fenster offen',
  'error.present.noMonitor': 'Kein Monitor für das Folien-Fenster gefunden',
  'error.cmd.openFailed': 'Öffnen fehlgeschlagen: {detail}',
} as const
