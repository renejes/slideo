// English catalogue — src/lib/* + src/types/index.ts — data catalogues, renderer, templates.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.

type Keys = keyof typeof import('../de/lib').lib

export const lib: Record<Keys, string> = {
  // --- Preview overlay inside the iframe (renderer.ts) ------------------------
  // These five values are injected into an iframe script that is built as a
  // template literal — a backtick or `${` here is fatal at runtime.
  'lib.preview.dragHandle': 'Drag to reorder',
  'lib.preview.selectParent': 'Select parent (Esc)',
  'lib.preview.editText': 'Edit text (double-click)',
  'lib.preview.linkSlide': 'Link to a slide',
  'lib.preview.delete': 'Delete (Del)',

  // --- WCAG contrast rating ---------------------------------------------------
  'lib.contrast.largeTextOnly': 'large text only',
  'lib.contrast.tooLow': 'too low',

  // --- Tauri bridge -----------------------------------------------------------
  'lib.tauri.unavailable':
    'Tauri backend unavailable (command "{cmd}"). File operations only work in the desktop app (npm run tauri:dev).',

  // --- Onboarding: sample prompt to copy --------------------------------------
  'lib.onboarding.topicPlaceholder': '[your topic]',
  'lib.onboarding.topicQuoted': '“{title}”',
  'lib.onboarding.samplePrompt':
    'Build a presentation in Slideo about {topic}. Create 6–8 clear slides — one key message per slide, written in Markdown. Use the design tokens, suitable layouts and the built-in components, and keep everything inside the 1280×720 safe area. The slides show up live in Slideo as you build.',

  // --- Theme presets ----------------------------------------------------------
  'lib.preset.editorial.label': 'Editorial',
  'lib.preset.editorial.description': 'Light, serif, editorial — calm type with a terracotta accent.',
  'lib.preset.dark-tech.label': 'Dark Tech',
  'lib.preset.dark-tech.description': 'Dark and matter-of-fact — blue and cyan accents on deep midnight blue.',
  'lib.preset.warm.label': 'Warm',
  'lib.preset.warm.description': 'Warm cream with orange — inviting and friendly.',
  'lib.preset.minimal.label': 'Minimal',
  'lib.preset.minimal.description': 'Black and white, maximum restraint — no rounded corners.',
  'lib.preset.corporate.label': 'Corporate',
  'lib.preset.corporate.description': 'Professional — navy on white, clean blues.',

  // --- Starter templates ------------------------------------------------------
  // The `slideN` values are Markdown and become CONTENT the moment a presentation
  // is created: written once in the language that was active back then, frozen
  // afterwards. Keep the structure intact — heading levels, the '+++' column
  // separator and the blank lines all carry meaning.
  'lib.template.blank.label': 'Blank',
  'lib.template.blank.description': 'A single title slide — build it your way.',
  'lib.template.blank.slide1': '# {title}\n\nYour first slide. Start writing.',

  'lib.template.pitch.label': 'Pitch',
  'lib.template.pitch.description': 'Startup pitch: problem → solution → market → ask.',
  'lib.template.pitch.slide1': '# {title}\n\nYour tagline in one sentence.',
  'lib.template.pitch.slide2':
    '## Problem\n\n- The pain your audience feels\n- Why existing solutions fall short\n- Why now',
  'lib.template.pitch.slide3':
    '## Solution\n\nYour product in one sentence.\n\n+++\n\n### How it works\n\n- Step 1\n- Step 2\n- Step 3',
  'lib.template.pitch.slide4':
    '## Market\n\n**TAM** – total market\n\n**SAM** – market you can serve\n\n**SOM** – realistic share',
  'lib.template.pitch.slide5':
    '## Traction\n\n- Users / revenue\n- Growth per month\n- Key milestones',
  'lib.template.pitch.slide6': '## Ask\n\nWe are raising **X €** for **Y**.\n\nGet in touch: …',

  'lib.template.lecture.label': 'Lecture',
  'lib.template.lecture.description': 'Talks and teaching: title, agenda, chapters, takeaways.',
  'lib.template.lecture.slide1': '# {title}\n\nName · Date',
  'lib.template.lecture.slide2':
    '## Agenda\n\n1. Introduction\n2. Main part\n3. Examples\n4. Summary',
  'lib.template.lecture.slide3': '## Introduction\n\nSketch the key terms and the context.',
  'lib.template.lecture.slide4': '## Main part\n\nYour central point — one thought per slide.',
  'lib.template.lecture.slide5': '## Summary\n\n- Key point 1\n- Key point 2\n- What comes next',

  'lib.template.editorial.label': 'Editorial',
  'lib.template.editorial.description': 'Editorial look: large type, unhurried sections.',
  'lib.template.editorial.slide1': '# {title}',
  'lib.template.editorial.slide2': '## A strong claim\n\nA paragraph that unfolds it calmly.',
  'lib.template.editorial.slide3': '> A sharp quote that sticks.',
  'lib.template.editorial.slide4': '## Three points\n\n- First\n- Second\n- Third',
}
