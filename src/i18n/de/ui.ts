// Deutscher Katalog — src/components/ui/* + CloseGuard + ErrorBoundary.
//
// Schluessel-Schema: <bereich>.<komponente-oder-feature>.<was>
// Plural: zwei Schluessel `<basis>.one` und `<basis>.other`, abgerufen ueber tp().
// Steckplaetze fuer eingebettete Knoten: {0}, {1}, … (siehe i18n/T.tsx).
// Variablen: {name} — siehe t(key, { name: … }).

export const ui = {
  // Zweimal genutzt: Tooltip am Dirty-Punkt der Topbar und Titel des CloseGuard-Modals.
  'ui.unsavedChanges': 'Ungespeicherte Änderungen',

  // --- Topbar ---------------------------------------------------------------
  'ui.topbar.titleHint': 'Titel der Präsentation — zum Umbenennen klicken',
  'ui.topbar.titleAria': 'Titel der Präsentation',
  'ui.topbar.new': 'Neu',
  'ui.topbar.open': 'Öffnen',
  // Mehrzeiliger Tooltip: die zweite Zeile nennt den Shift/Alt-Zweig desselben Knopfes.
  'ui.topbar.saveHint':
    'Speichern: {path}\nMit Shift/Alt: Speichern unter … (Cmd/Strg+Shift+S)',
  'ui.topbar.saveAsHint': 'Speichern unter …',
  'ui.topbar.export': 'Exportieren',
  'ui.topbar.exportHint':
    'Exportieren — HTML, PDF oder PowerPoint (mit Hinweis, was jeweils verloren geht)',
  'ui.topbar.design': 'Design',
  'ui.topbar.designHint': 'Design — Theme, Farben, Schriften, Logo & Folien-Übergänge',
  'ui.topbar.media': 'Medien',
  'ui.topbar.mediaHint': 'Asset-Verwaltung — Bilder, Videos & Audio importieren und verwalten',
  'ui.topbar.find': 'Suchen & Ersetzen',
  'ui.topbar.findHint': 'Suchen & Ersetzen (Cmd/Ctrl+F)',
  'ui.topbar.history': 'Versionsverlauf',
  'ui.topbar.historyHint': 'Versionsverlauf — lokale Snapshots wiederherstellen',
  'ui.topbar.help': 'Hilfe',
  'ui.topbar.helpHint': 'Hilfe — wie Slideo mit deinem KI-Agenten arbeitet',
  // title= und aria-label= sind hier woertlich gleich → EIN Schluessel.
  'ui.topbar.settings': 'Einstellungen',
  'ui.topbar.present': 'Präsentieren',

  // --- MCP-Ziel-Karten ------------------------------------------------------
  // Die Ziel-NAMEN (Claude Desktop, Meta-MCP, Claude Code) sind Eigennamen und
  // stehen weiterhin im Code. Uebersetzt wird nur, was Beschreibung ist.
  'ui.mcp.hint.desktop': 'claude_desktop_config.json',
  'ui.mcp.hint.meta': 'localhost:3663 · Aggregator-Proxy',
  'ui.mcp.hint.claude': '~/.claude.json · User-Scope',
  'ui.mcp.avail.desktop.yes': 'Installiert',
  'ui.mcp.avail.desktop.no': 'Nicht installiert',
  'ui.mcp.avail.meta.yes': 'Läuft',
  'ui.mcp.avail.meta.no': 'Nicht erreichbar',
  'ui.mcp.avail.claude.yes': 'Erkannt',
  'ui.mcp.avail.claude.no': 'Nicht erkannt',
  'ui.mcp.active': 'Aktiv',
  'ui.mcp.switching': 'Wechsle…',

  // --- Verbindungs-Chip (KI-Kanal) -----------------------------------------
  'ui.chip.agoSec': 'vor {n} s',
  'ui.chip.agoMin': 'vor {n} min',
  'ui.chip.agoHour': 'vor {n} h',
  'ui.chip.disconnected': 'KI nicht verbunden',
  'ui.chip.connected': 'KI verbunden',
  'ui.chip.idle': 'KI {ago}',
  'ui.chip.titleNever':
    'Seit dem Start hat noch kein KI-Tool Slideo erreicht.\n' +
    'Achtung: dein MCP-Client meldet die Werkzeuge auch dann als vorhanden, wenn Slideo nicht läuft — ' +
    'erst der erste echte Aufruf zeigt es.\nZum Einrichten klicken.',
  'ui.chip.titleLast': 'Zuletzt: {tool} ({ago})',
  // Eigene Zeile des Tooltips, im Code mit \n angehaengt.
  'ui.chip.titleVersion': 'Connector-Version {version}',

  // --- Onboarding-Hinweis ---------------------------------------------------
  'ui.nudge.headline': 'Dein KI-Agent baut deine Folien.',
  'ui.nudge.body':
    'Öffne deinen MCP-Client (z.B. Claude Desktop, Codex CLI) und beschreib dein Thema — oder kopier dir einen fertigen Prompt.',
  'ui.nudge.copy': 'Prompt kopieren',
  'ui.nudge.copied': 'Prompt kopiert — in deinen KI-Agent einfügen.',
  'ui.nudge.copyFailed': 'Kopieren nicht möglich.',
  'ui.nudge.how': 'Wie das geht?',
  'ui.nudge.dismiss': 'Hinweis ausblenden',

  // --- Asset-Bibliothek -----------------------------------------------------
  'ui.assets.noPresentation': 'Erst eine Präsentation öffnen/anlegen.',
  'ui.assets.pickHint': 'Asset anklicken zum Einfügen — oder neue importieren (Mehrfachauswahl).',
  // {0}/{1} sind <code>-Knoten (list_assets bzw. assets/<name>) — siehe i18n/T.tsx.
  'ui.assets.libraryHint': 'Bilder, Videos & Audio — auch von der KI per {0} als {1} nutzbar.',
  'ui.assets.import': 'Importieren',
  'ui.assets.empty': 'Noch keine Assets — importiere welche (Mehrfachauswahl möglich).',
  'ui.assets.insert': 'Einfügen: {name}',
  'ui.assets.remove': 'Asset entfernen',
  'ui.assets.removeConfirm': '„{name}" entfernen? (Rückgängig mit Cmd/Strg+Z)',
  'ui.assets.removeUsed.one':
    '„{name}" wird an {count} Stelle in der Präsentation verwendet.\n\nTrotzdem entfernen? (Rückgängig mit Cmd/Strg+Z)',
  'ui.assets.removeUsed.other':
    '„{name}" wird an {count} Stellen in der Präsentation verwendet.\n\nTrotzdem entfernen? (Rückgängig mit Cmd/Strg+Z)',

  // --- Lizenz-Leiste --------------------------------------------------------
  // Schluessel-Map ueber den Rust-Enum-Wert `status.state` — der Enum-Wert selbst
  // bleibt unveraendert, nur der angezeigte Satz kommt aus dem Katalog.
  'ui.license.state.revoked': 'Lizenz widerrufen — Slideo ist schreibgeschützt.',
  'ui.license.state.expired': 'Lizenz abgelaufen — Slideo ist schreibgeschützt.',
  'ui.license.state.upgrade_required':
    'Deine Lizenz gilt für eine ältere Slideo-Version — Upgrade nötig (schreibgeschützt).',
  'ui.license.state.trial_expired':
    'Testphase abgelaufen — Slideo ist schreibgeschützt (Öffnen & Exportieren bleibt möglich).',
  'ui.license.trialDays.one': 'Testphase: noch {count} Tag.',
  'ui.license.trialDays.other': 'Testphase: noch {count} Tage.',
  'ui.license.buy': 'Slideo kaufen',
  'ui.license.activate': 'Lizenz aktivieren',
  'ui.license.buyFailed': 'Kauf-Seite konnte nicht geöffnet werden: {error}',
  'ui.license.buyFailedUnconfigured':
    'Kauf-Seite konnte nicht geöffnet werden (Lizenzierung noch nicht konfiguriert): {error}',

  // --- Editor-Shell (Spalten) ----------------------------------------------
  'ui.shell.editor': 'Editor',
  'ui.shell.preview': 'Vorschau',
  'ui.shell.collapse': '{name} einklappen',
  'ui.shell.expand': '{name} einblenden',
  'ui.shell.resizePreview': 'Vorschau skalieren',

  // --- Schliessen-Schutz ----------------------------------------------------
  'ui.closeGuard.body':
    'Diese Präsentation hat ungespeicherte Änderungen. Möchtest du sie vor dem Schließen speichern?',
  'ui.closeGuard.discard': 'Nicht speichern',

  // --- Fehler-Auffangnetz ---------------------------------------------------
  'ui.error.title': 'Diese Ansicht konnte nicht dargestellt werden',
  // {0} ist ein <code>.slideo</code>-Knoten.
  'ui.error.body':
    'Deine Präsentation ist nicht verloren — sie liegt weiterhin auf der Platte. Häufigste Ursache ist eine beschädigte oder von Hand bearbeitete {0}-Datei.',
  'ui.error.reload': 'App neu laden',
} as const
