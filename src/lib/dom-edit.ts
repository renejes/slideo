// Direktmanipulation in der Vorschau (Spec §20).
//
// Elemente einer HTML-Zone werden über einen **Kind-Index-Pfad** adressiert, der
// an `.slideo-content` verankert ist (= das oberste Level von `zone.html`). Kein
// ID-/Schema-Eingriff: Der Renderer gibt `zone.html` strukturell 1:1 aus, daher
// ist der im Live-DOM berechnete Pfad eine stabile, bidirektionale Adresse auf
// das geparste rohe Quell-DOM.
//
// Zwei Funktionen:
//  - `applyElementOp` mutiert das **rohe** `zone.html` per `DOMParser` (Browser-
//    Runtime). `resolveAssetRefs` ändert nur Attribut-*Werte* (`src`), nicht die
//    Element-*Struktur* → der Pfad passt; `assets/x`-Refs bleiben beim
//    Re-Serialisieren erhalten.
//  - `findSourceRange` liefert die Quell-Range des öffnenden Tags für
//    „Klick → Quelle" (CodeMirror-Markierung). Verankert am SELBEN DOMParser-
//    Parse wie die Ops (kein eigenes Tree-Construction-Modell → keine Divergenz
//    bei implizitem `<tbody>`/Auto-Close): Zielelement via Pfad auflösen, seinen
//    Dokument-Index unter gleichnamigen Elementen bestimmen, das n-te öffnende
//    Tag-Literal im Quelltext finden (implizite Elemente haben kein Literal).

export type ElementOp = 'move' | 'editText' | 'duplicate' | 'delete' | 'resizeWidth' | 'setGoto' | 'split'

/** Payload je Operation (alle Felder optional; je Op werden andere genutzt). */
export interface OpPayload {
  /** move: linke Position in % der Folien-Box. */
  leftPct?: number
  /** move: obere Position in % der Folien-Box. */
  topPct?: number
  /** editText: bearbeitetes Inline-HTML aus dem contenteditable (wird sanitisiert). */
  html?: string
  /** split: Inline-HTML vor dem Cursor (bleibt im Original-Element). */
  before?: string
  /** split: Inline-HTML nach dem Cursor (kommt in den neuen Geschwister-Block). */
  after?: string
  /** resizeWidth: neue CSS-Breite (z.B. "42%" oder "300px") für ein Bild (Spec §20-Resize). */
  width?: string
  /**
   * setGoto: Zonen-Link-Ziel (Spec §23) — Zonen-UUID oder 1-basierte Foliennummer.
   * Leerer/fehlender Wert entfernt das `data-slideo-goto`-Attribut (Link lösen).
   */
  target?: string
  /**
   * Optionaler Tag-Name, den das per Pfad aufgelöste Element haben MUSS, sonst
   * No-op. Schützt vor stale Pfaden, wenn ein paralleler MCP-Edit die Zone
   * zwischen Auswahl und Op umgebaut hat (Spec §20, Risiko §8 des Plans).
   */
  expectTag?: string
}

function round2(n: number): number {
  return Math.round(n * 100) / 100
}

/**
 * Sanitisiert ein Zonen-Link-Ziel fürs `data-slideo-goto`-Attribut (Spec §23) —
 * nur unverfängliche Zeichen, ≤64 (kein Attribut-Ausbruch). Spiegelt `safe_goto`
 * der Rust-`toc`-Komponente, damit Direktmanipulation & Komponente identisch sind.
 */
export function safeGoto(t: string): string {
  return (t || '').replace(/[^A-Za-z0-9_:-]/g, '').slice(0, 64)
}

