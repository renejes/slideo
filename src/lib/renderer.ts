import type { Presentation, Zone, AssetMap, TransitionKind } from '@/types'
import { markdownToHtml, splitMarkdownBlocks } from './markdown-tiptap'
import { tokensToCssString } from './tokens'
import { mediaKind, parseDataUri, fontFormat, extFromName } from './assets'

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

/**
 * `@font-face`-Regeln für hochgeladene Schriften (Spec §19.4): Familienname +
 * Asset-Datei → Data-URI aus der Asset-Map. So sind Custom-Fonts in Vorschau,
 * Präsentation und im self-contained Export verfügbar.
 */
function fontFaceCss(presentation: Presentation, assets?: AssetMap): string {
  const fonts = presentation.fonts
  if (!fonts || fonts.length === 0 || !assets) return ''
  return fonts
    .map((f) => {
      const dataUri = assets[f.asset]
      if (!dataUri) return ''
      const fmt = fontFormat(extFromName(f.asset))
      return `@font-face { font-family: ${JSON.stringify(f.family)}; src: url(${dataUri}) format('${fmt}'); font-display: swap; }`
    })
    .filter(Boolean)
    .join('\n')
}

/** Marken-Logo (Spec §19.4) als `<img>` mit aufgelöster Quelle, oder ''. */
function logoHtml(presentation: Presentation, assets?: AssetMap): string {
  const logo = presentation.meta.logo
  if (!logo || !assets) return ''
  const src = assets[logo.asset]
  if (!src) return ''
  return `<img class="slideo-logo slideo-logo-${logo.position}" src="${src}" alt="" />`
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
/* Bild-Positionierung (Spec §18.1): Ausrichtung im Fluss + Float mit Umfluss. */
.slideo-content img.align-left   { display: block; margin-right: auto; }
.slideo-content img.align-center { display: block; margin-left: auto; margin-right: auto; }
.slideo-content img.align-right  { display: block; margin-left: auto; }
.slideo-content img.float-left   { float: left; margin: 0.2em 1.25em 0.75em 0; }
.slideo-content img.float-right  { float: right; margin: 0.2em 0 0.75em 1.25em; }
.slideo-content::after { content: ""; display: block; clear: both; }
.slideo-content hr { border: 0; border-top: 1px solid var(--color-surface); margin: 1.5em 0; }
.slideo-content table { border-collapse: collapse; width: 100%; }
.slideo-content th, .slideo-content td { border: 1px solid var(--color-surface); padding: 0.5em 0.75em; }

/* Editier-Modus (nur Vorschau): umsortierbare Blöcke + Drag-Handle. */
.slideo-block { position: relative; }
.slideo-block > :first-child { margin-top: 0; }
.slideo-block > :last-child { margin-bottom: 0; }
.slideo-block + .slideo-block { margin-top: 0.75em; }
.slideo-block > .slideo-drag {
  position: absolute; left: -1.7rem; top: 0.15em;
  width: 1.15rem; height: 1.35rem; border-radius: 5px;
  cursor: grab; touch-action: none; opacity: 0; transition: opacity 0.12s ease;
  background-color: rgba(127,127,127,0.16);
  background-image: url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16' fill='%23999'><circle cx='5.5' cy='4' r='1.3'/><circle cx='10.5' cy='4' r='1.3'/><circle cx='5.5' cy='8' r='1.3'/><circle cx='10.5' cy='8' r='1.3'/><circle cx='5.5' cy='12' r='1.3'/><circle cx='10.5' cy='12' r='1.3'/></svg>");
  background-size: 0.95rem; background-repeat: no-repeat; background-position: center;
}
.slideo-block:hover > .slideo-drag { opacity: 0.85; }
.slideo-block > .slideo-drag:active { cursor: grabbing; }
.slideo-block.slideo-dragging { opacity: 0.4; }
/* Bild-Resize-Anfasser (rechte Kante), nur Vorschau. */
.slideo-resize {
  position: fixed; z-index: 50;
  width: 11px; height: 32px; border-radius: 6px;
  background: var(--color-accent); cursor: ew-resize; touch-action: none;
  box-shadow: 0 0 0 2px rgba(255,255,255,0.55), 0 1px 3px rgba(0,0,0,0.3);
}
/* Builds (Schritt-Einblenden), nur In-App-Präsentation. */
.slideo-fragment { opacity: 0; transform: translateY(10px); transition: opacity 0.35s ease, transform 0.35s ease; }
.slideo-fragment.is-shown { opacity: 1; transform: none; }
.slideo-fragment > :first-child { margin-top: 0; }
.slideo-fragment > :last-child { margin-bottom: 0; }
.slideo-fragment + .slideo-fragment { margin-top: 0.6em; }
/* Marken-Logo auf jeder Folie (Spec §19.4). */
.slideo-logo { position: absolute; z-index: 5; max-height: 9%; max-width: 22%; height: auto; width: auto; opacity: 0.95; pointer-events: none; }
.slideo-logo-top-left { top: 4%; left: 4%; }
.slideo-logo-top-right { top: 4%; right: 4%; }
.slideo-logo-bottom-left { bottom: 4%; left: 4%; }
.slideo-logo-bottom-right { bottom: 4%; right: 4%; }
`.trim()

/**
 * Navigations-Script für Iframe ↔ Parent (postMessage).
 * - In-App-Präsentation & Vorschau: **parent-autoritativ** — keine eigene Tastatur,
 *   reagiert auf `slideo:goto {index}` und `slideo:show {index, step}` (Builds).
 * - `standalone` (exportierte .html, ohne Parent): eigene Tastatur + Klick-Navigation.
 * - `deck` (Transition aktiv): Aktiv-Folie-Modell statt Scroll-Snap (is-active/is-prev).
 * `slideo:show` blendet zudem `.slideo-fragment`-Elemente bis `step` ein (Spec §19.1).
 */
function navScript(
  standalone: boolean,
  deck: boolean,
  durationMs: number,
  kind: TransitionKind,
): string {
  return `
(function () {
  var DECK = ${deck ? 'true' : 'false'};
  var AUTO = ${kind === 'auto' ? 'true' : 'false'};
  var DURATION = ${Math.max(0, Math.round(durationMs))};
  var root = document.documentElement;
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slideo-zone'));
  var current = 0;
  var leaveTimer = null;
  var pendingMorph = null;
  function clamp(i) { return Math.max(0, Math.min(i, slides.length - 1)); }
  function clearPrev() { for (var k = 0; k < slides.length; k++) slides[k].classList.remove('is-prev'); }

  // ---- Auto-Animate (Spec §19.1): gleiche data-id-Elemente per FLIP morphen ----
  // data-id → erstes Element je Folie (Map statt Selektor → kein Escaping nötig).
  function mapIds(slide) {
    var m = {}, els = slide.querySelectorAll('[data-id]');
    for (var i = 0; i < els.length; i++) {
      var id = els[i].getAttribute('data-id');
      if (id && !(id in m)) m[id] = els[i];
    }
    return m;
  }
  function inHiddenFragment(el) {
    return !!(el.closest && el.closest('.slideo-fragment:not(.is-shown)'));
  }
  function reduceMotion() {
    return !!(window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  }
  // Vor dem Klassenwechsel messen (alte Folie aktiv, neue noch verborgen aber gelayoutet).
  function collectMorph(outSlide, inSlide) {
    var outMap = mapIds(outSlide), inMap = mapIds(inSlide), pairs = [];
    for (var id in outMap) {
      if (!Object.prototype.hasOwnProperty.call(inMap, id)) continue;
      var outEl = outMap[id], inEl = inMap[id];
      if (inHiddenFragment(inEl)) continue; // noch nicht eingeblendeter Build → kein Morph
      var o = outEl.getBoundingClientRect(), n = inEl.getBoundingClientRect();
      if (!n.width || !n.height) continue;
      pairs.push({ outEl: outEl, inEl: inEl, o: o, n: n });
    }
    return pairs;
  }
  function playMorph(pairs) {
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      var dx = p.o.left - p.n.left, dy = p.o.top - p.n.top;
      var sx = p.n.width ? p.o.width / p.n.width : 1, sy = p.n.height ? p.o.height / p.n.height : 1;
      p.inEl.style.willChange = 'transform'; // nur während des Morphs (Cleanup räumt auf)
      p.inEl.style.transformOrigin = 'top left';
      p.inEl.style.transition = 'none';
      p.inEl.style.transform = 'translate(' + dx + 'px,' + dy + 'px) scale(' + sx + ',' + sy + ')';
      p.outEl.style.visibility = 'hidden'; // kein Doppelbild
    }
    void document.documentElement.offsetWidth; // Reflow erzwingen
    requestAnimationFrame(function () {
      if (pairs !== pendingMorph) return; // abgelöst (schnelle Navigation) → nicht erneut anfassen
      for (var i = 0; i < pairs.length; i++) {
        pairs[i].inEl.style.transition = 'transform ' + DURATION + 'ms ease';
        pairs[i].inEl.style.transform = '';
      }
    });
  }
  function cleanupMorph(pairs) {
    if (!pairs) return;
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      p.inEl.style.transition = ''; p.inEl.style.transform = '';
      p.inEl.style.transformOrigin = ''; p.inEl.style.willChange = '';
      p.outEl.style.visibility = '';
    }
  }
  // Builds: in der aktiven Folie Fragmente bis 'step' zeigen, sonst alle.
  function applyFragments(activeIdx, step) {
    for (var zi = 0; zi < slides.length; zi++) {
      var frs = slides[zi].querySelectorAll('.slideo-fragment');
      for (var fi = 0; fi < frs.length; fi++) {
        var fragIdx = parseInt(frs[fi].getAttribute('data-frag'), 10);
        if (zi !== activeIdx || fragIdx <= step) frs[fi].classList.add('is-shown');
        else frs[fi].classList.remove('is-shown');
      }
    }
  }
  function go(i, smooth) {
    var prev = current;
    current = clamp(i);
    if (DECK) {
      // Auto-Animate nur bei animierter, benachbarter Navigation (smooth). Initiales
      // Laden / View-Wechsel (smooth=false), nicht-benachbarte Sprünge und reduzierte
      // Bewegung schalten hart um. Hängende Inline-Styles eines vorherigen Morphs lösen.
      cleanupMorph(pendingMorph);
      pendingMorph = null;
      var morph =
        AUTO && smooth && !reduceMotion() && prev !== current && Math.abs(current - prev) === 1
          ? collectMorph(slides[prev], slides[current])
          : null;
      root.setAttribute('data-dir', current >= prev ? 'fwd' : 'back');
      for (var k = 0; k < slides.length; k++) {
        slides[k].classList.toggle('is-active', k === current);
        slides[k].classList.toggle('is-prev', k === prev && prev !== current);
      }
      if (morph && morph.length) {
        playMorph(morph);
        pendingMorph = morph;
      }
      if (leaveTimer) clearTimeout(leaveTimer);
      leaveTimer = setTimeout(function () {
        clearPrev();
        cleanupMorph(pendingMorph);
        pendingMorph = null;
      }, DURATION + 60);
    } else {
      var el = slides[current];
      if (el) el.scrollIntoView({ behavior: smooth ? 'smooth' : 'auto', block: 'start' });
    }
  }
  ${
    standalone
      ? `// Standalone-Export: eigene Tastatur + Klick (kein Parent-Fenster).
  window.addEventListener('keydown', function (e) {
    if (['ArrowRight','ArrowDown','PageDown',' '].indexOf(e.key) !== -1) { e.preventDefault(); go(current + 1, true); }
    else if (['ArrowLeft','ArrowUp','PageUp'].indexOf(e.key) !== -1) { e.preventDefault(); go(current - 1, true); }
    else if (e.key === 'Home') { e.preventDefault(); go(0, true); }
    else if (e.key === 'End') { e.preventDefault(); go(slides.length - 1, true); }
  });
  function syncCurrent() {
    if (DECK) return;
    var best = 0, bestDist = Infinity;
    for (var k = 0; k < slides.length; k++) {
      var d = Math.abs(slides[k].getBoundingClientRect().top);
      if (d < bestDist) { bestDist = d; best = k; }
    }
    current = best;
  }
  document.addEventListener('click', function (e) {
    var t = e.target;
    if (t && t.closest && t.closest('a,button,input,textarea,select,label,video,audio,iframe,[contenteditable],[data-no-advance]')) return;
    syncCurrent();
    go(current + (e.clientX < window.innerWidth * 0.25 ? -1 : 1), true);
  });`
      : ''
  }
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'slideo:goto') go(d.index, d.smooth !== false);
    // Fragment-Sichtbarkeit der Zielfolie VOR go() setzen, damit der Auto-Morph
    // Elemente in noch nicht eingeblendeten Builds überspringt (kein Aufblitzen).
    else if (d.type === 'slideo:show') { applyFragments(d.index, d.step | 0); go(d.index, d.smooth !== false); }
  });
  if (DECK) go(0, false); // Folie 0 initial aktivieren
  parent.postMessage({ type: 'slideo:ready', count: slides.length }, '*');
})();
`.trim()
}

/**
 * Edit-Script (nur Vorschau): **Pointer-basierte** Interaktionen (HTML5-DnD ist im
 * WKWebView unzuverlässig).
 *  1. Block-Reordering: Zug am `.slideo-drag`-Handle → neue Reihenfolge der
 *     `data-block-index` an den Parent (slideo:reorder-blocks).
 *  2. Bild-Resize: Anfasser an der rechten Bildkante → Breite stufenlos in %
 *     (slideo:resize-image). Bleibt flussbasiert.
 */
function editScript(): string {
  return `
