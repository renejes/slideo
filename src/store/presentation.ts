import { create } from 'zustand'
import {
  type Presentation,
  type Zone,
  type ZoneStyle,
  type ContentType,
  type DesignTokens,
  type AssetMap,
  type Asset,
  type TransitionKind,
  type RevealMode,
  type LogoPosition,
  DEFAULT_TOKENS,
  DEFAULT_ZONE_STYLE,
  FILE_FORMAT_VERSION,
} from '@/types'
import { markdownToHtml, splitMarkdownBlocks, setBlockImageWidth } from '@/lib/markdown-tiptap'
import { applyElementOp, applyFreezeLayout, type ElementOp, type OpPayload, type FreezeItem } from '@/lib/dom-edit'
import { renderStandalonePage, renderPrintPage } from '@/lib/renderer'
import { exportPdfViaPrint } from '@/lib/print'
import { findPreset } from '@/lib/presets'
import type { DeckTemplate } from '@/lib/templates'
import { setAssetResolver } from '@/lib/asset-resolver'
import { normalizePresentation } from '@/lib/normalize'
import {
  assetsToMap,
  mapToAssets,
  parseDataUri,
  mimeToExt,
  mediaKind,
  shortId,
  familyFromName,
  extFromName,
} from '@/lib/assets'
import { useLicenseStore } from './license'
import { useSettingsStore } from './settings'
import {
  loadPresentationFile,
  savePresentationFile,
  pickOpenPath,
  pickSavePath,
  pickExportHtmlPath,
  exportHtmlFile,
  openPrintView,
  pickExportPptxPath,
  exportPptxFile,
  createSnapshot as createSnapshotCmd,
  restoreSnapshot as restoreSnapshotCmd,
  recoveryWrite,
  recoveryClear,
  recoveryTake,
  describeError,
  type RecoveryInfo,
  isTauri,
} from '@/lib/tauri'
import { notify } from '@/store/toast'
import { t, getLocale } from '@/i18n'

type Mode = 'editor' | 'presentation'

interface PresentationState {
  // Daten
  presentation: Presentation | null
  filePath: string | null
  isDirty: boolean
  /** Asset-Map: Dateiname → Data-URI (Bilder etc., separat von presentation.json). */
  assets: AssetMap

  // UI State
  activeZoneId: string | null
  mode: Mode
  activeSlideIndex: number

  // Undo-/Redo-History (strukturelle/Design-Änderungen; Texteingaben haben Editor-Undo)
  past: HistoryEntry[]
  /** Zurückgenommene Stände (Review 2026-08, Befund H1 — Redo fehlte komplett). */
  future: HistoryEntry[]
  undo: () => void
  redo: () => void

  // Lifecycle
  /** Legt ein neues Deck an. Gibt `false` zurück, wenn das Lizenz-Gate ablehnt —
   *  Aufrufer MÜSSEN das prüfen (Befund H14: sonst wurde das ALTE Deck unter dem
   *  neuen Namen gespeichert). */
  newPresentation: (title: string, template?: DeckTemplate) => boolean
  loadPresentation: (path: string) => Promise<void>
  openPresentationDialog: () => Promise<void>
  savePresentation: (path?: string) => Promise<void>
  savePresentationAsDialog: () => Promise<void>
  exportHtml: () => Promise<void>
  exportPdf: () => Promise<void>
  exportPptx: () => Promise<void>

  // Zones
  createZone: (afterId?: string, markdown?: string) => string
  /**
   * Dupliziert eine Folie samt Stil, Notizen, CSS und Reveal-Modus direkt dahinter
   * (Review 2026-08, Befund H2). Fehlte komplett — weder UI noch MCP —, obwohl es
   * die haeufigste Bewegung beim Editieren ueber einen KI-Entwurf ist. Die Kopie
   * bekommt eine NEUE UUID (sonst kollidieren Zonen-Links und der Patch-Klassifikator).
   * Gibt die ID der Kopie zurueck (leer, wenn abgelehnt).
   */
  duplicateZone: (id: string) => string
  deleteZone: (id: string) => void
  updateZoneMarkdown: (id: string, markdown: string) => void
  updateZoneHtml: (id: string, html: string) => void
  updateZoneCss: (id: string, css: string) => void
  setZoneContentType: (id: string, contentType: ContentType) => void
  updateZoneStyle: (id: string, style: Partial<ZoneStyle>) => void
  updateZoneLabel: (id: string, label: string) => void
  updateZoneNotes: (id: string, notes: string) => void
  /** Ersetzt alle Vorkommen deck-weit (Markdown- bzw. HTML-Inhalt). Gibt die Anzahl zurück. */
  replaceAllInDeck: (search: string, replace: string) => number
  /** Schaltet Builds (schrittweises Einblenden) für eine Zone (Spec §19.1). */
  setZoneReveal: (id: string, mode: RevealMode) => void
  /** Setzt das Layout und verwaltet bei 'split' den '+++'-Spaltentrenner automatisch. */
  setZoneLayout: (id: string, layout: ZoneStyle['layout']) => void
  /** Sortiert die Markdown-Blöcke einer Zone um (Drag in der Vorschau). */
  reorderZoneBlocks: (id: string, order: number[]) => void
  /** Direktmanipulation für Markdown-Blöcke (editor-cleanup Punkt 3): einen Top-Level-
   *  Block in der Vorschau löschen bzw. duplizieren — über splitMarkdownBlocks +
   *  Reassemble (`\n\n`), undoable (recordHistory). Flussmodell bleibt unberührt. */
  deleteZoneBlock: (id: string, blockIndex: number) => void
  duplicateZoneBlock: (id: string, blockIndex: number) => void
  /** Inline-Text-Edit eines Markdown-Blocks (Punkt 3b): ersetzt blockIndex durch
   *  `markdown` (vom Konverter htmlBlockToMarkdown). Leerer Block wird nicht erzeugt. */
  editZoneBlock: (id: string, blockIndex: number, markdown: string) => void
  /** Setzt die Breite eines Bildes (Resize-Anfasser in der Vorschau), z.B. "63%". */
  resizeZoneImage: (id: string, blockIndex: number, imgIndex: number, width: string) => void
  /**
   * Direktmanipulation in der Vorschau (Spec §20): wendet eine Element-Operation
   * (löschen/duplizieren/Text/verschieben) auf das `zone.html` einer HTML-Zone an,
   * adressiert über den Kind-Index-Pfad ab `.slideo-content`. recordHistory=true
   * (diskrete Edits → Cmd/Z). No-op bei Nicht-HTML-Zonen oder ungültigem Pfad.
   */
  applyZoneElementOp: (
    zoneId: string,
    path: number[],
    op: ElementOp,
    payload?: OpPayload,
  ) => void
  /**
   * „Folie einfrieren" (Spec §20): pinnt mehrere Elemente einer HTML-Zone absolut
   * an ihre aktuelle Position+Größe (beim ersten Verschieben → freies Anordnen ohne
   * Reflow). recordHistory=true → ein Cmd/Z macht das gesamte Einfrieren rückgängig.
   */
  freezeZoneLayout: (zoneId: string, items: FreezeItem[]) => void
  reorderZones: (orderedIds: string[]) => void

