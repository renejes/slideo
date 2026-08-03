# macOS: signieren, notarisieren, ausliefern

> Vorbereitet in der Review-Session 2026-08-03 (Maßnahme #11). Die Konfiguration steht;
> was fehlt, sind nur noch **deine** Zertifikats-/Account-Werte und ein Durchlauf.
> Frist: **Homebrew deaktiviert ab 01.09.2026 alle Casks, die den Gatekeeper-Check nicht bestehen.**

## Was bereits konfiguriert ist

In [`src-tauri/tauri.conf.json`](../src-tauri/tauri.conf.json):

- `bundle.macOS.minimumSystemVersion: "10.15"` — untere Grenze für WKWebView-Features, die Slideo nutzt.
- `bundle.macOS.signingIdentity: null` — **bewusst null**: Tauri nimmt dann `APPLE_SIGNING_IDENTITY`
  aus der Umgebung. So liegt die Identität nicht im Repo und CI und lokaler Build verhalten sich gleich.
- `copyright` / `category` / `shortDescription` / `longDescription` — von `notarytool` und dem Finder gelesen.
- `fileAssociations` für `.slideo` — Doppelklick öffnet Slideo (Review-Befund M22).
- **Kein Entitlements-File.** Tauri aktiviert Hardened Runtime automatisch; eine normale WKWebView-App
  braucht keine zusätzlichen Entitlements. Überflüssige Entitlements können die Notarisierung eher
  *behindern* — deshalb erst hinzufügen, wenn ein konkreter Laufzeitfehler es verlangt (siehe unten).

## Einmalig prüfen

```bash
# Welche Developer-ID-Zertifikate liegen im Schlüsselbund?
security find-identity -v -p codesigning
```

Gesucht ist eine Zeile mit **„Developer ID Application: … (TEAMID)"** — nicht „Apple Development"
(das ist ein Entwicklungszertifikat und taugt nicht für Verteilung außerhalb des App Store).
Fehlt sie: im Apple-Developer-Portal unter *Certificates* ein **Developer ID Application**-Zertifikat
anlegen und installieren.

Team-ID findest du im Portal oben rechts oder in der Klammer der Zertifikatszeile.

## Bauen

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: DEIN NAME (TEAMID)"
export APPLE_ID="deine@apple.id"
export APPLE_PASSWORD="app-spezifisches-passwort"   # appleid.apple.com → Anmeldung & Sicherheit → App-spezifische Passwörter
export APPLE_TEAM_ID="TEAMID"

npm run tauri build
```

Sind alle vier gesetzt, signiert **und** notarisiert Tauri automatisch und heftet das Ticket an
(`stapler`). Ohne `APPLE_ID`/`APPLE_PASSWORD`/`APPLE_TEAM_ID` wird nur signiert — das reicht **nicht**
für einen warnungsfreien Start auf einem fremden Rechner.

### Universal Binary (Intel + Apple Silicon)

```bash
rustup target add x86_64-apple-darwin aarch64-apple-darwin
npm run tauri build -- --target universal-apple-darwin
```

Empfohlen für eine öffentliche Auslieferung — sonst startet die App auf Intel-Macs nicht.

## Verifizieren

```bash
APP="src-tauri/target/release/bundle/macos/Slideo.app"

codesign --verify --deep --strict --verbose=2 "$APP"   # Signatur intakt?
xcrun stapler validate "$APP"                          # Notarisierungs-Ticket angeheftet?
spctl -a -vvv -t install "$APP"                        # Gatekeeper: "accepted / Notarized Developer ID"
```

**Der eigentliche Test** ist ein anderer: `.dmg` auf einen **sauberen** Mac kopieren (oder per
`xattr -w com.apple.quarantine` das Quarantäne-Flag simulieren) und öffnen. Nur so siehst du, was ein
Kunde sieht.

## Wenn die Notarisierung fehlschlägt

```bash
xcrun notarytool history --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
xcrun notarytool log <submission-id> --apple-id "$APPLE_ID" --team-id "$APPLE_TEAM_ID" --password "$APPLE_PASSWORD"
```

Das Log nennt die verletzende Datei konkret. Häufigste Ursachen bei Tauri-Apps: eine nicht signierte
mitgebündelte Binärdatei, oder eine Bibliothek ohne Hardened Runtime.

**Erst wenn die App zwar startet, aber ein Laufzeitfehler auf fehlende Rechte hindeutet**, ein
Entitlements-File anlegen und in `bundle.macOS.entitlements` eintragen — und dann nur das, was
tatsächlich fehlt. Nicht vorsorglich.

## Danach

- **Windows** braucht einen eigenen Signaturpfad (OV-Zertifikat mit HSM, ~150–300 $/Jahr; Azure
  Artifact Signing ist für *Einzelentwickler* auf USA/Kanada begrenzt — ein deutscher Einzelunternehmer
  braucht eine EU-Organisation oder ein klassisches OV-Zertifikat).
- **Auto-Updater** (`tauri-plugin-updater`) — braucht ein eigenes Signaturschlüsselpaar
  (`npm run tauri signer generate`) und einen Ort für das Update-Manifest. Bei einer Perpetual-Lizenz
  ist der Wert nach Jahr eins genau dieser Updatepfad; ohne ihn ist das Angebot inkohärent.
- **Frischinstallations-Test** auf einem sauberen System: Gatekeeper, MCP-Registrierung in die
  Client-Config, erster Tool-Call (der neue Verbindungs-Chip zeigt es).
