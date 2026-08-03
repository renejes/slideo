import { common } from './de/common'
import { ui } from './de/ui'
import { modals } from './de/modals'
import { media } from './de/media'
import { editor } from './de/editor'
import { presentation } from './de/presentation'
import { store } from './de/store'
import { lib } from './de/lib'
import { components } from './de/components'

// Deutscher Gesamtkatalog — die QUELLE. `I18nKey` wird hieraus abgeleitet, jede
// andere Sprache misst sich daran.
//
// Aufgeteilt nach Bereichen, weil die Migration bereichsweise lief und weil ein
// einzelnes 700-Zeilen-Objekt bei jedem Merge kollidiert wäre. Die Schlüssel sind
// flach und punktgetrennt (nicht verschachtelt) — nur so greift
// `keyof typeof de` ohne zusätzliche Typ-Akrobatik.
export const de = {
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
