import { create } from 'zustand'
import {
  type Presentation,
  type Zone,
  type ZoneStyle,
  type ContentType,
  type DesignTokens,
  type AssetMap,
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
  isTauri,
} from '@/lib/tauri'
import { notify } from '@/store/toast'

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

  // Undo-History (strukturelle/Design-Änderungen; Texteingaben haben Editor-Undo)
  past: Presentation[]
  undo: () => void

  // Lifecycle
  newPresentation: (title: string, template?: DeckTemplate) => void
  loadPresentation: (path: string) => Promise<void>
  openPresentationDialog: () => Promise<void>
  savePresentation: (path?: string) => Promise<void>
  savePresentationAsDialog: () => Promise<void>
  exportHtml: () => Promise<void>
  exportPdf: () => Promise<void>
  exportPptx: () => Promise<void>

  // Zones
  createZone: (afterId?: string, markdown?: string) => string
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

  // Präsentation (deck-weit)
  setTransition: (kind: TransitionKind, durationMs?: number) => void

  // UI
  setActiveZone: (id: string | null) => void
  setMode: (mode: Mode) => void
  setActiveSlide: (index: number) => void
  nextSlide: () => void
  prevSlide: () => void

  // MCP: extern (über den MCP-Server) gelieferten State anwenden
  applyExternalPresentation: (presentation: Presentation) => void
}

const now = () => new Date().toISOString()

function errMsg(e: unknown): string {
  return e instanceof Error ? e.message : String(e)
}

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
  return [
    '<div style="text-align:center;color:var(--color-text);font-family:var(--font-heading)">',
    '  <h1 style="font-size:3rem;margin:0">Interaktive Zone</h1>',
    '  <p style="color:var(--color-secondary)">Beliebiges HTML, CSS &amp; JavaScript möglich.</p>',
    '</div>',
  ].join('\n')
}