// Inline-Tags, die in einem text-editierbaren Element vorkommen dürfen (Stil/Links
// bleiben so beim Edit erhalten); alles andere = Block/Struktur → nicht editierbar.
const INLINE_OK = new Set([
  'a', 'abbr', 'b', 'bdi', 'bdo', 'br', 'cite', 'code', 'data', 'dfn', 'em', 'i',
  'kbd', 'mark', 'q', 'rp', 'rt', 'ruby', 's', 'samp', 'small', 'span', 'strong',
  'sub', 'sup', 'time', 'u', 'var', 'wbr', 'font', 'big', 'tt',
])
const SAFE_ATTR = new Set([
  'class', 'style', 'data-id', 'title', 'href', 'target', 'rel', 'lang', 'dir', 'datetime',
])
// Vollständig entfernen (inkl. Inhalt) — sonst leckt z.B. Script-Text als Text.
const DROP_TAGS = new Set([
  'script', 'style', 'noscript', 'template', 'iframe', 'object', 'embed',
  'head', 'meta', 'link', 'title',
])

/**
 * true, wenn alle direkten Kind-Elemente Inline-Elemente sind (kein Block-Markup).
 * Dann kann ein contenteditable-Edit den Knoten gefahrlos durch sein bearbeitetes
 * Inline-HTML ersetzen, ohne verschachtelte Struktur/Komponenten zu zerstören.
 * Block-Container (Karten, Komponenten, data-id-Wrapper) sind NICHT editierbar.
 */
function isInlineEditable(el: Element): boolean {
  // TIEF prüfen: JEDES Nachfahre-Element muss inline-sicher sein. Ein nicht-inline
  // Element (z.B. <img>/<svg> in einem Inline-Wrapper wie <a>/<span>) würde sonst
  // beim Commit von sanitizeInline still verworfen (Datenverlust) — solche Blöcke
  // bleiben dem Quell-/Markdown-Editor vorbehalten.
  const all = el.getElementsByTagName('*')
  for (let i = 0; i < all.length; i++) {
    if (!INLINE_OK.has(all[i].tagName.toLowerCase())) return false
  }
  return true
}

/** Kopiert nur erlaubtes Inline-Markup (+ Text) rekursiv nach `target`. */
function cleanInto(src: Node, target: Element, doc: Document): void {
  for (const node of Array.from(src.childNodes)) {
    if (node.nodeType === 3) {
      target.appendChild(doc.createTextNode(node.textContent ?? ''))
    } else if (node.nodeType === 1) {
      const el = node as Element
      const tag = el.tagName.toLowerCase()
      if (DROP_TAGS.has(tag)) {
        continue // Element + Inhalt verwerfen
      } else if (INLINE_OK.has(tag)) {
        const clean = doc.createElement(tag)
        for (const attr of Array.from(el.attributes)) {
          const name = attr.name.toLowerCase()
          if (name.startsWith('on') || !SAFE_ATTR.has(name)) continue
          let val = attr.value
          if (name === 'href' && /^\s*javascript:/i.test(val)) continue
          if (name === 'style') val = val.replace(/url\s*\([^)]*\)/gi, '').replace(/expression\s*\(/gi, '')
          clean.setAttribute(attr.name, val)
        }
        cleanInto(el, clean, doc)
        target.appendChild(clean)
      } else {
        cleanInto(el, target, doc) // unbekanntes Tag entfernen, Inhalt behalten
      }
    }
  }
}

/** Säubert contenteditable-HTML auf sicheres Inline-Markup (für editText). */
function sanitizeInline(html: string): string {
  const doc = new DOMParser().parseFromString('<body>' + html + '</body>', 'text/html')
  const out = doc.createElement('div')
  cleanInto(doc.body, out, doc)
  return out.innerHTML
}

/** Navigiert die Element-Kinder ab `root` per Pfad; null bei ungültigem Pfad. */
function elementAtPath(root: Element, path: number[]): Element | null {
  if (path.length === 0) return null
  let el: Element = root
  for (const idx of path) {
    const kids = el.children
    if (idx < 0 || idx >= kids.length) return null
    el = kids[idx]
  }
  return el
}

/** Bumpt einen `%`-Wert um delta, falls parsebar; sonst unverändert. */
function bumpPct(value: string | undefined, delta: number): string | null {
  const m = /^\s*(-?\d*\.?\d+)%\s*$/.exec(value ?? '')
  if (!m) return null
  return `${round2(parseFloat(m[1]) + delta)}%`
}