(function () {
  function zoneOf(el) { return el && el.closest ? el.closest('.slideo-zone') : null; }

  /* ---------- Block-Reordering ---------- */
  var dragEl = null, dragZone = null;
  function blockAtY(y) {
    if (!dragZone) return null;
    var els = dragZone.querySelectorAll('.slideo-block');
    for (var i = 0; i < els.length; i++) {
      var r = els[i].getBoundingClientRect();
      if (y >= r.top && y <= r.bottom) return els[i];
    }
    return null;
  }
  function onDragMove(e) {
    if (!dragEl) return;
    var over = blockAtY(e.clientY);
    if (!over || over === dragEl) return;
    var r = over.getBoundingClientRect();
    var before = (e.clientY - r.top) < r.height / 2;
    over.parentNode.insertBefore(dragEl, before ? over : over.nextSibling);
  }
  function onDragEnd() {
    if (dragEl) {
      dragEl.classList.remove('slideo-dragging');
      document.documentElement.style.userSelect = '';
      if (dragZone) {
        var id = dragZone.id.replace(/^zone-/, '');
        var blocks = dragZone.querySelectorAll('.slideo-block');
        var order = [];
        for (var i = 0; i < blocks.length; i++) order.push(parseInt(blocks[i].getAttribute('data-block-index'), 10));
        parent.postMessage({ type: 'slideo:reorder-blocks', zoneId: id, order: order }, '*');
      }
    }
    document.removeEventListener('pointermove', onDragMove);
    document.removeEventListener('pointerup', onDragEnd);
    document.removeEventListener('pointercancel', onDragEnd);
    dragEl = null; dragZone = null;
  }

  /* ---------- Bild-Resize ---------- */
  var rh = document.createElement('div');
  rh.className = 'slideo-resize';
  rh.style.display = 'none';
  document.body.appendChild(rh);
  var hoverImg = null, resizeImg = null, resizeLeft = 0, resizeCW = 1;
  function isImg(el) {
    return el && el.tagName === 'IMG' && el.closest('.slideo-content') && el.closest('.slideo-zone');
  }
  function placeHandle(img) {
    var r = img.getBoundingClientRect();
    rh.style.left = (r.right - 6) + 'px';
    rh.style.top = (r.top + r.height / 2 - 16) + 'px';
    rh.style.display = 'block';
  }
  function hideHandle() { rh.style.display = 'none'; hoverImg = null; }
  function onResizeMove(e) {
    if (!resizeImg) return;
    // Startkante + Containerbreite sind fixiert (bei zentrierten Bildern wandert
    // die Kante sonst beim Skalieren → Oszillation).
    var pct = Math.round((e.clientX - resizeLeft) / resizeCW * 100);
    pct = Math.max(5, Math.min(100, pct));
    resizeImg.style.width = pct + '%';
    placeHandle(resizeImg);
  }
  function onResizeEnd() {
    if (resizeImg) {
      document.documentElement.style.userSelect = '';
      var z = resizeImg.closest('.slideo-zone');
      var block = resizeImg.closest('.slideo-block');
      if (z && block) {
        var imgs = block.querySelectorAll('img');
        parent.postMessage({
          type: 'slideo:resize-image',
          zoneId: z.id.replace(/^zone-/, ''),
          blockIndex: parseInt(block.getAttribute('data-block-index'), 10),
          imgIndex: Array.prototype.indexOf.call(imgs, resizeImg),
          width: resizeImg.style.width || '100%'
        }, '*');
      }
    }
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', onResizeEnd);
    document.removeEventListener('pointercancel', onResizeEnd);
    resizeImg = null;
  }
  rh.addEventListener('pointerdown', function (e) {
    if (!hoverImg) return;
    e.preventDefault();
    resizeImg = hoverImg;
    var content = resizeImg.closest('.slideo-content');
    resizeLeft = resizeImg.getBoundingClientRect().left;
    resizeCW = content ? content.getBoundingClientRect().width : resizeImg.parentNode.getBoundingClientRect().width;
    if (!resizeCW) resizeCW = 1;
    document.documentElement.style.userSelect = 'none';
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeEnd);
    document.addEventListener('pointercancel', onResizeEnd);
  });

  /* ---------- gemeinsamer Einstieg ---------- */
  document.addEventListener('pointermove', function (e) {
    if (dragEl || resizeImg) return; // während eines Zugs kein Hover-Update
    if (e.target === rh) return;     // auf dem Anfasser bleiben
    if (isImg(e.target)) { hoverImg = e.target; placeHandle(e.target); }
    else hideHandle();
  });
  document.addEventListener('pointerdown', function (e) {
    var handle = e.target.closest && e.target.closest('.slideo-drag');
    if (!handle) return;
    var block = handle.closest('.slideo-block');
    if (!block) return;
    e.preventDefault();
    dragEl = block;
    dragZone = zoneOf(block);
    block.classList.add('slideo-dragging');
    document.documentElement.style.userSelect = 'none';
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  });
})();
`.trim()
}

/** CSS für den Aktiv-Folie-Modus (Transitions). Ersetzt im Deck-Modus die Snap-Regeln. */
function transitionCss(kind: TransitionKind, durationMs: number): string {
  const d = `${Math.max(0, Math.round(durationMs))}ms`
  // Auto-Animate (Spec §19.1): die aktive Folie wird sofort sichtbar (kein Folien-
  // Fade), Elemente mit gleichem data-id morphen per JS (FLIP, siehe navScript).
  // Funktioniert am besten bei gleichem Folien-Hintergrund (Magic-Move-Stil).
  if (kind === 'auto') {
    // is-active erscheint sofort (kein Folien-Fade) und deckt bei opakem Hintergrund
    // die alte Folie ab; is-prev fadet als Sicherheitsnetz aus → bei transparentem
    // Folien-Hintergrund degradiert es zum Cross-Fade statt zum harten Aufblitzen.
    return `
