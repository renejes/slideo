import {
  type Presentation,
  type Zone,
  DEFAULT_TOKENS,
  DEFAULT_ZONE_STYLE,
  FILE_FORMAT_VERSION,
} from '@/types'

// Normalisierung aller Deck-Eingänge (Review 2026-08, Befund M49/M50/S8).
//
// Das Rust-I/O ist BEWUSST untypisiert (serde_json::Value, preserve_order): so
// überlebt jedes unbekannte Feld einen Load-Edit-Save-Zyklus und die Schema-Hoheit
// bleibt im Frontend. Der Preis war, dass danach gar nichts mehr prüfte: eine
// defekte oder von Hand editierte `.slideo` erreichte den Renderer ungefiltert,
// und `renderZoneSection` dereferenziert `zone.style.layout` unbedingt → weißer
// Bildschirm, ohne ErrorBoundary im Baum. Gleichzeitig wurde `version` zwar
// geschrieben, aber NIE gelesen (M50) — CLAUDE.md-Regel 7 hatte keinen
// Durchsetzungspunkt und die erste echte Migration keinen Einhängepunkt.
//
// Leitlinie: **auffüllen, klemmen, sortieren — niemals verwerfen.** Vorwärts-
// kompatibilität ist eine Kernentscheidung des Formats; unbekannte Felder bleiben
// unangetastet. Diese Funktion repariert nur das, was der Renderer voraussetzt.

const LAYOUTS = new Set(['center', 'top', 'split', 'full', 'hero'])
const ALIGNS = new Set(['left', 'center', 'right'])

function normalizeZone(raw: unknown, index: number): Zone {
  const z = (raw ?? {}) as Partial<Zone> & Record<string, unknown>
  const style = (z.style ?? {}) as Partial<Zone['style']>
  const contentType = z.content_type === 'html' ? 'html' : 'markdown'
  return {
    ...z,
    id: typeof z.id === 'string' && z.id ? z.id : crypto.randomUUID(),
    label: typeof z.label === 'string' && z.label ? z.label : `Slide ${index + 1}`,
    order: index,
    content_type: contentType,
    markdown: typeof z.markdown === 'string' ? z.markdown : '',
    html: typeof z.html === 'string' ? z.html : null,
    custom_css: typeof z.custom_css === 'string' ? z.custom_css : '',
    notes: typeof z.notes === 'string' ? z.notes : '',
    reveal: z.reveal === 'steps' ? 'steps' : z.reveal === 'none' ? 'none' : undefined,
    style: {
      ...DEFAULT_ZONE_STYLE,
      ...style,
      // Ein unbekannter Layout-Wert erzeugt sonst `class="layout-banana"` und damit
      // eine still ungestylte Folie (S8) — dasselbe gilt für die Ausrichtung.
      layout: LAYOUTS.has(String(style.layout))
        ? (style.layout as Zone['style']['layout'])
        : DEFAULT_ZONE_STYLE.layout,
      text_align: ALIGNS.has(String(style.text_align))
        ? (style.text_align as Zone['style']['text_align'])
        : DEFAULT_ZONE_STYLE.text_align,
      padding: typeof style.padding === 'string' ? style.padding : DEFAULT_ZONE_STYLE.padding,
      background: typeof style.background === 'string' ? style.background : null,
    },
  } as Zone
}

/** Major-Version einer Formatangabe („1.0" → 1). NaN → 1 (wohlwollend). */
function major(version: unknown): number {
  const n = parseInt(String(version ?? '').split('.')[0], 10)
  return Number.isFinite(n) ? n : 1
}

export interface NormalizeResult {
  presentation: Presentation
  /** true, wenn die Datei aus einer neueren Hauptversion stammt (M50). */
  fromNewerVersion: boolean
}

/**
 * Bringt ein von außen kommendes Deck (Datei, Snapshot, MCP-Event) in eine Form,
 * die der Renderer sicher verarbeiten kann. Sortiert nach `order` und renummeriert.
 */
export function normalizePresentation(raw: unknown): NormalizeResult {
  const p = (raw ?? {}) as Partial<Presentation> & Record<string, unknown>
  const zonesRaw = Array.isArray(p.zones) ? p.zones : []
  const sorted = [...zonesRaw].sort((a, b) => {
    const ao = Number((a as Zone)?.order ?? 0)
    const bo = Number((b as Zone)?.order ?? 0)
    return (Number.isFinite(ao) ? ao : 0) - (Number.isFinite(bo) ? bo : 0)
  })
  const zones = sorted.map(normalizeZone)
  // Ein Deck ohne Folien lässt den Editor ins Leere laufen → eine leere anlegen.
  if (zones.length === 0) zones.push(normalizeZone({}, 0))

  const meta = (p.meta ?? {}) as Partial<Presentation['meta']>
  const nowIso = new Date().toISOString()

  return {
    fromNewerVersion: major(p.version) > major(FILE_FORMAT_VERSION),
    presentation: {
      ...p,
      version: typeof p.version === 'string' ? p.version : FILE_FORMAT_VERSION,
      meta: {
        ...meta,
        title: typeof meta.title === 'string' && meta.title ? meta.title : 'Unbenannt',
        created: typeof meta.created === 'string' ? meta.created : nowIso,
        modified: typeof meta.modified === 'string' ? meta.modified : nowIso,
        // Additiv (Spec-Feld `meta.language`): nur uebernehmen, wenn es ein
        // brauchbares BCP-47-artiges Tag ist. Alles andere faellt weg, der
        // Renderer setzt dann seinen Default.
        language:
          typeof meta.language === 'string' && /^[a-zA-Z]{2,3}(-[a-zA-Z0-9]{2,8})*$/.test(meta.language)
            ? meta.language
            : undefined,
      },
      // Fehlende Tokens auffüllen: der Renderer schreibt sie als :root-Variablen,
      // eine fehlende Farbe ergäbe sonst `var(--color-bg)` ohne Wert.
      tokens: { ...DEFAULT_TOKENS, ...(p.tokens ?? {}) },
      zones,
    } as Presentation,
  }
}
