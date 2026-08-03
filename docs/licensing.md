# Slideo — Lizenzierung (Trial + Polar)

> Umgesetzt 2026-07-15. **30-Tage-Demo (rein lokal)** → danach **read-only**, bis eine **Polar**-Lizenz
> (Einmalkauf, unbefristet, 3 Geräte) aktiviert wird. **Kein Backend, kein Secret** — der Client ruft Polars
> öffentliche `customer-portal`-Endpoints direkt. Code: [../src-tauri/src/license.rs](../src-tauri/src/license.rs).

## Wie es funktioniert

- **Trial:** Beim ersten Start wird ein Zeitstempel lokal gespeichert (`<config>/slideo/license.json`).
  30 Tage lang ist die App voll nutzbar — **kein Polar-Kontakt, keine Karte, keine Telemetrie**.
- **Nach Ablauf → read-only:** Öffnen, **Speichern** und Exportieren bleiben möglich; **Erstellen und
  Bearbeiten** sind gesperrt (auch über den **MCP-/KI-Kanal** — sonst wäre die Demo trivial umgehbar).
  Eine Leiste unter der Topbar ([LicenseBar](../src/components/ui/LicenseBar.tsx)) weist darauf hin.
  *Speichern ist bewusst erlaubt* (`save_presentation` steht auf der Read-only-Allowlist in
  [tools.rs](../src-tauri/src/tools.rs) `is_read_only_tool`): es schreibt nur, was ohnehin im Store
  steht, und ein gesperrtes Speichern würde den Close-Guard in eine Schleife schicken. Bis zum Review
  2026-08 behauptete dieser Abschnitt das Gegenteil (Befund S28) — Doku und Code widersprachen sich.
- **Ohne konfigurierte Polar-Werte wird NIE limitiert** (Befund B9): solange `POLAR_ORG_ID` ein
  Platzhalter ist, liefert `compute()` den Zustand `unconfigured` und erlaubt volles Bearbeiten.
  Sonst wäre jeder Build ohne Konfiguration eine 30-Tage-Bombe ohne Kaufweg. Der ignorierte Test
  `konfiguration_ist_im_release_gesetzt` (`cargo test -- --ignored`) ist das Release-Gate dagegen.
- **Lizenz:** Der Nutzer kauft auf Polar (System-Browser), kopiert seinen `SLIDEO_…`-Schlüssel aus dem
  Polar-Kundenportal und fügt ihn im **Lizenz-Modal** ([LicenseModal](../src/components/modals/LicenseModal.tsx))
  ein. Der Client ruft **activate** (bindet das Gerät, Limit 3) → **validate** und cached das Ergebnis lokal.
- **Offline:** Nach der einmaligen Online-Aktivierung läuft die App offline weiter; ein Re-Check beim Start
  aktualisiert den Cache, wenn online. **Offline wird nie hart gesperrt** (der Cache gilt weiter).

## Einrichtung auf Polar (einmalig — nur der Mensch)

