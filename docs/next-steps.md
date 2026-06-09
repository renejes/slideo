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

> Der detaillierte, umsetzungsreife Plan (Datenmodell / Store / Renderer / MCP / UI + Aufwand pro Feature) steht in **Spec §18 (Roadmap)**. Hier nur die Reihenfolge + Querverweise. Empfohlene Reihenfolge laut §18.8:

1. **Speaker-Notes-Editor** + `set_zone_notes` — §18.2 (klein).
2. **Export self-contained HTML** + **Teilen** — §18.4 / §18.5 (macht es benutzbar/teilbar).
3. **Themes / Presets** — §18.6 (klein, viel Wirkung).
4. **Folien-Transitions** — §18.3 (mittel).
5. **Asset-Positionierung**: erst **Light** (Bild-Toolbar: Größe/Ausrichtung/Float), dann **Medium** (Block-Drag + Slots) — §18.1. Free-Canvas „Large" bewusst zurückgestellt.
6. **Interaktivität**: **Agenten-Skill erweitern** (KI kennt das volle Repertoire) + **Komponenten-Bibliothek** (token-bewusste, fertige Snippets via `list_components`/`insert_component`) — §18.7. Iterativ wachsen lassen.
7. **PDF-Export** — §18.4 (mittel).

### Kleinere technische To-dos (unabhängig, bei Gelegenheit)
- **`slideoasset://` im Iframe absichern** (falls A5 fehlschlägt): Iframe-`sandbox` um benötigte Tokens erweitern oder gezielte CSP setzen (`media-src slideoasset: data:` etc.). Bilder bleiben Data-URI → kein Risiko.
- **Range-Requests** im Protocol-Handler ([src-tauri/src/lib.rs](../src-tauri/src/lib.rs)) für flüssiges Spulen großer Videos.
- **Editor-Bild-Vorschau:** `assets/…`-Bilder zeigen im Editor-Card noch einen Platzhalter (App-WebView löst `assets/` nicht auf). Auflösen via Reverse-Mapping oder eigenem Bild-Node (passt gut zu §18.1 Light).
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
