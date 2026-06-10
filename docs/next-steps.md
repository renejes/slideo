# Slideo — Nächste Schritte

> To-do-Dokument. Reihenfolge: **erst testen** (A), **dann Features** (B), **dann Distribution/Notarization** (C).
> Stand-Kontext: [project-status.md](project-status.md). Maßgebliche Spec: [slideo-spec.md](slideo-spec.md).

---

## A. Testen (zuerst — das wurde headless NICHT verifiziert)

Vorbereitung: `npm run tauri:dev` **frisch** starten. Nach jeder Backend-Änderung zusätzlich **Claude Desktop neu starten** (sonst altes MCP-Binary!).

### A1. Editor-Grundfunktionen
- [ ] Neue Präsentation: „Neu" → Modal (Name + Speicherort) → speichert direkt als `.slideo`.
- [ ] Zonen: hinzufügen, löschen, per Drag&Drop sortieren; Tiptap-Tippen, Token-Sidebar live in der Vorschau.
- [ ] Markdown ⇄ HTML-Zone togglen (Warn-Dialog beim Rückweg).
- [ ] Custom CSS pro Zone (Panel unter der Zone) → wirkt nur auf diese Folie in der Vorschau.
- [ ] Layouts: `hero`, `split` (Markdown mit `+++`-Trennzeile → zwei Spalten).

### A2. Speichern & Schließen (kritischer Fix — bitte gezielt prüfen)
- [ ] Speichern via Button (Cmd+S) → Datei landet am Ort, Toast „Gespeichert".
- [ ] **Schließen mit ungespeicherten Änderungen** → 3-Knopf-Dialog (Speichern / Nicht speichern / Abbrechen). „Speichern" darf nichts verlieren; „Abbrechen" lässt offen.
- [ ] `.slideo` schließen und wieder öffnen → alles (inkl. Custom CSS, Assets) ist da.

### A3. Präsentation & Speaker-View
- [ ] Präsentieren → Pfeiltasten/Leertaste navigieren (vor UND zurück), `Esc` raus.
- [ ] Taste `s` → Speaker-View (aktuelle + nächste Folie, Timer, Zähler, Notizen). Navigation muss in beide Richtungen funktionieren (war ein Bug, jetzt gefixt — verifizieren).

### A4. MCP / KI (Claude Desktop)
- [ ] Claude Desktop neu starten → Slideo-Tools erscheinen (sollten **23** sein, inkl. `set_zone_css`, `list_assets`).
- [ ] Generierung: „Baue eine Präsentation über X mit dunklem Theme" → Folien erscheinen **live** im Editor.
- [ ] Prüfen, ob Claude **Markdown-first** baut (Tokens/Layouts statt Inline-HTML) und HTML nur token-basiert nutzt.
- [ ] MCP-Prompt `slideo_guide` in Claude Desktop aufrufbar?
- [ ] `set_zone_css` / `set_zone_style(custom_css)` funktionieren und erscheinen live.

### A5. Assets (Bild / Video / Audio)
- [ ] Bild via Zone-Button einfügen → in Vorschau sichtbar; nach Speichern/Öffnen persistent (liegt im ZIP unter `assets/`).
- [ ] Settings → Assets: Bild/Video/Audio hinterlegen, Thumbnails, entfernen.
- [ ] `list_assets` in Claude Desktop → KI findet vorab hinterlegte Assets und baut sie ein.
- [ ] **`slideoasset://`-Streaming (neu, unsicher):** kurzes mp4 in eine HTML-Zone (`<video controls src="assets/x.mp4">`). Lädt es? **DevTools → Network** auf `slideoasset://…`-Requests prüfen; **Konsole** auf Block-Meldungen (CSP/Sandbox). Falls blockiert → siehe B1.

### A6. Cross-Platform (falls verfügbar)
- [ ] Windows: `http://slideoasset.localhost/`-Variante; Dialoge; Claude-Config-Pfad (`%APPDATA%/Claude`).
- [ ] Linux: webkit2gtk-Abhängigkeiten; Claude-Config-Pfad.

---

## B. Features ausbauen — **geplant in [slideo-spec.md](slideo-spec.md) §18**