html, body { height: 100%; overflow: hidden; }
.slideo-zone { position: absolute; inset: 0; height: 100vh; opacity: 0; }
.slideo-zone.is-active { opacity: 1; z-index: 2; }
.slideo-zone.is-prev { opacity: 0; z-index: 1; transition: opacity ${d} ease; }`
  }
  const base = `
html, body { height: 100%; overflow: hidden; }
.slideo-zone {
  position: absolute; inset: 0; height: 100vh;
  opacity: 0; will-change: opacity, transform;
  transition: opacity ${d} ease, transform ${d} ease;
}
.slideo-zone.is-active { opacity: 1; z-index: 2; }
.slideo-zone.is-prev { z-index: 1; }`
  if (kind === 'fade') {
    return `${base}
.slideo-zone.is-prev { opacity: 0; }`
  }
  if (kind === 'zoom') {
    return `${base}
.slideo-zone { transform: scale(1.04); }
.slideo-zone.is-active { transform: scale(1); }
.slideo-zone.is-prev { opacity: 0; transform: scale(0.98); }`
  }
  // slide (richtungsabhängig über data-dir)
  return `${base}
[data-dir="fwd"]  .slideo-zone { transform: translateX(100%); }
[data-dir="back"] .slideo-zone { transform: translateX(-100%); }
.slideo-zone.is-active { transform: translateX(0); }
[data-dir="fwd"]  .slideo-zone.is-prev { opacity: 0; transform: translateX(-100%); }
[data-dir="back"] .slideo-zone.is-prev { opacity: 0; transform: translateX(100%); }`
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

/**
 * Editier-Modus (nur Vorschau): jeder Top-Level-Block wird umhüllt + per Drag
 * umsortierbar gemacht. `data-block-index` mappt zurück auf splitMarkdownBlocks().
 * Bei nur einem Block kein Wrapping (nichts umzusortieren).
 */
function renderEditableBlocks(markdown: string): string {
  const blocks = splitMarkdownBlocks(markdown)
  if (blocks.length === 0) return markdownToHtml(markdown)
  // Immer umhüllen (auch Einzelblock → Bild-Resize braucht den data-block-index);
  // das Reorder-Handle nur ab 2 Blöcken zeigen. Pointer-basiertes Drag (kein
  // natives draggable — WKWebView unterstützt HTML5-DnD nicht zuverlässig).
  const showHandle = blocks.length > 1
  return blocks
    .map(
      (b, i) =>
        `<div class="slideo-block" data-block-index="${i}">` +
        (showHandle
          ? `<span class="slideo-drag" data-drag-handle title="Ziehen zum Umsortieren"></span>`
          : '') +
        markdownToHtml(b) +
        `</div>`,
    )
    .join('')
}

/**
 * Builds (Spec §19.1): jeder Top-Level-Block wird ein `.slideo-fragment` mit
 * `data-frag`-Index; das Nav-Script blendet sie schrittweise ein. Bei ≤1 Block
 * gibt es nichts schrittweise zu zeigen → normaler Inhalt.
 */
function renderFragmentBlocks(markdown: string): string {
  const blocks = splitMarkdownBlocks(markdown)
  if (blocks.length <= 1) return markdownToHtml(markdown)
  return blocks
    .map((b, i) => `<div class="slideo-fragment" data-frag="${i}">${markdownToHtml(b)}</div>`)
    .join('')
}

/** Rendert eine einzelne Zone als <section>-Element. */
export function renderZoneSection(
  zone: Zone,
  assets?: AssetMap,
  urlBase?: string,
  editable = false,
  fragments = false,
  logo = '',
): string {
  // content_type entscheidet: markdown → Pipeline, html → roh einsetzen (Spec §14).
  // Bei HTML-Zonen werden Scripts bewusst NICHT gefiltert (volle Browser-Fähigkeiten).
  // editable (Vorschau): Blöcke umsortierbar. fragments (In-App-Präsentation): Builds.
  const isSplit = zone.style.layout === 'split'
  const rawInner =
    zone.content_type === 'html'
      ? zone.html ?? ''
      : editable && !isSplit
        ? renderEditableBlocks(zone.markdown)
        : fragments && zone.reveal === 'steps' && !isSplit
          ? renderFragmentBlocks(zone.markdown)
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
    logo +
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
  /** standalone = exportierte .html (läuft ohne Parent): Klick-zum-Weiterblättern. */
  standalone?: boolean
  /** editable = Vorschau-Editiermodus: Markdown-Blöcke per Drag umsortierbar. */
  editable?: boolean
}

/** Rendert die komplette Präsentation als eine self-contained HTML-Page. */
export function renderFullPage(presentation: Presentation, options: RenderOptions = {}): string {
  const { present = false, assets, assetUrlBase, standalone = false, editable = false } = options
  // Builds (Fragmente) nur in der In-App-Präsentation (parent-gesteuert), nicht im
  // Standalone-Export (zeigt v1 alles) und nicht in der Vorschau.
  const fragments = present && !standalone
  const logo = logoHtml(presentation, assets)
  const sections = presentation.zones
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((zone) => renderZoneSection(zone, assets, assetUrlBase, editable, fragments, logo))
    .join('\n')

  // Transition (deck-weit) aus den Metadaten; fehlt = 'none' (reiner Scroll-Snap).
  const transition = presentation.meta.transition
  const kind: TransitionKind = transition?.kind ?? 'none'
  const duration = transition?.duration_ms ?? 500
  // Deck-Modus (Aktiv-Folie + CSS-Transition) nur im Präsentations-/Standalone-Modus
  // UND wenn ein Übergang gewählt ist. Sonst bleibt das bewährte Scroll-Snap.
  const deck = present && kind !== 'none'

  const snapCss = !present
    ? ''
    : deck
      ? transitionCss(kind, duration)
      : `html { scroll-snap-type: y mandatory; scroll-behavior: smooth; }
