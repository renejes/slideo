// Deutscher Katalog — src/components/modals/*.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const modals = {
  // ── Mehrfach genutzt (mindestens zwei Modals) ────────────────────────────
  'modal.gotIt': 'Verstanden',
  'modal.desktopOnly': 'Nur in der Desktop-App verfügbar.',
  'modal.copyFailed': 'Kopieren nicht möglich.',
  'modal.mcpStatusLoading': 'Status wird geladen…',

  // ── SettingsModal ────────────────────────────────────────────────────────
  'modal.settings.title': 'Einstellungen',
  'modal.settings.general': 'Allgemein',
  'modal.settings.language': 'Sprache der Oberfläche',
  'modal.settings.languageHint': 'Die Sprache der Folien stellst du im Design-Overlay ein.',
  'modal.settings.languageRestart': 'wirkt nach Neustart',
  'modal.settings.defaultDir': 'Standard-Speicherort',
  'modal.settings.defaultDirHint': 'Vorausgewählter Ordner für neue Präsentationen.',
  'modal.settings.defaultDirFallback': 'Desktop (Standard)',
  'modal.settings.change': 'Ändern',
  'modal.settings.mcp': 'KI-Verbindung (MCP)',
  'modal.settings.assets': 'Assets',
  'modal.settings.license': 'Lizenz',
  'modal.settings.licenseAction': 'Testphase, kaufen & aktivieren',
  'modal.settings.about': 'Über',
  'modal.settings.version': 'v{version}',
  'modal.settings.aboutTagline':
    'Lokal, code-frei, MCP-nativ — nutzbar mit jedem MCP-fähigen KI-Client.',
  'modal.settings.mcpTargetActive': 'MCP-Ziel aktiv: {target}',
  'modal.settings.mcpStatusUnavailable': 'Status nicht verfügbar.',
  // {0} = hervorgehobener Einschub (mcpIntroEmphasis).
  'modal.settings.mcpIntro':
    'Slideo stellt deinem KI-Agenten (MCP-Client wie Claude Desktop, Codex CLI) seine Folien-Werkzeuge bereit. Wähle, wo sich Slideo registriert — es ist immer genau {0}, die anderen werden automatisch abgemeldet.',
  'modal.settings.mcpIntroEmphasis': 'ein Ziel aktiv',
  'modal.settings.otherClient': 'Anderer MCP-Client',
  // {0} = <code>mcpServers</code>
  'modal.settings.otherClientHint':
    'Cursor, Windsurf, Zed, LM Studio, Codex CLI & Co. konfigurierst du selbst — dieses Snippet in die {0}-Sektion des Clients einfügen und ihn neu starten.',
  'modal.settings.copyConfig': 'Konfiguration kopieren',
  'modal.settings.configCopied': 'Konfiguration kopiert.',

  // ── LicenseModal ─────────────────────────────────────────────────────────
  'modal.license.title': 'Slideo — Lizenz',
  'modal.license.activeTitle': 'Lizenz aktiv — vollständige Version',
  'modal.license.keyLabel': 'Schlüssel {key}',
  'modal.license.activatedNoKey': 'Lizenz aktiviert',
  'modal.license.validUntil': 'gültig bis {date}',
  'modal.license.perpetual': 'unbefristet',
  'modal.license.boundHint':
    'Diese Lizenz ist an dieses Gerät gebunden. Um sie auf einen anderen Rechner umzuziehen (dein Limit an Geräten ist erreicht), gib dieses Gerät frei — der Aktivierungs-Platz wird wieder frei.',
  'modal.license.recheck': 'Erneut prüfen',
  'modal.license.release': 'Gerät freigeben',
  // {0} = hervorgehobener Einschub (unconfiguredEmphasis).
  'modal.license.unconfigured':
    'Lizenzierung ist in diesem Build noch nicht konfiguriert (Polar-Verbindung fehlt). Kaufen & Aktivieren sind erst nach der Einrichtung verfügbar — {0} und läuft nicht ab.',
  'modal.license.unconfiguredEmphasis': 'Slideo bleibt so lange uneingeschränkt nutzbar',
  'modal.license.upgradeRequired':
    'Deine bestehende Lizenz gilt für eine ältere Slideo-Version. Kaufe das Upgrade für diese Version — oder gib unten einen für diese Version gültigen Schlüssel ein.',
  'modal.license.enterKey': 'Lizenzschlüssel eingeben',
  'modal.license.enterKeyHint':
    'Nach dem Kauf findest du deinen Schlüssel im Polar-Kundenportal (Link in der Bestell-E-Mail). Kopiere ihn hierher.',
  'modal.license.activating': 'Aktiviere …',
  'modal.license.activate': 'Aktivieren',
  'modal.license.or': 'oder',
  'modal.license.buy': 'Slideo kaufen',
  'modal.license.activated': 'Lizenz aktiviert — danke!',
  'modal.license.activationFailed': 'Aktivierung nicht erfolgreich.',
  'modal.license.checkoutFailed': 'Kauf-Seite konnte nicht geöffnet werden: {error}',
  'modal.license.deviceReleased': 'Gerät freigegeben.',
  'modal.license.releaseFailed': 'Freigeben fehlgeschlagen: {error}',

  // ── McpSetupModal ────────────────────────────────────────────────────────
  'modal.mcpSetup.title': 'KI-Agent verbinden (MCP)',
  // {0}/{1}/{2} = hervorgehobene Einschübe (introServer, introTools, introChoice).
  'modal.mcpSetup.intro':
    'Slideo ist ein {0} und stellt deinem KI-Agenten {1} bereit (z.B. Claude Desktop, Codex CLI) — der Agent baut & bearbeitet dein Deck, Slideo zeigt es live. Wähle, wo sich Slideo registriert (erst {2}, immer nur ein Ziel).',
  'modal.mcpSetup.introServer': 'MCP-Server',
  'modal.mcpSetup.introTools': '{count} Folien-Werkzeuge',
  'modal.mcpSetup.introChoice': 'nach deiner Auswahl',
  'modal.mcpSetup.notNow': 'Jetzt nicht',
  'modal.mcpSetup.activating': 'Aktiviere…',
  'modal.mcpSetup.activate': 'Aktivieren',
  'modal.mcpSetup.changeLater':
    'Lässt sich jederzeit in den Einstellungen unter „KI-Verbindung (MCP)" ändern.',
  'modal.mcpSetup.doneTitle': 'Fast fertig — einmal neu starten',
  // {0} = hervorgehobener Einschub (restartNow).
  'modal.mcpSetup.restartBody':
    '{0} MCP-Clients lesen ihre Server-Liste nur beim Start — vorher sieht dein Agent Slideo nicht.',
  'modal.mcpSetup.restartNow': 'Starte {target} jetzt einmal neu.',
  'modal.mcpSetup.askExample': 'Danach dort einfach fragen, zum Beispiel:',
  /** Beispielfrage fürs Erfolgspanel — bewusst kurz und ohne Slideo-Jargon. */
  'modal.mcpSetup.exampleAsk': 'Welche Slideo-Werkzeuge hast du? Bau mir damit eine Testfolie.',
  'modal.mcpSetup.copy': 'Kopieren',
  'modal.mcpSetup.copied': 'Kopiert.',
  'modal.mcpSetup.statusHint':
    'Ob es geklappt hat, zeigt der Punkt oben rechts in der Leiste: er springt auf „KI verbunden", sobald der erste Aufruf Slideo erreicht.',

  // ── HelpModal ────────────────────────────────────────────────────────────
  'modal.help.title': 'Wie Slideo mit deinem KI-Agent arbeitet',
  // {0}/{1} = hervorgehobene Einschübe (introNoAi, introAgent).
  'modal.help.intro':
    'Slideo läuft lokal und hat {0}. Die Präsentation baut {1} über den MCP-Server (ein beliebiger MCP-Client — z.B. Claude Desktop, Codex CLI) — du verfeinerst sie hier.',
  'modal.help.introNoAi': 'keine eigene KI',
  'modal.help.introAgent': 'dein KI-Agent',
  'modal.help.step1.title': '1 · Präsentation anlegen',
  'modal.help.step1.body':
    'Vorlage wählen oder leer starten. Slideo ist Editor & Player — die Folien baut die KI.',
  'modal.help.step2.title': '2 · KI-Agent verbinden',
  'modal.help.step2.body':
    'Direkt in Slideo: Chat-Fenster unten (Cmd/Strg+J) mit deinem Cursor-Konto. Oder einen MCP-Client öffnen (Claude Desktop, Codex CLI, …) — Einstellungen → KI-Verbindung (MCP).',
  'modal.help.step3.title': '3 · Thema beschreiben',
  'modal.help.step3.body':
    'Im Chat oder im KI-Agent z.B.: „Erstelle 6 Folien über [Thema] in Slideo.“ Er nutzt dafür Slideos Folien-Werkzeuge.',
  'modal.help.step4.title': '4 · Live verfeinern',
  'modal.help.step4.body':
    'Die Folien erscheinen sofort. Du editierst direkt in der Vorschau: Text, Bilder, Verschieben, Verlinken.',
  'modal.help.copyPrompt': 'Beispiel-Prompt kopieren',
  'modal.help.promptCopied': 'Beispiel-Prompt kopiert — in deinen KI-Agent einfügen.',

  // ── ExportModal ──────────────────────────────────────────────────────────
  'modal.export.title': 'Exportieren',
  'modal.export.intro':
    'Die Formate unterscheiden sich in der Wiedergabetreue — hier steht, was in diesem Deck jeweils verloren geht.',
  'modal.export.html.title': 'HTML — eigenständige Datei',
  'modal.export.html.lead':
    'Höchste Treue. Läuft offline in jedem Browser, mit Tastatur-Navigation, Übergängen und Builds.',
  'modal.export.html.media': 'Alle Medien sind eingebettet — die Datei kann groß werden.',
  'modal.export.html.notes':
    'Sprechernotizen sind NICHT enthalten (sie würden in der geteilten Präsentation sichtbar).',
  'modal.export.pdf.title': 'PDF — zum Drucken und Verschicken',
  'modal.export.pdf.lead':
    'Eine Folie pro Seite, 16:9. Öffnet die Druckansicht im Standardbrowser.',
  'modal.export.pdf.margins':
    'Im Druckdialog „Ränder: keine" wählen und Kopf-/Fußzeilen abwählen — sonst steht der Dateipfad auf jeder Folie.',
  'modal.export.pdf.builds.one':
    '{count} Folie mit Schritt-Einblendung zeigt alle Punkte auf einmal.',
  'modal.export.pdf.builds.other':
    '{count} Folien mit Schritt-Einblendung zeigt alle Punkte auf einmal.',
  'modal.export.pptx.title': 'PowerPoint (.pptx) — weiter bearbeitbar',
  'modal.export.pptx.lead':
    'Native Rekonstruktion: echte Textfelder, Bilder und Theme-Farben, in PowerPoint editierbar.',
  'modal.export.pptx.htmlZones':
    '{count} von {total} Folien sind HTML und werden zu reinem Text vereinfacht (Diagramme und Komponenten gehen verloren).',
  'modal.export.pptx.split.one':
    '{count} zweispaltige Folie mit Bild — Layout wird angenähert.',
  'modal.export.pptx.split.other':
    '{count} zweispaltige Folien mit Bild — Layout wird angenähert.',
  'modal.export.pptx.notes': 'Sprechernotizen ({count}) werden übernommen.',
  'modal.export.pptx.css': 'Custom-CSS und Übergänge werden nicht übernommen.',

  // ── NewPresentationModal ─────────────────────────────────────────────────
  'modal.new.title': 'Neue Präsentation',
  'modal.new.create': 'Erstellen',
  /** Vorbelegung des Namensfelds — wird beim Anlegen zum Titel (Inhalt, danach eingefroren). */
  'modal.new.defaultName': 'Meine Präsentation',
  /** Titel-Fallback, wenn das Namensfeld leer bleibt. */
  'modal.new.untitled': 'Unbenannt',
  'modal.new.unsavedConfirm':
    'Es gibt ungespeicherte Änderungen. Neue Präsentation trotzdem anlegen?',
  'modal.new.projectName': 'Projektname',
  'modal.new.template': 'Vorlage',
  'modal.new.location': 'Speicherort',
  'modal.new.locationFallback': 'Zuletzt genutzter Ordner',
  'modal.new.choose': 'Wählen…',
  'modal.new.locationBrowserHint':
    'Speicherort-Auswahl nur in der Desktop-App. Die Präsentation wird in-memory angelegt; speichern später per „Speichern".',
  // {0} = <code>name.slideo</code>
  'modal.new.createHint':
    '„Erstellen" öffnet den Speichern-Dialog — vorbelegt mit {0} in diesem Ordner. Dort lässt sich Name und Ort noch ändern.',

  // ── FindReplaceModal ─────────────────────────────────────────────────────
  'modal.findReplace.title': 'Suchen & Ersetzen',
  'modal.findReplace.replaceAll': 'Alle ersetzen',
  'modal.findReplace.find': 'Suchen nach',
  'modal.findReplace.replaceWith': 'Ersetzen durch',
  'modal.findReplace.enterTerm': 'Suchbegriff eingeben …',
  'modal.findReplace.matches.one': '{count} Treffer in der gesamten Präsentation',
  'modal.findReplace.matches.other': '{count} Treffer in der gesamten Präsentation',
  'modal.findReplace.replaced.one': '{count} Vorkommen ersetzt.',
  'modal.findReplace.replaced.other': '{count} Vorkommen ersetzt.',
  'modal.findReplace.noMatches': 'Keine Treffer.',
} as const
