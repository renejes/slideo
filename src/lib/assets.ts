import type { Asset, AssetMap } from '@/types'

// Konvertierungen zwischen der Rust-Repräsentation (Asset: base64) und der
// Laufzeit-Map im Frontend (Dateiname → Data-URI).

export function parseDataUri(dataUri: string): { mime: string; base64: string } {
  const match = /^data:([^;,]+)?(?:;base64)?,(.*)$/s.exec(dataUri)
  if (!match) return { mime: 'application/octet-stream', base64: '' }
  return { mime: match[1] || 'application/octet-stream', base64: match[2] || '' }
}

export function assetToDataUri(asset: Asset): string {
  return `data:${asset.mime};base64,${asset.data}`
}

export function assetsToMap(assets: Asset[]): AssetMap {
  const map: AssetMap = {}
  for (const a of assets) map[a.name] = assetToDataUri(a)
  return map
}

export function mapToAssets(map: AssetMap): Asset[] {
  return Object.entries(map).map(([name, dataUri]) => {
    const { mime, base64 } = parseDataUri(dataUri)
    return { name, mime, data: base64 }
  })
}

export function mimeToExt(mime: string): string {
  const table: Record<string, string> = {
    'image/png': 'png',
    'image/jpeg': 'jpg',
    'image/gif': 'gif',
    'image/webp': 'webp',
    'image/svg+xml': 'svg',
    'image/avif': 'avif',
    'image/bmp': 'bmp',
    'image/x-icon': 'ico',
    // Video
    'video/mp4': 'mp4',
    'video/webm': 'webm',
    'video/ogg': 'ogv',
    'video/quicktime': 'mov',
    // Audio
    'audio/mpeg': 'mp3',
    'audio/ogg': 'ogg',
    'audio/wav': 'wav',
    'audio/x-wav': 'wav',
    'audio/webm': 'weba',
    'audio/mp4': 'm4a',
    'audio/aac': 'aac',
  }
  if (table[mime]) return table[mime]
  // Fallback: Subtyp als Endung (z.B. "video/x-matroska" → "x-matroska" ist unschön,
  // aber besser als "bin"); bei bekannten Präfixen sinnvolle Defaults.
  if (mime.startsWith('video/')) return 'mp4'
  if (mime.startsWith('audio/')) return 'mp3'
  return 'bin'
}

export type MediaKind = 'image' | 'video' | 'audio' | 'other'

export function mediaKind(mime: string): MediaKind {
  if (mime.startsWith('image/')) return 'image'
  if (mime.startsWith('video/')) return 'video'
  if (mime.startsWith('audio/')) return 'audio'
  return 'other'
}

/** Kurze, eindeutige ID für Asset-Dateinamen. */
export function shortId(): string {
  return crypto.randomUUID().slice(0, 8)
}

/** Kleingeschriebene Dateiendung (ohne Punkt), oder '' wenn keine. */
export function extFromName(name: string): string {
  const i = name.lastIndexOf('.')
  return i >= 0 ? name.slice(i + 1).toLowerCase() : ''
}

/** CSS `format(...)`-String für `@font-face` aus der Dateiendung. */
export function fontFormat(ext: string): string {
  switch (ext.toLowerCase()) {
    case 'woff2':
      return 'woff2'
    case 'woff':
      return 'woff'
    case 'ttf':
      return 'truetype'
    case 'otf':
      return 'opentype'
    default:
      return 'woff2'
  }
}

/** Leitet aus einem Datei-/Asset-Namen einen lesbaren Font-Familiennamen ab. */
export function familyFromName(name: string): string {
  const base = name.replace(/\.[^.]+$/, '') // Endung weg
  return (
    base
      .replace(/[-_]+/g, ' ')
      .replace(/\s+/g, ' ')
      .trim() || 'Schrift'
  )
}
