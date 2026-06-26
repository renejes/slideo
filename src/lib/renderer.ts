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
/* Feste 16:9-Bühne (Spec §21): jede Folie ist logisch 1280×720 und wird per
   --slideo-scale gleichmäßig ins Frame eingepasst. Das .slideo-frame ist die
   Layout-/Navigations-Einheit; die .slideo-zone ist die skalierte, geclippte Bühne. */
.slideo-frame {
  position: relative;
  width: 100%;
  aspect-ratio: 16 / 9;   /* Vorschau-Default: volle Breite, 16:9 hoch */
  overflow: hidden;
  display: grid;
  place-items: center;    /* zentriert die (über transform skalierte) Bühne */
  background: var(--color-bg);
}
.slideo-frame + .slideo-frame { margin-top: 1.25rem; }   /* Abstand in der Vorschau */
.slideo-zone {
  position: relative;
  width: 1280px;
  height: 720px;
  flex: none;
  overflow: hidden;       /* Überlauf wird abgeschnitten (PPT/Keynote-Standard) */
  display: flex;
  background: var(--color-bg);
  transform: scale(var(--slideo-scale, 1));
  transform-origin: center center;
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
/* Direktmanipulation (Spec §20): Hover-/Auswahl-Box + Mini-Toolbar, nur im
   Direktbearbeiten-Modus der Vorschau (Overlays werden im Iframe gezeichnet). */
.slideo-de-box { position: fixed; z-index: 60; pointer-events: none; box-sizing: border-box; }
.slideo-de-hover { outline: 1.5px dashed var(--color-accent); outline-offset: 1px; }
.slideo-de-sel { outline: 2px solid var(--color-accent); outline-offset: 1px; }
.slideo-de-toolbar {
  position: fixed; z-index: 61; display: flex; gap: 2px; padding: 3px;
  border-radius: 8px; background: #1f1f1f; box-shadow: 0 2px 12px rgba(0,0,0,0.4);
}
.slideo-de-btn {
  display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; border: 0; border-radius: 5px;
  background: transparent; color: #fff; cursor: pointer;
}
.slideo-de-btn:hover { background: rgba(255,255,255,0.16); }
.slideo-de-btn svg {
  width: 16px; height: 16px; display: block;
  fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round;
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
  scaleFit: 'width' | 'both',
): string {
  return `
(function () {
  var DECK = ${deck ? 'true' : 'false'};
  var AUTO = ${kind === 'auto' ? 'true' : 'false'};
  var DURATION = ${Math.max(0, Math.round(durationMs))};
  var root = document.documentElement;
  // Feste 16:9-Bühne (Spec §21): --slideo-scale skaliert die 1280×720-Zonen ins
  // Frame. 'width' = volle Breite (Vorschau, scrollend), 'both' = ins Fenster
  // einpassen + Letterbox (Präsentation). window.__sldScale teilt den Faktor mit
  // editScript (Drag/Freeze) und dem Morph (FLIP) — alle rechnen in Bildschirm-px.
  var SCALE_FIT = '${scaleFit}';
  function sldFit() {
    var s = SCALE_FIT === 'both'
      ? Math.min((window.innerWidth || 1) / 1280, (window.innerHeight || 1) / 720)
      : (root.clientWidth || window.innerWidth || 1) / 1280;
    if (!(s > 0)) s = 1;
    window.__sldScale = s;
    root.style.setProperty('--slideo-scale', String(s));
  }
  sldFit();
  window.addEventListener('resize', sldFit);
  var slides = Array.prototype.slice.call(document.querySelectorAll('.slideo-frame'));
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
    // Die gemessenen Deltas sind Bildschirm-px; das Element sitzt aber in einer um
    // --slideo-scale skalierten Zone → Translate durch den Scale teilen (Skalen-Faktoren
    // sind Verhältnisse und damit scale-invariant).
    var SC = window.__sldScale || 1;
    for (var i = 0; i < pairs.length; i++) {
      var p = pairs[i];
      var dx = (p.o.left - p.n.left) / SC, dy = (p.o.top - p.n.top) / SC;
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
 *  3. Direktmanipulation (Spec §20, nur bei `directEdit`): Hover/Auswahl von
 *     Elementen in HTML-Zonen + Mini-Toolbar (Ebene hoch / Duplizieren / Löschen);
 *     Adressierung über den Kind-Index-Pfad ab `.slideo-content`. Re-Select nach
 *     dem Re-Render über `slideo:reselect`.
 */
function editScript(directEdit: boolean): string {
  return `
(function () {
  var DIRECT = ${directEdit ? 'true' : 'false'};
  function zoneOf(el) { return el && el.closest ? el.closest('.slideo-zone') : null; }
  function inHtmlZone(el) { return !!(el && el.closest && el.closest('.slideo-zone-html')); }

  // Cmd/Ctrl+Z im Iframe an den Parent weiterreichen — sonst greift der globale
  // Undo nicht, weil der Tastendruck im sandboxed Iframe landet (nicht im Fenster).
  // In Eingabefeldern/contenteditable deren eigenes Undo nicht stören.
  document.addEventListener('keydown', function (e) {
    if (!(e.metaKey || e.ctrlKey) || e.shiftKey) return;
    if (e.key !== 'z' && e.key !== 'Z') return;
    var t = e.target;
    if (t && (/^(INPUT|TEXTAREA)$/.test(t.tagName || '') || t.isContentEditable)) return;
    e.preventDefault();
    parent.postMessage({ type: 'slideo:undo' }, '*');
  });

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
    // Resize gilt nur für Markdown-Zonen (resizeZoneImage no-opt auf HTML); in
    // HTML-Zonen übernimmt der Direktmanipulations-Layer.
    return el && el.tagName === 'IMG' && el.closest('.slideo-content')
      && el.closest('.slideo-zone') && !inHtmlZone(el);
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

  /* ---------- Direktmanipulation (Spec §20), nur im Direktbearbeiten-Modus ---------- */
  if (DIRECT) {
    var hoverBox = document.createElement('div');
    hoverBox.className = 'slideo-de-box slideo-de-hover';
    hoverBox.style.display = 'none';
    document.body.appendChild(hoverBox);
    var selBox = document.createElement('div');
    selBox.className = 'slideo-de-box slideo-de-sel';
    selBox.style.display = 'none';
    document.body.appendChild(selBox);
    var toolbar = document.createElement('div');
    toolbar.className = 'slideo-de-toolbar slideo-de-ui';
    toolbar.style.display = 'none';
    toolbar.innerHTML =
      '<button class="slideo-de-btn" data-de="up" title="Eine Ebene höher (Esc)">' +
        '<svg viewBox="0 0 24 24"><path d="M12 19V5M5 12l7-7 7 7"/></svg></button>' +
      '<button class="slideo-de-btn" data-de="text" title="Text bearbeiten (Doppelklick)">' +
        '<svg viewBox="0 0 24 24"><path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5z"/></svg></button>' +
      '<button class="slideo-de-btn" data-de="duplicate" title="Duplizieren">' +
        '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg></button>' +
      '<button class="slideo-de-btn" data-de="delete" title="Löschen (Entf)">' +
        '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg></button>';
    document.body.appendChild(toolbar);

    var selEl = null, selZone = null;
    var editing = null;      // Element im Inline-Text-Edit (Phase 2)
    var editOrig = '';       // ursprüngliches innerHTML (für Abbruch)
    var moveState = null;    // aktiver Verschiebe-Drag (Phase 3)
    var suppressClick = false; // unterdrückt den Klick nach einem Drag
    // Editierbar = nur Inline-Kinder (Span/Link/Strong/<br>/…), kein Block-Markup.
    // So bleibt Inline-Stil beim Text-Edit erhalten, ohne Container/Komponenten
    // (Karten, data-id-Wrapper) plattzumachen.
    var INLINE_OK = {a:1,abbr:1,b:1,bdi:1,bdo:1,br:1,cite:1,code:1,data:1,dfn:1,em:1,i:1,kbd:1,mark:1,q:1,rp:1,rt:1,ruby:1,s:1,samp:1,small:1,span:1,strong:1,sub:1,sup:1,time:1,u:1,'var':1,wbr:1,font:1,big:1,tt:1};
    function isInlineEditable(el) {
      var kids = el.children;
      for (var i = 0; i < kids.length; i++) if (!INLINE_OK[kids[i].tagName.toLowerCase()]) return false;
      return true;
    }

    function contentOf(el) { return el && el.closest ? el.closest('.slideo-content') : null; }
    // Pfad vom Element hoch bis (exkl.) .slideo-content; Element-Kind-Indizes.
    function pathOf(el) {
      var content = contentOf(el);
      if (!content) return null;
      var path = [], node = el;
      while (node && node !== content) {
        var parent = node.parentNode;
        if (!parent) return null;
        var idx = Array.prototype.indexOf.call(parent.children, node);
        if (idx < 0) return null;
        path.unshift(idx);
        node = parent;
      }
      return path.length ? path : null;
    }
    function elAtPath(section, path) {
      var el = section.querySelector('.slideo-content');
      if (!el) return null;
      for (var k = 0; k < path.length; k++) {
        if (!el.children || path[k] < 0 || path[k] >= el.children.length) return null;
        el = el.children[path[k]];
      }
      return el && el.classList && el.classList.contains('slideo-content') ? null : el;
    }
    function boxFor(box, el) {
      if (!el) { box.style.display = 'none'; return; }
      var r = el.getBoundingClientRect();
      box.style.left = r.left + 'px'; box.style.top = r.top + 'px';
      box.style.width = r.width + 'px'; box.style.height = r.height + 'px';
      box.style.display = 'block';
    }
    function placeToolbar(el) {
      if (!el) { toolbar.style.display = 'none'; return; }
      toolbar.style.display = 'flex';
      var r = el.getBoundingClientRect();
      var tw = toolbar.offsetWidth || 90, th = toolbar.offsetHeight || 32;
      var top = r.top - th - 6;
      if (top < 4) top = r.bottom + 6; // unter das Element, wenn oben kein Platz
      var left = r.left;
      if (left + tw > window.innerWidth - 4) left = window.innerWidth - tw - 4;
      if (left < 4) left = 4;
      toolbar.style.left = left + 'px'; toolbar.style.top = top + 'px';
    }
    // Reposition über rAF koaleszieren (Scroll/Resize feuern dicht; sonst
    // synchroner Reflow pro Event → Jank).
    var repoPending = false;
    function reposition() {
      if (repoPending) return;
      repoPending = true;
      requestAnimationFrame(function () {
        repoPending = false;
        // Während des Inline-Edits Overlays NICHT wieder einblenden (sonst würden
        // Box/Toolbar über dem Tippen erscheinen + die Toolbar-Buttons live werden).
        if (editing) { selBox.style.display = 'none'; toolbar.style.display = 'none'; return; }
        if (selEl && document.contains(selEl)) { boxFor(selBox, selEl); placeToolbar(selEl); }
        else if (selEl) { selBox.style.display = 'none'; toolbar.style.display = 'none'; }
      });
    }
    function select(el, silent) {
      if (selEl && selEl !== el) selEl.style.cursor = '';
      selEl = el; selZone = inHtmlZone(el) ? el.closest('.slideo-zone-html') : null;
      if (el) el.style.cursor = 'move'; // Affordance: ausgewähltes Element ist ziehbar (Phase 3)
      hoverBox.style.display = 'none';
      boxFor(selBox, el); placeToolbar(el);
      if (!silent) {
        var path = pathOf(el);
        if (selZone && path) parent.postMessage({ type: 'slideo:select-element', zoneId: selZone.id.replace(/^zone-/, ''), path: path, tag: el.tagName.toLowerCase() }, '*');
      }
    }
    function deselect() {
      if (selEl) selEl.style.cursor = '';
      selEl = null; selZone = null;
      selBox.style.display = 'none'; toolbar.style.display = 'none'; hoverBox.style.display = 'none';
      parent.postMessage({ type: 'slideo:deselect' }, '*');
    }
    function levelUp() {
      if (!selEl) return;
      var content = contentOf(selEl), p = selEl.parentNode;
      if (!content || !p || p === content) return; // schon oberste Ebene
      select(p);
    }
    function opMsg(op) {
      if (!selEl || !selZone) return;
      var path = pathOf(selEl);
      // tag = Erwartungswert gegen stale Pfade (paralleler MCP-Edit, Spec §20).
      if (path) parent.postMessage({ type: 'slideo:' + op + '-element', zoneId: selZone.id.replace(/^zone-/, ''), path: path, tag: selEl.tagName.toLowerCase() }, '*');
    }
    // Löschen nur, wenn der Fokus auf der Auswahl bzw. neutralem Hintergrund liegt
    // (nicht auf einem ANDEREN interaktiven Inhaltselement → versehentliches Löschen).
    function deleteAllowed(t) {
      if (!t) return true;
      if (/^(INPUT|TEXTAREA)$/.test(t.tagName || '') || t.isContentEditable) return false;
      if (selEl && (t === selEl || selEl.contains(t))) return true;
      if (t.closest && t.closest('a,button,select,[tabindex]') && !t.closest('.slideo-de-ui')) return false;
      return true;
    }

    /* ---------- Phase 2: Inline-Text-Edit (contenteditable) ---------- */
    function startEdit(el) {
      // Nur Elemente mit reinem Inline-Inhalt editieren — sonst würde der Commit
      // einen Block-Container (Karte/Komponente) plattmachen.
      if (!el || editing || !isInlineEditable(el)) return;
      editing = el;
      editOrig = el.innerHTML; // Snapshot für Abbruch
      selBox.style.display = 'none'; toolbar.style.display = 'none'; hoverBox.style.display = 'none';
      el.setAttribute('contenteditable', 'true');
      el.style.cursor = 'text';
      el.focus();
      try {
        var range = document.createRange();
        range.selectNodeContents(el);
        var sel = window.getSelection();
        sel.removeAllRanges(); sel.addRange(range);
      } catch (err) {}
    }
    function finishEdit(commit) {
      if (!editing) return;
      var el = editing; editing = null; // zuerst, damit der Blur-Handler nicht doppelt feuert
      el.removeAttribute('contenteditable');
      el.style.cursor = '';
      if (commit) {
        var zone = el.closest('.slideo-zone-html');
        var path = pathOf(el);
        // Bearbeitetes Inline-HTML schicken (Stil/Links bleiben erhalten);
        // applyElementOp sanitisiert es. Re-Select macht der Parent.
        var editedHtml = el.innerHTML;
        if (zone && path) parent.postMessage({ type: 'slideo:edit-text', zoneId: zone.id.replace(/^zone-/, ''), path: path, html: editedHtml, tag: el.tagName.toLowerCase() }, '*');
      } else {
        el.innerHTML = editOrig; // Abbruch: verworfenen Text zurücksetzen (kein Re-Render)
        select(el, true); // Auswahl wieder zeigen
      }
      editOrig = '';
    }

    /* ---------- Phase 3: Verschieben + „Folie einfrieren" ---------- */
    function isAbs(n) { var p = getComputedStyle(n).position; return p === 'absolute' || p === 'fixed'; }
    function isFixedEl(n) { return getComputedStyle(n).position === 'fixed'; }
    // Erzeugt der Knoten einen Containing-Block für absolute Kinder? (position, aber
    // auch transform/filter/perspective — sonst läge der Bezugsrahmen falsch.)
    function createsCB(n) {
      var s = getComputedStyle(n);
      return (!!s.position && s.position !== 'static')
        || (!!s.transform && s.transform !== 'none')
        || (!!s.filter && s.filter !== 'none')
        || (!!s.perspective && s.perspective !== 'none');
    }
    // Tatsächlicher Containing-Block eines (absolut positionierten) Elements: nächster
    // Vorfahre, der einen CB erzeugt; sonst .slideo-content (falls via custom_css
    // positioniert) bzw. die Zone. NICHT offsetParent (liefert auch statische <td>).
    function moveCb(el) {
      var content = el.closest('.slideo-content'), zone = el.closest('.slideo-zone');
      if (!content || !zone) return zone || el.parentElement;
      var node = el.parentElement;
      while (node && node !== content) {
        if (createsCB(node)) return node;
        node = node.parentElement;
      }
      return createsCB(content) ? content : zone;
    }
    // Rect → %-Position/Größe relativ zur Padding-Box von cb (+ optionales Delta).
    // getBoundingClientRect ist in der per --slideo-scale skalierten Zone
    // Bildschirm-px → durch den Scale teilen (§21). clientLeft/Top/Width/Height sind
    // unskalierte Layout-px (von CSS-Transform unberührt) und bleiben außerhalb /s.
    function pctFromRect(r, cb, dx, dy) {
      var s = window.__sldScale || 1;
      var cbr = cb.getBoundingClientRect();
      var cw = cb.clientWidth || 1, ch = cb.clientHeight || 1;
      return {
        leftPct: ((r.left - cbr.left) / s - cb.clientLeft + (dx || 0) / s) / cw * 100,
        topPct: ((r.top - cbr.top) / s - cb.clientTop + (dy || 0) / s) / ch * 100,
        widthPct: (r.width / s) / cw * 100,
      };
    }
    function onMoveDrag(e) {
      if (!moveState) return;
      var dx = e.clientX - moveState.startX, dy = e.clientY - moveState.startY;
      if (!moveState.moved && (Math.abs(dx) + Math.abs(dy)) < 4) return; // Schwelle gegen Mini-Drags
      if (!moveState.moved) {
        moveState.moved = true;
        document.documentElement.style.userSelect = 'none';
        toolbar.style.display = 'none';
      }
      // dx/dy sind Bildschirm-px; das Element sitzt in einer um --slideo-scale
      // skalierten Zone → durch den Scale teilen, damit es der Maus 1:1 folgt.
      var s = window.__sldScale || 1;
      moveState.el.style.transform = 'translate(' + (dx / s) + 'px,' + (dy / s) + 'px)';
      boxFor(selBox, moveState.el);
    }
    function onMoveEnd(e) {
      document.removeEventListener('pointermove', onMoveDrag);
      document.removeEventListener('pointerup', onMoveEnd);
      document.removeEventListener('pointercancel', onMoveEnd);
      document.documentElement.style.userSelect = '';
      var ms = moveState; moveState = null;
      if (!ms || !ms.moved) return;
      var el = ms.el;
      el.style.transform = '';
      // pointercancel (System-/Touch-Geste): KEINE Op posten und suppressClick NICHT
      // setzen (sonst bliebe es hängen, da kein Klick folgt) — nur Overlays zurück.
      if (!e || e.type !== 'pointerup') { boxFor(selBox, el); placeToolbar(el); return; }
      suppressClick = true; // der folgende Klick darf nicht neu-selektieren
      var zone = ms.zone, content = el.closest('.slideo-content');
      var dx = e.clientX - ms.startX, dy = e.clientY - ms.startY;
      var draggedPath = pathOf(el);
      var P = el.parentElement;

      // Fixed-Element: an den Viewport gepinnt → Canvas-Verschieben nicht sinnvoll (no-op).
      if (isFixedEl(el)) return;

      // Schon absolut (oder kein Fluss-Kontext) → nur dieses Element neu positionieren.
      if (isAbs(el) || !P || !content) {
        if (draggedPath) {
          var d0 = pctFromRect(ms.rect, moveCb(el), dx, dy);
          parent.postMessage({ type: 'slideo:move-element', zoneId: zone.id.replace(/^zone-/, ''), path: draggedPath, leftPct: d0.leftPct, topPct: d0.topPct, tag: el.tagName.toLowerCase() }, '*');
        }
        return;
      }

      // Im Fluss → den Fluss-Kontext (Eltern P) einfrieren, damit nichts nachrückt.
      // Bezugsrahmen cb = TATSÄCHLICHER, schon bestehender Containing-Block (kein neuer
      // wird erzeugt — sonst verspränge er bereits-absolute Geschwister). P bekommt nur
      // seine Ist-Höhe fixiert (gegen Kollaps → %-positionierte Geschwister bleiben).
      var cb = moveCb(el);
      var drop = pctFromRect(ms.rect, cb, dx, dy);
      var items = [];
      if (P !== content) {
        var pPath = pathOf(P);
        // getBoundingClientRect ist Bildschirm-px (skaliert) → durch den Scale teilen,
        // damit die fixierte Höhe im unskalierten 1280×720-Koordinatensystem stimmt.
        var sc = window.__sldScale || 1;
        if (pPath) items.push({ path: pPath, heightPx: P.getBoundingClientRect().height / sc, expectTag: P.tagName.toLowerCase() });
      }
      var kids = Array.prototype.slice.call(P.children), handled = false;
      for (var i = 0; i < kids.length; i++) {
        var k = kids[i];
        if (k !== el && isAbs(k)) continue; // bereits absolut/fixed → unberührt lassen (CB unverändert)
        var kp = pathOf(k);
        if (!kp) continue;
        var ktag = k.tagName.toLowerCase();
        if (k === el) {
          items.push({ path: kp, leftPct: drop.leftPct, topPct: drop.topPct, widthPct: drop.widthPct, expectTag: ktag });
          handled = true;
        } else {
          var m = pctFromRect(k.getBoundingClientRect(), cb, 0, 0);
          items.push({ path: kp, leftPct: m.leftPct, topPct: m.topPct, widthPct: m.widthPct, expectTag: ktag });
        }
      }
      if (!handled && draggedPath) items.push({ path: draggedPath, leftPct: drop.leftPct, topPct: drop.topPct, widthPct: drop.widthPct, expectTag: el.tagName.toLowerCase() });
      parent.postMessage({ type: 'slideo:freeze-zone', zoneId: zone.id.replace(/^zone-/, ''), items: items, path: draggedPath }, '*');
    }

    document.addEventListener('pointermove', function (e) {
      if (dragEl || resizeImg || editing || moveState) return;
      if (e.target && e.target.closest && e.target.closest('.slideo-de-ui')) { hoverBox.style.display = 'none'; return; }
      var content = inHtmlZone(e.target) ? contentOf(e.target) : null;
      if (!content || e.target === content || e.target === selEl) { hoverBox.style.display = 'none'; return; }
      boxFor(hoverBox, e.target);
    });

    // Klick = Auswahl (Capture, um Inhalts-Handler/Links im Edit-Modus zu schlagen).
    document.addEventListener('click', function (e) {
      if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; } // nach Drag
      if (editing) return; // Text-Edit: native contenteditable-Klicks durchlassen
      if (e.target && e.target.closest && e.target.closest('.slideo-de-ui')) return; // Toolbar separat
      if (!inHtmlZone(e.target)) { if (selEl) deselect(); return; } // außerhalb HTML-Zone → Auswahl fallen lassen
      var content = contentOf(e.target);
      if (!content || e.target === content) { if (selEl) deselect(); return; }
      e.preventDefault(); e.stopPropagation();
      select(e.target);
    }, true);

    // Doppelklick → Inline-Text-Edit (Phase 2).
    document.addEventListener('dblclick', function (e) {
      if (!inHtmlZone(e.target)) return;
      var content = contentOf(e.target);
      if (!content || e.target === content) return;
      e.preventDefault();
      if (e.target !== selEl) select(e.target);
      startEdit(selEl);
    });

    // Verschiebe-Drag auf dem AUSGEWÄHLTEN Element starten (Phase 3).
    document.addEventListener('pointerdown', function (e) {
      if (editing || moveState || e.button !== 0) return;
      if (e.target && e.target.closest && e.target.closest('.slideo-de-ui')) return;
      if (!selEl || (e.target !== selEl && !selEl.contains(e.target))) return;
      var zone = inHtmlZone(selEl) ? selEl.closest('.slideo-zone-html') : null;
      if (!zone) return;
      // Element-Rect (vor dem Drag) merken → das Element landet genau dort, wo es
      // losgelassen wird (Bezugsrahmen wird beim pointerup frisch bestimmt).
      moveState = { el: selEl, zone: zone,
        startX: e.clientX, startY: e.clientY, moved: false, rect: selEl.getBoundingClientRect() };
      document.addEventListener('pointermove', onMoveDrag);
      document.addEventListener('pointerup', onMoveEnd);
      document.addEventListener('pointercancel', onMoveEnd);
    });

    // Inline-Edit bei Fokusverlust committen.
    document.addEventListener('focusout', function (e) {
      if (editing && e.target === editing) finishEdit(true);
    });

    toolbar.addEventListener('click', function (e) {
      var btn = e.target.closest && e.target.closest('[data-de]');
      if (!btn) return;
      e.preventDefault();
      var act = btn.getAttribute('data-de');
      if (act === 'up') levelUp();
      else if (act === 'text') startEdit(selEl);
      else if (act === 'duplicate') opMsg('duplicate');
      else if (act === 'delete') opMsg('delete');
    });

    document.addEventListener('keydown', function (e) {
      if (editing) {
        // Im Text-Edit: Enter committet (Shift+Enter = Zeilenumbruch), Esc bricht ab.
        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); finishEdit(true); }
        else if (e.key === 'Escape') { e.preventDefault(); finishEdit(false); }
        return;
      }
      if (!selEl) return;
      // Nur Delete (Entf) löscht — Backspace ist reflexhaft „zurück" und würde
      // überraschen. Zusätzlich Fokus-Guard + nur wenn die Auswahl im Blick ist.
      if (e.key === 'Delete') {
        if (!deleteAllowed(e.target)) return;
        var r = selEl.getBoundingClientRect();
        if (r.bottom < 0 || r.top > window.innerHeight) return; // Auswahl off-screen
        e.preventDefault(); opMsg('delete');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        var content = contentOf(selEl);
        if (selEl.parentNode && selEl.parentNode !== content) levelUp();
        else deselect();
      }
    });

    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    // Re-Select nach dem Re-Render: der Parent schickt die zuletzt gewählte
    // (ggf. angepasste) Adresse zurück → Auswahl wiederherstellen (still).
    window.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'slideo:reselect' && typeof d.zoneId === 'string' && d.path && d.path.length) {
        var section = document.getElementById('zone-' + d.zoneId);
        var el = section ? elAtPath(section, d.path) : null;
        if (el) select(el, true); else deselect();
      } else if (d.type === 'slideo:clear-select') {
        deselect();
      }
    });
  }
})();
`.trim()
}

/** CSS für den Aktiv-Folie-Modus (Transitions). Ersetzt im Deck-Modus die Snap-Regeln. */
function transitionCss(kind: TransitionKind, durationMs: number): string {
  const d = `${Math.max(0, Math.round(durationMs))}ms`
  // Auto-Animate (Spec §19.1): die aktive Folie wird sofort sichtbar (kein Folien-
  // Fade), Elemente mit gleichem data-id morphen per JS (FLIP, siehe navScript).
  // Funktioniert am besten bei gleichem Folien-Hintergrund (Magic-Move-Stil).
  // Übergänge wirken auf das .slideo-frame (Navigations-Einheit); die skalierte
  // Bühne (.slideo-zone) liegt darin zentriert (Spec §21).
  if (kind === 'auto') {
    // is-active erscheint sofort (kein Folien-Fade) und deckt bei opakem Hintergrund
    // die alte Folie ab; is-prev fadet als Sicherheitsnetz aus → bei transparentem
    // Folien-Hintergrund degradiert es zum Cross-Fade statt zum harten Aufblitzen.
    return `