/** Versetzt ein dupliziertes, absolut positioniertes Element leicht (sichtbar). */
function offsetIfAbsolute(el: Element): void {
  const he = el as HTMLElement
  if (!he.style) return
  const pos = he.style.position
  if (pos !== 'absolute' && pos !== 'fixed') return
  const left = bumpPct(he.style.left, 2)
  const top = bumpPct(he.style.top, 2)
  if (left) he.style.left = left
  if (top) he.style.top = top
}

/**
 * Wendet eine Direktmanipulations-Operation auf das **rohe** `zone.html` an und
 * gibt das neue HTML zurück. Bei ungültigem Pfad bleibt das HTML unverändert.
 */
export function applyElementOp(
  html: string,
  path: number[],
  op: ElementOp,
  payload?: OpPayload,
): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const el = elementAtPath(doc.body, path)
  if (!el) return html
  // Stale-Pfad-Schutz: trifft der Pfad nach einem parallelen MCP-Umbau ein
  // ANDERES (aber existierendes) Element, würde die Op still das Falsche treffen.
  if (payload?.expectTag && el.tagName.toLowerCase() !== payload.expectTag.toLowerCase()) {
    return html
  }

  switch (op) {
    case 'delete':
      el.remove()
      break
    case 'duplicate': {
      const clone = el.cloneNode(true) as Element
      offsetIfAbsolute(clone)
      el.parentNode?.insertBefore(clone, el.nextSibling)
      break
    }
    case 'editText': {
      // Bearbeitetes Inline-HTML übernehmen (Stil/Links/<br> bleiben erhalten),
      // auf sicheres Inline-Markup gesäubert. Defensiv: Container mit Block-Kindern
      // werden NICHT editiert (kein Flatten bei stale Pfad / MCP-Umbau).
      if (!isInlineEditable(el)) return html
      ;(el as HTMLElement).innerHTML = sanitizeInline(payload?.html ?? '')
      break
    }
    case 'split': {
      // §20: ein Text-Element am Cursor in zwei eigenständige Geschwister-Blöcke
      // teilen. Original behält den Teil davor; ein FLACHER Klon (gleicher Tag +
      // Attribute → Klasse/Styling bleibt erhalten) bekommt den Teil danach.
      // Beide Seiten werden auf sicheres Inline-Markup gesäubert.
      if (!isInlineEditable(el)) return html
      ;(el as HTMLElement).innerHTML = sanitizeInline(payload?.before ?? '')
      const sib = el.cloneNode(false) as HTMLElement
      sib.innerHTML = sanitizeInline(payload?.after ?? '')
      el.parentNode?.insertBefore(sib, el.nextSibling)
      break
    }
    case 'resizeWidth': {
      // Bild-Resize (§20): nur die CSS-Breite setzen, übrige Styles (Position!) bleiben.
      const he = el as HTMLElement
      if (payload?.width) he.style.width = payload.width
      break
    }
    case 'setGoto': {
      // Zonen-Link (§23): das Element zu einem Sprung-Ziel machen (oder den Link
      // lösen). Leeres Ziel ⇒ Attribut entfernen → next===current bei „war nicht
      // gesetzt" (Store macht daraus einen No-op, kein leerer Undo-Eintrag).
      const target = safeGoto(payload?.target ?? '')
      if (target) el.setAttribute('data-slideo-goto', target)
      else el.removeAttribute('data-slideo-goto')
      break
    }
    case 'move': {
      // Fließ-Elemente werden „aufs Canvas gehoben" (position:absolute, Offene
      // Entscheidung 2); bereits fixed bleibt fixed. Position als % (responsiv).
      // margin:0, damit left/top die BORDER-Kante exakt treffen (sonst versetzt der
      // ursprüngliche Außenabstand das absolut positionierte Element).
      const he = el as HTMLElement
      if (he.style.position !== 'fixed') he.style.position = 'absolute'
      he.style.margin = '0'
      he.style.left = `${round2(payload?.leftPct ?? 0)}%`
      he.style.top = `${round2(payload?.topPct ?? 0)}%`
      break
    }
  }
  return doc.body.innerHTML
}

