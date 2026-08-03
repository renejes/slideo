//! Lizenzierung + 30-Tage-Trial.
//!
//! Modell (aus Produkt-Entscheidung): 30 Tage voll nutzbare Demo (rein lokal, kein
//! Netz, keine Karte, keine Telemetrie), danach **read-only** (öffnen + exportieren
//! erlaubt, Erstellen/Bearbeiten gesperrt) bis eine Lizenz aktiviert wird.
//!
//! Bezahlte Lizenz über **Polar** (polar.sh, Merchant of Record). Der Client ruft die
//! öffentlichen `customer-portal`-Endpoints (validate/activate/deactivate) direkt —
//! sie brauchen NUR `key` + `organization_id` (öffentlich, darf ins Binary), KEIN
//! Secret, KEIN Backend. Aktiviert wird einmal online, danach läuft die App offline
//! (der lokale Cache ist der Vertrauensanker; offline wird NIE hart gesperrt).
//!
//! Grenzen (bewusst, aus der Recherche): Polar liefert kein offline verifizierbares
//! signiertes Artefakt → nur *casual* tamper-resistant. Der Trial-Zustand liegt in
//! `<config>/slideo/license.json` (leichter manipulierbar als ein Keychain, aber
//! Trial-Bypass ist niedrig-severity und wird bewusst nicht overengineert).

use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use sha2::{Digest, Sha256};
use std::path::PathBuf;
use std::sync::{Mutex, OnceLock};

// ───────────────── Konfiguration (PLATZHALTER — vom Menschen einzutragen) ─────────────────
// `organization_id` ist PUBLIC (kein Secret) und darf im Binary stehen. Beides aus dem
// Polar-Dashboard, sobald die Org + das Produkt (One-time, License-Keys-Benefit,
// activation_limit = 3, kein Ablauf) angelegt sind.
const POLAR_ORG_ID: &str = "REPLACE_WITH_POLAR_ORGANIZATION_ID";
const POLAR_CHECKOUT_URL: &str = "REPLACE_WITH_POLAR_CHECKOUT_LINK";

const POLAR_API_BASE: &str = "https://api.polar.sh/v1";
const TRIAL_DAYS: i64 = 30;

/// Versions-Entitlement: welche Polar-`benefit_id`s DIESES Build freischalten.
/// **LEER = permissiv** (jeder gültige Benefit gilt) → reines Perpetual, jede Version schaltet frei
/// (heutiges Verhalten, unverändert). Für einen **bezahlten Major-Upgrade-Pfad** (z.B. Slideo 2 als
/// eigenes Polar-Produkt mit eigenem License-Keys-Benefit) hier die benefit_id(s) eintragen, die
/// diese Version freischalten:
///   - v2-benefit **allein** → alte v1-Schlüssel schalten v2 NICHT frei → Zustand `upgrade_required`
///     (Nutzer kauft das Upgrade).
///   - v1-benefit **zusätzlich** aufnehmen → Gratis-/Grandfather-Upgrade für Bestandskunden.
/// (Nur *casual* durchgesetzt — wie der Rest der Lizenzierung.)
const POLAR_ENTITLED_BENEFIT_IDS: &[&str] = &[];

/// Ist die Polar-Anbindung schon konfiguriert (echte org_id eingetragen)?
fn configured() -> bool {
    !POLAR_ORG_ID.is_empty() && !POLAR_ORG_ID.starts_with("REPLACE_")
}

/// Checkout-URL, falls konfiguriert.
fn checkout_url() -> Option<&'static str> {
    if !POLAR_CHECKOUT_URL.is_empty() && !POLAR_CHECKOUT_URL.starts_with("REPLACE_") {
        Some(POLAR_CHECKOUT_URL)
    } else {
        None
    }
}