.slideo-zone { scroll-snap-align: start; scroll-snap-stop: always; }
html, body { height: 100%; overflow-x: hidden; }`

  // Script immer einbinden (goto/show); eigene Tastatur nur im Standalone-Export.
  // Im Editier-Modus zusätzlich das Drag-Reorder-Script.
  const script =
    `<script>${navScript(standalone, deck, duration, kind)}</script>` +
    (editable ? `<script>${editScript()}</script>` : '')

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeAttr(presentation.meta.title)}</title>
<style>
${fontFaceCss(presentation, assets)}
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

/**
 * Rendert die Präsentation als **eigenständige, teilbare** `.html`-Datei:
 * alle Assets (auch Video/Audio) als Data-URI inline (kein Custom-Protocol),
 * Vollbild-Snap, Tastatur- UND Klick-Navigation. Läuft in jedem Browser offline.
 */
export function renderStandalonePage(presentation: Presentation, assets?: AssetMap): string {
  return renderFullPage(presentation, { present: true, standalone: true, assets })
}

/**
 * Print-optimierte Page für den PDF-Export (Spec §18.4): jede Zone wird zu
 * **einer** 16:9-Seite (1280×720) via `@page` + `page-break`. Kein Nav-Script;
 * alle Assets als Data-URI inline. Über den WebView-Druck → „Als PDF sichern".
 */
export function renderPrintPage(presentation: Presentation, assets?: AssetMap): string {
  const logo = logoHtml(presentation, assets)
  const sections = presentation.zones
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((zone) => renderZoneSection(zone, assets, undefined, false, false, logo))
    .join('\n')

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
<title>${escapeAttr(presentation.meta.title)}</title>
<style>
${fontFaceCss(presentation, assets)}
:root {
${tokensToCssString(presentation.tokens)}
}
${SLIDE_CSS}
@page { size: 1280px 720px; margin: 0; }
html, body { margin: 0; padding: 0; }
/* Hintergrundfarben/-bilder mitdrucken (Token-Design), sonst druckt der Browser
   sie standardmäßig weg → „anderes Design" im PDF. */
* { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
.slideo-zone {
  width: 1280px; height: 720px; min-height: 0;
  overflow: hidden;
  page-break-after: always; break-after: page;
}
.slideo-zone:last-child { page-break-after: auto; break-after: auto; }
</style>
</head>
<body>
${sections}
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
${fontFaceCss(presentation, assets)}
:root {
${tokensToCssString(presentation.tokens)}
}
${SLIDE_CSS}
</style></head><body>${renderZoneSection(zone, assets, undefined, false, false, logoHtml(presentation, assets))}</body></html>`
}
