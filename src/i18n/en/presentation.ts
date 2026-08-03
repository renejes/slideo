// English catalogue — src/components/presentation/* + src/components/preview/*.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/presentation').presentation

export const presentation: Record<Keys, string> = {
  // --- Slide iframe (PresentationMode and ProjectorView show the same thing) ---
  'present.iframe.title': 'Presentation',

  // --- Slide window / sharing (spec §26) ---
  // The window title is set in Rust (present.rs) and is the same in every
  // language — it has to match what Zoom/Meet lists in their window picker.
  'present.share.opened':
    'Slide window opened. In Zoom/Meet pick “Share window” → “Slideo — Präsentation”. For a projector: drag it onto the second display, then hit “Fullscreen”.',
  'present.share.failed': 'Could not open the slide window: {error}',
  'present.fullscreen.failed': 'Fullscreen failed: {error}',

  // --- Presentation-mode control bar ---
  // The letters in brackets are the keyboard shortcuts and stay the same in
  // every language — the key handler listens for exactly those keys.
  'present.control.prev': 'Previous (←)',
  'present.control.next': 'Next (→)',
  'present.control.overview': 'Overview (g)',
  'present.control.laser': 'Laser pointer (l)',
  'present.control.pen': 'Pen (p)',
  'present.control.clearAnnotations': 'Clear annotations (c)',
  'present.control.autoStop': 'Stop auto-advance (a)',
  'present.control.autoStart': 'Start auto-advance (a)',
  'present.control.autoSeconds': 'Seconds per step',
  'present.control.autoSecondsAria': 'Seconds per step (auto-advance)',
  'present.control.loopOff': 'Loop off',
  'present.control.loopOn': 'Loop (start over at the end)',
  'present.control.share':
    'Show the slide in a separate window — share it in Zoom/Meet or drag it onto a second screen (your notes stay private)',
  'present.control.projectorWindowed': 'Slide window: back to a window (to share in Zoom/Meet)',
  'present.control.projectorFullscreen':
    'Slide window: fullscreen on its own screen (drag it onto the projector, then click)',
  'present.control.projectorClose': 'Close slide window',
  'present.control.toggleSpeaker': 'Toggle speaker view (s)',
  'present.control.speaker': 'Speaker',
  'present.control.slide': 'Slide',
  'present.exit.title': 'Exit (Esc)',
  'present.exit.label': 'Exit',

  // --- Speaker view ---
  'present.speaker.current': 'Current · {label}',
  'present.speaker.next': 'Next · {label}',
  'present.speaker.last': 'Last slide',
  'present.speaker.end': 'End of presentation',
  'present.speaker.notes': 'Notes',
  'present.speaker.noNotes': 'No notes for this slide.',
  'present.speaker.step': 'Step {current}/{total}',

  // --- Slide overview (jump grid) ---
  'present.overview.aria': 'Slide overview',
  'present.overview.count.one': 'Overview · {count} slide',
  'present.overview.count.other': 'Overview · {count} slides',
  'present.overview.close': 'Close (Esc)',
  'present.overview.current': 'Current',

  // --- Static slide thumbnail ---
  'present.thumb.title': 'Slide preview',

  // --- Preview column next to the editor ---
  'present.preview.heading': 'Preview',
  'present.preview.directEditHint':
    'Direct editing: click in the preview — HTML elements and Markdown blocks alike can be edited in place (double-click), duplicated and deleted',
  'present.preview.directEdit': 'Direct editing',
  'present.preview.collapse': 'Collapse preview',
  'present.preview.linkSlide': 'Link to slide',
  'present.preview.noSlides': 'No slides.',
  'present.preview.slideFallback': 'Slide {index}',
  'present.preview.removeLink': 'Remove link',
}
