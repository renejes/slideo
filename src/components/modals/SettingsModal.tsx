import { useCallback, useEffect, useState } from 'react'
import { Modal, modalGhostBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { useSettingsStore } from '@/store/settings'
import { useUiStore } from '@/store/ui'
import { notify } from '@/store/toast'
import { describeError, isTauri } from '@/lib/tauri'
import { pickDirectory } from '@/lib/dialog'
import { copyText } from '@/lib/onboarding'
import {
  getMcpStatus,
  setMcpTarget,
  type McpStatus,
  type McpTarget,
} from '@/lib/mcp-registration'
import { McpTargetCards, mcpTargetLabel } from '@/components/ui/McpTargetCards'
import { AssetLibrary } from '@/components/ui/AssetLibrary'
import { chatLogin, chatLogout, chatStatus, displayChatError } from '@/lib/chat/api'
import type { ChatStatus } from '@/lib/chat/chatTypes'
import { t, LOCALES, getLocale, getStoredLocale, setStoredLocale, tp, type Locale } from '@/i18n'
import { T } from '@/i18n/T'

// Einstellungen — bewusst als Shell angelegt, wird nach und nach gefüllt.
export function SettingsModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const openModal = useUiStore((s) => s.openModal)
  const defaultProjectDir = useSettingsStore((s) => s.defaultProjectDir)
  const setDefaultProjectDir = useSettingsStore((s) => s.setDefaultProjectDir)
  const tauri = isTauri()
  // Version zur Laufzeit aus der Tauri-Config statt hartkodiert (Befund S30: das
  // frühere `APP_VERSION = '0.1.0'` war eine dritte, driftende Wahrheit neben
  // package.json und tauri.conf.json).
  const [appVersion, setAppVersion] = useState<string | null>(null)
  useEffect(() => {
    if (!tauri) {
      setAppVersion('dev')
      return
    }
    void import('@tauri-apps/api/app')
      .then((m) => m.getVersion())
      .then(setAppVersion)
      .catch(() => setAppVersion(null))
  }, [tauri])

  async function choose() {
    const dir = await pickDirectory(defaultProjectDir)
    if (dir) setDefaultProjectDir(dir)
  }

  return (
    <Modal title={t('modal.settings.title')} onClose={closeModal} width="w-[34rem]">
      <div className="flex flex-col divide-y divide-chrome-border">
        {/* Allgemein */}
        <Section title={t('modal.settings.general')}>
          <Row
            label={t('modal.settings.defaultDir')}
            hint={t('modal.settings.defaultDirHint')}
          >
            {tauri ? (
              <div className="flex items-center gap-2">
                <span
                  className="max-w-[14rem] truncate text-[13px] text-chrome-text"
                  dir="rtl"
                  title={defaultProjectDir ?? ''}
                >
                  {defaultProjectDir || t('modal.settings.defaultDirFallback')}
                </span>
                <button className={modalGhostBtn} onClick={choose}>
                  {t('modal.settings.change')}
                </button>
                {defaultProjectDir && (
                  <button
                    className="rounded-md p-1.5 text-chrome-muted hover:bg-chrome-surface-2 hover:text-chrome-text"
                    onClick={() => setDefaultProjectDir(null)}
                    title={t('common.reset')}
                  >
                    <Icon name="close" size={16} weight={400} />
                  </button>
                )}
              </div>
            ) : (
              <span className="text-[12px] text-chrome-muted">{t('common.desktopOnly')}</span>
            )}
          </Row>
          <LanguageRow />
        </Section>

        <Section title={t('chat.cursorSection')}>
          <CursorAccount tauri={tauri} />
        </Section>

        {/* KI-Verbindung (MCP) */}
        <Section title={t('modal.settings.mcp')}>
          <McpConnection />
        </Section>

        {/* Assets — geteilt mit dem Asset-Manager (Topbar) */}
        <Section title={t('modal.settings.assets')}>
          <AssetLibrary />
        </Section>

        {/* Lizenz — aus der Topbar hierher verschoben (Befund M55). */}
        <Section title={t('modal.settings.license')}>
          <button
            onClick={() => openModal('license')}
            className="flex w-full items-center gap-2 rounded-lg border border-chrome-border px-3 py-2 text-left text-[13px] text-chrome-secondary transition-colors hover:border-chrome-border-strong hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
          >
            <Icon name="sell" size={17} weight={400} className="text-chrome-muted" />
            {t('modal.settings.licenseAction')}
          </button>
        </Section>

        {/* Über. Die „Bald verfügbar"-Sektion ist entfallen (Befund M64): sie kündigte
            Theme und Fonts an, die längst im Design-Overlay leben — sie versprach also
            als Zukunft, was bereits ausgeliefert war. */}
        <Section title={t('modal.settings.about')}>
          <div className="flex flex-col gap-1 py-1 text-[12px] text-chrome-muted">
            <div className="flex items-center gap-2">
              <span className="flex h-5 w-5 items-center justify-center rounded bg-chrome-accent-600 text-[11px] font-bold text-white">
                S
              </span>
              <span className="text-[13px] font-medium text-chrome-text">Slideo</span>
              <span>{t('modal.settings.version', { version: appVersion ?? '…' })}</span>
            </div>
            {/* Herstellerneutral (Befund M64): Slideo spricht MCP, nicht „Claude". */}
            <p>{t('modal.settings.aboutTagline')}</p>
          </div>
        </Section>
      </div>
    </Modal>
  )
}