  /**
   * Setzt eine fertig gerenderte Komponenten-HTML in eine Zone (Spec §18.7,
   * Komponenten-Palette). Das HTML kommt vom Rust-Generator (`render_component`).
   * placement: 'new' = neue HTML-Folie nach targetZoneId; 'append' = an die
   * (HTML-)Zielzone anhängen; 'replace' = Zielzone-Inhalt durch HTML ersetzen.
   */
  insertComponent: (opts: {
    targetZoneId: string | null
    placement: 'new' | 'append' | 'replace'
    html: string
  }) => void

  // Assets
  addMediaToZone: (zoneId: string, dataUri: string) => void
  /** Ein bereits in der Library liegendes Asset (per Name) in eine Zone einfügen. */
  insertAssetIntoZone: (zoneId: string, assetName: string) => void
  addAssetToLibrary: (dataUri: string) => string
  /** Wie oft ein Asset im Deck referenziert wird (Folien, Logo, Fonts) — Befund H3. */
  countAssetRefs: (name: string) => number
  removeAsset: (name: string) => void
  /** Lädt eine Schriftdatei als Asset + registriert sie als Font (Spec §19.4). */
  addFont: (dataUri: string, fileName: string) => void
  /** Setzt das Marken-Logo (Bild-Asset auf jeder Folie, Spec §19.4). */
  setLogo: (dataUri: string) => void
  setLogoPosition: (position: LogoPosition) => void
  clearLogo: () => void

  // Tokens
  setToken: (key: string, value: string) => void
  setTokensBulk: (tokens: Record<string, string>) => void
  resetTokens: () => void
  applyPreset: (name: string) => void

  // Versionshistorie (Spec §19.9): lokale `.slideo`-Snapshots
  /** Erstellt manuell einen Snapshot (mit optionaler Beschriftung). Gibt true zurück, wenn geschrieben. */
  createSnapshot: (label?: string) => Promise<boolean>
  /** Stellt einen Snapshot wieder her (undoable; Dateipfad bleibt — zum Übernehmen speichern). */
  restoreSnapshot: (id: string) => Promise<void>

  /**
   * Benennt das Deck um (Review 2026-08, Befund H8). Schreiber waren bisher nur
   * `makePresentation` und das MCP-Tool `set_presentation_title` — der Agent hatte
   * also mehr Hoheit über den Namen des Decks als sein Besitzer, obwohl `meta.title`
   * Topbar, Export-Dateinamen, Standalone-<title>, Print und PPTX treibt.
   */
  setPresentationTitle: (title: string) => void

  // Präsentation (deck-weit)
  setTransition: (kind: TransitionKind, durationMs?: number) => void
  /** Sprache der Folien (`meta.language`) — steuert `lang`, Silbentrennung, Rechtschreibprüfung. */
  setDeckLanguage: (language: string) => void

  // UI
  setActiveZone: (id: string | null) => void
  setMode: (mode: Mode) => void
  setActiveSlide: (index: number) => void
  nextSlide: () => void
  prevSlide: () => void

  // MCP: extern (über den MCP-Server) gelieferten State anwenden
  applyExternalPresentation: (presentation: Presentation, zoneIds?: string[]) => void
  /**
   * Der MCP-Server hat ein ANDERES Deck geöffnet bzw. angelegt (Befund B3).
   * Zieht Presentation, Dateipfad UND Assets gemeinsam nach — vorher wurde nur
   * die Presentation übernommen, sodass der Store weiter auf die alte Datei zeigte
   * und ein Cmd+S das fremde Deck überschrieb.
   */
  applyExternalOpen: (presentation: Presentation, path: string | null, assets: Asset[]) => void
  /** Der MCP-Server hat gespeichert → Pfad übernehmen, Dirty-Punkt löschen (Befund M5). */
  applyExternalSave: (path: string) => void

  /**
   * Übernimmt eine beim Start gefundene Crash-Sicherung (Befund B4). Setzt den
   * ursprünglichen Dateipfad wieder und markiert dirty — der Nutzer entscheidet
   * per Cmd+S, ob der wiederhergestellte Stand die Datei ersetzen soll.
   */
  restoreRecovery: (info: RecoveryInfo) => Promise<void>
}

const now = () => new Date().toISOString()

function newId(): string {
  return crypto.randomUUID()
}

function makeZone(order: number, markdown = ''): Zone {
  return {
    id: newId(),
    label: `Slide ${order + 1}`,
    order,
    content_type: 'markdown',
    markdown,
    html: null,
    custom_css: '',
    style: { ...DEFAULT_ZONE_STYLE },
    notes: '',
  }
}

/** Starter-Template für eine frische, leere HTML-Zone. */
function htmlStarter(): string {
  // Inhalt, nicht Oberfläche: der Text wird beim ERZEUGEN in der aktuellen
  // Sprache geschrieben und wandert in die `.slideo`-Datei (docs/wording.md).
  return [
    '<div style="text-align:center;color:var(--color-text);font-family:var(--font-heading)">',
    `  <h1 style="font-size:3rem;margin:0">${t('store.htmlStarter.title')}</h1>`,
    `  <p style="color:var(--color-secondary)">${t('store.htmlStarter.body')}</p>`,
    '</div>',
  ].join('\n')
}

function makePresentation(title: string, template?: DeckTemplate): Presentation {
  const created = now()
  const preset = template?.preset ? findPreset(template.preset) : undefined
  const tokens = preset ? { ...DEFAULT_TOKENS, ...preset.tokens } : { ...DEFAULT_TOKENS }
  const seeds = template
    ? template.zones(title)
    : [{ markdown: t('store.newDeck.firstSlide', { title }) }]
  const zones = seeds.map((s, i) => {
    const z = makeZone(i, s.markdown)
    z.label = `Slide ${i + 1}`
    if (s.layout) z.style.layout = s.layout
    if (s.reveal) z.reveal = s.reveal
    return z
  })
  return {
    version: FILE_FORMAT_VERSION,
    // `language` ist die Sprache der FOLIEN, nicht der Oberfläche: hier einmal aus
    // der Oberflächensprache vorbelegt, danach wandert sie mit der Datei und wird
    // von einem späteren Sprachwechsel nicht mehr angefasst (docs/wording.md).
    meta: { title, created, modified: created, language: getLocale() },
    tokens,
    zones,
  }
}

/** Re-normalisiert die `order`-Felder auf 0..n-1 entsprechend Array-Reihenfolge. */
function renumber(zones: Zone[]): Zone[] {
  return zones.map((z, i) => (z.order === i ? z : { ...z, order: i }))
}

const PAST_CAP = 50
const clone = (p: Presentation): Presentation => JSON.parse(JSON.stringify(p))