1. Org auf [polar.sh](https://polar.sh) anlegen (Merchant of Record; kümmert sich um Steuer/VAT).
2. **Produkt** „Slideo" als **Einmalkauf** (~$99) erstellen.
3. Dem Produkt den **License-Keys-Benefit** hinzufügen:
   - **Prefix:** `SLIDEO`
   - **Expiry:** *keiner* (unbefristet → `expires_at: null`)
   - **Activation limit:** `3`
4. Einen **Checkout-Link** für das Produkt erstellen (Dashboard → Checkout Links).
5. Die beiden öffentlichen Werte notieren:
   - **`organization_id`** (Settings → General; ist **öffentlich**, kein Secret)
   - die **Checkout-Link-URL**

> **Fees (Stand 2026):** neue Orgs starten auf **Starter (5 % + 50 ¢** pro Transaktion, **+1,5 %** auf
> internationale Karten). Merchant of Record = keine eigene Steuer-Registrierung nötig.

## Werte im Code eintragen

In [../src-tauri/src/license.rs](../src-tauri/src/license.rs) die zwei Platzhalter ersetzen:

```rust
const POLAR_ORG_ID: &str = "REPLACE_WITH_POLAR_ORGANIZATION_ID";   // → deine organization_id
const POLAR_CHECKOUT_URL: &str = "REPLACE_WITH_POLAR_CHECKOUT_LINK"; // → deine Checkout-URL
```

Bis das gesetzt ist, läuft der **Trial normal**; „Kaufen/Aktivieren" zeigen „noch nicht konfiguriert".
Danach **`cargo build`** (+ neue App starten). Zum Testen zuerst gegen die **Sandbox** (`sandbox-api.polar.sh`)
mit einer Sandbox-Org — dafür in `license.rs` `POLAR_API_BASE` temporär auf die Sandbox-URL zeigen lassen.

## Update-/Upgrade-Pfad (bezahlte Major-Versionen) — vorbereitet

Der Code ist **jetzt schon** für einen bezahlten Upgrade-Pfad vorbereitet, ohne heute etwas zu ändern (per
Versions-Entitlement über die Polar-`benefit_id`).

- **Heute:** `POLAR_ENTITLED_BENEFIT_IDS` in [../src-tauri/src/license.rs](../src-tauri/src/license.rs) ist **leer =
  permissiv** → reines Perpetual: jeder gültige Schlüssel schaltet **jede** Version frei. (Nie updaten? Schadet nicht.)
- **Für z.B. Slideo 2 als bezahltes Upgrade:**
  1. Auf Polar ein **eigenes Produkt** „Slideo 2" mit **eigenem License-Keys-Benefit** anlegen → eigene `benefit_id`.
  2. Im **v2-Build** in `POLAR_ENTITLED_BENEFIT_IDS` die **v2-`benefit_id`** eintragen (aus dem Polar-Dashboard):
     - **nur** die v2-benefit → alte v1-Schlüssel schalten v2 **nicht** frei → Zustand **`upgrade_required`**
       (Nutzer sieht „Upgrade nötig", read-only);
     - v1-benefit **zusätzlich** eintragen → **Gratis-/Grandfather-Upgrade** für Bestandskunden.
  3. Optional `POLAR_CHECKOUT_URL` im v2-Build auf den Upgrade-Checkout zeigen (Polar-Coupon für Bestandskunden möglich).

Die App speichert die `benefit_id` bei Aktivierung/Prüfung; der Gate greift, sobald die Liste nicht leer ist. Vor der
Aktivierung wird der Schlüssel **ohne Slot-Verbrauch** vorab geprüft — ein Schlüssel für die falsche Version belegt also
kein Gerät. **Vor dem Scharfstellen** in der Polar-**Sandbox** gegenprüfen, dass `benefit_id` in der `validate`-Antwort steckt.

## Grenzen (bewusst, aus der Recherche)

- **Kein offline verifizierbares signiertes Artefakt** von Polar → der lokale Cache/Trial-Record ist der
  Vertrauensanker, also nur *casual* tamper-resistant (Trial per Uhr-Reset/VM/Datei-Löschen umgehbar). Laut
  Polar-Empfehlung bewusst **nicht** overengineert (Trial-Bypass ist niedrig-severity). Für echte
  Krypto-offline-Lizenzierung später optional **Keygen/Keyforge** *auf* Polar aufsetzen.
- **Schlüssel-Zustellung per Copy/Paste** aus dem Polar-Kundenportal (kein Auto-Push in die laufende App).
- **Datenschutz:** Während des Trials verlässt nichts das Gerät. Bei Aktivierung/Prüfung gehen nur
  `key` + `organization_id` (+ ein **gehashter** Geräte-Fingerprint) an `api.polar.sh`; nie Deck-Inhalte.

## Verhalten in Kürze

| Zustand | Bearbeiten | Öffnen/Speichern/Export | MCP-Mutationen |
|---|---|---|---|
| **Unkonfiguriert** (Polar-Platzhalter) | ✅ | ✅ | ✅ |
| Trial (Tag 1–30) | ✅ | ✅ | ✅ |
| Trial abgelaufen / widerrufen / abgelaufen / **Upgrade nötig** | ❌ (read-only) | ✅ | ❌ (gesperrt) |
| Lizenziert | ✅ | ✅ | ✅ |

Im read-only-Zustand sind der Markdown- **und** beide CodeMirror-Editoren tatsächlich gesperrt
(`setEditable` bzw. ein `Compartment`) — vorher nahmen sie Eingaben entgegen, die der Store still
verwarf (Befund B2).

Geräte-Umzug: im Lizenz-Modal **„Gerät freigeben"** (gibt den Aktivierungs-Slot zurück) oder im
Polar-Kundenportal deaktivieren.
