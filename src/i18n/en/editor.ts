// English catalogue — src/components/editor/* + src/components/tokens/*.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/editor').editor

export const editor: Record<Keys, string> = {
  // --- ZoneCard: header, media drop, warning bands, collapsed row ---
  'editor.card.dragHandle': 'Drag to reorder',
  'editor.card.dragHandleAria': 'Move',
  'editor.card.dropMedia': 'Drop media here',
  'editor.card.mediaTypeOnly': 'Only images, video and audio are supported.',
  'editor.card.mediaReadFailed.one': '{count} file could not be read.',
  'editor.card.mediaReadFailed.other': '{count} files could not be read.',
  'editor.card.overflowTitle': 'Content overflows',
  'editor.card.overflowDetail': '~{px}px too tall — will be cut off when presenting and exporting.',
  'editor.card.htmlBadge': 'Custom HTML',
  'editor.card.htmlHint': 'Full browser mode — HTML, CSS & JavaScript are rendered as-is.',
  'editor.card.clickToEdit': 'Click to edit',
  'editor.card.emptySlide': 'Empty slide',

  // --- ZoneCard: custom CSS panel ---
  'editor.card.cssTitle': 'Custom CSS',
  'editor.card.cssActive': 'CSS in use',
  'editor.card.cssScope': 'styles this slide',
  'editor.card.cssHint':
    'Selectors apply to this slide only, e.g. {0}. Token variables such as {1} stay themeable.',

  // --- ZoneCard: notes panel ---
  'editor.card.notesTitle': 'Notes',
  'editor.card.notesPresent': 'Has notes',
  'editor.card.notesScope': 'speaker view only',
  'editor.card.notesPlaceholder': 'Speaker notes for this slide …',

  // --- ZoneToolbar ---
  'editor.toolbar.labelAria': 'Slide name',
  'editor.toolbar.lastSlide': 'The last slide cannot be deleted.',
  'editor.toolbar.deleteConfirm': 'Delete slide "{label}"? (Undo with Cmd/Ctrl+Z)',
  'editor.toolbar.toMarkdownConfirm':
    'Switch back to Markdown? HTML content cannot be converted back to Markdown in full, ' +
    'and it will no longer show up in the preview (it stays saved until you edit the ' +
    'Markdown content).',
  'editor.toolbar.layout': 'Layout (Two columns inserts a +++ column break automatically)',
  'editor.toolbar.textAlign': 'Text alignment',
  'editor.toolbar.reveal': 'Reveal in steps (builds): blocks appear one by one while presenting',
  'editor.toolbar.revealAria': 'Reveal in steps',
  'editor.toolbar.insertMedia': 'Insert media — opens the media manager (import & pick)',
  'editor.toolbar.insertMediaAria': 'Insert media',
  'editor.toolbar.insertComponent': 'Insert component (charts, key figures, timeline, quote …)',
  'editor.toolbar.insertComponentAria': 'Insert component',
  'editor.toolbar.toggleContentType': 'Switch between Markdown and HTML',
  'editor.toolbar.duplicateSlide': 'Duplicate slide (Cmd/Ctrl+D)',
  'editor.toolbar.duplicateSlideAria': 'Duplicate slide',
  'editor.toolbar.deleteSlide': 'Delete slide',

  // --- ImageToolbar (floating toolbar on the selected image) ---
  'editor.image.cropDone': 'Image cropped.',
  'editor.image.cropFailed': 'Cropping failed (image selection lost).',
  'editor.image.align': 'Alignment',
  'editor.image.alignTitle': 'Align {align}',
  'editor.image.wrap': 'Text wrap',
  'editor.image.wrapNone': 'None',
  'editor.image.wrapLeft': 'Left',
  'editor.image.wrapRight': 'Right',
  'editor.image.alt': 'Alt text',
  'editor.image.altPlaceholder': 'Image description (accessibility)',
  'editor.image.image': 'Image',
  'editor.image.cropTitle': 'Crop image',
  'editor.image.crop': 'Crop',

  // --- TiptapEditor / EditorCanvas ---
  'editor.tiptap.placeholder': 'Write your slide content here …',
  'editor.canvas.addSlide': 'Add slide',

  // --- TokenEditor (the brand kit inside the design overlay) ---
  'editor.tokens.themes': 'Themes',
  'editor.tokens.colors': 'Colors',
  'editor.tokens.colorAria': '{label} color',
  'editor.tokens.fonts': 'Fonts',
  'editor.tokens.fontUpload': 'Upload a font file (woff2/woff/ttf/otf)',
  'editor.tokens.upload': 'Upload',
  'editor.tokens.fontHint': 'Upload a font of your own — it shows up above under Heading/Body font.',
  'editor.tokens.logo': 'Logo',
  'editor.tokens.logoRemove': 'Remove',
  'editor.tokens.logoUpload': 'Upload a logo image (PNG/SVG with transparency recommended)',
  'editor.tokens.logoHint': 'Upload a logo image — it sits discreetly on every slide, exports included.',
  'editor.tokens.contrast': 'Contrast (WCAG)',
  'editor.tokens.contrastText': 'Text / background',
  'editor.tokens.contrastAccent': 'Accent / background',
  'editor.tokens.contrastPass': 'Meets WCAG AA',
  'editor.tokens.contrastFail': 'Below WCAG AA (4.5:1) for body text',
  'editor.tokens.transition': 'Transition',
  'editor.tokens.transitionDuration': 'Duration (ms)',
  'editor.tokens.transitionHint': 'Applies to presentation mode and the HTML export.',
  'editor.tokens.deckLanguage': 'Slide language',
  'editor.tokens.deckLanguageHint': 'Applies to hyphenation, screen readers and spell-checking while editing in the preview. It belongs to the presentation, not the interface — it travels with the file.',
  'editor.tokens.advanced': 'Advanced',
  'editor.tokens.advancedHint': 'Sizes & spacing',
  'editor.tokens.resetTitle': 'Reset every design token to its default',
  'editor.tokens.reset': 'Reset all tokens',

  // --- Label lists from src/types/index.ts ---
  'editor.logoPos.topLeft': 'Top left',
  'editor.logoPos.topRight': 'Top right',
  'editor.logoPos.bottomLeft': 'Bottom left',
  'editor.logoPos.bottomRight': 'Bottom right',

  'editor.transition.none': 'None',
  'editor.transition.fade': 'Fade',
  // „Schieben" is a push transition; calling it „Slide" would collide with the
  // word for the thing being animated.
  'editor.transition.slide': 'Push',
  'editor.transition.zoom': 'Zoom',
  'editor.transition.auto': 'Auto-Animate',

  'editor.token.colorPrimary': 'Primary',
  'editor.token.colorSecondary': 'Secondary',
  'editor.token.colorBg': 'Background',
  'editor.token.colorSurface': 'Surface',
  'editor.token.colorText': 'Text',
  'editor.token.colorAccent': 'Accent',
  'editor.token.fontHeading': 'Heading font',
  'editor.token.fontBody': 'Body font',
  'editor.token.fontSizeBase': 'Base font size',
  'editor.token.spacingBase': 'Base spacing',
  'editor.token.borderRadius': 'Corner radius',

  'editor.layout.center': 'Centered',
  'editor.layout.hero': 'Hero',
  'editor.layout.top': 'Top',
  'editor.layout.split': 'Two columns',
  'editor.layout.full': 'Full bleed',

  'editor.textAlign.left': 'Left',
  'editor.textAlign.center': 'Center',
  'editor.textAlign.right': 'Right',
}
