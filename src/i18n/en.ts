import { common } from './en/common'
import { ui } from './en/ui'
import { modals } from './en/modals'
import { media } from './en/media'
import { editor } from './en/editor'
import { presentation } from './en/presentation'
import { store } from './en/store'
import { lib } from './en/lib'
import { components } from './en/components'

import type { I18nKey } from './index'

// Englischer Gesamtkatalog.
//
// Die Annotation ist die eigentliche Absicherung: `Record<I18nKey, string>`
// verlangt JEDEN Schlüssel des deutschen Katalogs. Fehlt einer, scheitert
// `tsc --noEmit` — und damit `npm run build`, bevor irgendein Test läuft.
// Zusätzlich prüft jede Bereichsdatei in `en/` schon für sich, dass sie keine
// unbekannten Schlüssel enthält (Tippfehler zeigen dort direkt auf die Zeile).
export const en: Record<I18nKey, string> = {
  ...common,
  ...ui,
  ...modals,
  ...media,
  ...editor,
  ...presentation,
  ...store,
  ...lib,
  ...components,
}