/**
 * Ein Undo-/Redo-Stand (Review 2026-08, Befund S1/H3/M53).
 *
 * Vorher hielt die Historie NUR die Presentation, während `assets` ein
 * Geschwisterfeld war, das mit rohem `set()` mutiert wurde. Folgen: ein gelöschtes
 * Asset war unwiederbringlich (H3), ein Undo nach Snapshot-Restore ließ das Deck
 * auf die falschen Assets zeigen (M53), und Font-/Logo-Upload konnte ein verwaistes
 * Asset hinterlassen (M54).
 *
 * Die Asset-Map wird bewusst als **Referenz** geführt, nicht tief geklont: der
 * Store ersetzt das Objekt bei jeder Asset-Änderung ohnehin (deshalb funktioniert
 * auch der Identitätsvergleich in `classifyPreviewChange`), und ein Deep-Clone
 * würde bei Video-Assets zweistellige MB pro Undo-Schritt kosten.
 */
interface HistoryEntry {
  presentation: Presentation
  assets: AssetMap
}

// ───────────────────────── Crash-Recovery (Review 2026-08, Befund B4) ─────────────────────────
//
// Bis hierher wurde ausschließlich bei explizitem Cmd+S geschrieben. Das Risikofenster
// war exakt die Kernschleife des Produkts: ein Agent baut zehn Minuten lang über 100+
// Tool-Calls ein Deck, die WebView stürzt ab — alles weg. Die Versionshistorie half
// nicht, weil sie einen Dateipfad braucht und nur aus `savePresentation` heraus lief.
//
// Bewusst KEIN „echtes" Autosave in die Nutzerdatei: das würde ein explizites
// Speichermodell (mit Dirty-Punkt und Close-Guard) durch ein implizites ersetzen und
// nebenbei jedes „ausprobieren und verwerfen" unmöglich machen. Stattdessen eine
// Sicherungskopie neben der Konfiguration, die nach dem nächsten echten Speichern
// verschwindet und nur nach einem Absturz beim Start auftaucht.
const AUTOSAVE_IDLE_MS = 3000 // nach dieser Ruhe schreiben
const AUTOSAVE_MAX_WAIT_MS = 30000 // spätestens nach dieser Zeit, auch bei Dauerlast

/** ID dieser Sitzung — zwei parallel laufende Instanzen dürfen sich nicht überschreiben. */
const SESSION_ID = typeof crypto !== 'undefined' ? crypto.randomUUID() : 'dev-session'