html, body { height: 100%; overflow: hidden; }
.slideo-frame { position: absolute; inset: 0; margin: 0; opacity: 0; }
.slideo-frame.is-active { opacity: 1; z-index: 2; }
.slideo-frame.is-prev { opacity: 0; z-index: 1; transition: opacity ${d} ease; }`
  }
  const base = `
html, body { height: 100%; overflow: hidden; }
.slideo-frame {
  position: absolute; inset: 0; margin: 0;
  opacity: 0; will-change: opacity, transform;
  transition: opacity ${d} ease, transform ${d} ease;
}
.slideo-frame.is-active { opacity: 1; z-index: 2; }
.slideo-frame.is-prev { z-index: 1; }`
  if (kind === 'fade') {
    return `${base}
.slideo-frame.is-prev { opacity: 0; }`
  }
  if (kind === 'zoom') {
    return `${base}
.slideo-frame { transform: scale(1.04); }
.slideo-frame.is-active { transform: scale(1); }
.slideo-frame.is-prev { opacity: 0; transform: scale(0.98); }`
  }
  // slide (richtungsabhängig über data-dir)
  return `${base}
[data-dir="fwd"]  .slideo-frame { transform: translateX(100%); }
[data-dir="back"] .slideo-frame { transform: translateX(-100%); }
.slideo-frame.is-active { transform: translateX(0); }
[data-dir="fwd"]  .slideo-frame.is-prev { opacity: 0; transform: translateX(-100%); }
[data-dir="back"] .slideo-frame.is-prev { opacity: 0; transform: translateX(100%); }`
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
  // HTML-Zonen erhalten eine Markierungsklasse, damit der Direktmanipulations-
  // Layer (Spec §20) sie vom flussbasierten Markdown unterscheiden kann.
  const htmlClass = zone.content_type === 'html' ? ' slideo-zone-html' : ''
  // .slideo-frame = Layout-/Navigations-Einheit; die .slideo-zone darin ist die
  // feste, skalierte 1280×720-Bühne (Spec §21).
  return (
    `<div class="slideo-frame">` +
    `<section id="zone-${escapeAttr(zone.id)}" ` +
    `class="slideo-zone layout-${layout} align-${text_align}${htmlClass}" ` +
    `style="${style}">` +
    customStyle +
    `<div class="slideo-content">${inner}</div>` +
    logo +
    `</section>` +
    `</div>`
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
  /** directEdit = Direktmanipulation (Spec §20): Auswahl-Layer für HTML-Zonen. */
  directEdit?: boolean
}

/**
 * Restriktive CSP für die **In-App**-Folien-Iframes (Audit S3). Erlaubt die bewusst
 * inline laufenden Styles/Scripts der Folien (HTML-Zonen führen gewollt JS aus) sowie
 * Bild-/Medien-/Font-Quellen, unterbindet aber jeglichen Netzwerkverkehr
 * (`connect-src 'none'`, `default-src 'none'`) → eine bösartige HTML-Zone kann das Deck
 * nicht per fetch/Image/WebSocket exfiltrieren. Wird NUR in-app injiziert; der
 * Standalone-Export ([renderStandalonePage]) bleibt bewusst offen, damit geteilte Decks
 * externe Einbettungen weiter laden können.
 */
const SLIDE_CSP_META =
  '<meta http-equiv="Content-Security-Policy" content="' +
  "default-src 'none'; " +
  // slideoasset: ist das macOS-Schema; http://slideoasset.localhost die Windows-Form
  // (assetUrlBase() in tauri.ts) — beide müssen erlaubt sein, sonst brechen
  // gestreamte Videos/Audios in-app auf Windows (Audit-Review M1).
  'img-src data: blob: slideoasset: http://slideoasset.localhost; ' +
  'media-src data: blob: slideoasset: http://slideoasset.localhost; ' +
  'font-src data: slideoasset: http://slideoasset.localhost; ' +
  "style-src 'unsafe-inline'; " +
  "script-src 'unsafe-inline'; " +
  "connect-src 'none'; " +
  "object-src 'none'; " +
  "base-uri 'none'; " +
  "form-action 'none'" +
  '" />'

/** Rendert die komplette Präsentation als eine self-contained HTML-Page. */
export function renderFullPage(presentation: Presentation, options: RenderOptions = {}): string {
  const {
    present = false,
    assets,
    assetUrlBase,
    standalone = false,
    editable = false,
    directEdit = false,
  } = options
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

  // Präsentation passt jede Folie ins Fenster (fit-both, Letterbox); die Vorschau
  // skaliert auf volle Breite (fit-width, scrollend) — Default-Frame-CSS.
  const snapCss = !present
    ? ''
    : deck
      ? transitionCss(kind, duration)
      : `html { scroll-snap-type: y mandatory; scroll-behavior: smooth; }
