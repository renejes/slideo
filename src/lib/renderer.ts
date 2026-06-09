import type { Presentation, Zone, AssetMap } from '@/types'
import { markdownToHtml } from './markdown-tiptap'
import { tokensToCssString } from './tokens'
import { mediaKind, parseDataUri } from './assets'

// Renderer: Markdown + Tokens → in sich geschlossene HTML-Page.
//
// Pipeline (Spec §6):
//   Zone.markdown → HTML (markdown-it) → Zone-Template mit CSS-Klassen
//   → CSS Custom Properties aus Tokens injiziert.
//
// Wichtig: Der gerenderte Inhalt nutzt KEIN Tailwind, sondern eigenes CSS auf
// Basis der Token-CSS-Variablen. So ist die Page vollständig offline & portabel
// (passend zu "DSGVO-konform, läuft lokal").

function escapeAttr(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;')
}

/**
 * Scoped das Custom-CSS einer Zone auf deren Container (`#zone-<id>`), damit es
 * nicht auf andere Folien überläuft. Leichtgewichtiger Parser: prefixt jeden
 * Selektor mit dem Scope; @media/@supports/@container/@layer werden rekursiv
 * gescoped; @keyframes/@font-face bleiben unangetastet.
 */
function scopeCss(rawCss: string, scope: string): string {
  const css = rawCss.replace(/\/\*[\s\S]*?\*\//g, '') // Kommentare entfernen
  let out = ''
  let i = 0
  const n = css.length
  while (i < n) {
    while (i < n && /\s/.test(css[i])) i++
    if (i >= n) break
    const start = i
    while (i < n && css[i] !== '{' && css[i] !== ';' && css[i] !== '}') i++
    const prelude = css.slice(start, i).trim()
    if (i >= n || css[i] === '}') {
      if (css[i] === '}') i++
      continue
    }
    if (css[i] === ';') {
      i++ // At-Statement wie @import …;
      if (prelude) out += `${prelude};\n`
      continue
    }
    // css[i] === '{' → passende schließende Klammer finden
    i++
    let depth = 1
    const bodyStart = i
    while (i < n && depth > 0) {
      if (css[i] === '{') depth++
      else if (css[i] === '}') {
        depth--
        if (depth === 0) break
      }
      i++
    }
    const body = css.slice(bodyStart, i)
    i++ // '}' konsumieren
    const at = prelude.startsWith('@') ? prelude.split(/\s+/)[0].toLowerCase() : ''
    if (at === '@media' || at === '@supports' || at === '@container' || at === '@layer') {
      out += `${prelude} {\n${scopeCss(body, scope)}}\n`
    } else if (at) {
      out += `${prelude} {${body}}\n` // @keyframes/@font-face etc. unverändert
    } else {
      const scoped = prelude
        .split(',')
        .map((sel) => `${scope} ${sel.trim()}`)
        .join(', ')
      out += `${scoped} {${body}}\n`
    }
  }
  return out
}

/**
 * Ersetzt `assets/<name>`-Referenzen durch eine ladbare Quelle.
 * - Bilder → Data-URI (inline, klein, zuverlässig).
 * - Video/Audio → Custom-Protocol-URL (`urlBase`), damit große Medien gestreamt
 *   statt als base64 inline eingebettet werden. Ohne `urlBase` (Browser-Dev)
 *   Fallback auf Data-URI.
 */
function resolveAssetRefs(html: string, assets?: AssetMap, urlBase?: string): string {
  if (!assets) return html
  let out = html
  for (const [name, dataUri] of Object.entries(assets)) {
    const kind = mediaKind(parseDataUri(dataUri).mime)
    const replacement =
      urlBase && (kind === 'video' || kind === 'audio') ? `${urlBase}${name}` : dataUri
    out = out.split(`assets/${name}`).join(replacement)
  }
  return out
}

/** Stylesheet für Layout-Container + Content-Elemente (token-getrieben). */
const SLIDE_CSS = `
* { box-sizing: border-box; }
html, body { margin: 0; padding: 0; }
body {
  background: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-body), system-ui, -apple-system, sans-serif;
  -webkit-font-smoothing: antialiased;
}
.slideo-zone {
  position: relative;
  width: 100%;
  min-height: 100vh;
  display: flex;
  background: var(--color-bg);
}
.slideo-zone.layout-center { align-items: center; justify-content: center; }
.slideo-zone.layout-hero   { align-items: center; justify-content: center; }
.slideo-zone.layout-top    { align-items: flex-start; justify-content: center; }
.slideo-zone.layout-full   { align-items: stretch; justify-content: stretch; }
.slideo-zone.layout-split  { align-items: center; justify-content: center; }

.slideo-content { width: 100%; max-width: 56rem; }
.layout-full .slideo-content  { max-width: none; }
.layout-split .slideo-content { max-width: 68rem; }
.layout-hero .slideo-content  { max-width: 60rem; }

.align-left   .slideo-content { text-align: left; }
.align-center .slideo-content { text-align: center; }
.align-right  .slideo-content { text-align: right; }

/* Zwei-Spalten-Layout (Markdown an '+++' getrennt; deckt auch Bild+Text ab). */
.slideo-columns { display: flex; gap: 3rem; align-items: center; width: 100%; }
.slideo-col { flex: 1 1 0; min-width: 0; }
.slideo-col > :first-child { margin-top: 0; }
.slideo-col > :last-child { margin-bottom: 0; }
.slideo-col img { width: 100%; height: auto; }

/* Hero: große, zentrierte Titel-Folie. */
.slideo-zone.layout-hero .slideo-content { text-align: center; }
.layout-hero h1 { font-size: calc(var(--font-size-base) * 4); line-height: 1.05; }
.layout-hero p { font-size: calc(var(--font-size-base) * 1.4); color: var(--color-secondary); }

.slideo-content > :first-child { margin-top: 0; }
.slideo-content > :last-child  { margin-bottom: 0; }

.slideo-content h1 {
  font-family: var(--font-heading), var(--font-body), sans-serif;
  font-size: calc(var(--font-size-base) * 3);
  font-weight: 800; line-height: 1.08; margin: 0 0 0.4em;
  color: var(--color-text);
}
.slideo-content h2 {
  font-family: var(--font-heading), var(--font-body), sans-serif;
  font-size: calc(var(--font-size-base) * 1.875);
  font-weight: 600; line-height: 1.2; margin: 1em 0 0.4em;
  color: var(--color-text);
}
.slideo-content h3 {
  font-family: var(--font-heading), var(--font-body), sans-serif;
  font-size: calc(var(--font-size-base) * 1.5);
  font-weight: 500; line-height: 1.3; margin: 1em 0 0.4em;
  color: var(--color-text);
}
.slideo-content p {
  font-size: calc(var(--font-size-base) * 1.125);
  line-height: 1.7; margin: 0 0 0.75em;
}
.slideo-content ul, .slideo-content ol {
  font-size: calc(var(--font-size-base) * 1.125);
  line-height: 1.7; margin: 0 0 0.75em; padding-left: 1.5em;
  display: flex; flex-direction: column; gap: 0.35em;
}
.slideo-content ul { list-style: disc; }
.slideo-content ol { list-style: decimal; }
.align-center .slideo-content ul,
.align-center .slideo-content ol { display: inline-flex; text-align: left; }
.slideo-content a { color: var(--color-primary); text-decoration: underline; text-underline-offset: 2px; }
.slideo-content strong { font-weight: 700; color: var(--color-accent); }
.slideo-content em { font-style: italic; }
.slideo-content blockquote {
  border-left: 3px solid var(--color-primary);
  padding-left: 1em; margin: 0 0 0.75em; color: var(--color-secondary);
}
.slideo-content code {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  background: var(--color-surface); padding: 0.15em 0.4em;
  border-radius: calc(var(--border-radius) * 0.5); font-size: 0.9em;
}
.slideo-content pre {
  background: var(--color-surface); color: var(--color-text);
  padding: 1em 1.25em; border-radius: var(--border-radius);
  overflow: auto; margin: 0 0 0.75em; text-align: left;
}
.slideo-content pre code { background: none; padding: 0; }
.slideo-content img { max-width: 100%; border-radius: var(--border-radius); }
.slideo-content hr { border: 0; border-top: 1px solid var(--color-surface); margin: 1.5em 0; }
.slideo-content table { border-collapse: collapse; width: 100%; }
.slideo-content th, .slideo-content td { border: 1px solid var(--color-surface); padding: 0.5em 0.75em; }
`.trim()

/**
 * Navigations-Script für Iframe ↔ Parent (postMessage).
 * `keys` schaltet Tastatur-Navigation ein (nur im Präsentationsmodus).
 */
function navScript(keys: boolean): string {
  return `
(function () {
  // REPORT: nur der Präsentations-Deck (Tastatur aktiv) meldet den Index zurück.
  // Vorschau-Iframes (z.B. Speaker-Ansicht) dürfen NICHT melden, sonst entsteht
  // eine Rückkopplung über die "nächste Folie".
  var REPORT = ${keys ? 'true' : 'false'};
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slideo-zone'));
  var current = 0;
  function clamp(i) { return Math.max(0, Math.min(i, slides.length - 1)); }
  function go(i, smooth) {
    current = clamp(i);
    var el = slides[current];
    if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    if (REPORT) parent.postMessage({ type: 'slideo:index', index: current, count: slides.length }, '*');
  }
  ${
    keys
      ? `window.addEventListener('keydown', function (e) {
    if (['ArrowRight','ArrowDown','PageDown',' '].indexOf(e.key) !== -1) { e.preventDefault(); go(current + 1, true); }
    else if (['ArrowLeft','ArrowUp','PageUp'].indexOf(e.key) !== -1) { e.preventDefault(); go(current - 1, true); }
    else if (e.key === 'Home') { e.preventDefault(); go(0, true); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1, true); }
  });`
      : ''
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'slideo:goto') go(d.index, d.smooth !== false);
  });
  parent.postMessage({ type: 'slideo:ready', count: slides.length }, '*');
})();
`.trim()
}

