import { create } from 'zustand'
import {
  type Presentation,
  type Zone,
  type ZoneStyle,
  type ContentType,
  type DesignTokens,
  type AssetMap,
  DEFAULT_TOKENS,
  DEFAULT_ZONE_STYLE,
  FILE_FORMAT_VERSION,
} from '@/types'
import { markdownToHtml } from '@/lib/markdown-tiptap'
import { assetsToMap, mapToAssets, parseDataUri, mimeToExt, mediaKind, shortId } from '@/lib/assets'
import {
  loadPresentationFile,
  savePresentationFile,
  pickOpenPath,
  pickSavePath,
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
  newPresentation: (title: string) => void
  loadPresentation: (path: string) => Promise<void>
  openPresentationDialog: () => Promise<void>
  savePresentation: (path?: string) => Promise<void>
  savePresentationAsDialog: () => Promise<void>

  // Zones
  createZone: (afterId?: string, markdown?: string) => string
  deleteZone: (id: string) => void
  updateZoneMarkdown: (id: string, markdown: string) => void
  updateZoneHtml: (id: string, html: string) => void
  updateZoneCss: (id: string, css: string) => void
  setZoneContentType: (id: string, contentType: ContentType) => void
  updateZoneStyle: (id: string, style: Partial<ZoneStyle>) => void
  updateZoneLabel: (id: string, label: string) => void
  reorderZones: (orderedIds: string[]) => void

  // Assets
  addMediaToZone: (zoneId: string, dataUri: string) => void
  addAssetToLibrary: (dataUri: string) => string
  removeAsset: (name: string) => void

  // Tokens
  setToken: (key: string, value: string) => void
  setTokensBulk: (tokens: Record<string, string>) => void
  resetTokens: () => void

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

function makePresentation(title: string): Presentation {
  const created = now()
  return {
    version: FILE_FORMAT_VERSION,
    meta: { title, created, modified: created },
    tokens: { ...DEFAULT_TOKENS },
    zones: [makeZone(0, `# ${title}\n\nDein erster Slide. Leg los.`)],
  }
}

/** Re-normalisiert die `order`-Felder auf 0..n-1 entsprechend Array-Reihenfolge. */
function renumber(zones: Zone[]): Zone[] {
  return zones.map((z, i) => (z.order === i ? z : { ...z, order: i }))
}

const PAST_CAP = 50
const clone = (p: Presentation): Presentation => JSON.parse(JSON.stringify(p))

export const usePresentationStore = create<PresentationState>((set, get) => {
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

    newPresentation: (title) => {
      const presentation = makePresentation(title || 'Unbenannt')
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