// ───────────────────────────── Persistenter Zustand ─────────────────────────────
#[derive(Serialize, Deserialize, Default, Clone)]
struct Store {
    trial_start: Option<String>,       // RFC3339 — beim Erststart gesetzt
    fp: Option<String>,                // Geräte-Fingerprint (Bindung)
    key: Option<String>,               // aktivierter Lizenzschlüssel
    key_display: Option<String>,       // maskiert (z.B. "****-E304DA")
    activation_id: Option<String>,     // Polar-Aktivierungs-ID dieses Geräts
    status: Option<String>,            // "granted" | "revoked" | "disabled"
    benefit_id: Option<String>,        // Polar-Benefit dieser Lizenz (Versions-Entitlement)
    expires_at: Option<String>,        // RFC3339 oder None (unbefristet)
    last_validated_at: Option<String>, // RFC3339 der letzten Online-Prüfung
}

/// Statusobjekt fürs Frontend + MCP-Gate.
#[derive(Serialize, Clone)]
pub struct LicenseStatus {
    pub state: String, // "licensed" | "trial" | "trial_expired" | "revoked" | "expired" | "upgrade_required"
    pub editing_allowed: bool,
    pub configured: bool,
    pub checkout_available: bool,
    pub trial_days_left: Option<i64>,
    pub key_display: Option<String>,
    pub expires_at: Option<String>,
}

// ───────────────────────────── Zeit / Fingerprint ─────────────────────────────
fn now() -> DateTime<Utc> {
    Utc::now()
}
fn parse(s: &str) -> Option<DateTime<Utc>> {
    DateTime::parse_from_rfc3339(s).ok().map(|d| d.with_timezone(&Utc))
}
fn iso(d: DateTime<Utc>) -> String {
    d.to_rfc3339_opts(chrono::SecondsFormat::Secs, true)
}

/// Stabiler, gehashter Geräte-Fingerprint (nie die rohe Hardware-ID senden).
fn fingerprint() -> String {
    let raw = machine_uid::get().unwrap_or_else(|_| "slideo-no-machine-id".to_string());
    let mut h = Sha256::new();
    h.update(b"slideo:");
    h.update(raw.as_bytes());
    h.finalize().iter().map(|b| format!("{b:02x}")).collect()
}

fn device_label() -> String {
    let host = std::env::var("HOSTNAME")
        .ok()
        .or_else(|| std::env::var("COMPUTERNAME").ok())
        .filter(|s| !s.is_empty());
    let os = std::env::consts::OS;
    match host {
        Some(h) => format!("Slideo — {h} ({os})"),
        None => format!("Slideo ({os})"),
    }
}

// ───────────────────────────── Storage (atomar) ─────────────────────────────
fn store_path() -> Option<PathBuf> {
    dirs::config_dir().map(|d| d.join("slideo").join("license.json"))
}

fn read_from_disk() -> Store {
    let Some(p) = store_path() else {
        return Store::default();
    };
    std::fs::read_to_string(&p)
        .ok()
        .and_then(|t| serde_json::from_str(&t).ok())
        .unwrap_or_default()
}

fn write_to_disk(s: &Store) -> Result<(), String> {
    let Some(path) = store_path() else {
        return Err(crate::errcode::code("license.noConfigDir"));
    };
    let dir = path
        .parent()
        .ok_or_else(|| crate::errcode::code("license.noParentDir"))?;
    std::fs::create_dir_all(dir).map_err(|e| e.to_string())?;
    let json = serde_json::to_string_pretty(s).map_err(|e| e.to_string())?;
    let tmp = dir.join(format!(".license-{}.tmp", uuid::Uuid::new_v4().simple()));
    std::fs::write(&tmp, json.as_bytes()).map_err(|e| e.to_string())?;
    std::fs::rename(&tmp, &path).map_err(|e| {
        let _ = std::fs::remove_file(&tmp);
        e.to_string()
    })
}