function CursorAccount({ tauri }: { tauri: boolean }) {
  const [status, setStatus] = useState<ChatStatus | null>(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    if (!tauri) return
    try {
      setStatus(await chatStatus())
    } catch {
      setStatus(null)
    }
  }, [tauri])

  useEffect(() => {
    void load()
  }, [load])

  async function login(): Promise<void> {
    setBusy(true)
    setError('')
    try {
      const res = await chatLogin()
      if (!res?.ok) setError(displayChatError(res?.error || t('chat.loginFailed')))
      await load()
    } catch (e) {
      setError(describeError(e))
    } finally {
      setBusy(false)
    }
  }

  async function logout(): Promise<void> {
    await chatLogout()
    await load()
  }

  if (!tauri) {
    return <p className="py-1 text-[12px] text-chrome-muted">{t('chat.desktopOnly')}</p>
  }

  const daysLeft =
    status?.loggedIn && typeof status.expiresAt === 'number'
      ? Math.max(0, Math.ceil((status.expiresAt - Date.now()) / 86_400_000))
      : null

  return (
    <div className="flex flex-col gap-2 py-1">
      {status?.loggedIn && status.expired ? (
        <>
          <p className="text-[12px] text-chrome-muted">{t('chat.expired')}</p>
          <button className={modalGhostBtn} onClick={() => void login()} disabled={busy}>
            {t('chat.signIn')}
          </button>
        </>
      ) : status?.loggedIn ? (
        <>
          <p className="text-[13px] text-chrome-text">
            {status.email ? t('chat.signedInAs', { email: status.email }) : t('chat.signedIn')}
          </p>
          {daysLeft !== null && (
            <p className="text-[12px] text-chrome-muted">{tp('chat.expiresInDays', daysLeft)}</p>
          )}
          <p className="text-[12px] text-chrome-muted">{t('chat.cursorChatHint')}</p>
          <button className={modalGhostBtn} onClick={() => void logout()}>
            {t('chat.signOut')}
          </button>
        </>
      ) : (
        <>
          <p className="text-[12px] text-chrome-muted">{t('chat.signInBody')}</p>
          <button className={modalGhostBtn} onClick={() => void login()} disabled={busy}>
            {t('chat.signIn')}
          </button>
          {error && <p className="text-[12px] text-chrome-danger">{error}</p>}
        </>
      )}
      <p className="text-[12px] text-chrome-muted">{t('chat.disclaimer')}</p>
    </div>
  )
}

/**
 * Sprache der OBERFLÄCHE (Review 2026-08, Entscheidung E2 vom 2026-08-03).
 *
 * Der Wechsel wirkt bewusst erst nach einem Neustart, statt live. Live zu
 * schalten kostete fünf Kopplungspunkte quer durch die App — der
 * Tiptap-Placeholder wird einmalig in `useEditor()` konfiguriert, drei
 * Render-`useMemo` haben die Sprache nicht in ihren Abhängigkeiten,
 * `classifyPreviewChange` kennt sie nicht (die Vorschau behielte ihre alten
 * Tooltips), und das Projektor-Fenster ist ein eigener WebView ohne Store. Für
 * eine Einstellung, die man einmal setzt, ist eine Zeile Hinweistext der bessere
 * Handel. `applyLocale()` in `@/i18n` steht bereit, falls sich das ändern soll.
 *
 * NICHT zu verwechseln mit der Sprache der FOLIEN (`meta.language`, im
 * Design-Overlay) — die gehört zum Dokument und wandert mit der Datei.
 */
function LanguageRow() {
  const [choice, setChoice] = useState<Locale>(getStoredLocale())
  const pending = choice !== getLocale()

  return (
    <Row label={t('modal.settings.language')} hint={t('modal.settings.languageHint')}>
      <div className="flex items-center gap-2">
        {pending && (
          <span className="text-[11px] text-chrome-warn">{t('modal.settings.languageRestart')}</span>
        )}
        <select
          value={choice}
          onChange={(e) => {
            const next = e.target.value as Locale
            setStoredLocale(next)
            setChoice(next)
          }}
          aria-label={t('modal.settings.language')}
          className="rounded-md border border-chrome-border bg-white px-2 py-1 text-[13px] text-chrome-text transition-colors focus:border-chrome-accent focus:outline-none focus:ring-2 focus:ring-chrome-accent/30"
        >
          {LOCALES.map((l) => (
            <option key={l.value} value={l.value}>
              {l.label}
            </option>
          ))}
        </select>
      </div>
    </Row>
  )
}