/** Markdown einer Zone in den inneren HTML-Inhalt rendern.
 *  Beim Layout 'split' wird der Markdown an `+++`-Zeilen in Spalten getrennt. */
function renderMarkdownInner(markdown: string, layout: string): string {
  if (layout !== 'split') return markdownToHtml(markdown)
  const cols = markdown.split(/^\s*\+\+\+\s*$/m)
  return (
    `<div class="slideo-columns">` +
    cols.map((c) => `<div class="slideo-col">${markdownToHtml(c)}</div>`).join('') +
    `</div>`
  )
}

/** Rendert eine einzelne Zone als <section>-Element. */
export function renderZoneSection(zone: Zone, assets?: AssetMap, urlBase?: string): string {
  // content_type entscheidet: markdown → Pipeline, html → roh einsetzen (Spec §14).
  // Bei HTML-Zonen werden Scripts bewusst NICHT gefiltert (volle Browser-Fähigkeiten).
  const rawInner =
    zone.content_type === 'html'
      ? zone.html ?? ''
      : renderMarkdownInner(zone.markdown, zone.style.layout)
  const inner = resolveAssetRefs(rawInner, assets, urlBase)
  const { layout, padding, background, text_align } = zone.style
  const bg = background ?? 'var(--color-bg)'
  const style = `background:${escapeAttr(bg)};padding:${escapeAttr(padding)};`
  // Zonen-gescoptes Custom-CSS (Text bleibt sauber, Styling lebt separat).
  const customStyle = zone.custom_css?.trim()
    ? `<style>${scopeCss(zone.custom_css, `#zone-${zone.id}`)}</style>`
    : ''
  return (
    `<section id="zone-${escapeAttr(zone.id)}" ` +
    `class="slideo-zone layout-${layout} align-${text_align}" ` +
    `style="${style}">` +
    customStyle +
    `<div class="slideo-content">${inner}</div>` +
    `</section>`
  )
}

