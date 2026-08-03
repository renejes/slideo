import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { AssetMap, Presentation } from '@/types'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { logoHtml, renderFullPage, renderZoneSection } from '@/lib/renderer'
import { classifyPreviewChange } from '@/lib/preview-diff'
import { findSourceRange } from '@/lib/dom-edit'
import { htmlBlockToMarkdown } from '@/lib/tiptap-markdown'
import { isTauri, assetUrlBase } from '@/lib/tauri'
import { Icon } from '@/components/ui/Icon'

const ASSET_BASE = isTauri() ? assetUrlBase() : undefined

// Live-Vorschau der gesamten Präsentation neben dem Editor.
// Re-rendert debounced in ein isoliertes Iframe (sandbox) und scrollt zur
// aktiven Zone.
export function PreviewPane({ onCollapse }: { onCollapse?: () => void }) {
  const presentation = usePresentationStore((s) => s.presentation)
  const assets = usePresentationStore((s) => s.assets)
  const activeZoneId = usePresentationStore((s) => s.activeZoneId)
  const setActiveZone = usePresentationStore((s) => s.setActiveZone)
  const reorderZoneBlocks = usePresentationStore((s) => s.reorderZoneBlocks)
  const resizeZoneImage = usePresentationStore((s) => s.resizeZoneImage)
  const applyZoneElementOp = usePresentationStore((s) => s.applyZoneElementOp)
  const freezeZoneLayout = usePresentationStore((s) => s.freezeZoneLayout)
  const deleteZoneBlock = usePresentationStore((s) => s.deleteZoneBlock)
  const duplicateZoneBlock = usePresentationStore((s) => s.duplicateZoneBlock)
  const editZoneBlock = usePresentationStore((s) => s.editZoneBlock)
  const previewEdit = useUiStore((s) => s.previewEdit)
  const togglePreviewEdit = useUiStore((s) => s.togglePreviewEdit)
  const setHtmlReveal = useUiStore((s) => s.setHtmlReveal)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [html, setHtml] = useState('')
  // Zuletzt direkt-manipulierte Auswahl {zoneId, path} für den Re-Select nach
  // dem (debounced) Re-Render. null = nichts ausgewählt.
  const lastSel = useRef<{ zoneId: string; path: number[] } | null>(null)
  // Analog für Markdown-Block-Auswahl {zoneId, blockIndex} (Punkt 3). Gegenseitig
  // exklusiv mit lastSel — genau eine Auswahl ist aktiv.
  const lastSelBlock = useRef<{ zoneId: string; blockIndex: number } | null>(null)
  // --- In-Place-Patch der Vorschau (Spec §25 / P2·P6) ---
  // Statt bei jeder Änderung das Iframe neu zu laden (srcDoc), vergleichen wir gegen
  // den zuletzt gerenderten Stand und patchen per postMessage (Tokens / einzelne Zone).
  // lastRendered/lastAssets/lastEdit = Vergleichs-Snapshot (was das Iframe zeigt).
  const lastRendered = useRef<Presentation | null>(null)
  const lastAssets = useRef<AssetMap | null>(null)
  const lastEdit = useRef<boolean>(false)
  // reloadSeq = monotone Nonce je Voll-Reload → das srcDoc unterscheidet sich IMMER, auch
  // wenn der Voll-Render byte-gleich wäre (z.B. Import eines nicht referenzierten Assets).
  // So feuert onLoad garantiert und readyRef bleibt nie hängen — ohne fragile String-Vergleiche.
  const reloadSeq = useRef<number>(0)
  // ready = Iframe ist geladen (Skripte installiert) → sicher patchbar. busy = im
  // Iframe läuft eine Interaktion (Drag/Resize/Inline-Edit) → Patch aufschieben.
  const readyRef = useRef<boolean>(true)
  const busyRef = useRef<boolean>(false)
  // deferred = eine Änderung kam während busy/!ready → beim nächsten sicheren Moment
  // (busy:false bzw. onLoad) EINMAL nachziehen.
  const deferredRef = useRef<boolean>(false)
  // Folien-Auswahl-Popover für „Element → Folie verknüpfen" (§23). null = zu.
  const [linkPicker, setLinkPicker] = useState<{
    zoneId: string
    path: number[]
    tag?: string
    current: string
  } | null>(null)

  // In-Place-Sync der Vorschau (Spec §25 / P2·P6). Klassifiziert die Änderung gegen den
  // zuletzt gerenderten Stand und wählt die günstigste sichere Strategie:
  //   full  → renderFullPage → srcDoc (Iframe-Reload). Fallback + selten (Struktur/Assets/
  //           Fonts/Logo/previewEdit-Toggle/erster Render).
  //   patch → per postMessage: :root-Tokens und/oder einzelne .slideo-frame-Sections.
  //   none  → nichts render-relevant → nur Snapshot nachziehen.
  // Liest den Store frisch (getState) → auch vom busy/onLoad-Reconcile aufrufbar.
  // editable: Markdown-Blöcke per Drag umsortierbar (Spec §18.1). directEdit: §20-Layer.
  const syncPreview = useCallback(() => {
    const iframe = iframeRef.current
    if (!iframe) return
    const st = usePresentationStore.getState()
    const p = st.presentation
    if (!p) return
    const a = st.assets
    const edit = useUiStore.getState().previewEdit

    // Laufende Iframe-Interaktion oder Iframe (re)lädt gerade → aufschieben und beim
    // nächsten sicheren Moment (busy:false / onLoad) EINMAL nachziehen.
    if (busyRef.current || !readyRef.current) {
      deferredRef.current = true
      return
    }

    const decision = classifyPreviewChange(
      lastRendered.current,
      p,
      lastAssets.current,
      a,
      lastEdit.current,
      edit,
    )

    if (decision.kind === 'full') {
      lastRendered.current = p
      lastAssets.current = a
      lastEdit.current = edit
      reloadSeq.current += 1
      // Nonce-Kommentar im <head> → das srcDoc unterscheidet sich garantiert vom vorherigen,
      // also feuert onLoad zuverlässig (readyRef bleibt nie hängen). Kein String-Vergleich mehr,
      // dessen Prämisse (DOM == letzter Voll-Render) nach In-Place-Patches nicht mehr stimmt.
      const full = renderFullPage(p, {
        present: false,
        assets: a,
        assetUrlBase: ASSET_BASE,
        editable: true,
        directEdit: edit,
      }).replace('</head>', `<!--sld:${reloadSeq.current}--></head>`)
      readyRef.current = false
      setHtml(full)
      return
    }

    // Snapshot in jedem Fall nachziehen (auch 'none').
    lastRendered.current = p
    lastAssets.current = a
    lastEdit.current = edit
    if (decision.kind === 'none') return

    const win = iframe.contentWindow
    if (!win) return
    if (decision.tokens) {
      win.postMessage({ type: 'slideo:patch-tokens', tokens: decision.tokens }, '*')
    }
    if (decision.zoneIds.length) {
      const logo = logoHtml(p, a)
      for (const id of decision.zoneIds) {
        const zone = p.zones.find((z) => z.id === id)
        if (!zone) continue
        const frameHtml = renderZoneSection(zone, a, ASSET_BASE, true, false, logo)
        win.postMessage({ type: 'slideo:patch-zone', zoneId: id, frameHtml }, '*')
        // §20: hält die gepatchte Zone die aktuelle Auswahl → gezielt neu selektieren
        // (die alten Overlays zeigen sonst auf ersetzte, detachte Knoten).
        if (edit) {
          if (lastSel.current?.zoneId === id) {
            win.postMessage({ type: 'slideo:reselect', ...lastSel.current }, '*')
          } else if (lastSelBlock.current?.zoneId === id) {
            win.postMessage({ type: 'slideo:reselect-block', ...lastSelBlock.current }, '*')
          }
        }
      }
    }
  }, [])

  // Debounce: Änderungen ~220 ms sammeln, dann einmal synchronisieren.
  useEffect(() => {
    if (!presentation) return
    const id = setTimeout(() => syncPreview(), 220)
    return () => clearTimeout(id)
  }, [presentation, assets, previewEdit, syncPreview])

  // Beim Verlassen des Direktbearbeiten-Modus die Auswahl verwerfen.
  useEffect(() => {
    // Toggle des Bearbeiten-Modus ist eine bewusste Nutzeraktion (Pointer ist oben) → als
    // Recovery-Escape busy/deferred zurücksetzen (falls ein busy:false je verloren ging).
    busyRef.current = false
    if (!previewEdit) {
      lastSel.current = null
      lastSelBlock.current = null
      setLinkPicker(null)
      iframeRef.current?.contentWindow?.postMessage({ type: 'slideo:clear-select' }, '*')
    }
  }, [previewEdit])

  // Esc schließt das Folien-Auswahl-Popover (§23).
  useEffect(() => {
    if (!linkPicker) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        e.preventDefault()
        setLinkPicker(null)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [linkPicker])

  // §23: Popover schließen, wenn seine Zone verschwindet (z.B. MCP-Löschung der
  // ganzen Folie) — sonst zeigt es auf eine nicht mehr existierende Zone.
  useEffect(() => {
    if (linkPicker && presentation && !presentation.zones.some((z) => z.id === linkPicker.zoneId)) {
      setLinkPicker(null)
    }
  }, [presentation, linkPicker])

  // Nachrichten aus der Vorschau: Block-Reorder, Bild-Resize und
  // Direktmanipulation (Auswählen/Duplizieren/Löschen, Spec §20).
  useEffect(() => {
    // Quell-Markierung für die (ggf. nach einer Op neue) Adresse aktualisieren.
    // focusEditor:false → der Fokus bleibt im Iframe (Tastatur-Ops weiterhin aktiv).
    function reveal(zoneId: string, path: number[]) {
      const zone = usePresentationStore.getState().presentation?.zones.find((z) => z.id === zoneId)
      if (!zone || zone.content_type !== 'html') return
      const range = findSourceRange(zone.html ?? '', path)
      if (range) setHtmlReveal({ zoneId, from: range.from, to: range.to, focusEditor: false })
    }
    // lastSel (HTML-Element) und lastSelBlock (Markdown-Block) sind gegenseitig EXKLUSIV:
    // jede Auswahl-Zuweisung löscht die andere. Sonst kann eine veraltete Block-Auswahl den
    // handleLoad-Reselect „gewinnen", sobald ein Element-Op lastSel auf null setzt (Review-Fix).
    function setElemSel(s: { zoneId: string; path: number[] } | null) {
      lastSel.current = s
      lastSelBlock.current = null
    }
    function setBlockSel(s: { zoneId: string; blockIndex: number } | null) {
      lastSelBlock.current = s
      lastSel.current = null
    }
    function onMessage(e: MessageEvent) {
      // Herkunftsprüfung (Review 2026-08, Befund S15): NUR das eigene Folien-Iframe
      // darf hier steuern. Die Folien-Iframes führen bewusst untrusted KI-HTML mit
      // `script-src 'unsafe-inline'` aus — ohne diesen Einzeiler könnte ein Inline-
      // Skript in einer Zone `slideo:delete-element`, `slideo:freeze-zone` oder
      // `slideo:undo` an den Parent posten. Auswirkung war begrenzt (nur Deck-Edits,
      // undoable), der Check kostet aber nichts.
      if (iframeRef.current && e.source !== iframeRef.current.contentWindow) return
      const d = e.data || {}
      const tag = typeof d.tag === 'string' ? (d.tag as string) : undefined
      if (d.type === 'slideo:preview-busy' && typeof d.busy === 'boolean') {
        // Iframe-Interaktion (Drag/Resize/Inline-Edit) läuft/endet (Spec §25 / P2·P6).
        // Während busy schieben wir Patches auf; bei busy:false EINMAL nachziehen —
        // die Op-Nachricht (freeze/move/edit) kam davor, der Store ist also schon aktuell.
        busyRef.current = d.busy
        if (!d.busy && deferredRef.current) {
          deferredRef.current = false
          syncPreview()
        }
        return
      }
      if (d.type === 'slideo:reorder-blocks' && typeof d.zoneId === 'string' && Array.isArray(d.order)) {
        reorderZoneBlocks(d.zoneId, d.order as number[])
      } else if (
        d.type === 'slideo:resize-image' &&
        typeof d.zoneId === 'string' &&
        typeof d.blockIndex === 'number' &&
        typeof d.width === 'string'
      ) {
        resizeZoneImage(d.zoneId, d.blockIndex, typeof d.imgIndex === 'number' ? d.imgIndex : 0, d.width)
      } else if (
        d.type === 'slideo:resize-element' &&
        typeof d.zoneId === 'string' &&
        Array.isArray(d.path) &&
        typeof d.width === 'string'
      ) {
        // Bild-Resize in einer HTML-Zone (§20): nur die CSS-Breite am Pfad-Element setzen.
        applyZoneElementOp(d.zoneId, d.path as number[], 'resizeWidth', {
          width: d.width as string,
          expectTag: tag,
        })
      } else if (d.type === 'slideo:select-element' && typeof d.zoneId === 'string' && Array.isArray(d.path)) {
        // Klick → Quelle (Phase 0): Zone aktiv + Quell-Range im HTML-Editor markieren.
        const zoneId = d.zoneId as string
        const path = d.path as number[]
        setElemSel({ zoneId, path })
        setActiveZone(zoneId)
        reveal(zoneId, path)
      } else if (d.type === 'slideo:deselect') {
        setElemSel(null) // leert beide Refs
        setLinkPicker(null) // §23: kein Element mehr → das Folien-Popover schließen
      } else if (d.type === 'slideo:select-block' && typeof d.zoneId === 'string' && typeof d.blockIndex === 'number') {
        // Punkt 3: ganzer Markdown-Block ausgewählt (block-granular, kein HTML-Quell-Mapping).
        setBlockSel({ zoneId: d.zoneId, blockIndex: d.blockIndex })
        setActiveZone(d.zoneId)
      } else if (d.type === 'slideo:delete-block' && typeof d.zoneId === 'string' && typeof d.blockIndex === 'number') {
        deleteZoneBlock(d.zoneId, d.blockIndex)
        setBlockSel(null) // Block ist weg → keine Re-Auswahl
      } else if (d.type === 'slideo:duplicate-block' && typeof d.zoneId === 'string' && typeof d.blockIndex === 'number') {
        duplicateZoneBlock(d.zoneId, d.blockIndex)
        setBlockSel({ zoneId: d.zoneId, blockIndex: d.blockIndex + 1 }) // Klon (dahinter) wählen
      } else if (
        d.type === 'slideo:edit-block-text' &&
        typeof d.zoneId === 'string' &&
        typeof d.blockIndex === 'number' &&
        typeof d.html === 'string'
      ) {
        // Punkt 3b: editiertes Block-HTML → Markdown (Tiptap, gleiche Quelle der Wahrheit) → Block ersetzen.
        let markdown = ''
        try {
          markdown = htmlBlockToMarkdown(d.html as string)
        } catch {
          markdown = ''
        }
        if (markdown) editZoneBlock(d.zoneId, d.blockIndex, markdown)
        setBlockSel({ zoneId: d.zoneId, blockIndex: d.blockIndex }) // Block bleibt am selben Index
      } else if (d.type === 'slideo:duplicate-element' && typeof d.zoneId === 'string' && Array.isArray(d.path)) {
        const path = d.path as number[]
        applyZoneElementOp(d.zoneId, path, 'duplicate', { expectTag: tag })
        // Klon liegt direkt nach dem Original → Auswahl auf den Klon (lastIndex+1).
        const clone = path.slice()
        clone[clone.length - 1] += 1
        setElemSel({ zoneId: d.zoneId, path: clone })
        reveal(d.zoneId, clone)
      } else if (d.type === 'slideo:delete-element' && typeof d.zoneId === 'string' && Array.isArray(d.path)) {
        const path = d.path as number[]
        applyZoneElementOp(d.zoneId, path, 'delete', { expectTag: tag })
        // Nach dem Löschen das Eltern-Element wählen (Top-Level → keine Auswahl).
        const parentPath = path.slice(0, -1)
        setElemSel(parentPath.length ? { zoneId: d.zoneId, path: parentPath } : null)
        if (parentPath.length) reveal(d.zoneId, parentPath)
      } else if (
        d.type === 'slideo:edit-text' &&
        typeof d.zoneId === 'string' &&
        Array.isArray(d.path) &&
        typeof d.html === 'string'
      ) {
        // Phase 2: Inline-Text-Commit (bearbeitetes Inline-HTML; applyElementOp sanitisiert).
        const path = d.path as number[]
        applyZoneElementOp(d.zoneId, path, 'editText', { html: d.html as string, expectTag: tag })
        setElemSel({ zoneId: d.zoneId, path })
        reveal(d.zoneId, path)
      } else if (
        d.type === 'slideo:split-text' &&
        typeof d.zoneId === 'string' &&
        Array.isArray(d.path) &&
        typeof d.before === 'string' &&
        typeof d.after === 'string'
      ) {
        // §20: Text-Element am Cursor in zwei eigenständige Blöcke teilen (Cmd/Ctrl+Enter).
        // applyElementOp sanitisiert beide Hälften; der neue Block erbt Tag + Styling.
        const path = d.path as number[]
        applyZoneElementOp(d.zoneId, path, 'split', {
          before: d.before as string,
          after: d.after as string,
          expectTag: tag,
        })
        setElemSel({ zoneId: d.zoneId, path })
        reveal(d.zoneId, path)
      } else if (d.type === 'slideo:overflow' && Array.isArray(d.zones)) {
        // Gemessener Überlauf aus dem Iframe (Befund H5c) → Badge auf der Folienkarte.
        const map: Record<string, number> = {}
        for (const z of d.zones as { id: string; overflowPx: number }[]) {
          if (z && typeof z.id === 'string') map[z.id] = z.overflowPx | 0
        }
        useUiStore.getState().setOverflowZones(map)
      } else if (d.type === 'slideo:undo') {
        // Cmd/Z aus dem Iframe (Fokus dort) → globalen Undo auslösen.
        usePresentationStore.getState().undo()
      } else if (d.type === 'slideo:redo') {
        // Cmd+Shift+Z / Ctrl+Y aus dem Iframe (Befund H1).
        usePresentationStore.getState().redo()
      } else if (d.type === 'slideo:goto-request' && typeof d.index === 'number') {
        // Zonen-Link in der Vorschau (Nicht-Edit-Modus) angeklickt → zur Zielzone
        // scrollen (Spec §23). activeZone treibt den Vorschau-Scroll.
        const pres = usePresentationStore.getState().presentation
        if (pres) {
          const sorted = [...pres.zones].sort((a, b) => a.order - b.order)
          const z = sorted[d.index | 0]
          if (z) setActiveZone(z.id)
        }
      } else if (d.type === 'slideo:request-link' && typeof d.zoneId === 'string' && Array.isArray(d.path)) {
        // „Mit Folie verknüpfen" aus der §20-Toolbar → Folien-Auswahl-Popover öffnen.
        setLinkPicker({
          zoneId: d.zoneId,
          path: d.path as number[],
          tag,
          current: typeof d.current === 'string' ? d.current : '',
        })
      } else if (
        d.type === 'slideo:move-element' &&
        typeof d.zoneId === 'string' &&
        Array.isArray(d.path) &&
        typeof d.leftPct === 'number' &&
        typeof d.topPct === 'number'
      ) {
        // Phase 3: Verschieben → absolute %-Position (Fließ-Element wird gehoben).
        const path = d.path as number[]
        applyZoneElementOp(d.zoneId, path, 'move', {
          leftPct: d.leftPct as number,
          topPct: d.topPct as number,
          expectTag: tag,
        })
        setElemSel({ zoneId: d.zoneId, path })
        reveal(d.zoneId, path)
      } else if (d.type === 'slideo:freeze-zone' && typeof d.zoneId === 'string' && Array.isArray(d.items)) {
        // Phase 3: „Folie einfrieren" beim ersten Verschieben (alle Top-Level-Blöcke absolut).
        freezeZoneLayout(d.zoneId, d.items)
        const p = Array.isArray(d.path) ? (d.path as number[]) : null
        setElemSel(p ? { zoneId: d.zoneId, path: p } : null)
        if (p) reveal(d.zoneId, p)
      }
    }
    window.addEventListener('message', onMessage)
    return () => window.removeEventListener('message', onMessage)
  }, [reorderZoneBlocks, resizeZoneImage, applyZoneElementOp, deleteZoneBlock, duplicateZoneBlock, editZoneBlock, setActiveZone, setHtmlReveal, freezeZoneLayout, syncPreview])

  const activeIndex = useMemo(() => {
    if (!presentation) return 0
    const zones = [...presentation.zones].sort((a, b) => a.order - b.order)
    const i = zones.findIndex((z) => z.id === activeZoneId)
    return i < 0 ? 0 : i
  }, [presentation, activeZoneId])

  // Bei Wechsel der aktiven Zone sanft dorthin scrollen (ohne Reload).
  useEffect(() => {
    iframeRef.current?.contentWindow?.postMessage(
      { type: 'slideo:goto', index: activeIndex, smooth: true },
      '*',
    )
  }, [activeIndex])

  function handleLoad() {
    // Iframe geladen → Skripte (nav/edit/patch) installiert → sicher patchbar. Ein frisch
    // geladenes Dokument hat garantiert keine laufende Interaktion → busy zurücksetzen
    // (schließt „busy bleibt über einen Reload hinweg hängen" → Vorschau fröre ein).
    readyRef.current = true
    busyRef.current = false
    const win = iframeRef.current?.contentWindow
    win?.postMessage({ type: 'slideo:goto', index: activeIndex, smooth: false }, '*')
    // Auswahl nach dem Re-Render wiederherstellen (Spec §20 Re-Select-Handshake) —
    // HTML-Element über den Pfad, Markdown-Block über den Block-Index.
    if (previewEdit) {
      if (lastSel.current) win?.postMessage({ type: 'slideo:reselect', ...lastSel.current }, '*')
      else if (lastSelBlock.current)
        win?.postMessage({ type: 'slideo:reselect-block', ...lastSelBlock.current }, '*')
    }
    // Während des (Re)Loads aufgeschobene Änderung jetzt EINMAL nachziehen.
    if (deferredRef.current) {
      deferredRef.current = false
      syncPreview()
    }
  }

  // §23: gewählte Ziel-Folie auf das verknüpfte Element schreiben (oder Link lösen).
  function chooseLink(target: string) {
    if (!linkPicker) return
    applyZoneElementOp(linkPicker.zoneId, linkPicker.path, 'setGoto', {
      target,
      expectTag: linkPicker.tag,
    })
    // Auswahl über den Re-Render hinweg halten (§20 Re-Select-Handshake).
    lastSel.current = { zoneId: linkPicker.zoneId, path: linkPicker.path }
    lastSelBlock.current = null
    setLinkPicker(null)
  }

  const pickerZones = useMemo(
    () => (presentation ? [...presentation.zones].sort((a, b) => a.order - b.order) : []),
    [presentation],
  )

  return (
    <section className="relative flex h-full w-full flex-col border-l border-chrome-border bg-chrome-bg">
      <div className="flex h-9 shrink-0 items-center gap-1.5 px-3.5 text-chrome-muted">
        <Icon name="visibility" size={15} weight={400} />
        <span className="text-[11px] font-semibold uppercase tracking-wider">Vorschau</span>
        <div className="ml-auto flex items-center gap-1">
          <button
            onClick={togglePreviewEdit}
            aria-pressed={previewEdit}
            title="Direktbearbeiten: in der Vorschau anklicken — HTML-Elemente bzw. Markdown-Blöcke: Text bearbeiten (Doppelklick), duplizieren, löschen"
            className={
              'flex items-center gap-1.5 rounded-md px-2 py-1 text-[11px] font-medium transition-colors ' +
              (previewEdit
                ? 'bg-chrome-accent-soft text-chrome-accent-600'
                : 'text-chrome-muted hover:text-chrome-text')
            }
          >
            <Icon name="arrow_selector_tool" size={15} weight={400} />
            {/* „Direktbearbeiten" statt „Bearbeiten" (Review 2026-08, Befund M28):
                deckungsgleich mit dem eigenen Tooltip und ehrlich gegenüber dem,
                was der Toggle NICHT abschaltet — Block-Drag und Bild-Resize sind
                Hover-Werkzeuge der Vorschau und laufen unabhängig davon. */}
            Direktbearbeiten
          </button>
          {onCollapse && (
            <button
              onClick={onCollapse}
              title="Vorschau einklappen"
              aria-label="Vorschau einklappen"
              className="flex h-7 w-7 items-center justify-center rounded-md text-chrome-muted transition-colors hover:bg-chrome-surface-2 hover:text-chrome-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-chrome-accent/40"
            >
              <Icon name="chevron_right" size={18} />
            </button>
          )}
        </div>
      </div>
      <div className="min-h-0 flex-1 p-3.5 pt-0">
        <iframe
          ref={iframeRef}
          srcDoc={html}
          onLoad={handleLoad}
          title="Vorschau"
          sandbox="allow-scripts"
          className="h-full w-full rounded-xl border border-chrome-border bg-black shadow-card"
        />
      </div>

      {/* §23: Folien-Auswahl für „Element → Folie verknüpfen". Klick auf Backdrop/Esc schließt. */}
      {linkPicker && (
        <div
          className="absolute inset-0 z-30 flex items-center justify-center bg-black/15 p-4"
          onClick={() => setLinkPicker(null)}
        >
          <div
            role="dialog"
            aria-label="Mit Folie verknüpfen"
            onClick={(e) => e.stopPropagation()}
            className="flex max-h-full w-72 flex-col overflow-hidden rounded-xl border border-chrome-border bg-chrome-surface shadow-pop"
          >
            <div className="flex items-center gap-1.5 border-b border-chrome-border px-3 py-2">
              <Icon name="link" size={15} weight={400} />
              <span className="text-[12px] font-semibold text-chrome-text">Mit Folie verknüpfen</span>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto py-1">
              {pickerZones.length === 0 ? (
                <div className="px-3 py-2 text-[12px] text-chrome-muted">Keine Folien.</div>
              ) : (
                pickerZones.map((z, i) => {
                  const active = linkPicker.current === z.id || linkPicker.current === String(i + 1)
                  return (
                    <button
                      key={z.id}
                      onClick={() => chooseLink(z.id)}
                      className={
                        'flex w-full items-center gap-2 px-3 py-1.5 text-left text-[13px] transition-colors hover:bg-chrome-surface-2 ' +
                        (active ? 'font-medium text-chrome-accent-600' : 'text-chrome-text')
                      }
                    >
                      <span className="w-6 shrink-0 text-[11px] tabular-nums text-chrome-muted">{i + 1}</span>
                      <span className="min-w-0 flex-1 truncate">{z.label || `Folie ${i + 1}`}</span>
                    </button>
                  )
                })
              )}
            </div>
            {linkPicker.current && (
              <button
                onClick={() => chooseLink('')}
                className="border-t border-chrome-border px-3 py-2 text-left text-[12px] text-chrome-muted transition-colors hover:text-chrome-text"
              >
                Link entfernen
              </button>
            )}
          </div>
        </div>
      )}
    </section>
  )
}