> Der detaillierte, umsetzungsreife Plan steht in **Spec §18 (Roadmap)**. Empfohlene Reihenfolge laut §18.8 — **Status dieser Session:**

1. ✅ **Speaker-Notes-Editor** + `set_zone_notes` — §18.2.
2. ✅ **Export self-contained HTML** + **Teilen** — §18.4 / §18.5.
3. ✅ **Themes / Presets** — §18.6.
4. ✅ **Folien-Transitions** — §18.3.
5. **Asset-Positionierung** — §18.1: ✅ **Light** (Bild-Toolbar) + ✅ **Medium** (Block-Drag **in der interaktiven Vorschau** — `editable`-Render + `reorderZoneBlocks`; Spalten-Slots über automatische `+++`-Verwaltung im Layout-Dropdown). **OFFEN (Richtung Large):** Drag *zwischen* Spalten, Block-Drag auch für split/HTML-Zonen, Free-Canvas.
6. **Interaktivität** — §18.7: ✅ Agenten-Skill erweitert + ✅ Komponenten-Bibliothek (MCP `list_components`/`insert_component`, Rust-Generator). **OFFEN: UI-Komponenten-Palette** im Editor (denselben Rust-Generator via Tauri-Command nutzen — keine Template-Duplikation). Komponenten-Set iterativ erweitern.
7. ✅ **PDF-Export** — §18.4.

### B2. Programm §19 — „Richtung vollwertige Präsentationssoftware" (Spec §19)

- ✅ **19.2 Daten-Diagramme** — `line_chart` + `donut_chart` (9 Komponenten gesamt).
- ✅ **19.7 Barrierefreiheit** — Alt-Text-Feld + WCAG-Kontrast-Check.
- ✅ **19.1 In-Folien-Builds** — `set_zone_reveal`, parent-autoritative Nav. **OFFEN: Auto-Animate/Morph.**
- ✅ **19.4 Vorlagen & Marke** — Custom-Fonts + Logo/Brand + Starter-Templates.
- ✅ **19.9 Suchen & Ersetzen** + Spellcheck. **OFFEN: Outline-Modus + Versionshistorie.**
- **OFFEN: 19.3 Presenter-Tools** (Folien-Übersicht/Sprung, Laser/Stift, echtes Zweitfenster, Auto-Advance/Loop).
- **OFFEN: 19.8 Medien** (Drag&Drop-Bildimport, Crop, Icons, Aufnahme/Narration + Video-Export).
- **OFFEN: 19.5 PPTX-Export** (v1 bild-basiert via pptxgenjs).
- **OFFEN: Komponenten-Palette** (manuelles Einfügen, Polish — mit Parameter-Formularen).