/**
 * Ein einzufrierendes Element. Zwei Varianten:
 *  - **Absolut-Pin** (Fluss-Kind / gezogenes Element): `leftPct`/`topPct`/`widthPct`
 *    gesetzt → `position:absolute` an dieser Position/Größe (% des Containing Blocks).
 *  - **Container-Pin** (Fluss-Eltern): `heightPx` gesetzt → fixiert NUR `height`
 *    (+ `box-sizing:border-box`) gegen Kollaps, damit %-positionierte Kinder nicht
 *    springen. `position` wird bewusst NIE geändert → es entsteht KEIN neuer
 *    Containing-Block, sodass bereits-absolute Geschwister ihren CB behalten.
 */
export interface FreezeItem {
  path: number[]
  leftPct?: number
  topPct?: number
  widthPct?: number
  heightPx?: number
  /** Erwarteter Tag-Name (Schutz vor stale Pfaden bei parallelem MCP-Edit). */
  expectTag?: string
}

/**
 * „Folie einfrieren" (Spec §20): pinnt beim ersten Verschieben den Fluss-Kontext des
 * gezogenen Elements — alle Fluss-Geschwister absolut an ihre Ist-Position+Größe und
 * den Fluss-Eltern auf seine Ist-Höhe (gegen Kollaps) —, damit nichts mehr nachrückt.
 * Positionen werden im Iframe (mit Layout) gemessen.
 */
export function applyFreezeLayout(html: string, items: FreezeItem[]): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  let changed = false
  for (const it of items) {
    if (!it || !Array.isArray(it.path)) continue
    const el = elementAtPath(doc.body, it.path) as HTMLElement | null
    if (!el || !el.style) continue
    // Stale-Pfad-Schutz (paralleler MCP-Umbau zwischen Drag-Start und Op).
    if (it.expectTag && el.tagName.toLowerCase() !== it.expectTag.toLowerCase()) continue
    if (Number.isFinite(it.heightPx)) {
      // Container-Pin: NUR Höhe fixieren (gegen Kollaps → %-positionierte Kinder
      // bleiben stehen). Position wird bewusst NICHT geändert — sonst entstünde ein
      // neuer Containing-Block und bereits-absolute Geschwister würden verspringen.
      el.style.boxSizing = 'border-box'
      el.style.height = `${round2(it.heightPx as number)}px`
      changed = true
      continue
    }
    if (!Number.isFinite(it.leftPct) || !Number.isFinite(it.topPct) || !Number.isFinite(it.widthPct)) continue
    if (el.style.position !== 'fixed') el.style.position = 'absolute'
    el.style.margin = '0'
    el.style.boxSizing = 'border-box'
    el.style.left = `${round2(it.leftPct as number)}%`
    el.style.top = `${round2(it.topPct as number)}%`
    el.style.width = `${round2(it.widthPct as number)}%`
    changed = true
  }
  return changed ? doc.body.innerHTML : html
}

export interface SourceRange {
  from: number
  to: number
}

// Elemente, deren Inhalt roh ist (Kind-`<...>` sind Text, keine echten Tags) —
// damit ein `<div` in JS/CSS nicht als Element-Start gezählt wird.
const RAWTEXT_TAGS = new Set(['script', 'style'])

/** Findet das Ende (Index nach `>`) eines Tags ab `start` (= Index von `<`). */
function tagEnd(html: string, start: number): number {
  const n = html.length
  let i = start + 1
  let quote = ''
  while (i < n) {
    const c = html[i]
    if (quote) {
      if (c === quote) quote = ''
    } else if (c === '"' || c === "'") {
      quote = c
    } else if (c === '>') {
      return i + 1
    }
    i++
  }
  return n
}