// Auswahl, wo sich Slideo als MCP-Server anmeldet. Genau ein Ziel ist aktiv;
// der Rust-Backend-Command registriert es und meldet die anderen ab.
function McpConnection() {
  const tauri = isTauri()
  const [status, setStatus] = useState<McpStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState<McpTarget | null>(null)

  const refresh = useCallback(async () => {
    try {
      setStatus(await getMcpStatus())
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (tauri) void refresh()
    else setLoading(false)
  }, [tauri, refresh])

  async function choose(key: McpTarget) {
    if (busy || !status || key === status.target) return
    setBusy(key)
    try {
      const next = await setMcpTarget(key)
      setStatus(next)
      notify(t('modal.settings.mcpTargetActive', { target: mcpTargetLabel(key) }), 'success')
    } catch (e) {
      notify(describeError(e), 'error')
      // Realen Zustand zurückholen — der Wechsel wurde nicht übernommen.
      await refresh()
    } finally {
      setBusy(null)
    }
  }

  if (!tauri)
    return <p className="py-1 text-[12px] text-chrome-muted">{t('modal.desktopOnly')}</p>
  if (loading)
    return <p className="py-1 text-[12px] text-chrome-muted">{t('modal.mcpStatusLoading')}</p>
  if (!status)
    return (
      <p className="py-1 text-[12px] text-chrome-muted">
        {t('modal.settings.mcpStatusUnavailable')}
      </p>
    )

  return (
    <div className="flex flex-col gap-2.5 py-1">
      <p className="text-[12px] leading-relaxed text-chrome-muted">
        <T
          k="modal.settings.mcpIntro"
          slots={[
            <span className="text-chrome-secondary">
              {t('modal.settings.mcpIntroEmphasis')}
            </span>,
          ]}
        />
      </p>
      <McpTargetCards
        status={status}
        selected={status.target}
        busy={busy}
        disabled={!!busy}
        showActiveBadge
        onSelect={choose}
      />
      {/* Jeder andere MCP-Client (Review 2026-08, Befund H4/S33). Empty-State,
          Onboarding-Banner, Hilfe-Modal und diese Einstellungen versprechen viermal
          „beliebiger MCP-Client" und nennen Codex CLI — implementiert waren aber
          exakt drei Ziele. Cursor-, Windsurf-, Zed- und LM-Studio-Nutzer hatten
          keinerlei Pfad, obwohl `desired_entry` das nötige Objekt intern längst baut.
          Hier steht es kopierbar: Slideo trägt nichts ein, der Nutzer selbst schon. */}
      {status.genericConfig && (
        <div className="flex flex-col gap-1.5 rounded-lg border border-chrome-border bg-chrome-surface-2 px-3 py-2.5">
          <p className="text-[12px] font-medium text-chrome-secondary">
            {t('modal.settings.otherClient')}
          </p>
          <p className="text-[12px] leading-relaxed text-chrome-muted">
            <T
              k="modal.settings.otherClientHint"
              slots={[<code className="font-mono">mcpServers</code>]}
            />
          </p>
          <div className="flex items-start gap-2">
            <pre className="min-w-0 flex-1 overflow-x-auto rounded border border-chrome-border bg-chrome-surface px-2 py-1.5 font-mono text-[11px] leading-relaxed text-chrome-text">
              {JSON.stringify(status.genericConfig, null, 2)}
            </pre>
            <button
              onClick={() =>
                void copyText(JSON.stringify(status.genericConfig, null, 2)).then((ok) =>
                  notify(
                    ok ? t('modal.settings.configCopied') : t('modal.copyFailed'),
                    ok ? 'success' : 'error',
                  ),
                )
              }
              title={t('modal.settings.copyConfig')}
              aria-label={t('modal.settings.copyConfig')}
              className="shrink-0 rounded-md p-1.5 text-chrome-muted transition-colors hover:bg-chrome-surface hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
            >
              <Icon name="content_copy" size={16} weight={400} />
            </button>
          </div>
        </div>
      )}

      {status.lastError && (
        <div className="flex items-start gap-2 rounded-lg border border-chrome-warn/30 bg-chrome-warn-soft px-3 py-2">
          <Icon
            name="warning"
            size={16}
            weight={400}
            className="mt-0.5 shrink-0 text-chrome-warn"
          />
          <p className="text-[12px] leading-relaxed text-chrome-warn">
            {describeError(status.lastError)}
          </p>
        </div>
      )}
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="py-3.5 first:pt-0 last:pb-0">
      <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-wider text-chrome-muted">
        {title}
      </h3>
      {children}
    </div>
  )
}

function Row({
  label,
  hint,
  children,
}: {
  label: string
  hint?: string
  children: React.ReactNode
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-1.5">
      <div className="min-w-0">
        <div className="text-[13px] text-chrome-text">{label}</div>
        {hint && <div className="text-[11px] text-chrome-muted">{hint}</div>}
      </div>
      <div className="shrink-0">{children}</div>
    </div>
  )
}