/// In-Memory-Cache des Store (damit `editing_allowed()` billig ist — der MCP-Gate
/// ruft es pro Tool-Call auf und soll nicht jedes Mal die Datei lesen).
fn cell() -> &'static Mutex<Store> {
    static CELL: OnceLock<Mutex<Store>> = OnceLock::new();
    CELL.get_or_init(|| Mutex::new(read_from_disk()))
}

fn save(s: Store) -> Result<(), String> {
    write_to_disk(&s)?;
    *crate::state::lock_recover(cell()) = s;
    Ok(())
}

// ───────────────────────────── Statuslogik ─────────────────────────────
/// Gilt der Benefit dieser Lizenz für dieses Build? (Versions-Entitlement.)
fn benefit_entitled(benefit_id: Option<&str>) -> bool {
    if POLAR_ENTITLED_BENEFIT_IDS.is_empty() {
        return true; // permissiv: reines Perpetual (jede Version)
    }
    match benefit_id {
        Some(id) => POLAR_ENTITLED_BENEFIT_IDS.contains(&id),
        // Unbekannter Benefit (alte Aktivierung ohne benefit_id) → nicht aussperren;
        // der Start-recheck() holt die benefit_id online nach und der Gate greift dann.
        None => true,
    }
}

fn compute(s: &Store) -> LicenseStatus {
    let mut out = LicenseStatus {
        state: "trial".into(),
        editing_allowed: false,
        configured: configured(),
        checkout_available: checkout_url().is_some(),
        trial_days_left: None,
        key_display: s.key_display.clone(),
        expires_at: s.expires_at.clone(),
    };

    // 0) SICHERUNG (Review 2026-08, Befund B9): Solange die Polar-Anbindung nicht
    //    konfiguriert ist, darf NIE limitiert werden. Vorher lief der Trial trotzdem
    //    ab, während Aktivieren UND Kaufen deaktiviert waren — die App war an Tag 31
    //    dauerhaft schreibgeschützt, ohne jeden Ausweg. Eine vergessene Konstante
    //    trennte einen Release von einer 30-Tage-Bombe beim Kunden.
    //    Der Release-Test unten (`konfiguration_ist_im_release_gesetzt`) stellt sicher,
    //    dass dieser Zweig nicht versehentlich zum Dauerzustand wird.
    if !configured() {
        out.state = "unconfigured".into();
        out.editing_allowed = true;
        return out;
    }

    // 1) Lizenz vorhanden?
    if s.key.is_some() {
        let status = s.status.as_deref().unwrap_or("");
        let expired = s
            .expires_at
            .as_deref()
            .and_then(parse)
            .map(|e| e <= now())
            .unwrap_or(false);
        let entitled = benefit_entitled(s.benefit_id.as_deref());
        if status == "granted" && !expired && entitled {
            out.state = "licensed".into();
            out.editing_allowed = true;
            return out;
        }
        if status == "granted" && !expired && !entitled {
            // Lizenz gültig, aber für eine andere (ältere) Version → bezahltes Upgrade nötig.
            out.state = "upgrade_required".into();
            return out;
        }
        if !status.is_empty() && status != "granted" {
            out.state = "revoked".into();
            return out;
        }
        if expired {
            out.state = "expired".into();
            return out;
        }
    }

    // 2) Trial
    if let Some(start) = s.trial_start.as_deref().and_then(parse) {
        // Uhr-Rückstellung soll die Demo nicht verlängern → elapsed nie negativ.
        let elapsed = (now() - start).num_days().max(0);
        let left = TRIAL_DAYS - elapsed;
        if left > 0 {
            out.state = "trial".into();
            out.editing_allowed = true;
            out.trial_days_left = Some(left);
        } else {
            out.state = "trial_expired".into();
            out.trial_days_left = Some(0);
        }
        return out;
    }

    // 3) Kein Trial-Start bekannt (vor ensure_trial) → als frischer Trial behandeln.
    out.editing_allowed = true;
    out.trial_days_left = Some(TRIAL_DAYS);
    out
}