export const usePresentationStore = create<PresentationState>((set, get) => {
  // Bild-Anzeige im Editor: `assets/<name>` → aktuelle Data-URI auflösen.
  setAssetResolver((name) => get().assets[name])

  /** Hängt einen Snapshot an die Undo-History (gekappt auf PAST_CAP). */
  function pushHistory(p: Presentation): void {
    // Eine neue Aktion nach einem Undo verwirft den Redo-Zweig — Standardverhalten
    // jedes linearen Undo-Stacks; ohne das könnte Redo einen Stand einspielen, der
    // zu einer inzwischen abgezweigten Historie gehört.
    const entry: HistoryEntry = { presentation: clone(p), assets: get().assets }
    set({ past: [...get().past, entry].slice(-PAST_CAP), future: [] })
  }

  // --- Undo-Granularität (Review 2026-08, Befund H29/S6) ---
  //
  // Jede MCP-Mutation pushte bisher einen Ganz-Deck-Klon. Ein „bau mir ein Deck"-Lauf
  // sind 50–150 Tool-Calls → der 50er-Ring war danach restlos mit KI-Zwischenschritten
  // gefüllt und der Stand VOR dem KI-Lauf — der einzige, zu dem der Mensch je zurück
  // will — war herausgedrängt. Dazu kostete jeder Push ein synchrones
  // JSON.parse(JSON.stringify(deck)) auf dem UI-Thread.
  //
  // Lösung: eine KI-„Runde" ist ein Undo-Schritt. Nur der erste Call einer Runde legt
  // einen Snapshot an; Folgeaufrufe innerhalb von AI_ROUND_MS verlängern sie nur.
  const AI_ROUND_MS = 1200
  let aiRoundUntil = 0

  /** Snapshot für eine KI-Mutation — koalesziert zusammenhängende Tool-Calls. */
  function pushAiHistory(p: Presentation): void {
    const nowMs = Date.now()
    if (nowMs >= aiRoundUntil) pushHistory(p)
    aiRoundUntil = nowMs + AI_ROUND_MS
  }

  // --- Autosave-Zeitgeber (Befund B4) ---
  let autosaveIdle: ReturnType<typeof setTimeout> | null = null
  let autosaveDeadline: ReturnType<typeof setTimeout> | null = null

  function cancelAutosave(): void {
    if (autosaveIdle) clearTimeout(autosaveIdle)
    if (autosaveDeadline) clearTimeout(autosaveDeadline)
    autosaveIdle = null
    autosaveDeadline = null
  }

  /** Schreibt die Sicherungskopie dieser Sitzung (still, fire-and-forget). */
  function writeRecovery(): void {
    cancelAutosave()
    const { presentation, assets, filePath, isDirty } = get()
    if (!presentation || !isDirty || !isTauri()) return
    void recoveryWrite(SESSION_ID, presentation, mapToAssets(assets), filePath).catch((e) =>
      console.warn('[slideo] Recovery-Sicherung fehlgeschlagen:', e),
    )
  }

  /**
   * Plant eine Sicherung: nach 3 s Ruhe — spätestens aber 30 s nach der ersten
   * ungesicherten Änderung. Ohne die Deadline würde ein Agent, der im Sekundentakt
   * Tool-Calls feuert, den Idle-Timer endlos zurücksetzen und nie sichern — also
   * genau im gefährlichsten Fall gar nichts schreiben.
   */
  function scheduleAutosave(): void {
    if (!isTauri()) return
    if (autosaveIdle) clearTimeout(autosaveIdle)
    autosaveIdle = setTimeout(writeRecovery, AUTOSAVE_IDLE_MS)
    if (!autosaveDeadline) {
      autosaveDeadline = setTimeout(writeRecovery, AUTOSAVE_MAX_WAIT_MS)
    }
  }

  /** Nach einem echten Speichern ist die Sicherung überflüssig. */
  function clearRecovery(): void {
    cancelAutosave()
    if (!isTauri()) return
    void recoveryClear(SESSION_ID).catch(() => {})
  }

  /**
   * Mutiert die aktuelle Presentation, markiert dirty und stempelt `modified`.
   * `recordHistory=false` für hochfrequente Texteingaben (Editor hat eigenes Undo).
   *
   * **Gibt zurück, ob wirklich mutiert wurde** (Review 2026-08, Befund S11). Vorher
   * lieferte `mutate` `void` und schluckte die eigene Ablehnung — Aufrufer meldeten
   * danach bedingungslos Erfolg. `addFont` zeigte im read-only-Zustand roten UND
   * grünen Toast und ließ ein verwaistes Asset zurück (M54); dasselbe Muster in
   * `setLogo`, `insertAssetIntoZone` und `applyPreset`. Jede Aufrufstelle, die etwas
   * meldet, MUSS den Rückgabewert prüfen.
   */
  function mutate(fn: (p: Presentation) => Presentation, recordHistory = true): boolean {
    // Lizenz-Gate: nach Ablauf der Demo ohne Lizenz ist Slideo schreibgeschützt
    // (Öffnen + Exportieren bleibt möglich). Hochfrequente Tipp-Mutationen
    // (recordHistory=false) still ablehnen, damit keine Toast-Flut entsteht.
    if (!useLicenseStore.getState().editingAllowed()) {
      if (recordHistory) {
        notify(t('store.readOnly.edit'), 'error')
      }
      return false
    }
    const p = get().presentation
    if (!p) return false
    if (recordHistory) pushHistory(p)
    const next = fn(p)
    next.meta = { ...next.meta, modified: now() }
    set({ presentation: next, isDirty: true })
    scheduleAutosave()
    return true
  }

  return {
    past: [],
    future: [],

    undo: () => {
      // Gate auch hier (Befund M20): ohne das konnte ein abgelaufener Nutzer das Deck
      // weiter durch die Historie rollen und dirty machen — Bearbeiten über die Rückwärts-
      // taste, während jede Vorwärts-Bearbeitung abgelehnt wurde.
      if (!useLicenseStore.getState().editingAllowed()) return
      const { past, presentation: current, assets: currentAssets } = get()
      if (past.length === 0) return
      const previous = past[past.length - 1]
      const keepActive = previous.presentation.zones.some((z) => z.id === get().activeZoneId)
      set({
        past: past.slice(0, -1),
        // Aktuellen Stand für Redo aufheben (H1) — inklusive Assets (S1).
        future: current
          ? [{ presentation: clone(current), assets: currentAssets }, ...get().future].slice(0, PAST_CAP)
          : get().future,
        presentation: previous.presentation,
        // Assets mitziehen: ein gelöschtes Bild kommt so zurück (H3), und ein Undo
        // nach Snapshot-Restore zeigt nicht mehr auf die falschen Assets (M53).
        assets: previous.assets,
        isDirty: true,
        activeZoneId: keepActive
          ? get().activeZoneId
          : (previous.presentation.zones[0]?.id ?? null),
      })
      scheduleAutosave()
    },

    redo: () => {
      if (!useLicenseStore.getState().editingAllowed()) return
      const { future, presentation: current, assets: currentAssets } = get()
      if (future.length === 0) return
      const next = future[0]
      const keepActive = next.presentation.zones.some((z) => z.id === get().activeZoneId)
      set({
        // NICHT über pushHistory (das würde `future` leeren) — hier wird der
        // Redo-Zweig ja gerade abgelaufen, nicht verworfen.
        past: current
          ? [...get().past, { presentation: clone(current), assets: currentAssets }].slice(-PAST_CAP)
          : get().past,
        future: future.slice(1),
        presentation: next.presentation,
        assets: next.assets,
        isDirty: true,
        activeZoneId: keepActive
          ? get().activeZoneId
          : (next.presentation.zones[0]?.id ?? null),
      })
      scheduleAutosave()
    },

    presentation: null,
    filePath: null,
    isDirty: false,
    assets: {},
    activeZoneId: null,
    mode: 'editor',
    activeSlideIndex: 0,

    newPresentation: (title, template) => {
      if (!useLicenseStore.getState().editingAllowed()) {
        notify(t('store.readOnly.new'), 'error')
        return false
      }
      const presentation = makePresentation(title || t('store.newDeck.untitled'), template)
      set({
        presentation,
        filePath: null,
        isDirty: false,
        assets: {},
        past: [],
        future: [],
        activeZoneId: presentation.zones[0]?.id ?? null,
        mode: 'editor',
        activeSlideIndex: 0,
      })
      return true
    },

    loadPresentation: async (path) => {
      try {
        const raw = await loadPresentationFile(path)
        const { presentation, fromNewerVersion } = normalizePresentation(raw.presentation)
        const assets = raw.assets
        if (fromNewerVersion) {
          notify(t('store.open.newerVersion'), 'info')
        }
        set({
          presentation,
          filePath: path,
          isDirty: false,
          assets: assetsToMap(assets),
          past: [],
          future: [],
          activeZoneId: presentation.zones[0]?.id ?? null,
          mode: 'editor',
          activeSlideIndex: 0,
        })
        useSettingsStore.getState().rememberRecent(path, presentation.meta.title)
        notify(t('store.open.ok'), 'success')
      } catch (e) {
        console.error('[slideo] load_presentation fehlgeschlagen:', e)
        notify(t('store.open.failed', { error: describeError(e) }), 'error')
      }
    },

    openPresentationDialog: async () => {
      const path = await pickOpenPath()
      if (path) await get().loadPresentation(path)
    },

    savePresentation: async (path) => {
      const { presentation, filePath } = get()
      if (!presentation) return
      const target = path ?? filePath
      if (!target) {
        await get().savePresentationAsDialog()
        return
      }
      try {
        const assetList = mapToAssets(get().assets)
        await savePresentationFile(target, presentation, assetList)
        set({ filePath: target, isDirty: false })
        // Der Stand ist jetzt echt auf Platte → die Sitzungs-Sicherung darf weg,
        // sonst bietet der nächste Start eine Wiederherstellung für nichts an.
        clearRecovery()
        useSettingsStore.getState().rememberRecent(target, presentation.meta.title)
        notify(t('store.save.ok'), 'success')
        // Auto-Snapshot (Versionshistorie §19.9): still + im Backend dedupliziert;
        // Fehler dürfen das Speichern nicht stören (fire-and-forget).
        if (isTauri()) {
          void createSnapshotCmd(target, presentation, assetList, '', true, now(), newId()).catch(
            (e) => console.warn('[slideo] auto-snapshot fehlgeschlagen:', e),
          )
        }
      } catch (e) {
        console.error('[slideo] save_presentation fehlgeschlagen:', e)
        notify(t('store.save.failed', { error: describeError(e) }), 'error')
      }
    },

    savePresentationAsDialog: async () => {
      const { presentation } = get()
      if (!presentation) return
      const safeName = presentation.meta.title.replace(/[^\w\-]+/g, '-').toLowerCase() || 'presentation'
      const path = await pickSavePath(`${safeName}.slideo`)
      if (path) await get().savePresentation(path)
    },

    exportHtml: async () => {
      const { presentation, assets } = get()
      if (!presentation) return
      const safeName = presentation.meta.title.replace(/[^\w\-]+/g, '-').toLowerCase() || 'presentation'
      const path = await pickExportHtmlPath(`${safeName}.html`)
      if (!path) return
      try {
        const html = renderStandalonePage(presentation, assets)
        await exportHtmlFile(path, html)
        notify(t('store.export.htmlOk'), 'success')
      } catch (e) {
        console.error('[slideo] export_html fehlgeschlagen:', e)
        notify(t('store.export.failed', { error: describeError(e) }), 'error')
      }
    },

    exportPdf: async () => {
      const { presentation, assets } = get()
      if (!presentation) return
      if (isTauri()) {
        // WKWebView kann window.print() nicht zuverlässig — print-Page in den
        // Standardbrowser auslagern; dort „Drucken → Als PDF sichern".
        try {
          await openPrintView(renderPrintPage(presentation, assets))
          notify(t('store.export.pdfOpened'), 'info')
        } catch (e) {
          console.error('[slideo] open_print_view fehlgeschlagen:', e)
          notify(t('store.export.pdfFailed', { error: describeError(e) }), 'error')
        }
      } else {
        // Reiner Browser-Dev: direkter Iframe-Druck funktioniert.
        exportPdfViaPrint(presentation, assets)
        notify(t('store.export.pdfDialog'), 'info')
      }
    },

    exportPptx: async () => {
      const { presentation, assets } = get()
      if (!presentation) return
      const safeName = presentation.meta.title.replace(/[^\w\-]+/g, '-').toLowerCase() || 'presentation'
      try {
        const { buildPptxBase64 } = await import('@/lib/pptx')
        const base64 = await buildPptxBase64(presentation, assets)
        if (isTauri()) {
          const path = await pickExportPptxPath(`${safeName}.pptx`)
          if (!path) return
          await exportPptxFile(path, base64)
          notify(t('store.export.pptxOk'), 'success')
        } else {
          // Browser-Dev: Download über einen Blob aus dem base64-String.
          const bytes = Uint8Array.from(atob(base64), (c) => c.charCodeAt(0))
          const blob = new Blob([bytes], {
            type: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          })
          const url = URL.createObjectURL(blob)
          const a = document.createElement('a')
          a.href = url
          a.download = `${safeName}.pptx`
          a.click()
          URL.revokeObjectURL(url)
          notify(t('store.export.pptxDownloaded'), 'success')
        }
      } catch (e) {
        console.error('[slideo] export_pptx fehlgeschlagen:', e)
        notify(t('store.export.pptxFailed', { error: describeError(e) }), 'error')
      }
    },

    createZone: (afterId, markdown = '') => {
      let createdId = ''
      mutate((p) => {
        const zones = [...p.zones]
        const idx = afterId ? zones.findIndex((z) => z.id === afterId) : zones.length - 1
        const insertAt = idx >= 0 ? idx + 1 : zones.length
        const zone = makeZone(insertAt, markdown)
        zone.label = `Slide ${insertAt + 1}`
        createdId = zone.id
        zones.splice(insertAt, 0, zone)
        return { ...p, zones: renumber(zones) }
      })
      if (createdId) set({ activeZoneId: createdId })
      return createdId
    },

    duplicateZone: (id) => {
      let newId = ''
      mutate((p) => {
        const idx = p.zones.findIndex((z) => z.id === id)
        if (idx < 0) return p
        const src = p.zones[idx]
        newId = newId || newId
        const copy: Zone = {
          ...JSON.parse(JSON.stringify(src)),
          id: crypto.randomUUID(),
          label: `${src.label} (Kopie)`,
        }
        newId = copy.id
        const zones = [...p.zones]
        zones.splice(idx + 1, 0, copy)
        return { ...p, zones: renumber(zones) }
      })
      if (newId) set({ activeZoneId: newId })
      return newId
    },

    deleteZone: (id) => {
      mutate((p) => ({ ...p, zones: renumber(p.zones.filter((z) => z.id !== id)) }))
      if (get().activeZoneId === id) {
        const zones = get().presentation?.zones ?? []
        set({ activeZoneId: zones[0]?.id ?? null })
      }
    },

    updateZoneMarkdown: (id, markdown) => {
      // Texteingaben: kein History-Snapshot (Tiptap hat eigenes Undo).
      mutate(
        (p) => ({
          ...p,
          zones: p.zones.map((z) => (z.id === id ? { ...z, markdown } : z)),
        }),
        false,
      )
    },

    updateZoneHtml: (id, html) => {
      // Texteingaben: kein History-Snapshot (CodeMirror hat eigenes Undo).
      mutate(
        (p) => ({
          ...p,
          zones: p.zones.map((z) => (z.id === id ? { ...z, html } : z)),
        }),
        false,
      )
    },

    updateZoneCss: (id, css) => {
      mutate(
        (p) => ({
          ...p,
          zones: p.zones.map((z) => (z.id === id ? { ...z, custom_css: css } : z)),
        }),
        false,
      )
    },

    setZoneContentType: (id, contentType) => {
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => {
          if (z.id !== id || z.content_type === contentType) return z
          if (contentType === 'html') {
            // markdown → html: bestehenden Markdown-Inhalt vorkonvertieren,
            // damit beim Umschalten nichts verloren geht.
            const seed = z.markdown.trim() ? markdownToHtml(z.markdown) : htmlStarter()
            return { ...z, content_type: 'html', html: z.html ?? seed }
          }
          // html → markdown: HTML lässt sich nicht verlustfrei zurückkonvertieren;
          // das vorhandene markdown-Feld bleibt erhalten (UI warnt davor).
          return { ...z, content_type: 'markdown' }
        }),
      }))
    },

    updateZoneStyle: (id, style) => {
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => (z.id === id ? { ...z, style: { ...z.style, ...style } } : z)),
      }))
    },

    updateZoneLabel: (id, label) => {
      // recordHistory=false (Befund S6): das Feld wird pro Tastendruck geschrieben —
      // vorher klonte jeder Anschlag das ganze Deck in die Undo-Historie.
      mutate(
        (p) => ({
          ...p,
          zones: p.zones.map((z) => (z.id === id ? { ...z, label } : z)),
        }),
        false,
      )
    },

    updateZoneNotes: (id, notes) => {
      // Texteingabe: kein History-Snapshot (analog Markdown/CSS).
      mutate(
        (p) => ({
          ...p,
          zones: p.zones.map((z) => (z.id === id ? { ...z, notes } : z)),
        }),
        false,
      )
    },

    replaceAllInDeck: (search, replace) => {
      if (!search) return 0
      let count = 0
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => {
          if (z.content_type === 'html') {
            const text = z.html ?? ''
            const n = text.split(search).length - 1
            if (n === 0) return z
            count += n
            return { ...z, html: text.split(search).join(replace) }
          }
          const n = z.markdown.split(search).length - 1
          if (n === 0) return z
          count += n
          return { ...z, markdown: z.markdown.split(search).join(replace) }
        }),
      }))
      return count
    },

    setZoneReveal: (id, mode) => {
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => (z.id === id ? { ...z, reveal: mode } : z)),
      }))
    },

    setZoneLayout: (id, layout) => {
      const SEP = /^[ \t]*\+\+\+[ \t]*$/
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => {
          if (z.id !== id) return z
          const style = { ...z.style, layout }
          // +++-Trenner nur in Markdown-Zonen automatisch verwalten.
          if (z.content_type !== 'markdown') return { ...z, style }
          if (layout === 'split' && z.style.layout !== 'split') {
            // Zwei Spalten: sicherstellen, dass ein Trenner existiert.
            const hasSep = z.markdown.split('\n').some((l) => SEP.test(l))
            const markdown = hasSep ? z.markdown : `${z.markdown.trim()}\n\n+++\n\n`
            return { ...z, markdown, style }
          }
          if (layout !== 'split' && z.style.layout === 'split') {
            // Einspaltig: Trenner entfernen, Inhalte zusammenführen.
            const markdown = z.markdown
              .split('\n')
              .filter((l) => !SEP.test(l))
              .join('\n')
              .replace(/\n{3,}/g, '\n\n')
              .trim()
            return { ...z, markdown, style }
          }
          return { ...z, style }
        }),
      }))
    },

    reorderZoneBlocks: (id, order) => {
      const current = get().presentation
      const zone = current?.zones.find((z) => z.id === id)
      if (!zone || zone.content_type !== 'markdown') return
      const blocks = splitMarkdownBlocks(zone.markdown)
      // Permutation validieren (gleiche Länge, jeder Index genau einmal).
      if (order.length !== blocks.length) return
      const seen = new Set(order)
      if (seen.size !== blocks.length || order.some((i) => i < 0 || i >= blocks.length)) return
      const markdown = order.map((i) => blocks[i]).join('\n\n')
      if (markdown === zone.markdown) return // keine Änderung
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => (z.id === id ? { ...z, markdown } : z)),
      }))
      set({ activeZoneId: id })
    },

    deleteZoneBlock: (id, blockIndex) => {
      const zone = get().presentation?.zones.find((z) => z.id === id)
      if (!zone || zone.content_type !== 'markdown') return
      const blocks = splitMarkdownBlocks(zone.markdown)
      if (blockIndex < 0 || blockIndex >= blocks.length) return // stale/ungültig → no-op
      const next = blocks.slice()
      next.splice(blockIndex, 1)
      const markdown = next.join('\n\n')
      if (markdown === zone.markdown) return
      mutate((p) => ({ ...p, zones: p.zones.map((z) => (z.id === id ? { ...z, markdown } : z)) }))
      set({ activeZoneId: id })
    },

    duplicateZoneBlock: (id, blockIndex) => {
      const zone = get().presentation?.zones.find((z) => z.id === id)
      if (!zone || zone.content_type !== 'markdown') return
      const blocks = splitMarkdownBlocks(zone.markdown)
      if (blockIndex < 0 || blockIndex >= blocks.length) return
      const next = blocks.slice()
      next.splice(blockIndex + 1, 0, blocks[blockIndex]) // Klon direkt hinter das Original
      const markdown = next.join('\n\n')
      mutate((p) => ({ ...p, zones: p.zones.map((z) => (z.id === id ? { ...z, markdown } : z)) }))
      set({ activeZoneId: id })
    },

    editZoneBlock: (id, blockIndex, markdown) => {
      const zone = get().presentation?.zones.find((z) => z.id === id)
      if (!zone || zone.content_type !== 'markdown') return
      if (!markdown.trim()) return // leeren Block nicht via Inline-Edit erzeugen (dafür Löschen)
      const blocks = splitMarkdownBlocks(zone.markdown)
      if (blockIndex < 0 || blockIndex >= blocks.length) return // stale/ungültig → no-op
      if (blocks[blockIndex] === markdown) return
      const next = blocks.slice()
      next[blockIndex] = markdown
      const joined = next.join('\n\n')
      if (joined === zone.markdown) return
      mutate((p) => ({ ...p, zones: p.zones.map((z) => (z.id === id ? { ...z, markdown: joined } : z)) }))
      set({ activeZoneId: id })
    },

    resizeZoneImage: (id, blockIndex, _imgIndex, width) => {
      const zone = get().presentation?.zones.find((z) => z.id === id)
      if (!zone || zone.content_type !== 'markdown') return
      const blocks = splitMarkdownBlocks(zone.markdown)
      if (blockIndex < 0 || blockIndex >= blocks.length) return
      const updated = setBlockImageWidth(blocks[blockIndex], width)
      if (updated === blocks[blockIndex]) return
      const next = blocks.slice()
      next[blockIndex] = updated
      const markdown = next.join('\n\n')
      mutate((p) => ({ ...p, zones: p.zones.map((z) => (z.id === id ? { ...z, markdown } : z)) }))
      set({ activeZoneId: id })
    },

    applyZoneElementOp: (zoneId, path, op, payload) => {
      const zone = get().presentation?.zones.find((z) => z.id === zoneId)
      if (!zone || zone.content_type !== 'html') return
      const current = zone.html ?? ''
      const next = applyElementOp(current, path, op, payload)
      if (next === current) return // ungültiger Pfad oder keine Änderung
      // recordHistory=true: diskrete Direktmanipulation ist per Cmd/Z umkehrbar
      // (anders als das laufende Tippen via updateZoneHtml).
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => (z.id === zoneId ? { ...z, html: next } : z)),
      }))
      set({ activeZoneId: zoneId })
    },

    freezeZoneLayout: (zoneId, items) => {
      const zone = get().presentation?.zones.find((z) => z.id === zoneId)
      if (!zone || zone.content_type !== 'html' || !Array.isArray(items) || items.length === 0) return
      const current = zone.html ?? ''
      const next = applyFreezeLayout(current, items)
      if (next === current) return
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => (z.id === zoneId ? { ...z, html: next } : z)),
      }))
      set({ activeZoneId: zoneId })
    },

    reorderZones: (orderedIds) => {
      mutate((p) => {
        const byId = new Map(p.zones.map((z) => [z.id, z]))
        const reordered = orderedIds
          .map((id) => byId.get(id))
          .filter((z): z is Zone => z !== undefined)
        // Verbleibende (nicht in der Liste enthaltene) Zones anhängen, um Datenverlust zu vermeiden.
        for (const z of p.zones) if (!orderedIds.includes(z.id)) reordered.push(z)
        return { ...p, zones: renumber(reordered) }
      })
    },

    insertComponent: ({ targetZoneId, placement, html }) => {
      let focusId = ''
      mutate((p) => {
        const zones = [...p.zones]
        const target = targetZoneId ? zones.find((z) => z.id === targetZoneId) : undefined
        // Invariante (auch ohne UI-Schutz): eine nicht-leere Markdown-Folie wird NIE
        // überschrieben — die Komponente bekommt dann eine eigene neue HTML-Folie.
        const wouldClobberMarkdown =
          !!target && target.content_type === 'markdown' && !!target.markdown.trim()
        // Neue Folie (auch Fallback, wenn keine/keine gültige Zielzone existiert).
        if (placement === 'new' || !target || wouldClobberMarkdown) {
          const idx = target ? zones.findIndex((z) => z.id === target.id) : zones.length - 1
          const insertAt = idx >= 0 ? idx + 1 : zones.length
          const zone = makeZone(insertAt)
          zone.label = `Slide ${insertAt + 1}`
          zone.content_type = 'html'
          zone.html = html
          focusId = zone.id
          zones.splice(insertAt, 0, zone)
          return { ...p, zones: renumber(zones) }
        }
        // In bestehende Zone: anhängen (nur sinnvoll/genutzt bei HTML-Zonen) oder ersetzen.
        focusId = target.id
        return {
          ...p,
          zones: zones.map((z) => {
            if (z.id !== target.id) return z
            const existing = z.content_type === 'html' ? (z.html ?? '') : ''
            // Anhängen an eine NICHT-leere HTML-Zone: wie beim Medien-Einfügen die Komponente
            // in einen absolut positionierten, sichtbaren Container wickeln (z-index über dem
            // Inhalt). Sonst landet sie im Fluss unter dem (meist platzfüllenden) KI-Inhalt und
            // wird von der 1280×720-Bühne abgeschnitten. Per §20-Drag verschiebbar.
            const next =
              placement === 'append' && existing.trim()
                ? `${existing}\n<div style="position:absolute;left:10%;top:14%;width:80%;z-index:50">${html}</div>`
                : html
            return { ...z, content_type: 'html', html: next }
          }),
        }
      })
      if (focusId) set({ activeZoneId: focusId })
    },

    addAssetToLibrary: (dataUri) => {
      // Lizenz-Gate auch hier (Befund S28): Assets sind Teil des Decks, wurden aber
      // an `mutate` vorbei geschrieben — im read-only-Zustand wuchs die Datei weiter.
      if (!useLicenseStore.getState().editingAllowed()) return ''
      const { mime } = parseDataUri(dataUri)
      const filename = `img-${shortId()}.${mimeToExt(mime)}`
      set({ assets: { ...get().assets, [filename]: dataUri }, isDirty: true })
      return filename
    },

    countAssetRefs: (name) => {
      const p = get().presentation
      if (!p) return 0
      const ref = `assets/${name}`
      let n = 0
      for (const z of p.zones) {
        if (z.markdown.includes(ref)) n++
        if (z.html?.includes(ref)) n++
        if (z.custom_css.includes(ref)) n++
      }
      if (p.meta.logo?.asset === name) n++
      if (p.fonts?.some((f) => f.asset === name)) n++
      return n
    },

    removeAsset: (name) => {
      if (!useLicenseStore.getState().editingAllowed()) return
      const current = get().presentation
      // Über `mutate` gehen, damit das Löschen in der Historie landet (Befund H3/S1):
      // vorher lief es über ein rohes `set()`, war also weder undoable noch dirty-
      // korrekt — ein versehentlich gelöschtes Bild war unwiederbringlich, während
      // jede Folie, die es referenzierte, still ein kaputtes Bild renderte.
      // Die Presentation selbst bleibt unverändert; der Snapshot fängt die Assets.
      if (current) pushHistory(current)
      const next = { ...get().assets }
      delete next[name]
      set({ assets: next, isDirty: true })
      scheduleAutosave()
    },

    addFont: (dataUri, fileName) => {
      const ext = extFromName(fileName) || 'woff2'
      const family = familyFromName(fileName)
      const asset = `font-${shortId()}.${ext}`
      // Reihenfolge umgedreht (Befund M54): erst die gegatete Mutation, dann das Asset.
      // Vorher lief das Asset-Schreiben ungated VOR dem abgelehnten `mutate` — Ergebnis
      // war ein roter UND ein grüner Toast plus ein verwaistes Font-Asset im Deck.
      const ok = mutate((p) => ({ ...p, fonts: [...(p.fonts ?? []), { family, asset }] }))
      if (!ok) return
      set({ assets: { ...get().assets, [asset]: dataUri } })
      notify(t('store.font.added', { family }), 'success')
    },

    setLogo: (dataUri) => {
      const asset = get().addAssetToLibrary(dataUri)
      if (!asset) return // Gate hat abgelehnt — kein Erfolgs-Toast (M54)
      const ok = mutate((p) => ({
        ...p,
        meta: { ...p.meta, logo: { asset, position: p.meta.logo?.position ?? 'bottom-right' } },
      }))
      if (!ok) {
        get().removeAsset(asset) // nichts Verwaistes zurücklassen
        return
      }
      notify(t('store.logo.set'), 'success')
    },

    setLogoPosition: (position) => {
      mutate((p) =>
        p.meta.logo ? { ...p, meta: { ...p.meta, logo: { ...p.meta.logo, position } } } : p,
      )
    },

    clearLogo: () => {
      mutate((p) => {
        if (!p.meta.logo) return p
        const meta = { ...p.meta }
        delete meta.logo
        return { ...p, meta }
      })
    },

    addMediaToZone: (zoneId, dataUri) => {
      // Datei importieren + einfügen (genutzt vom ZoneCard-Drag&Drop). Das Einfügen
      // teilt sich die Logik mit insertAssetIntoZone (Asset-Verwaltung „pick").
      const name = get().addAssetToLibrary(dataUri)
      get().insertAssetIntoZone(zoneId, name)
    },

    insertAssetIntoZone: (zoneId, assetName) => {
      const dataUri = get().assets[assetName]
      if (!dataUri) return
      const kind = mediaKind(parseDataUri(dataUri).mime)
      const ref = `assets/${assetName}`
      const zone = get().presentation?.zones.find((z) => z.id === zoneId)
      const isHtmlZone = zone?.content_type === 'html'

      // Video/Audio brauchen HTML-Tags. In Markdown-Zonen würde Tiptap rohes HTML beim
      // Bearbeiten verwerfen → nur in HTML-Zonen einfügen, sonst nur Hinweis (Asset
      // liegt bereits in der Library).
      if ((kind === 'video' || kind === 'audio') && !isHtmlZone) {
        notify(t('store.media.needsHtmlSlide'), 'info')
        return
      }

      const inserted = mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => {
          if (z.id !== zoneId) return z
          if (z.content_type === 'html') {
            // ABSOLUT & sichtbar einfügen (nicht ans Ende): KI-HTML-Folien füllen ihren
            // Platz meist schon → ein angehängtes Block-Element würde von der 1280×720-
            // Bühne (overflow:hidden, §21) abgeschnitten. Absolut positioniert erscheint
            // das Medium sichtbar über dem Inhalt und ist per §20-Drag verschieb-/skalierbar.
            const snippet =
              kind === 'video'
                ? `<video controls src="${ref}" style="position:absolute;left:30%;top:28%;width:40%;border-radius:var(--border-radius);z-index:50"></video>`
                : kind === 'audio'
                  ? `<audio controls src="${ref}" style="position:absolute;left:25%;top:84%;width:50%;z-index:50"></audio>`
                  : `<img src="${ref}" alt="" style="position:absolute;left:30%;top:28%;width:40%;height:auto;border-radius:var(--border-radius);z-index:50" />`
            const html = z.html?.trim() ? `${z.html}\n${snippet}` : snippet
            return { ...z, html }
          }
          // Markdown-Zone: nur Bilder (markdown-/Tiptap-sicher).
          const markdown = z.markdown.trim() ? `${z.markdown}\n\n![](${ref})` : `![](${ref})`
          return { ...z, markdown }
        }),
      }))
      if (!inserted) return // read-only → kein Erfolgs-Toast über einer Ablehnung (M54)
      notify(t(kind === 'image' ? 'store.media.imageInserted' : 'store.media.inserted'), 'success')
    },

    setToken: (key, value) => {
      // recordHistory=false (Befund S6): der Farbwähler feuert bei jeder Mausbewegung.
      // Der Sprung zurück auf ein ganzes Theme bleibt über `applyPreset`/`resetTokens`
      // (beide mit Historie) erreichbar.
      mutate((p) => ({ ...p, tokens: { ...p.tokens, [key]: value } }), false)
    },

    setTokensBulk: (tokens) => {
      mutate((p) => ({ ...p, tokens: { ...p.tokens, ...tokens } as DesignTokens }))
    },

    resetTokens: () => {
      mutate((p) => ({ ...p, tokens: { ...DEFAULT_TOKENS } }))
    },

    applyPreset: (name) => {
      const preset = findPreset(name)
      if (!preset) {
        notify(t('store.preset.notFound', { name }), 'error')
        return
      }
      if (!mutate((p) => ({ ...p, tokens: { ...p.tokens, ...preset.tokens } }))) return
      notify(t('store.preset.applied', { name: preset.label }), 'success')
    },

    setPresentationTitle: (title) => {
      const clean = title.trim()
      if (!clean) return
      mutate((p) => (p.meta.title === clean ? p : { ...p, meta: { ...p.meta, title: clean } }))
    },

    setDeckLanguage: (language) => {
      mutate((p) => ({ ...p, meta: { ...p.meta, language } }))
    },

    setTransition: (kind, durationMs) => {
      mutate((p) => ({
        ...p,
        meta: {
          ...p.meta,
          transition: {
            kind,
            duration_ms: durationMs ?? p.meta.transition?.duration_ms ?? 500,
          },
        },
      }))
    },

    createSnapshot: async (label = '') => {
      const { presentation, assets, filePath } = get()
      if (!isTauri()) {
        notify(t('store.history.desktopOnly'), 'info')
        return false
      }
      if (!presentation || !filePath) {
        notify(t('store.history.saveFirst'), 'info')
        return false
      }
      try {
        const meta = await createSnapshotCmd(
          filePath,
          presentation,
          mapToAssets(assets),
          label.trim(),
          false,
          now(),
          newId(),
        )
        notify(
          t(meta ? 'store.history.created' : 'store.history.unchanged'),
          meta ? 'success' : 'info',
        )
        return !!meta
      } catch (e) {
        console.error('[slideo] create_snapshot fehlgeschlagen:', e)
        notify(t('store.history.createFailed', { error: describeError(e) }), 'error')
        return false
      }
    },

    restoreSnapshot: async (id) => {
      const { filePath } = get()
      if (!isTauri() || !filePath) return
      if (!useLicenseStore.getState().editingAllowed()) {
        notify(t('store.readOnly.restore'), 'error')
        return
      }
      try {
        const rawSnap = await restoreSnapshotCmd(filePath, id)
        const presentation = normalizePresentation(rawSnap.presentation).presentation
        const assets = rawSnap.assets
        const current = get().presentation
        if (current) pushHistory(current) // Wiederherstellen ist per Undo umkehrbar
        set({
          presentation,
          assets: assetsToMap(assets),
          isDirty: true,
          activeZoneId: presentation.zones[0]?.id ?? null,
        })
        notify(t('store.history.restored'), 'success')
      } catch (e) {
        console.error('[slideo] restore_snapshot fehlgeschlagen:', e)
        notify(t('store.restore.failed', { error: describeError(e) }), 'error')
      }
    },

    setActiveZone: (id) => set({ activeZoneId: id }),

    setMode: (mode) => set({ mode }),

    setActiveSlide: (index) => {
      const count = get().presentation?.zones.length ?? 0
      const clamped = Math.max(0, Math.min(index, Math.max(0, count - 1)))
      set({ activeSlideIndex: clamped })
    },

    nextSlide: () => get().setActiveSlide(get().activeSlideIndex + 1),
    prevSlide: () => get().setActiveSlide(get().activeSlideIndex - 1),

    // `zoneIds` (welche Zonen der Tool-Aufruf angefasst hat) kommt seit dem
    // Effect-Redesign mit, wird hier aber noch nicht ausgewertet — die
    // Provenance-Anzeige („KI hat Folie 4 geändert") ist Maßnahme #36. Bewusst
    // durchgereicht statt weggeworfen: die Daten sind da, die UI kommt später.
    applyExternalPresentation: (presentation, _zoneIds) => {
      // MCP-Änderung undoable machen — aber pro RUNDE, nicht pro Tool-Call (H29).
      const current = get().presentation
      if (current) pushAiHistory(current)
      const next = normalizePresentation(presentation).presentation
      const zones = next.zones
      // aktive Zone beibehalten, falls noch vorhanden, sonst erste Zone
      const keepActive = zones.some((z) => z.id === get().activeZoneId)
      set({
        presentation: next,
        isDirty: true,
        activeZoneId: keepActive ? get().activeZoneId : (zones[0]?.id ?? null),
      })
      // KI-Edits laufen NICHT durch `mutate` → hier explizit sichern. Genau diese
      // Sitzung (Agent baut minutenlang ein Deck) war der teuerste Verlustfall.
      scheduleAutosave()
    },

    applyExternalOpen: (rawPresentation, path, assets) => {
      const presentation = normalizePresentation(rawPresentation).presentation
      // Deckwechsel: KEIN pushHistory — das alte Deck gehört zu einer anderen Datei,
      // ein Undo dorthin würde die beiden Decks vermischen (genau die Klasse Fehler,
      // die B3 verursacht hat). Stattdessen sauberer Schnitt, wie loadPresentation.
      const zones = presentation.zones
      set({
        presentation,
        filePath: path,
        assets: assetsToMap(assets),
        // Frisch geladen bzw. angelegt: das Deck steht so noch nicht auf Platte,
        // wenn es kein Pfad hat (create_presentation) — sonst ist es deckungsgleich.
        isDirty: path === null,
        past: [],
        future: [],
        activeZoneId: zones[0]?.id ?? null,
        mode: 'editor',
        activeSlideIndex: 0,
      })
      clearRecovery()
      notify(t(path ? 'store.mcp.opened' : 'store.mcp.created'), 'info')
    },

    applyExternalSave: (path) => {
      set({ filePath: path, isDirty: false })
      clearRecovery()
    },

    restoreRecovery: async (info) => {
      try {
        const rawRec = await recoveryTake(info.session)
        const presentation = normalizePresentation(rawRec.presentation).presentation
        const assets = rawRec.assets
        set({
          presentation,
          // Ursprungspfad zurücksetzen, damit Cmd+S wieder die richtige Datei trifft.
          filePath: info.original_path,
          assets: assetsToMap(assets),
          // Bewusst dirty: der Stand ist NICHT der auf Platte. Der Nutzer entscheidet,
          // ob er ihn übernimmt — automatisches Zurückschreiben wäre genau die Art
          // Überraschung, die dieses Feature verhindern soll.
          isDirty: true,
          past: [],
          future: [],
          activeZoneId: presentation.zones[0]?.id ?? null,
          mode: 'editor',
          activeSlideIndex: 0,
        })
        notify(
          t(info.original_path ? 'store.recovery.restored' : 'store.recovery.restoredUnsaved'),
          'success',
        )
      } catch (e) {
        console.error('[slideo] restore_recovery fehlgeschlagen:', e)
        notify(t('store.restore.failed', { error: describeError(e) }), 'error')
      }
    },
  }
})