.slideo-frame { width: 100%; height: 100vh; aspect-ratio: auto; margin: 0; scroll-snap-align: start; scroll-snap-stop: always; }
html, body { height: 100%; overflow-x: hidden; }`

  // Script immer einbinden (goto/show + Skalierung); eigene Tastatur nur im Standalone.
  // Im Editier-Modus zusätzlich das Drag-Reorder-/Direktmanipulations-Script.
  const script =
    `<script>${navScript(standalone, deck, duration, kind, present ? 'both' : 'width')}</script>` +
    (editable ? `<script>${editScript(directEdit)}</script>` : '')

  return `<!doctype html>
<html lang="de">
<head>
<meta charset="utf-8" />
${standalone ? '' : SLIDE_CSP_META}
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
/* Druck: jedes Frame ist genau eine 1280×720-Seite, die Bühne 1:1 (keine Skalierung). */
.slideo-frame {
  width: 1280px; height: 720px; aspect-ratio: auto; margin: 0;
  overflow: hidden;
  page-break-after: always; break-after: page;
}
.slideo-frame:last-child { page-break-after: auto; break-after: auto; }
.slideo-zone { transform: none; }
</style>
</head>
<body>
${sections}
</body>
</html>`
}

/** Rendert nur eine einzelne Zone als self-contained Mini-Page (Thumbnail/Speaker-
 *  Vorschau): die feste 1280×720-Bühne wird **ins Fenster eingepasst** (fit-both,
 *  zentriert/Letterbox) — passt damit in jede Box (Spec §21). */
export function renderSingleZonePage(
  presentation: Presentation,
  zone: Zone,
  assets?: AssetMap,
): string {
  return `<!doctype html>
<html lang="de"><head><meta charset="utf-8" />${SLIDE_CSP_META}<style>
${fontFaceCss(presentation, assets)}
:root {
${tokensToCssString(presentation.tokens)}
}
${SLIDE_CSS}
html, body { height: 100%; overflow: hidden; }
.slideo-frame { position: fixed; inset: 0; aspect-ratio: auto; margin: 0; }
</style></head><body>${renderZoneSection(zone, assets, undefined, false, false, logoHtml(presentation, assets))}<script>(function(){function f(){var s=Math.min((document.documentElement.clientWidth||1)/1280,(document.documentElement.clientHeight||1)/720);if(s>0)document.documentElement.style.setProperty('--slideo-scale',String(s));}f();window.addEventListener('resize',f);})();</script></body></html>`
}