### A7. GUI-Tests der neuen §18/§19-Features (zuerst! headless nicht verifiziert)
- [ ] **Bild-Positionierung:** Bild in eine Markdown-Zone, anklicken → Bubble-Toolbar erscheint → Größe (S/M/L/Voll), Ausrichtung, Umfluss wirken in Vorschau; speichern/öffnen → Attribute bleiben (im Markdown stehen `<img style/class>`).
- [ ] **Transitions:** Design-Tab → Übergang fade/slide/zoom + Dauer → Präsentationsmodus blättern → Animation greift (slide richtungsabhängig); `none` = unverändertes Verhalten.
- [ ] **HTML-Export („Teilen"):** speichert `.html`; im Browser öffnen → Folien + Tastatur/Klick-Nav + Bilder/Video inline funktionieren.
- [ ] **PDF („PDF"):** öffnet die print-Page im **Standardbrowser** (Tauri-Command `open_print_view` → Temp-Datei). Dort Cmd/Strg+P → „Als PDF sichern", Seitenformat 16:9, eine Folie pro Seite. (WKWebView-`window.print()` wird bewusst nicht genutzt — siehe Spec §18.4.)
- [ ] **Notizen:** Notizen-Panel pro Zone → Text erscheint in der Speaker-View.
- [ ] **Themes:** Theme-Picker im Design-Tab → Preset wendet Farben/Fonts live an.
- [ ] **Komponenten (MCP):** „füge ein Balkendiagramm/eine Timeline ein" → `insert_component` erzeugt token-bewusste HTML-Zone, live sichtbar, über Token-Sidebar umfärbbar.
- [ ] **MCP-Tools 30:** Claude Desktop neu starten → `set_zone_notes`, `set_zone_reveal`, `apply_preset`, `set_transition`, `list_components`/`insert_component` (inkl. `line_chart`/`donut_chart`) vorhanden.
- [ ] **Block-Drag (Medium, in der VORSCHAU):** in der rechten Vorschau über einen Block fahren → Drag-Handle (⠿) links erscheint → Block per Drag umsortieren; die Reihenfolge wird ins Markdown übernommen, nach Speichern/Öffnen erhalten. (Nur Markdown-Zonen ohne `split`; HTML/Spalten-Zonen ohne Handle.) **Pointer-Events** — nicht natives DnD.
- [ ] **Bild-Resize (in der VORSCHAU):** über ein Bild fahren → blauer Anfasser an der rechten Kante → ziehen skaliert die Breite stufenlos (5–100 %); beim Loslassen als `<img style="width:NN%">` gespeichert, im Editor/Export erhalten.
- [ ] **Spalten-UI (Medium):** Layout „Zwei Spalten" wählen → `+++`-Trenner wird automatisch eingefügt, Vorschau zeigt zwei Spalten; zurück auf „Zentriert" → Trenner weg, Inhalte zusammengeführt.
- [ ] **Builds (§19.1):** an einer Markdown-Folie das ⚡/„animation"-Icon in der ZoneToolbar aktivieren → Präsentieren → Pfeil/Leertaste blendet die Blöcke nacheinander ein (vor UND zurück), dann nächste Folie; Speaker-View zeigt „Schritt s/n"; `none` = altes Verhalten. KI: „blende die Punkte schrittweise ein" → `set_zone_reveal`.
- [ ] **Custom-Fonts (§19.4):** Design-Tab → „Schriften" → Hochladen (woff2/ttf) → Schrift in „Überschrift-/Fließtext-Font" wählen → wirkt in Vorschau/Präsentation; nach Speichern/Öffnen + im HTML-Export erhalten (Font ist eingebettet).
- [ ] **Suchen & Ersetzen (§19.9):** Cmd/Ctrl+F oder Topbar-Lupe → Begriff eingeben (Trefferzahl live) → „Alle ersetzen" wirkt über alle Folien; Undo (Cmd+Z) macht es rückgängig.
- [ ] **Logo (§19.4):** Design-Tab → „Logo" → Hochladen + Position → erscheint in der Ecke jeder Folie (auch Export/PDF); Entfernen funktioniert.
- [ ] **Templates (§19.4):** „Neu" → Vorlage wählen (Pitch/Vortrag/Editorial/Leer) → Deck wird mit Preset-Theme + Seed-Folien (inkl. Builds) angelegt.

### Polish / geparkt
- **Komponenten-Palette (manuell einfügen):** UI, die die 9 Rust-Komponenten (inkl. Charts) per Klick in die aktive Zone einsetzt — über einen Tauri-Command `render_component`, der denselben Generator nutzt (keine Template-Duplikation). Bewusst als **Polish** geparkt; richtig wertvoll erst mit **Parameter-Formularen** (z.B. Daten-Tabelle fürs Chart). Aktuell sind Komponenten über die KI (MCP `insert_component`) einsetzbar.

### Kleinere technische To-dos (unabhängig, bei Gelegenheit)
- **`slideoasset://` im Iframe absichern** (falls A5 fehlschlägt): Iframe-`sandbox` um benötigte Tokens erweitern oder gezielte CSP setzen (`media-src slideoasset: data:` etc.). Bilder bleiben Data-URI → kein Risiko.
- **Range-Requests** im Protocol-Handler ([src-tauri/src/lib.rs](../src-tauri/src/lib.rs)) für flüssiges Spulen großer Videos.
- ✅ **Editor-Bild-Vorschau** (erledigt): `SlideoImage.renderHTML` löst `assets/<name>` über [asset-resolver.ts](../src/lib/asset-resolver.ts) zur Data-URI auf (nur Anzeige; Markdown bleibt `assets/<name>`). Resolver wird im Store registriert.
- **Asset-Verwaltung**: umbenennen, ungenutzte aufräumen · **Drag&Drop**-Import.
- **Bundle-Größe:** Material-Symbols-Variable-Font (~3,6 MB) auf genutzte Icons subsetten.

### Größer / später (Spec §12)
- PPTX-Export, Custom-Fonts-Upload, Versionsverlauf/Git-UI, Kollaboration, echtes Speaker-Zweitfenster auf separatem Display.

---

## C. Distribution & Notarization

Ziel: signierte, notarisierte Builds, die ohne Gatekeeper-Warnung laufen.

### C0. Vorbereitung (alle Plattformen)
- App-Metadaten final: Name „Slideo", Identifier `app.slideo.desktop` ([src-tauri/tauri.conf.json](../src-tauri/tauri.conf.json)), Icon vorhanden.
- **Sicherheits-Review vor Release:** HTML-Zonen führen beliebiges JS im Iframe aus (gewollt), aber der Iframe ist isoliert (`sandbox="allow-scripts"`, keine Tauri-APIs im Iframe). CSP in `tauri.conf.json` ist aktuell `null` — vor Release **bewusst eine CSP setzen**, die Iframe-Funktion (Data-URI, `slideoasset:`, Inline-Styles/Scripts der Slides) erlaubt, aber Sonstiges einschränkt.
- MCP-Auto-Registrierung schreibt in die Claude-Config — im notarisierten `.app` zeigt `current_exe()` auf `/Applications/Slideo.app/Contents/MacOS/slideo`, das passt automatisch.

### C1. macOS — Signing & Notarization
**Voraussetzungen:** Apple Developer Program ($99/J), **Developer ID Application**-Zertifikat (Distribution außerhalb App Store), **kein** App-Sandbox nötig (nur für MAS), Hardened Runtime (von Tauri automatisch).

**Signing** (eine der Varianten):
- Zertifikat im Keychain → `APPLE_SIGNING_IDENTITY="Developer ID Application: <Name> (<TEAMID>)"`.
- Oder CI-tauglich: `APPLE_CERTIFICATE` (base64 der `.p12`) + `APPLE_CERTIFICATE_PASSWORD`.

**Notarization** (Tauri ruft `notarytool` automatisch bei `tauri build`, wenn gesetzt):
```bash
export APPLE_ID="dein@apple.id"
export APPLE_PASSWORD="app-spezifisches-passwort"   # appleid.apple.com → App-spezifische Passwörter
export APPLE_TEAM_ID="DEINE_TEAM_ID"
export APPLE_SIGNING_IDENTITY="Developer ID Application: … (TEAMID)"
npm run tauri build                                  # signiert + notarisiert + stapelt
```
- Ergebnis: `.dmg`/`.app` notarisiert; mit `xcrun stapler validate` prüfen.
- Bei WebView-/JIT-Problemen ggf. **Entitlements**-Datei setzen (`tauri.conf.json` → `bundle.macOS.entitlements`).
- Universal-Binary (arm64 + x86_64) erwägen: `tauri build --target universal-apple-darwin`.

### C2. Windows — Code Signing
- OV-/EV-Zertifikat (EV vermeidet SmartScreen-Reputation-Aufbau). Tauri-Signing via `bundle.windows.signCommand` oder Standard-Signtool-Env.
- WebView2 muss vorhanden sein (Evergreen-Runtime; Tauri kann Bootstrapper bündeln).
- Custom-Protocol-Variante `http://slideoasset.localhost/` testen.

### C3. Linux
- Keine Notarization. **AppImage** und/oder **.deb**/**.rpm** via `tauri build`.
- Laufzeitabhängigkeit: `webkit2gtk`.

### C4. Release-Hygiene
- Versionsschema/Changelog, ggf. Auto-Update (`tauri-plugin-updater`) mit Signaturschlüssel.
- Test der frischen Installation auf einem **sauberen** System (Gatekeeper-Verhalten, Claude-Config-Eintrag, MCP-Verbindung).
