import StarterKit from '@tiptap/starter-kit'
import Typography from '@tiptap/extension-typography'
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