/// Legt beim ersten Start den Trial-Beginn fest (idempotent, kein Netz).
pub fn ensure_trial() {
    let mut store = crate::state::lock_recover(cell());
    if store.trial_start.is_none() {
        store.trial_start = Some(iso(now()));
        if store.fp.is_none() {
            store.fp = Some(fingerprint());
        }
        let snapshot = store.clone();
        drop(store);
        let _ = save(snapshot);
    }
}

/// Aktueller Status (billig, kein Netz).
pub fn status() -> LicenseStatus {
    compute(&crate::state::lock_recover(cell()))
}

/// Ob Bearbeiten/Authoring erlaubt ist (Trial aktiv ODER gültige Lizenz).
/// Auch vom MCP-Gate (ipc.rs) genutzt, um mutierende Tools nach Ablauf zu sperren.
pub fn editing_allowed() -> bool {
    compute(&crate::state::lock_recover(cell())).editing_allowed
}

// ───────────────────────────── Polar-HTTP (unauthentifiziert) ─────────────────────────────
fn client() -> Result<Client, String> {
    Client::builder()
        .user_agent("Slideo")
        .build()
        .map_err(|e| e.to_string())
}

async fn http_activate(c: &Client, key: &str, fp: &str, label: &str) -> Result<String, String> {
    let body = json!({
        "key": key,
        "organization_id": POLAR_ORG_ID,
        "label": label,
        "meta": { "fp": fp }
    });
    let resp = c
        .post(format!("{POLAR_API_BASE}/customer-portal/license-keys/activate"))
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::errcode::code_with("license.networkActivate", e))?;
    let code = resp.status().as_u16();
    if code == 403 {
        return Err(crate::errcode::code("license.deviceLimit"));
    }
    if code == 404 {
        return Err(crate::errcode::code("license.notFoundCheckKey"));
    }
    if !resp.status().is_success() {
        return Err(crate::errcode::code_with("license.activateRejected", code));
    }
    let v: Value = resp
        .json()
        .await
        .map_err(|e| crate::errcode::code_with("license.badResponse", e))?;
    v.get("id")
        .and_then(|x| x.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| crate::errcode::code("license.activationIdMissing"))
}

async fn http_validate(c: &Client, key: &str, activation_id: Option<&str>) -> Result<Value, String> {
    let mut body = json!({
        "key": key,
        "organization_id": POLAR_ORG_ID
    });
    if let Some(a) = activation_id {
        body["activation_id"] = json!(a);
    }
    let resp = c
        .post(format!("{POLAR_API_BASE}/customer-portal/license-keys/validate"))
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::errcode::code_with("license.networkValidate", e))?;
    let code = resp.status().as_u16();
    if code == 404 {
        return Err(crate::errcode::code("license.notFound"));
    }
    if !resp.status().is_success() {
        return Err(crate::errcode::code_with("license.validateFailed", code));
    }
    resp.json()
        .await
        .map_err(|e| crate::errcode::code_with("license.badResponse", e))
}

async fn http_deactivate(c: &Client, key: &str, activation_id: &str) -> Result<(), String> {
    let body = json!({
        "key": key,
        "organization_id": POLAR_ORG_ID,
        "activation_id": activation_id
    });
    let resp = c
        .post(format!("{POLAR_API_BASE}/customer-portal/license-keys/deactivate"))
        .json(&body)
        .send()
        .await
        .map_err(|e| crate::errcode::code_with("license.networkDeactivate", e))?;
    let code = resp.status().as_u16();
    if !resp.status().is_success() && code != 204 {
        return Err(crate::errcode::code_with("license.deactivateFailed", code));
    }
    Ok(())
}

