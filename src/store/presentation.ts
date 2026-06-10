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
import {
  loadPresentationFile,
  savePresentationFile,
  pickOpenPath,
  pickSavePath,
  pickExportHtmlPath,
  exportHtmlFile,
  openPrintView,
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
  /** Setzt die Breite eines Bildes (Resize-Anfasser in der Vorschau), z.B. "63%". */
  resizeZoneImage: (id: string, blockIndex: number, imgIndex: number, width: string) => void
  reorderZones: (orderedIds: string[]) => void

  // Assets
  addMediaToZone: (zoneId: string, dataUri: string) => void
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
        await savePresentationFile(target, presentation, mapToAssets(get().assets))
        set({ filePath: target, isDirty: false })
        notify('Gespeichert.', 'success')
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
      const { mime } = parseDataUri(dataUri)
      const kind = mediaKind(mime)
      const zone = get().presentation?.zones.find((z) => z.id === zoneId)
      const isHtmlZone = zone?.content_type === 'html'

      // 1) Asset immer in die Library aufnehmen.
      const filename = get().addAssetToLibrary(dataUri)
      const ref = `assets/${filename}`

      // 2) Video/Audio brauchen HTML-Tags. In Markdown-Zonen würde Tiptap rohes
      //    HTML beim Bearbeiten verwerfen → daher nur in HTML-Zonen einfügen,
      //    sonst nur in die Library legen und den Nutzer hinweisen.
      if ((kind === 'video' || kind === 'audio') && !isHtmlZone) {
        notify('Video/Audio gespeichert — in einer HTML-Zone einbinden (Toggle „HTML").', 'info')
        return
      }

      mutate((p) => ({
        ...p,
        zones: p.zones.map((z) => {
          if (z.id !== zoneId) return z
          if (z.content_type === 'html') {
            const snippet =
              kind === 'video'
                ? `<video controls src="${ref}" style="max-width:100%;border-radius:var(--border-radius)"></video>`
                : kind === 'audio'
                  ? `<audio controls src="${ref}" style="width:100%"></audio>`
                  : `<img src="${ref}" alt="" />`
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
