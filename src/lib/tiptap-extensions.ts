import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
import Link from '@tiptap/extension-link'
import { Markdown } from 'tiptap-markdown'
import type { Extensions } from '@tiptap/react'
import { SlideoImage } from './tiptap-image'

// Gemeinsamer Tiptap-Extension-Satz, der sowohl vom Editor (ZoneCard) als auch
// von den Markdown↔JSON-Convertern genutzt wird. So bleibt die Konvertierung
// in beide Richtungen konsistent.
//
// tiptap-markdown übernimmt die Markdown ↔ Tiptap-JSON Konvertierung;
// ein eigener Parser ist nicht nötig (siehe Spec §9).
export function baseExtensions(): Extensions {
  return [
    StarterKit.configure({
      // Heading-Level auf 1–3 begrenzen (Spec-Renderer stylt h1–h3).
      heading: { levels: [1, 2, 3] },
    }),
    Typography,
    // Link-Mark (Review 2026-08, Befund B5): StarterKit bringt SIE NICHT MIT.
    // Ohne sie kennt das ProseMirror-Schema keine Links → `[Text](url)` aus dem
    // KI-Entwurf wurde beim ersten Tastendruck des Menschen als reiner Text
    // zurückserialisiert, der Link war weg. Gilt gleichermaßen für den
    // Inline-Commit der Vorschau, der dieselben Extensions nutzt.
    //   autolink:false  → Tippen soll keine Links erfinden (Markdown ist die Quelle).
    //   openOnClick:false → im Editor navigiert ein Klick nicht weg.
    //   linkOnPaste:true  → eingefügte URL auf markiertem Text wird ein Link.
    Link.configure({ autolink: false, openOnClick: false, linkOnPaste: true }),
    // Bild-Knoten (mit Positionierungs-Attributen, Spec §18.1), damit
    // `![](assets/…)`-Referenzen beim Markdown-Roundtrip erhalten bleiben
    // und Größe/Ausrichtung/Float persistiert werden.
    SlideoImage.configure({ allowBase64: true }),
    Markdown.configure({
      html: true, // rohes HTML in Markdown erlauben ("custom HTML block")
      tightLists: true,
      linkify: true,
      breaks: false,
      transformPastedText: true,
    }),
  ]
}
