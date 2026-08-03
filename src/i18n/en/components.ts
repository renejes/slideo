// English catalogue — src/lib/component-forms.ts — form schemas + component catalogue overlay.
//
// Typed against the German catalogue: every key must exist, none may be extra.
// `tsc --noEmit` (first step of `npm run build`) enforces this — no runtime test
// can tell you about a missing translation as early as the compiler does.
//
// `comp.catalog.*` and `comp.seed.*` are deliberately WORD-FOR-WORD identical to
// src-tauri/src/components.rs (the `list_components` catalogue and the generator
// fallbacks). The overlay is redundant in English — but keeping it means the
// palette always reads from one place, in either language, instead of switching
// its source of truth with the locale. Only the `toc` description follows the
// wording contract ("slide", never "zone") where the AI-facing Rust text says
// "zone".

type Keys = keyof typeof import('../de/components').components

export const components: Record<Keys, string> = {
  // ---------------------------------------------------------------------------
  // (a) Catalogue — display overlay per component type
  // ---------------------------------------------------------------------------
  'comp.catalog.stat_cards.label': 'Stat cards',
  'comp.catalog.stat_cards.description': 'Row of large KPI cards (value + label).',
  'comp.catalog.bar_chart.label': 'Bar chart',
  'comp.catalog.bar_chart.description': 'Horizontal bars, automatically scaled.',
  'comp.catalog.line_chart.label': 'Line chart',
  'comp.catalog.line_chart.description': 'Line trend over time as SVG, token-aware.',
  'comp.catalog.donut_chart.label': 'Donut / pie chart',
  'comp.catalog.donut_chart.description': 'Shares as a donut with legend (percentages automatic).',
  'comp.catalog.progress.label': 'Progress bars',
  'comp.catalog.progress.description': 'Labeled percentage bars (0–100).',
  'comp.catalog.quote.label': 'Quote',
  'comp.catalog.quote.description': 'Large centered quote with source.',
  'comp.catalog.timeline.label': 'Timeline',
  'comp.catalog.timeline.description': 'Vertical timeline with dots.',
  'comp.catalog.comparison.label': 'Comparison (two columns)',
  'comp.catalog.comparison.description': 'Two opposing list columns.',
  'comp.catalog.callout.label': 'Callout box',
  'comp.catalog.callout.description': 'Highlighted box with title and text.',
  'comp.catalog.icon.label': 'Icon (inline SVG)',
  'comp.catalog.icon.description':
    'Token-colored symbol (optionally with a label). Names: check, close, arrow_right, arrow_up, plus, minus, star, heart, bolt, circle, check_circle, shield, info, warning, lightbulb.',
  'comp.catalog.toc.label': 'Table of contents (jump links)',
  'comp.catalog.toc.description':
    'Clickable slide overview — each entry jumps to the target slide (slide link, Spec §23). target = slide id OR 1-based slide number; a back link to the contents slide returns.',
  'comp.catalog.data_table.label': 'Table',
  'comp.catalog.data_table.description':
    'Data table, token-styled, striped rows. Max ~8 rows (else overflow of the 720px stage).',
  'comp.catalog.big_number.label': 'Big number',
  'comp.catalog.big_number.description': 'One standout number (KPI hero) with label, optional subtitle.',
  'comp.catalog.feature_grid.label': 'Feature grid',
  'comp.catalog.feature_grid.description': "Cards with icon + title + text (2–3 side by side). Icon names as in 'icon'.",
  'comp.catalog.process_steps.label': 'Process steps',
  'comp.catalog.process_steps.description': 'Numbered steps with arrows (horizontal). Best with 3–5 steps.',
  'comp.catalog.pricing.label': 'Pricing table',
  'comp.catalog.pricing.description': '2–4 pricing cards; one highlighted via featured:true.',
  'comp.catalog.gallery.label': 'Image gallery',
  'comp.catalog.gallery.description':
    'Image grid from existing assets (names from list_assets); columns 1–4. Without images, placeholders are shown.',

  // ---------------------------------------------------------------------------
  // (b) Form fields — labels and placeholders
  // ---------------------------------------------------------------------------

  // Token colour picker: the VALUE is the CSS variable (an API value); only the
  // display name lives here.
  'comp.form.color.accent': 'Accent',
  'comp.form.color.primary': 'Primary',
  'comp.form.color.secondary': 'Secondary',
  'comp.form.color.text': 'Text',

  'comp.form.stat_cards.items': 'Stats',
  'comp.form.stat_cards.addItem': 'Stat',
  'comp.form.stat_cards.value': 'Value',
  'comp.form.stat_cards.valuePlaceholder': '98%',
  'comp.form.stat_cards.label': 'Label',
  'comp.form.stat_cards.labelPlaceholder': 'Satisfaction',

  'comp.form.bar_chart.max': 'Maximum (optional, automatic otherwise)',
  'comp.form.bar_chart.maxPlaceholder': 'auto',
  'comp.form.bar_chart.items': 'Bars',
  'comp.form.bar_chart.addItem': 'Bar',
  'comp.form.bar_chart.label': 'Label',
  'comp.form.bar_chart.labelPlaceholder': 'Q1',
  'comp.form.bar_chart.value': 'Value',
  'comp.form.bar_chart.valuePlaceholder': '40',

  'comp.form.line_chart.items': 'Data points',
  'comp.form.line_chart.addItem': 'Point',
  'comp.form.line_chart.label': 'Label',
  'comp.form.line_chart.labelPlaceholder': 'Jan',
  'comp.form.line_chart.value': 'Value',
  'comp.form.line_chart.valuePlaceholder': '12',

  'comp.form.donut_chart.items': 'Segments',
  'comp.form.donut_chart.addItem': 'Segment',
  'comp.form.donut_chart.label': 'Label',
  'comp.form.donut_chart.labelPlaceholder': 'Direct',
  'comp.form.donut_chart.value': 'Value',
  'comp.form.donut_chart.valuePlaceholder': '45',

  'comp.form.progress.items': 'Progress bars',
  'comp.form.progress.addItem': 'Bar',
  'comp.form.progress.label': 'Label',
  'comp.form.progress.labelPlaceholder': 'Design',
  'comp.form.progress.percent': 'Percent (0–100)',
  'comp.form.progress.percentPlaceholder': '90',

  'comp.form.quote.text': 'Quote',
  'comp.form.quote.author': 'Source',

  'comp.form.timeline.items': 'Milestones',
  'comp.form.timeline.addItem': 'Milestone',
  'comp.form.timeline.title': 'Title',
  'comp.form.timeline.titlePlaceholder': '2024',
  'comp.form.timeline.text': 'Text',
  'comp.form.timeline.textPlaceholder': 'Founded',

  'comp.form.comparison.left.title': 'Left column — title',
  'comp.form.comparison.left.titlePlaceholder': 'Before',
  'comp.form.comparison.left.list': 'Points (one line = one point)',
  'comp.form.comparison.right.title': 'Right column — title',
  'comp.form.comparison.right.titlePlaceholder': 'After',
  'comp.form.comparison.right.list': 'Points (one line = one point)',

  'comp.form.callout.title': 'Title',
  'comp.form.callout.text': 'Text',

  'comp.form.icon.name': 'Symbol',
  'comp.form.icon.label': 'Label (optional)',
  'comp.form.icon.labelPlaceholder': 'e.g. Secure',
  'comp.form.icon.color': 'Colour',
  'comp.form.icon.size': 'Size (rem)',

  'comp.form.toc.items': 'Entries',
  'comp.form.toc.addItem': 'Entry',
  'comp.form.toc.label': 'Label',
  'comp.form.toc.labelPlaceholder': 'Introduction',
  'comp.form.toc.target': 'Target (slide number or slide id)',
  'comp.form.toc.targetPlaceholder': '2',

  'comp.form.big_number.value': 'Number',
  'comp.form.big_number.label': 'Label',
  'comp.form.big_number.sub': 'Subtitle (optional)',
  'comp.form.big_number.subPlaceholder': 'since Q1',

  'comp.form.feature_grid.items': 'Features',
  'comp.form.feature_grid.addItem': 'Feature',
  'comp.form.feature_grid.icon': 'Icon',
  'comp.form.feature_grid.title': 'Title',
  'comp.form.feature_grid.titlePlaceholder': 'Fast',
  'comp.form.feature_grid.text': 'Text',
  'comp.form.feature_grid.textPlaceholder': 'Ready in seconds.',

  'comp.form.process_steps.items': 'Steps',
  'comp.form.process_steps.addItem': 'Step',
  'comp.form.process_steps.title': 'Title',
  'comp.form.process_steps.titlePlaceholder': 'Discover',
  'comp.form.process_steps.text': 'Text',
  'comp.form.process_steps.textPlaceholder': 'Understand the need',

  // ---------------------------------------------------------------------------
  // (c) Seed values — CONTENT (ends up in the slide), evaluated once on insert
  // ---------------------------------------------------------------------------
  'comp.seed.stat_cards.1.value': '98%',
  'comp.seed.stat_cards.1.label': 'Satisfaction',
  'comp.seed.stat_cards.2.value': '3.2x',
  'comp.seed.stat_cards.2.label': 'Growth',
  'comp.seed.stat_cards.3.value': '12k',
  'comp.seed.stat_cards.3.label': 'Users',

  'comp.seed.bar_chart.1.label': 'Q1',
  'comp.seed.bar_chart.1.value': '40',
  'comp.seed.bar_chart.2.label': 'Q2',
  'comp.seed.bar_chart.2.value': '65',
  'comp.seed.bar_chart.3.label': 'Q3',
  'comp.seed.bar_chart.3.value': '80',
  'comp.seed.bar_chart.4.label': 'Q4',
  'comp.seed.bar_chart.4.value': '100',

  'comp.seed.line_chart.1.label': 'Jan',
  'comp.seed.line_chart.1.value': '12',
  'comp.seed.line_chart.2.label': 'Feb',
  'comp.seed.line_chart.2.value': '19',
  'comp.seed.line_chart.3.label': 'Mar',
  'comp.seed.line_chart.3.value': '15',
  'comp.seed.line_chart.4.label': 'Apr',
  'comp.seed.line_chart.4.value': '27',
  'comp.seed.line_chart.5.label': 'May',
  'comp.seed.line_chart.5.value': '34',

  'comp.seed.donut_chart.1.label': 'Direct',
  'comp.seed.donut_chart.1.value': '45',
  'comp.seed.donut_chart.2.label': 'Search',
  'comp.seed.donut_chart.2.value': '30',
  'comp.seed.donut_chart.3.label': 'Social',
  'comp.seed.donut_chart.3.value': '25',

  'comp.seed.progress.1.label': 'Design',
  'comp.seed.progress.1.percent': '90',
  'comp.seed.progress.2.label': 'Development',
  'comp.seed.progress.2.percent': '70',
  'comp.seed.progress.3.label': 'QA',
  'comp.seed.progress.3.percent': '45',

  'comp.seed.quote.text': 'Great ideas need courage, not permission.',
  'comp.seed.quote.author': 'Unknown',

  'comp.seed.timeline.1.title': '2024',
  'comp.seed.timeline.1.text': 'Founded',
  'comp.seed.timeline.2.title': '2025',
  'comp.seed.timeline.2.text': 'First 1,000 users',
  'comp.seed.timeline.3.title': '2026',
  'comp.seed.timeline.3.text': 'International launch',

  'comp.seed.comparison.left.title': 'Before',
  'comp.seed.comparison.left.1': 'Manual processes',
  'comp.seed.comparison.left.2': 'High error rate',
  'comp.seed.comparison.left.3': 'Slow',
  'comp.seed.comparison.right.title': 'After',
  'comp.seed.comparison.right.1': 'Automated',
  'comp.seed.comparison.right.2': 'Reliable',
  'comp.seed.comparison.right.3': 'Fast',

  'comp.seed.callout.title': 'Important',
  'comp.seed.callout.text': 'The key message of this slide.',

  'comp.seed.toc.1.label': 'Introduction',
  'comp.seed.toc.1.target': '2',
  'comp.seed.toc.2.label': 'Main',
  'comp.seed.toc.2.target': '3',
  'comp.seed.toc.3.label': 'Conclusion',
  'comp.seed.toc.3.target': '4',

  'comp.seed.big_number.value': '+42%',
  'comp.seed.big_number.label': 'Growth last quarter',

  'comp.seed.feature_grid.1.title': 'Fast',
  'comp.seed.feature_grid.1.text': 'Ready in seconds.',
  'comp.seed.feature_grid.2.title': 'Secure',
  'comp.seed.feature_grid.2.text': 'Runs fully local.',
  'comp.seed.feature_grid.3.title': 'Simple',
  'comp.seed.feature_grid.3.text': 'No learning curve.',

  'comp.seed.process_steps.1.title': 'Discover',
  'comp.seed.process_steps.1.text': 'Understand the need',
  'comp.seed.process_steps.2.title': 'Design',
  'comp.seed.process_steps.2.text': 'Sketch the solution',
  'comp.seed.process_steps.3.title': 'Deliver',
  'comp.seed.process_steps.3.text': 'Ship & measure',
}