export interface RenderOptions {
  /** present = Vollbild-Snap + Tastatur-Navigation; preview = normaler Scroll. */
  present?: boolean
  /** Asset-Map zur Auflösung von `assets/<name>`-Referenzen. */
  assets?: AssetMap
  /** Basis-URL des Custom-Protocols (Video/Audio streamen statt inline). */
  assetUrlBase?: string
}

/** Rendert die komplette Präsentation als eine self-contained HTML-Page. */
export function renderFullPage(presentation: Presentation, options: RenderOptions = {}): string {
  const { present = false, assets, assetUrlBase } = options
  const sections = presentation.zones
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((zone) => renderZoneSection(zone, assets, assetUrlBase))
    .join('\n')

  const snapCss = present
    ? `html { scroll-snap-type: y mandatory; scroll-behavior: smooth; }
.slideo-zone { scroll-snap-align: start; scroll-snap-stop: always; }
html, body { height: 100%; overflow-x: hidden; }`
    : ''

  // Script immer einbinden (für gezieltes "goto"); Tastatur nur im Präsentationsmodus.
  const script = `<script>${navScript(present)}</script>`

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(presentation.meta.title)}</title>
<style>
:root {
${tokensToCssString(presentation.tokens)}
}
${SLIDE_CSS}
${snapCss}
</style>
</head>
<body>
${sections}
${script}
</body>
</html>`
}

/** Rendert nur eine einzelne Zone als self-contained Mini-Page (z.B. Thumbnail). */
export function renderSingleZonePage(
  presentation: Presentation,
  zone: Zone,
  assets?: AssetMap,
): string {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8" /><style>
:root {
${tokensToCssString(presentation.tokens)}
}
${SLIDE_CSS}
</style></head><body>${renderZoneSection(zone, assets)}</body></html>`
}
