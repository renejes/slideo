import type { AssetMap, DesignTokens, FontFace, Presentation, Zone } from '@/types'
import type { BrandLogo } from '@/types'

// Klassifikation für den In-Place-Vorschau-Patch (Spec §25 / P2·P6).
//
// Die Vorschau lädt das Iframe NICHT mehr bei jeder Änderung neu (srcDoc-Reload),
// sondern vergleicht den neuen `presentation`-Stand mit dem zuletzt gerenderten und
// entscheidet:
//   - 'full'  → kompletter Iframe-Reload (renderFullPage → srcDoc). Fallback + selten:
//               strukturelle Änderungen (Zonen add/remove/reorder), geänderte Assets/
//               Fonts/Logo, previewEdit-Toggle, erster Render.
//   - 'patch' → per postMessage in-place: Token-CSS-Variablen und/oder einzelne
//               `.slideo-frame`-Sections austauschen. Häufigster Fall (Tippen, Design).
//   - 'none'  → nichts RENDER-relevant geändert (nur meta.modified/notes/reveal/…):
//               kein Iframe-Eingriff, nur den Vergleichs-Snapshot nachziehen.
//
// Reines Modul (kein DOM, kein Store) → gut adversarial-review- und testbar. Die
// Klassifikation MUSS konservativ sein: im Zweifel 'full' (nie ein falscher Patch).

export type PreviewPatch =
  | { kind: 'full' }
  | { kind: 'none' }
  | { kind: 'patch'; tokens: DesignTokens | null; zoneIds: string[] }

/** Flacher Vergleich zweier String-Maps (Tokens sind `--key: value`-Paare). */
function tokensEqual(a: DesignTokens, b: DesignTokens): boolean {
  if (a === b) return true
  const ak = Object.keys(a)
  const bk = Object.keys(b)
  if (ak.length !== bk.length) return false
  for (const k of ak) {
    if (a[k] !== b[k]) return false
  }
  return true
}

function logoEqual(a: BrandLogo | undefined, b: BrandLogo | undefined): boolean {
  if (a === b) return true
  if (!a || !b) return false
  return a.asset === b.asset && a.position === b.position
}

function fontsEqual(a: FontFace[] | undefined, b: FontFace[] | undefined): boolean {
  if (a === b) return true
  const al = a ?? []
  const bl = b ?? []
  if (al.length !== bl.length) return false
  for (let i = 0; i < al.length; i++) {
    if (al[i].family !== bl[i].family || al[i].asset !== bl[i].asset) return false
  }
  return true
}

/**
 * Ändert sich die GERENDERTE Section einer Zone (renderZoneSection, Vorschau =
 * editable:true, fragments:false)? Bewusst NUR die Felder, die in der Vorschau ins
 * Frame-HTML einfließen: content_type (markdown↔html), markdown, html, custom_css und
 * style (layout/padding/background/text_align). `reveal` wirkt nur in der Präsentation
 * (fragments), `notes`/`label` nie im Frame → hier absichtlich ignoriert.
 */
function zoneRenderChanged(a: Zone, b: Zone): boolean {
  if (a.content_type !== b.content_type) return true
  if (a.markdown !== b.markdown) return true
  if (a.html !== b.html) return true
  if (a.custom_css !== b.custom_css) return true
  const sa = a.style
  const sb = b.style
  return (
    sa.layout !== sb.layout ||
    sa.padding !== sb.padding ||
    sa.background !== sb.background ||
    sa.text_align !== sb.text_align
  )
}

/**
 * Vergleicht den zuletzt gerenderten Stand (`prev`) mit dem neuen (`next`) und liefert
 * die günstigste sichere Patch-Strategie. `prevAssets`/`nextAssets` sind die Asset-Maps
 * (Identitätsvergleich reicht: der Store ersetzt das Objekt bei jeder Asset-Änderung).
 */
export function classifyPreviewChange(
  prev: Presentation | null,
  next: Presentation,
  prevAssets: AssetMap | null,
  nextAssets: AssetMap,
  prevEdit: boolean,
  nextEdit: boolean,
): PreviewPatch {
  // Erster Render → Voll-Reload (baut das Iframe überhaupt erst auf).
  if (!prev) return { kind: 'full' }
  // previewEdit-Toggle ändert die injizierten Skripte (editScript directEdit) → Reload.
  if (prevEdit !== nextEdit) return { kind: 'full' }
  // Assets geändert (Bild-Import/Crop/Font-Upload) → betrifft resolveAssetRefs in
  // beliebig vielen Zonen + fontFaceCss im <head>. Selten → sicher voll neu laden.
  if (prevAssets !== nextAssets) return { kind: 'full' }
  // Struktur: Zonenzahl bzw. -Reihenfolge/-IDs geändert (add/remove/reorder) → Reload
  // (navScript kennt die neuen Frames erst nach einem Neuaufbau).
  if (prev.zones.length !== next.zones.length) return { kind: 'full' }
  for (let i = 0; i < next.zones.length; i++) {
    if (prev.zones[i].id !== next.zones[i].id) return { kind: 'full' }
  }
  // Logo (auf JEDER Folie) und Fonts (<head> font-face) → global → Reload (beide selten).
  if (!logoEqual(prev.meta.logo, next.meta.logo)) return { kind: 'full' }
  if (!fontsEqual(prev.fonts, next.fonts)) return { kind: 'full' }
  // Deck-Sprache steht im `<html lang="…">` und damit AUSSERHALB jeder Zone — ein
  // In-Place-Patch käme dort nie an, die Vorschau behielte still die alte Sprache
  // (und damit die falsche Rechtschreibprüfung beim Inline-Bearbeiten). Der
  // `|| 'de'`-Fallback spiegelt `deckLang()` in renderer.ts: der Übergang
  // `undefined` → `'de'` ändert das gerenderte Markup nicht und löst deshalb auch
  // keinen überflüssigen Reload aus.
  if ((prev.meta.language || 'de') !== (next.meta.language || 'de')) return { kind: 'full' }

  // Ab hier: gleiche Zonen-IDs in gleicher Reihenfolge, gleiche Assets/Fonts/Logo.
  const tokensChanged = !tokensEqual(prev.tokens, next.tokens)
  if (tokensChanged) {
    // Ein ENTFERNTER Token-Key (z.B. Custom-Token nach „Zurücksetzen"/reset_tokens) lässt
    // sich per Inline-Patch nicht sicher löschen — der aus dem letzten Voll-Render stammende
    // :root-Wert überdauerte und würde stale rendern. Solche (seltenen) Fälle → Voll-Reload,
    // der :root sauber neu aufbaut. Reines Hinzufügen/Ändern von Keys bleibt patchbar.
    for (const k of Object.keys(prev.tokens)) {
      if (!(k in next.tokens)) return { kind: 'full' }
    }
  }
  const tokens = tokensChanged ? next.tokens : null
  const zoneIds: string[] = []
  for (let i = 0; i < next.zones.length; i++) {
    if (zoneRenderChanged(prev.zones[i], next.zones[i])) zoneIds.push(next.zones[i].id)
  }
  if (!tokens && zoneIds.length === 0) return { kind: 'none' }
  return { kind: 'patch', tokens, zoneIds }
}