/** Dokument-Reihenfolge-Index von `target` unter allen gleichnamigen Elementen. */
function sameTagDocIndex(root: Element, target: Element, tagLower: string): number {
  let count = 0
  let found = -1
  let done = false
  const visit = (el: Element): void => {
    const kids = el.children
    for (let i = 0; i < kids.length && !done; i++) {
      const c = kids[i]
      if (c === target) {
        found = count
        done = true
        return
      }
      if (c.tagName.toLowerCase() === tagLower) count++
      visit(c)
    }
  }
  visit(root)
  return found
}

/** Alle öffnenden-Tag-Ranges namens `tagLower` im rohen `html` (Quell-Reihenfolge). */
function openTagRanges(html: string, tagLower: string): SourceRange[] {
  const out: SourceRange[] = []
  const len = html.length
  let i = 0
  while (i < len) {
    const lt = html.indexOf('<', i)
    if (lt < 0) break
    i = lt
    if (html.startsWith('<!--', i)) {
      const e = html.indexOf('-->', i + 4)
      i = e < 0 ? len : e + 3
      continue
    }
    if (html[i + 1] === '!') {
      const g = html.indexOf('>', i)
      i = g < 0 ? len : g + 1
      continue
    }
    if (html[i + 1] === '/') {
      i = tagEnd(html, i) // schließendes Tag überspringen
      continue
    }
    const m = /^[a-zA-Z][a-zA-Z0-9:-]*/.exec(html.slice(i + 1, i + 64))
    if (!m) {
      i += 1
      continue
    }
    const name = m[0].toLowerCase()
    const end = tagEnd(html, i)
    if (name === tagLower) out.push({ from: i, to: end })
    // Roh-Text-Elemente (script/style) als Block überspringen.
    if (RAWTEXT_TAGS.has(name)) {
      const close = new RegExp('</' + name + '\\s*>', 'i').exec(html.slice(end))
      i = close ? end + close.index + close[0].length : len
      continue
    }
    i = end
  }
  return out
}

/** Anzahl gleichnamiger Elemente im Teilbaum (Zuverlässigkeits-Prüfung). */
function countSameTag(root: Element, tagLower: string): number {
  let n = 0
  const walk = (el: Element): void => {
    for (const c of el.children) {
      if (c.tagName.toLowerCase() === tagLower) n++
      walk(c)
    }
  }
  walk(root)
  return n
}

/**
 * Quell-Range des **öffnenden Tags** des Elements am Kind-Index-Pfad — für
 * „Klick → Quelle" (CodeMirror-Markierung). Verankert am SELBEN HTML5-Parse wie
 * `pathOf` (Live-DOM) und `applyElementOp` (DOMParser): wir lösen das Zielelement
 * via DOMParser auf (deckungsgleich mit dem Live-DOM-Pfad, inkl. implizitem
 * `<tbody>` / Auto-Close), bestimmen seinen Dokument-Reihenfolge-Index unter
 * gleichnamigen Elementen und nehmen das gleichrangige öffnende Tag-Literal aus
 * dem rohen Quelltext.
 *
 * Zuverlässigkeits-Guard: nur wenn die Zahl der Quell-Literale exakt der Zahl der
 * gleichnamigen Elemente entspricht, ist die Element↔Literal-Zuordnung sicher.
 * Synthetisiert/verwirft der HTML5-Parser Elemente (z.B. leeres `<p>` aus einem
 * verirrten `</p>`, impliziter `<tbody>`, Foster-Parenting), stimmt die Zählung
 * nicht → wir geben **null** zurück (keine Markierung) statt einer falschen Stelle.
 */
export function findSourceRange(html: string, path: number[]): SourceRange | null {
  if (path.length === 0) return null
  const doc = new DOMParser().parseFromString(html, 'text/html')
  const target = elementAtPath(doc.body, path)
  if (!target) return null
  const tag = target.tagName.toLowerCase()
  const k = sameTagDocIndex(doc.body, target, tag)
  if (k < 0) return null
  const ranges = openTagRanges(html, tag)
  if (ranges.length !== countSameTag(doc.body, tag) || k >= ranges.length) return null
  return ranges[k]
}