// ───────────────────────────── Öffentliche Aktionen ─────────────────────────────
/// Aktiviert einen Lizenzschlüssel auf diesem Gerät (activate → validate → Cache).
pub async fn activate(key: String) -> Result<LicenseStatus, String> {
    if !configured() {
        return Err(crate::errcode::code("license.notConfigured"));
    }
    let key = key.trim().to_string();
    if key.is_empty() {
        return Err(crate::errcode::code("license.keyEmpty"));
    }
    let fp = fingerprint();
    let c = client()?;
    // 1) Vorab prüfen (OHNE activation_id → verbraucht KEINEN Aktivierungs-Slot): Status +
    //    Versions-Entitlement, damit ein Schlüssel für eine andere Version nicht unnötig ein
    //    Gerät belegt, nur um danach abgelehnt zu werden.
    let pre = http_validate(&c, &key, None).await?;
    let pre_status = pre.get("status").and_then(|x| x.as_str()).unwrap_or("");
    if pre_status != "granted" {
        return Err(crate::errcode::code_with("license.notGranted", pre_status));
    }
    let benefit_id = pre.get("benefit_id").and_then(|x| x.as_str()).map(String::from);
    if !benefit_entitled(benefit_id.as_deref()) {
        return Err(crate::errcode::code("license.wrongVersion"));
    }
    // 2) Gerät aktivieren (bindet einen Slot) + final mit activation_id bestätigen.
    let activation_id = http_activate(&c, &key, &fp, &device_label()).await?;
    let v = http_validate(&c, &key, Some(&activation_id)).await?;
    let status = v.get("status").and_then(|x| x.as_str()).unwrap_or("").to_string();
    if status != "granted" {
        return Err(crate::errcode::code_with("license.notGranted", status));
    }
    let mut s = crate::state::lock_recover(cell()).clone();
    s.key = Some(key);
    s.key_display = v.get("display_key").and_then(|x| x.as_str()).map(String::from);
    s.activation_id = Some(activation_id);
    s.status = Some(status);
    s.benefit_id = v
        .get("benefit_id")
        .and_then(|x| x.as_str())
        .map(String::from)
        .or(benefit_id);
    s.expires_at = v.get("expires_at").and_then(|x| x.as_str()).map(String::from);
    s.last_validated_at = Some(iso(now()));
    s.fp = Some(fp);
    save(s.clone())?;
    Ok(compute(&s))
}

/// Re-Validiert die Lizenz online (beim Start). Offline/Fehler ⇒ Cache behalten
/// (nie hart sperren nur wegen fehlender Verbindung).
pub async fn recheck() -> Result<LicenseStatus, String> {
    let s0 = crate::state::lock_recover(cell()).clone();
    let (Some(key), Some(act)) = (s0.key.clone(), s0.activation_id.clone()) else {
        return Ok(status()); // keine Lizenz → reiner Trial-Status
    };
    if !configured() {
        return Ok(status());
    }
    let c = client()?;
    match http_validate(&c, &key, Some(&act)).await {
        Ok(v) => {
            let mut s = crate::state::lock_recover(cell()).clone();
            s.status = v.get("status").and_then(|x| x.as_str()).map(String::from);
            // benefit_id nachziehen (nötig für den Versions-Gate; alte Caches ohne benefit_id
            // bekommen ihn hier). Fehlt er in der Antwort, bestehenden Wert behalten.
            s.benefit_id = v
                .get("benefit_id")
                .and_then(|x| x.as_str())
                .map(String::from)
                .or(s.benefit_id.clone());
            s.expires_at = v.get("expires_at").and_then(|x| x.as_str()).map(String::from);
            s.last_validated_at = Some(iso(now()));
            save(s.clone())?;
            Ok(compute(&s))
        }
        Err(_) => Ok(status()), // offline / Polar nicht erreichbar → Cache gilt weiter
    }
}

