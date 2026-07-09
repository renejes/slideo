import type { Presentation, Zone, AssetMap, TransitionKind } from '@/types'
import { markdownToHtml, splitMarkdownBlocks } from './markdown-tiptap'
import { tokensToCssString } from './tokens'
import { mediaKind, fontFormat, extFromName } from './assets'

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
 * - In-App (mit `urlBase`): Bild/Video/Audio → Custom-Protocol-URL (`slideoasset://`),
 *   damit Medien nicht als (u.U. mehrere MB große) base64-Data-URI ins `srcDoc` inline
 *   müssen — kleineres Dokument, schnelleres (Re-)Parsen + gecachtes Decode im Handler
 *   (Audit P3/P7). Die Slide-CSP erlaubt `slideoasset:`/`http://slideoasset.localhost`.
 * - Ohne `urlBase` (Standalone-Export, Print, Browser-Dev): Fallback auf Data-URI inline
 *   (self-contained, kein Protokoll-Handler verfügbar).
 */
/** MIME aus einem Data-URI nur über den HEADER lesen (Audit P4) — ohne die u.U.
 *  mehrere MB große base64-Nutzlast zu materialisieren (anders als parseDataUri). */
function mimeFromDataUri(uri: string): string {
  if (!uri.startsWith('data:')) return ''
  // MIME endet beim ERSTEN ';' oder ',' (je nachdem was zuerst kommt) — robust auch
  // für "data:<mime>,<roher Inhalt mit ; darin>" (z.B. unkodiertes SVG).
  const semi = uri.indexOf(';')
  const comma = uri.indexOf(',')
  let end = uri.length
  if (semi >= 0) end = Math.min(end, semi)
  if (comma >= 0) end = Math.min(end, comma)
  return uri.slice(5, end)
}