function makePresentation(title: string, template?: DeckTemplate): Presentation {
  const created = now()
  const preset = template?.preset ? findPreset(template.preset) : undefined
  const tokens = preset ? { ...DEFAULT_TOKENS, ...preset.tokens } : { ...DEFAULT_TOKENS }
  const seeds = template
    ? template.zones(title)
    : [{ markdown: `# ${title}\n\nDein erster Slide. Leg los.` }]
  const zones = seeds.map((s, i) => {
    const z = makeZone(i, s.markdown)
    z.label = `Slide ${i + 1}`
    if (s.layout) z.style.layout = s.layout
    if (s.reveal) z.reveal = s.reveal
    return z
  })
  return {
    version: FILE_FORMAT_VERSION,
    meta: { title, created, modified: created },
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

export const usePresentationStore = create<PresentationState>((set, get) => {
  // Bild-Anzeige im Editor: `assets/<name>` → aktuelle Data-URI auflösen.
  setAssetResolver((name) => get().assets[name])

  /** Hängt einen Snapshot an die Undo-History (gekappt auf PAST_CAP). */
  function pushHistory(p: Presentation): void {
    set({ past: [...get().past, clone(p)].slice(-PAST_CAP) })
  }

  /**
   * Mutiert die aktuelle Presentation, markiert dirty und stempelt `modified`.
   * `recordHistory=false` für hochfrequente Texteingaben (Editor hat eigenes Undo).
   */
  function mutate(fn: (p: Presentation) => Presentation, recordHistory = true): void {
    // Lizenz-Gate: nach Ablauf der Demo ohne Lizenz ist Slideo schreibgeschützt
    // (Öffnen + Exportieren bleibt möglich). Hochfrequente Tipp-Mutationen
    // (recordHistory=false) still ablehnen, damit keine Toast-Flut entsteht.
    if (!useLicenseStore.getState().editingAllowed()) {
      if (recordHistory) {
        notify('Testphase abgelaufen — Slideo ist schreibgeschützt. Aktiviere eine Lizenz zum Weiterbearbeiten.', 'error')
      }
      return
    }
    const p = get().presentation
    if (!p) return
    if (recordHistory) pushHistory(p)
    const next = fn(p)
    next.meta = { ...next.meta, modified: now() }
    set({ presentation: next, isDirty: true })
  }

  return {
    past: [],

    undo: () => {
      const past = get().past
      if (past.length === 0) return
      const previous = past[past.length - 1]
      const keepActive = previous.zones.some((z) => z.id === get().activeZoneId)
      set({
        past: past.slice(0, -1),
        presentation: previous,
        isDirty: true,
        activeZoneId: keepActive ? get().activeZoneId : (previous.zones[0]?.id ?? null),
      })
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
        notify('Testphase abgelaufen — bitte aktiviere eine Lizenz, um neue Präsentationen zu erstellen.', 'error')
        return
      }
      const presentation = makePresentation(title || 'Unbenannt', template)
      set({
        presentation,
        filePath: null,
        isDirty: false,
        assets: {},
        past: [],
        activeZoneId: presentation.zones[0]?.id ?? null,
        mode: 'editor',
        activeSlideIndex: 0,
      })
    },

    loadPresentation: async (path) => {
      try {
        const { presentation, assets } = await loadPresentationFile(path)
        presentation.zones = renumber([...presentation.zones].sort((a, b) => a.order - b.order))
        set({
          presentation,
          filePath: path,
          isDirty: false,
          assets: assetsToMap(assets),
          past: [],
          activeZoneId: presentation.zones[0]?.id ?? null,
          mode: 'editor',
          activeSlideIndex: 0,
        })
        notify('Präsentation geöffnet.', 'success')
      } catch (e) {
        console.error('[slideo] load_presentation fehlgeschlagen:', e)
        notify(`Öffnen fehlgeschlagen: ${errMsg(e)}`, 'error')
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
        notify('Gespeichert.', 'success')
        // Auto-Snapshot (Versionshistorie §19.9): still + im Backend dedupliziert;
        // Fehler dürfen das Speichern nicht stören (fire-and-forget).
        if (isTauri()) {
          void createSnapshotCmd(target, presentation, assetList, '', true, now(), newId()).catch(
            (e) => console.warn('[slideo] auto-snapshot fehlgeschlagen:', e),
          )
        }
      } catch (e) {
        console.error('[slideo] save_presentation fehlgeschlagen:', e)
        notify(`Speichern fehlgeschlagen: ${errMsg(e)}`, 'error')
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
        notify('Als HTML exportiert — überall im Browser abspielbar.', 'success')
      } catch (e) {
        console.error('[slideo] export_html fehlgeschlagen:', e)
        notify(`Export fehlgeschlagen: ${errMsg(e)}`, 'error')
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
          notify('Im Browser geöffnet — dort „Drucken → Als PDF sichern" (Cmd/Strg+P).', 'info')
        } catch (e) {
          console.error('[slideo] open_print_view fehlgeschlagen:', e)
          notify(`PDF-Export fehlgeschlagen: ${errMsg(e)}`, 'error')
        }
      } else {
        // Reiner Browser-Dev: direkter Iframe-Druck funktioniert.
        exportPdfViaPrint(presentation, assets)
        notify('Druckdialog geöffnet — „Als PDF sichern".', 'info')
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
          notify('Als PowerPoint (.pptx) exportiert.', 'success')
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
          notify('PPTX heruntergeladen.', 'success')
        }
      } catch (e) {
        console.error('[slideo] export_pptx fehlgeschlagen:', e)
        notify(`PPTX-Export fehlgeschlagen: ${errMsg(e)}`, 'error')
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
      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => (z.id === id ? { ...z, label } : z)),
      }))
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
      const { mime } = parseDataUri(dataUri)
      const filename = `img-${shortId()}.${mimeToExt(mime)}`
      set({ assets: { ...get().assets, [filename]: dataUri }, isDirty: true })
      return filename
    },

    removeAsset: (name) => {
      const next = { ...get().assets }
      delete next[name]
      set({ assets: next, isDirty: true })
    },

    addFont: (dataUri, fileName) => {
      const ext = extFromName(fileName) || 'woff2'
      const family = familyFromName(fileName)
      const asset = `font-${shortId()}.${ext}`
      set({ assets: { ...get().assets, [asset]: dataUri }, isDirty: true })
      mutate((p) => ({ ...p, fonts: [...(p.fonts ?? []), { family, asset }] }))
      notify(`Schrift „${family}" hinzugefügt — in der Schriftart-Auswahl wählbar.`, 'success')
    },

    setLogo: (dataUri) => {
      const asset = get().addAssetToLibrary(dataUri)
      mutate((p) => ({
        ...p,
        meta: { ...p.meta, logo: { asset, position: p.meta.logo?.position ?? 'bottom-right' } },
      }))
      notify('Logo gesetzt — erscheint auf jeder Folie.', 'success')
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
        notify('Video/Audio gespeichert — in einer HTML-Zone einbinden (Toggle „HTML").', 'info')
        return
      }

      mutate((p) => ({
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
      notify(kind === 'image' ? 'Bild eingefügt.' : 'Medium eingefügt.', 'success')
    },

    setToken: (key, value) => {
      mutate((p) => ({ ...p, tokens: { ...p.tokens, [key]: value } }))
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
        notify(`Theme „${name}" nicht gefunden.`, 'error')
        return
      }
      mutate((p) => ({ ...p, tokens: { ...p.tokens, ...preset.tokens } }))
      notify(`Theme „${preset.label}" angewendet.`, 'success')
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
        notify('Versionshistorie ist nur in der Desktop-App verfügbar.', 'info')
        return false
      }
      if (!presentation || !filePath) {
        notify('Bitte die Präsentation zuerst speichern (Cmd/Strg+S).', 'info')
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
          meta ? 'Schnappschuss erstellt.' : 'Keine Änderungen seit dem letzten Schnappschuss.',
          meta ? 'success' : 'info',
        )
        return !!meta
      } catch (e) {
        console.error('[slideo] create_snapshot fehlgeschlagen:', e)
        notify(`Schnappschuss fehlgeschlagen: ${errMsg(e)}`, 'error')
        return false
      }
    },

    restoreSnapshot: async (id) => {
      const { filePath } = get()
      if (!isTauri() || !filePath) return
      try {
        const { presentation, assets } = await restoreSnapshotCmd(filePath, id)
        presentation.zones = renumber([...presentation.zones].sort((a, b) => a.order - b.order))
        const current = get().presentation
        if (current) pushHistory(current) // Wiederherstellen ist per Undo umkehrbar
        set({
          presentation,
          assets: assetsToMap(assets),
          isDirty: true,
          activeZoneId: presentation.zones[0]?.id ?? null,
        })
        notify('Snapshot wiederhergestellt — zum Übernehmen speichern (Cmd/Strg+S).', 'success')
      } catch (e) {
        console.error('[slideo] restore_snapshot fehlgeschlagen:', e)
        notify(`Wiederherstellen fehlgeschlagen: ${errMsg(e)}`, 'error')
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

    applyExternalPresentation: (presentation) => {
      // MCP-Änderung undoable machen.
      const current = get().presentation
      if (current) pushHistory(current)
      const zones = renumber([...presentation.zones].sort((a, b) => a.order - b.order))
      const next = { ...presentation, zones }
      // aktive Zone beibehalten, falls noch vorhanden, sonst erste Zone
      const keepActive = zones.some((z) => z.id === get().activeZoneId)
      set({
        presentation: next,
        isDirty: true,
        activeZoneId: keepActive ? get().activeZoneId : (zones[0]?.id ?? null),
      })
    },
  }
})