/// Gibt dieses Gerät frei (Aktivierungs-Slot zurückgeben) und löscht die lokale Lizenz.
pub async fn deactivate() -> Result<LicenseStatus, String> {
    let s0 = crate::state::lock_recover(cell()).clone();
    if let (Some(key), Some(act)) = (s0.key.clone(), s0.activation_id.clone()) {
        if configured() {
            if let Ok(c) = client() {
                let _ = http_deactivate(&c, &key, &act).await; // best effort
            }
        }
    }
    let mut s = crate::state::lock_recover(cell()).clone();
    s.key = None;
    s.key_display = None;
    s.activation_id = None;
    s.status = None;
    s.expires_at = None;
    s.last_validated_at = None;
    save(s.clone())?;
    Ok(compute(&s))
}

// ───────────────────────────── Tauri-Commands ─────────────────────────────
#[tauri::command]
pub fn license_status() -> LicenseStatus {
    status()
}

#[tauri::command]
pub async fn license_activate(key: String) -> Result<LicenseStatus, String> {
    activate(key).await
}

#[tauri::command]
pub async fn license_recheck() -> Result<LicenseStatus, String> {
    recheck().await
}

#[tauri::command]
pub async fn license_deactivate() -> Result<LicenseStatus, String> {
    deactivate().await
}

/// Öffnet die Polar-Checkout-Seite im Standardbrowser.
#[tauri::command]
pub fn license_open_checkout() -> Result<(), String> {
    let url = checkout_url()
        .ok_or_else(|| crate::errcode::code("license.checkoutNotConfigured"))?;
    crate::commands::open_in_default_app(std::path::Path::new(url))
}

#[cfg(test)]
mod tests {
    use super::*;

    fn store_expired_trial() -> Store {
        let mut s = Store::default();
        // Trial-Start weit in der Vergangenheit → wäre normalerweise "trial_expired".
        s.trial_start = Some(iso(now() - chrono::Duration::days(TRIAL_DAYS + 5)));
        s
    }

    #[test]
    fn unkonfiguriert_limitiert_nie() {
        // Befund B9: ohne Polar-Konfiguration gibt es keinen Kaufweg — dann darf der
        // Trial-Ablauf auch nicht sperren, sonst ist die App dauerhaft schreibgeschützt.
        if configured() {
            // In einem konfigurierten Build ist dieser Zweig unerreichbar; der Test
            // unten deckt dann den Release-Fall ab.
            return;
        }
        let out = compute(&store_expired_trial());
        assert_eq!(out.state, "unconfigured");
        assert!(out.editing_allowed, "unkonfiguriert darf NIE schreibschützen");
        assert!(!out.configured);
    }

    #[test]
    fn abgelaufener_trial_sperrt_nur_im_konfigurierten_build() {
        if !configured() {
            return; // s.o.
        }
        let out = compute(&store_expired_trial());
        assert_eq!(out.state, "trial_expired");
        assert!(!out.editing_allowed);
        assert!(
            out.checkout_available,
            "ein sperrender Build MUSS einen Kaufweg anbieten"
        );
    }

    #[test]
    #[ignore = "Release-Gate: vor dem Signieren mit `cargo test -- --ignored` ausfuehren"]
    fn konfiguration_ist_im_release_gesetzt() {
        // Verhindert genau den Auslieferungsfehler aus B9: ein Build mit
        // REPLACE_WITH_… geht nicht an Kunden.
        assert!(
            configured(),
            "POLAR_ORG_ID ist noch ein Platzhalter — vor dem Release eintragen"
        );
        assert!(
            checkout_url().is_some(),
            "POLAR_CHECKOUT_URL ist noch ein Platzhalter — vor dem Release eintragen"
        );
    }

    #[test]
    fn laufender_trial_erlaubt_bearbeiten() {
        let mut s = Store::default();
        s.trial_start = Some(iso(now() - chrono::Duration::days(3)));
        let out = compute(&s);
        assert!(out.editing_allowed);
        if configured() {
            assert_eq!(out.state, "trial");
            assert_eq!(out.trial_days_left, Some(TRIAL_DAYS - 3));
        }
    }
}