function resolveAssetRefs(html: string, assets?: AssetMap, urlBase?: string): string {
  if (!assets) return html
  let out = html
  for (const [name, dataUri] of Object.entries(assets)) {
    const token = `assets/${name}`
    // Nicht referenzierte Assets überspringen (Audit P4: kein O(Zonen×Assets)-split/join
    // + kein base64-Decode für Assets, die in dieser Zone gar nicht vorkommen).
    if (!out.includes(token)) continue
    let replacement = dataUri
    if (urlBase) {
      const kind = mediaKind(mimeFromDataUri(dataUri)) // header-only, keine MB-base64
      // Bekannte Medien (Bild/Video/Audio) in-app über das Protocol streamen; alles
      // andere bleibt sicherheitshalber inline (defensiv gegen unbekannte Asset-Typen).
      if (kind === 'image' || kind === 'video' || kind === 'audio') replacement = `${urlBase}${name}`
    }
    out = out.split(token).join(replacement)
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
export function logoHtml(presentation: Presentation, assets?: AssetMap): string {
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
  var STANDALONE = ${standalone ? 'true' : 'false'};
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

  // ---- Zonen-Links (folien-internes Springen) ----
  // Jede .slideo-frame trägt eine <section id="zone-UUID">. Ein Element mit
  // data-slideo-goto (oder ein #zone-UUID-Hash) springt zu der Zielfolie. Alles
  // funnelt durch go()/den Parent — NIE nativer Hash-Scroll (der im Deck-Modus
  // stumm scheitert). Ziel = Zonen-UUID ODER 1-basierte Foliennummer.
  var zoneIndex = {};
  for (var zix = 0; zix < slides.length; zix++) {
    var sec = slides[zix].querySelector('section[id]');
    if (sec && sec.id) zoneIndex[sec.id.replace(/^zone-/, '')] = zix;
  }
  function resolveGoto(t) {
    if (t == null) return -1;
    t = String(t).replace(/^#/, '').replace(/^zone-/, '').trim();
    if (!t) return -1;
    if (Object.prototype.hasOwnProperty.call(zoneIndex, t)) return zoneIndex[t];
    if (/^[0-9]+$/.test(t)) { var n = parseInt(t, 10); if (n >= 1) return clamp(n - 1); }
    return -1;
  }
  function gotoTarget(idx) {
    if (idx < 0) return;
    // Standalone hat keinen Parent → selbst navigieren; in-app den autoritativen
    // Parent bitten (PresentationMode/PreviewPane setzen activeSlide/activeZone).
    if (STANDALONE) go(idx, true);
    else parent.postMessage({ type: 'slideo:goto-request', index: idx }, '*');
  }
  // Klick auf ein Sprung-Element (alle Modi). Im Direktbearbeiten-Modus NICHT
  // navigieren (dort selektiert der Klick Elemente — window.__sldDirectEdit aus
  // editScript). Bubble-Phase: in der Vorschau dürfen die §20-Handler zuerst greifen.
  document.addEventListener('click', function (e) {
    if (window.__sldDirectEdit) return;
    var t = e.target;
    var a = t && t.closest ? t.closest('[data-slideo-goto]') : null;
    if (!a) return;
    e.preventDefault();
    gotoTarget(resolveGoto(a.getAttribute('data-slideo-goto')));
  });
  // Schlichte <a href="#zone-UUID"> / Markdown-#-Links: hashchange → go() (auch im
  // Deck-Modus, plus Browser-Zurück gratis). Ziel-Elemente mit data-slideo-goto
  // verhindern den Hash bereits per preventDefault → kein Doppelsprung.
  window.addEventListener('hashchange', function () {
    var idx = resolveGoto(location.hash);
    if (idx >= 0) gotoTarget(idx);
  });

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
    if (t && t.closest && t.closest('a,button,input,textarea,select,label,video,audio,iframe,[contenteditable],[data-no-advance],[data-slideo-goto]')) return;
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
 *  3b. Markdown-Blöcke (editor-cleanup Punkt 3): in Markdown-Zonen ist die Einheit
 *     der ganze `.slideo-block` (Adressierung über `data-block-index`). Auswahl →
 *     Duplizieren/Löschen + Inline-Text-Edit einfacher Blöcke (p/h1–h3 → das editierte
 *     HTML konvertiert der Parent via Tiptap nach Markdown); kein Verschieben/Ebenen
 *     (Flussmodell). Re-Select über `slideo:reselect-block`. `selKind` ('element' | 'block').
 */
function editScript(directEdit: boolean): string {
  return `
(function () {
  var DIRECT = ${directEdit ? 'true' : 'false'};
  // Sichtbar für das navScript: im Direktbearbeiten-Modus unterdrückt es
  // Zonen-Link-Klicks (der Klick selektiert dort Elemente, statt zu navigieren).
  window.__sldDirectEdit = DIRECT;
  // Vorschau-„busy" (Spec §25 / P2·P6): meldet dem Parent, dass gerade eine Iframe-
  // Interaktion läuft (Block-Drag, Bild-Resize, §20-Verschieben, Inline-Text-Edit) →
  // der Parent schiebt In-Place-Patches auf, bis busy:false. Sonst könnte ein Patch die
  // Section unter dem gezogenen/bearbeiteten Element austauschen (Freeze schreibt
  // zone.html MITTEN im Drag). Zusätzlich window.__sldBusy für lokale Guards.
  function sldBusy(b) { window.__sldBusy = !!b; parent.postMessage({ type: 'slideo:preview-busy', busy: !!b }, '*'); }
  // Pointer-Capture auf das Wurzel-Element: so wird pointerup/-cancel dem Iframe auch
  // dann zugestellt, wenn die Maus außerhalb (über dem Editor / am Fensterrand) losgelassen
  // wird → der End-Handler feuert IMMER (sonst bliebe busy hängen und die Vorschau fröre ein).
  function sldCapture(e) { try { document.documentElement.setPointerCapture(e.pointerId); } catch (_) {} }
  function zoneOf(el) { return el && el.closest ? el.closest('.slideo-zone') : null; }
  function inHtmlZone(el) { return !!(el && el.closest && el.closest('.slideo-zone-html')); }
  function contentOf(el) { return el && el.closest ? el.closest('.slideo-content') : null; }
  // Element-Kind-Index-Pfad ab (exkl.) .slideo-content — die §20-Adresse eines HTML-Zonen-
  // Elements. Geteilt (shared scope), weil neben der Direktmanipulation auch der Bild-Resize
  // den Pfad braucht, um die Breite an HTML-Zonen-Bilder zu schreiben.
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
  // Erzeugt der Knoten einen Containing-Block für absolute Kinder? (position, aber auch
  // transform/filter/perspective.) Geteilt mit dem §20-Verschieben, damit Resize und Move
  // exakt denselben Bezugsrahmen nutzen.
  function createsCB(n) {
    var s = getComputedStyle(n);
    return (!!s.position && s.position !== 'static')
      || (!!s.transform && s.transform !== 'none')
      || (!!s.filter && s.filter !== 'none')
      || (!!s.perspective && s.perspective !== 'none');
  }
  // Tatsächlicher Containing-Block eines (absolut positionierten) Elements: nächster Vorfahre,
  // der einen CB erzeugt; sonst .slideo-content (falls positioniert) bzw. die Zone. NICHT
  // offsetParent (liefert auch statische <td> → falsche %-Breite).
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
  // Breite des Bezugsrahmens für die %-Bild-Breite: bei absolut/fixed positionierten Bildern
  // der TATSÄCHLICHE Containing-Block (moveCb — wie das Verschieben), sonst die .slideo-content-
  // Box (Markdown-Fluss). Beide rects sind in der skalierten Bühne Bildschirm-px → das
  // Verhältnis (Maus-Offset / cbWidth) ist scale-invariant (§21).
  function cbWidthOf(img) {
    var pos = getComputedStyle(img).position;
    if (pos === 'absolute' || pos === 'fixed') {
      return moveCb(img).getBoundingClientRect().width;
    }
    var content = img.closest('.slideo-content');
    return (content || img.parentNode).getBoundingClientRect().width;
  }

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
    sldBusy(false);
  }

  /* ---------- Bild-Resize ---------- */
  var rh = document.createElement('div');
  rh.className = 'slideo-resize';
  rh.style.display = 'none';
  document.body.appendChild(rh);
  var hoverImg = null, resizeImg = null, resizeLeft = 0, resizeCW = 1, resizeStartW = '';
  function isImg(el) {
    // Resize gilt für Bilder in Markdown- UND HTML-Zonen. Der Commit verzweigt in
    // onResizeEnd: Markdown → slideo:resize-image (block-index), HTML → slideo:resize-element
    // (§20-Pfad, setzt die CSS-Breite am rohen zone.html).
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
    // Nur committen, wenn sich die Breite wirklich geändert hat. Ein bloßer Klick auf den
    // Anfasser (oder ein Zug zurück auf die Startbreite) würde sonst eine No-op-Op posten, die
    // das rohe zone.html via DOMParser neu serialisiert/umformatiert + einen Undo-Schritt anlegt.
    if (resizeImg) document.documentElement.style.userSelect = ''; // immer zurücksetzen (auch No-op)
    if (resizeImg && resizeImg.style.width !== resizeStartW) {
      suppressClick = true; // den nachfolgenden Klick schlucken (sonst deselektiert er die §20-Auswahl)
      var z = resizeImg.closest('.slideo-zone');
      var width = resizeImg.style.width || '100%';
      if (z && inHtmlZone(resizeImg)) {
        // HTML-Zone: Breite über den §20-Pfad ans rohe zone.html schreiben (resizeWidth-Op).
        var path = pathOf(resizeImg);
        if (path) parent.postMessage({
          type: 'slideo:resize-element',
          zoneId: z.id.replace(/^zone-/, ''),
          path: path, width: width, tag: 'img'
        }, '*');
      } else {
        // Markdown-Zone: über block-index (unverändert).
        var block = resizeImg.closest('.slideo-block');
        if (z && block) {
          var imgs = block.querySelectorAll('img');
          parent.postMessage({
            type: 'slideo:resize-image',
            zoneId: z.id.replace(/^zone-/, ''),
            blockIndex: parseInt(block.getAttribute('data-block-index'), 10),
            imgIndex: Array.prototype.indexOf.call(imgs, resizeImg),
            width: width
          }, '*');
        }
      }
    }
    document.removeEventListener('pointermove', onResizeMove);
    document.removeEventListener('pointerup', onResizeEnd);
    document.removeEventListener('pointercancel', onResizeEnd);
    resizeImg = null;
    sldBusy(false);
  }
  rh.addEventListener('pointerdown', function (e) {
    if (!hoverImg) return;
    e.preventDefault();
    resizeImg = hoverImg;
    resizeStartW = resizeImg.style.width; // Startbreite → Schwelle gegen No-op-Commits
    resizeLeft = resizeImg.getBoundingClientRect().left;
    // Bezugsrahmen-Breite (CB): .slideo-content im Fluss, offsetParent bei absoluten
    // (HTML-Zonen-)Bildern → die committete %-Breite stimmt mit dem Drag überein.
    resizeCW = cbWidthOf(resizeImg);
    if (!resizeCW) resizeCW = 1;
    document.documentElement.style.userSelect = 'none';
    sldBusy(true);
    sldCapture(e); // pointerup auch bei Loslassen außerhalb des Iframes zustellen
    document.addEventListener('pointermove', onResizeMove);
    document.addEventListener('pointerup', onResizeEnd);
    document.addEventListener('pointercancel', onResizeEnd);
  });

  /* ---------- gemeinsamer Einstieg ---------- */
  document.addEventListener('pointermove', function (e) {
    // editing/moveState sind var-hoisted aus dem DIRECT-Block (undefined wenn aus) →
    // während eines §20-Inline-Edits/Verschiebens kein Resize-Anfasser einblenden.
    if (dragEl || resizeImg || editing || moveState) return; // während eines Zugs kein Hover-Update
    if (e.target === rh) return;     // auf dem Anfasser bleiben
    if (isImg(e.target)) { hoverImg = e.target; placeHandle(e.target); }
    else hideHandle();
  });
  document.addEventListener('pointerdown', function (e) {
    var handle = e.target.closest && e.target.closest('.slideo-drag');
    if (!handle) return;
    // Nicht über eine bereits laufende DIRECT-Interaktion legen (editing/moveState var-hoisted
    // aus dem DIRECT-Block; resizeImg aus dem Bild-Resize) — sonst postete das Drag-Ende ein
    // busy:false, während der Inline-Edit noch läuft → Patch detacht den contenteditable-Knoten.
    if (editing || moveState || resizeImg) return;
    var block = handle.closest('.slideo-block');
    if (!block) return;
    e.preventDefault();
    dragEl = block;
    dragZone = zoneOf(block);
    block.classList.add('slideo-dragging');
    document.documentElement.style.userSelect = 'none';
    sldBusy(true);
    sldCapture(e); // pointerup auch bei Loslassen außerhalb des Iframes zustellen
    document.addEventListener('pointermove', onDragMove);
    document.addEventListener('pointerup', onDragEnd);
    document.addEventListener('pointercancel', onDragEnd);
  });

  // Fenster-Fokusverlust (Cmd-Tab / Fensterwechsel) mitten im Drag → aktive Block-/Bild-
  // Interaktion sauber beenden (busy:false), sonst könnte sie ungepaart hängen bleiben
  // (Analog zur Splitter-blur-Bereinigung; Pointer-Capture deckt den Gleiches-Fenster-Fall).
  window.addEventListener('blur', function () {
    if (dragEl) onDragEnd();
    if (resizeImg) onResizeEnd();
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
      '<button class="slideo-de-btn" data-de="link" title="Mit Folie verknüpfen (Zonen-Link)">' +
        '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg></button>' +
      '<button class="slideo-de-btn" data-de="duplicate" title="Duplizieren">' +
        '<svg viewBox="0 0 24 24"><rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V5a2 2 0 0 1 2-2h8"/></svg></button>' +
      '<button class="slideo-de-btn" data-de="delete" title="Löschen (Entf)">' +
        '<svg viewBox="0 0 24 24"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2M6 6l1 14a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-14"/></svg></button>';
    document.body.appendChild(toolbar);

    var selEl = null, selZone = null, selKind = null; // selKind: 'element' (HTML-Zone) | 'block' (Markdown)
    var editing = null;      // Element im Inline-Text-Edit (Phase 2)
    var editingKind = null;  // 'element' (HTML-Zone) | 'block' (Markdown, Punkt 3b)
    var editingBlock = null; // bei editingKind==='block': der zugehörige .slideo-block
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

    // contentOf/pathOf leben jetzt im geteilten Scope (oben) — auch der Bild-Resize nutzt sie.
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
    // Toolbar je Auswahl-Art bestücken: HTML-Elemente bekommen alle Buttons, Markdown-
    // Blöcke v1 nur Duplizieren + Löschen (kein „Ebene hoch"; Text-Edit folgt in 3b).
    function configToolbar(kind) {
      var up = toolbar.querySelector('[data-de="up"]');
      var text = toolbar.querySelector('[data-de="text"]');
      var link = toolbar.querySelector('[data-de="link"]');
      // Kein „Ebene hoch" bei Blöcken; der Text-Button erscheint nur, wenn der Block ein
      // einfacher, inline-editierbarer Text-Block ist (sonst → Markdown-Editor, 3b).
      if (up) up.style.display = kind === 'block' ? 'none' : '';
      if (text) text.style.display = (kind === 'block' && !blockEditable(selEl)) ? 'none' : '';
      // Zonen-Link (§23) nur für HTML-Zonen-Elemente (Markdown bleibt flussbasiert,
      // kann kein data-slideo-goto tragen).
      if (link) link.style.display = kind === 'block' ? 'none' : '';
    }
    function select(el, silent) {
      if (selEl && selEl !== el) selEl.style.cursor = '';
      selEl = el; selZone = inHtmlZone(el) ? el.closest('.slideo-zone-html') : null; selKind = 'element';
      if (el) el.style.cursor = 'move'; // Affordance: ausgewähltes Element ist ziehbar (Phase 3)
      hoverBox.style.display = 'none';
      configToolbar('element');
      boxFor(selBox, el); placeToolbar(el);
      if (!silent) {
        var path = pathOf(el);
        if (selZone && path) parent.postMessage({ type: 'slideo:select-element', zoneId: selZone.id.replace(/^zone-/, ''), path: path, tag: el.tagName.toLowerCase() }, '*');
      }
    }
    // Markdown-Block auswählen (editor-cleanup Punkt 3): ganze .slideo-block-Einheit,
    // adressiert über data-block-index (NICHT den Kind-Index-Pfad der HTML-Zonen).
    // Kein 'move'-Cursor — Markdown bleibt flussbasiert (kein absolutes Verschieben).
    function selectBlock(block, silent) {
      if (selEl && selEl !== block) selEl.style.cursor = '';
      selEl = block; selZone = block.closest('.slideo-zone'); selKind = 'block';
      block.style.cursor = '';
      hoverBox.style.display = 'none';
      configToolbar('block');
      boxFor(selBox, block); placeToolbar(block);
      if (!silent) {
        var bi = parseInt(block.getAttribute('data-block-index'), 10);
        var zid = selZone ? selZone.id.replace(/^zone-/, '') : null;
        if (zid != null && !isNaN(bi)) parent.postMessage({ type: 'slideo:select-block', zoneId: zid, blockIndex: bi }, '*');
      }
    }
    function blockOpMsg(op) {
      if (selKind !== 'block' || !selEl || !selZone) return;
      var bi = parseInt(selEl.getAttribute('data-block-index'), 10);
      if (isNaN(bi)) return;
      parent.postMessage({ type: 'slideo:' + op + '-block', zoneId: selZone.id.replace(/^zone-/, ''), blockIndex: bi }, '*');
    }
    function deselect() {
      if (selEl) selEl.style.cursor = '';
      selEl = null; selZone = null; selKind = null;
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
    // Zonen-Link (§23): den Parent bitten, eine Ziel-Folie zu wählen (Folien-Auswahl-
    // Popover lebt im Parent — das Iframe kennt die Folien-Labels nicht). current =
    // aktueller data-slideo-goto-Wert (vorbelegt / „Link entfernen" möglich).
    function requestLink() {
      if (selKind !== 'element' || !selEl || !selZone) return;
      var path = pathOf(selEl);
      if (!path) return;
      parent.postMessage({
        type: 'slideo:request-link',
        zoneId: selZone.id.replace(/^zone-/, ''),
        path: path,
        tag: selEl.tagName.toLowerCase(),
        current: selEl.getAttribute('data-slideo-goto') || ''
      }, '*');
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
      editing = el; editingKind = 'element'; editingBlock = null;
      sldBusy(true);
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
    // Punkt 3b: ein EINFACHER Text-Block (genau ein p/h1–h3 mit reinem Inline-Inhalt) ist
    // inline editierbar. Komplexe Blöcke (Listen/Zitate/Code/Tabellen/Bild) NICHT — die
    // bearbeitet man im Markdown-Editor (zu großes HTML→Markdown-Divergenzrisiko). Gibt das
    // editierbare Element (p/h*) zurück oder null. Das Drag-Handle wird übersprungen.
    function blockEditable(block) {
      if (!block) return null;
      var el = null, kids = block.children;
      for (var i = 0; i < kids.length; i++) {
        if (kids[i].classList && kids[i].classList.contains('slideo-drag')) continue;
        if (el) return null; // mehr als ein Inhalts-Kind → nicht einfach
        el = kids[i];
      }
      if (!el) return null;
      var tag = el.tagName.toLowerCase();
      if (tag !== 'p' && tag !== 'h1' && tag !== 'h2' && tag !== 'h3') return null;
      if (!isInlineEditable(el)) return null;
      return el;
    }
    function startBlockEdit(block) {
      var el = blockEditable(block);
      if (!el || editing) return;
      editing = el; editingKind = 'block'; editingBlock = block;
      sldBusy(true);
      editOrig = el.innerHTML;
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
      // busy erst NACH der etwaigen edit-text/edit-block-text-Nachricht freigeben →
      // Parent schreibt zuerst den Store, danach reconciled er einmal (Patch + Re-Select).
      try { finishEditBody(commit); } finally { sldBusy(false); }
    }
    function finishEditBody(commit) {
      var el = editing, kind = editingKind, block = editingBlock;
      editing = null; editingKind = null; editingBlock = null; // zuerst, damit der Blur-Handler nicht doppelt feuert
      el.removeAttribute('contenteditable');
      el.style.cursor = '';
      if (commit) {
        if (kind === 'block') {
          // Leeren Block NICHT via Inline-Edit erzeugen (dafür Löschen): Original wiederherstellen
          // + Auswahl zeigen, KEINE Op posten — sonst zeigt die Vorschau einen geleerten Block,
          // während der Store unverändert bleibt (kein Re-Render → keine Korrektur). Review-Fix.
          if (!(el.textContent || '').trim()) {
            el.innerHTML = editOrig; editOrig = '';
            selectBlock(block, true);
            return;
          }
          // Markdown-Block: das OUTER-HTML des editierten Elements (mit Tag → Überschrift-
          // Level bleibt) → Parent konvertiert via Tiptap nach Markdown (Punkt 3b).
          var zb = block ? block.closest('.slideo-zone') : null;
          var bi = block ? parseInt(block.getAttribute('data-block-index'), 10) : NaN;
          if (zb && !isNaN(bi)) parent.postMessage({ type: 'slideo:edit-block-text', zoneId: zb.id.replace(/^zone-/, ''), blockIndex: bi, html: el.outerHTML }, '*');
          // Auswahl sofort wieder zeigen: bei einer ECHTEN Änderung re-rendert der Parent und
          // schickt slideo:reselect-block (idempotent); bei einem No-op-Commit (Text unverändert)
          // bliebe die Box sonst bis zur nächsten Interaktion verborgen. Review-Fix.
          selectBlock(block, true);
        } else {
          var zone = el.closest('.slideo-zone-html');
          var path = pathOf(el);
          // Bearbeitetes Inline-HTML schicken (Stil/Links bleiben erhalten);
          // applyElementOp sanitisiert es. Re-Select macht der Parent.
          var editedHtml = el.innerHTML;
          if (zone && path) parent.postMessage({ type: 'slideo:edit-text', zoneId: zone.id.replace(/^zone-/, ''), path: path, html: editedHtml, tag: el.tagName.toLowerCase() }, '*');
        }
      } else {
        el.innerHTML = editOrig; // Abbruch: verworfenen Text zurücksetzen (kein Re-Render)
        if (kind === 'block') selectBlock(block, true); else select(el, true); // Auswahl wieder zeigen
      }
      editOrig = '';
    }

    /* ---------- Phase 3: Verschieben + „Folie einfrieren" ---------- */
    function isAbs(n) { var p = getComputedStyle(n).position; return p === 'absolute' || p === 'fixed'; }
    function isFixedEl(n) { return getComputedStyle(n).position === 'fixed'; }
    // createsCB/moveCb leben jetzt im geteilten Scope (oben) — auch der Bild-Resize nutzt sie.
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
      // busy erst NACH etwaigen Op-Nachrichten (freeze-zone/move-element) freigeben, damit
      // der Parent zuerst den Store schreibt und danach EINMAL reconciled (Patch + Re-Select).
      try { onMoveEndBody(e); } finally { sldBusy(false); }
    }
    function onMoveEndBody(e) {
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

    // Hover-Overlay: das teure Box-Update (getBoundingClientRect + Style-Writes) per rAF
    // koaleszieren UND nur bei ZIEL-Wechsel ausführen (Audit P9) — die Box umrandet das
    // ganze Element/den ganzen Block, ändert sich also nicht, während die Maus IM selben
    // Ziel wandert. Das Ziel selbst wird pro pointermove billig bestimmt.
    var hoverTarget = null, hoverPending = false;
    function flushHover() {
      hoverPending = false;
      if (hoverTarget && document.contains(hoverTarget)) boxFor(hoverBox, hoverTarget);
      else hoverBox.style.display = 'none';
    }
    document.addEventListener('pointermove', function (e) {
      if (dragEl || resizeImg || editing || moveState) return;
      var t = null;
      if (e.target && e.target.closest && e.target.closest('.slideo-de-ui')) {
        t = null;
      } else if (inHtmlZone(e.target)) {
        // HTML-Zone: einzelne Elemente hervorheben.
        var content = contentOf(e.target);
        t = (!content || e.target === content || e.target === selEl) ? null : e.target;
      } else {
        // Markdown-Zone: den ganzen Block hervorheben (Block-granular).
        var block = e.target.closest && e.target.closest('.slideo-block');
        t = (!block || block === selEl) ? null : block;
      }
      if (t === hoverTarget) return; // gleiches Ziel → nichts neu zu zeichnen
      hoverTarget = t;
      if (!hoverPending) { hoverPending = true; requestAnimationFrame(flushHover); }
    });

    // Klick = Auswahl (Capture, um Inhalts-Handler/Links im Edit-Modus zu schlagen).
    document.addEventListener('click', function (e) {
      if (suppressClick) { suppressClick = false; e.preventDefault(); e.stopPropagation(); return; } // nach Drag
      if (editing) return; // Text-Edit: native contenteditable-Klicks durchlassen
      if (e.target && e.target.closest && e.target.closest('.slideo-de-ui')) return; // Toolbar separat
      if (!inHtmlZone(e.target)) {
        // Außerhalb einer HTML-Zone: ggf. einen Markdown-Block auswählen, sonst Auswahl fallen lassen.
        var block = e.target.closest && e.target.closest('.slideo-block');
        if (block) { e.preventDefault(); e.stopPropagation(); selectBlock(block); }
        else if (selEl) deselect();
        return;
      }
      var content = contentOf(e.target);
      if (!content || e.target === content) { if (selEl) deselect(); return; }
      e.preventDefault(); e.stopPropagation();
      select(e.target);
    }, true);

    // Doppelklick → Inline-Text-Edit (Phase 2 für HTML-Elemente, Punkt 3b für Markdown-Blöcke).
    document.addEventListener('dblclick', function (e) {
      if (inHtmlZone(e.target)) {
        var content = contentOf(e.target);
        if (!content || e.target === content) return;
        e.preventDefault();
        if (e.target !== selEl) select(e.target);
        startEdit(selEl);
        return;
      }
      // Markdown-Block: nur einfache Text-Blöcke (p/h*) inline editieren.
      var block = e.target.closest && e.target.closest('.slideo-block');
      if (!block || !blockEditable(block)) return;
      e.preventDefault();
      if (block !== selEl) selectBlock(block);
      startBlockEdit(block);
    });

    // Verschiebe-Drag auf dem AUSGEWÄHLTEN Element starten (Phase 3).
    document.addEventListener('pointerdown', function (e) {
      if (editing || moveState || e.button !== 0) return;
      if (selKind === 'block') return; // Markdown-Blöcke nicht verschiebbar (Flussmodell)
      if (e.target && e.target.closest && e.target.closest('.slideo-de-ui')) return;
      if (!selEl || (e.target !== selEl && !selEl.contains(e.target))) return;
      var zone = inHtmlZone(selEl) ? selEl.closest('.slideo-zone-html') : null;
      if (!zone) return;
      // Element-Rect (vor dem Drag) merken → das Element landet genau dort, wo es
      // losgelassen wird (Bezugsrahmen wird beim pointerup frisch bestimmt).
      moveState = { el: selEl, zone: zone,
        startX: e.clientX, startY: e.clientY, moved: false, rect: selEl.getBoundingClientRect() };
      sldBusy(true);
      sldCapture(e); // pointerup auch bei Loslassen außerhalb des Iframes zustellen
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
      else if (act === 'text') { if (selKind === 'block') startBlockEdit(selEl); else startEdit(selEl); }
      else if (act === 'link') requestLink();
      else if (act === 'duplicate') { if (selKind === 'block') blockOpMsg('duplicate'); else opMsg('duplicate'); }
      else if (act === 'delete') { if (selKind === 'block') blockOpMsg('delete'); else opMsg('delete'); }
    });

    document.addEventListener('keydown', function (e) {
      if (editing) {
        // Cmd/Ctrl+Enter: Absatz am Cursor in zwei eigene Bloecke teilen (Satz
        // extrahieren). Nur bei Element-Zonen (HTML §20); Markdown-Bloecke nicht.
        if ((e.metaKey || e.ctrlKey) && e.key === 'Enter' && editingKind === 'element') {
          e.preventDefault();
          var elS = editing;
          var selS = window.getSelection && window.getSelection();
          if (!selS || !selS.rangeCount) return;
          var tail = document.createRange();
          try {
            tail.selectNodeContents(elS);
            tail.setStart(selS.getRangeAt(0).endContainer, selS.getRangeAt(0).endOffset);
          } catch (err) { return; }
          var tmp = document.createElement('div');
          tmp.appendChild(tail.extractContents());
          // Nur teilen, wenn beide Seiten echten Text haben — sonst wieder zusammenfuegen.
          if (!(elS.textContent || '').trim() || !(tmp.textContent || '').trim()) {
            while (tmp.firstChild) elS.appendChild(tmp.firstChild);
            return;
          }
          var beforeH = elS.innerHTML, afterH = tmp.innerHTML;
          var zoneS = elS.closest('.slideo-zone-html');
          var pathS = pathOf(elS);
          editing = null; editingKind = null; editingBlock = null;
          elS.removeAttribute('contenteditable'); elS.style.cursor = ''; editOrig = '';
          if (zoneS && pathS) parent.postMessage({ type: 'slideo:split-text', zoneId: zoneS.id.replace(/^zone-/, ''), path: pathS, before: beforeH, after: afterH, tag: elS.tagName.toLowerCase() }, '*');
          sldBusy(false);
          return;
        }
        // Im Text-Edit: Enter committet, Esc bricht ab, Shift+Enter = Zeilenumbruch.
        if (e.key === 'Enter' && e.shiftKey) {
          // Umbruch EIGENHAENDIG als echtes br-Element setzen. Der native
          // WKWebView-Umbruch erzeugt einen reinen Zeilenumbruch-Textknoten bzw.
          // div-Wrapper, den sanitizeInline (nur Inline-Whitelist) beim Commit wieder
          // zusammenfaltet (Umbruch weg). Ein br-Element steht auf INLINE_OK und bleibt.
          // (Kein Backslash-n / kein Backtick hier — dieses Skript ist ein Template-Literal.)
          e.preventDefault();
          var sel = window.getSelection && window.getSelection();
          if (sel && sel.rangeCount) {
            var r = sel.getRangeAt(0);
            r.deleteContents();
            var br = document.createElement('br');
            r.insertNode(br);
            r.setStartAfter(br); r.collapse(true);
            sel.removeAllRanges(); sel.addRange(r);
          }
          return;
        }
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
        e.preventDefault();
        if (selKind === 'block') blockOpMsg('delete'); else opMsg('delete');
      } else if (e.key === 'Escape') {
        e.preventDefault();
        if (selKind === 'block') { deselect(); return; } // Blöcke haben keine Ebenen
        var content = contentOf(selEl);
        if (selEl.parentNode && selEl.parentNode !== content) levelUp();
        else deselect();
      }
    });

    window.addEventListener('scroll', reposition, true);
    window.addEventListener('resize', reposition);

    // Fenster-Fokusverlust mitten in Verschieben/Inline-Edit → sauber beenden (busy:false),
    // damit die Interaktion nie ungepaart hängt (onMoveEnd ohne pointerup-Event = Abbruch;
    // finishEdit committet — durch den editing-Guard idempotent mit dem focusout-Handler).
    window.addEventListener('blur', function () {
      if (moveState) onMoveEnd();
      else if (editing) finishEdit(true);
    });

    // Re-Select nach dem Re-Render: der Parent schickt die zuletzt gewählte
    // (ggf. angepasste) Adresse zurück → Auswahl wiederherstellen (still).
    window.addEventListener('message', function (e) {
      var d = e.data || {};
      if (d.type === 'slideo:reselect' && typeof d.zoneId === 'string' && d.path && d.path.length) {
        var section = document.getElementById('zone-' + d.zoneId);
        var el = section ? elAtPath(section, d.path) : null;
        if (el) select(el, true); else deselect();
      } else if (d.type === 'slideo:reselect-block' && typeof d.zoneId === 'string' && typeof d.blockIndex === 'number') {
        var bsection = document.getElementById('zone-' + d.zoneId);
        var block = bsection ? bsection.querySelector('.slideo-block[data-block-index="' + d.blockIndex + '"]') : null;
        if (block) selectBlock(block, true); else deselect();
      } else if (d.type === 'slideo:clear-select') {
        deselect();
      }
    });
  }
})();
`.trim()
}

/**
 * Patch-Script (nur Vorschau, Spec §25 / P2·P6): hält das Iframe am Leben und wendet
 * In-Place-Änderungen per postMessage an — statt bei jeder Änderung das ganze Iframe
 * neu zu laden (srcDoc). Zwei Nachrichten:
 *   - `slideo:patch-tokens {tokens}` → nur die `:root`-CSS-Variablen neu setzen
 *     (Inline überschreibt den <style>-Block; gleiche Mechanik wie --slideo-scale).
 *   - `slideo:patch-zone {zoneId, frameHtml}` → NUR die betroffene `.slideo-frame`
 *     aktualisieren. Der **Frame-Knoten bleibt erhalten** (nur sein innerHTML wird
 *     ersetzt) → navScripts `slides`-Array und der §23-`zoneIndex` (beide index- statt
 *     knotenbasiert, Section-id unverändert) bleiben gültig; Scroll/Auswahl der ANDEREN
 *     Zonen überleben. Die §20-Re-Auswahl der gepatchten Zone macht der Parent per
 *     vorhandenem `slideo:reselect`/`slideo:reselect-block`-Handshake.
 * Läuft als eigenständige IIFE (kein Zugriff auf navScript/editScript-Closures nötig).
 */
function patchScript(): string {
  return `
(function () {
  var root = document.documentElement;
  window.addEventListener('message', function (e) {
    var d = e.data || {};
    if (d.type === 'slideo:patch-tokens' && d.tokens && typeof d.tokens === 'object') {
      // Additiv setzen genügt: ein ENTFERNTER Token-Key würde per Inline-Style nicht sicher
      // gelöscht (der :root-Wert aus dem letzten Voll-Render bliebe) → solche Fälle klassifiziert
      // der Parent bewusst als Voll-Reload (preview-diff), erreichen diesen Pfad also nicht.
      for (var k in d.tokens) {
        if (Object.prototype.hasOwnProperty.call(d.tokens, k)) {
          root.style.setProperty('--' + k, String(d.tokens[k]));
        }
      }
      // Token-Änderung kann die Folie neu umbrechen (font-size-base/spacing-base/border-radius)
      // → die §20-Auswahl-Overlays neu vermessen lassen (editScript hört auf 'resize').
      window.dispatchEvent(new Event('resize'));
    } else if (d.type === 'slideo:patch-zone' && typeof d.zoneId === 'string' && typeof d.frameHtml === 'string') {
      var section = document.getElementById('zone-' + d.zoneId);
      if (!section) return; // Section fehlt → struktureller Mismatch; der Parent lädt dann voll neu
      var frame = section.closest ? section.closest('.slideo-frame') : null;
      if (!frame) return;
      // Neues Frame-HTML parsen und NUR den Inhalt in den bestehenden Frame-Knoten
      // übernehmen (Knoten-Identität bleibt → slides/zoneIndex bleiben gültig). Zonen-
      // HTML enthält keine <script> (die sind page-level) → innerHTML ist im WKWebView ok.
      var tpl = document.createElement('template');
      tpl.innerHTML = d.frameHtml;
      var newFrame = tpl.content.querySelector('.slideo-frame');
      if (!newFrame) return;
      frame.innerHTML = newFrame.innerHTML;
    }
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
    (editable
      ? `<script>${editScript(directEdit)}</script>` + `<script>${patchScript()}</script>`
      : '')

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
