import { Fragment, type ReactNode } from 'react'
import { t, type I18nKey } from './index'

/**
 * Übersetzter Text mit eingebetteten React-Knoten („Rich Text").
 *
 * Neun Stellen der Oberfläche zerbrechen einen Satz um ein `<code>` oder `<span>`
 * herum (z.B. „… diese Datei ist eine `.slideo`-Datei …"). Solche Sätze dürfen
 * nicht in Fragmente zerlegt in den Katalog wandern — die Wortstellung ist
 * sprachabhängig, und aus Fragmenten lässt sich kein englischer Satz bauen.
 *
 * Der Katalogtext trägt deshalb nummerierte Steckplätze:
 *
 *     'errorboundary.body': 'Die Datei {0} ist unverändert.'
 *     <T k="errorboundary.body" slots={[<code>.slideo</code>]} />
 *
 * Die Steckplätze dürfen in der Übersetzung an einer anderen Satzposition stehen —
 * genau das ist der Zweck.
 */
export function T({
  k,
  slots,
  params,
}: {
  k: I18nKey
  slots: ReactNode[]
  params?: Record<string, string | number>
}) {
  // Split mit Capture-Gruppe: die Trenner bleiben als eigene Elemente erhalten.
  const parts = t(k, params).split(/(\{\d+\})/g)
  return (
    <>
      {parts.map((part, i) => {
        const slot = /^\{(\d+)\}$/.exec(part)
        if (slot) return <Fragment key={i}>{slots[Number(slot[1])] ?? null}</Fragment>
        return part ? <Fragment key={i}>{part}</Fragment> : null
      })}
    </>
  )
}
