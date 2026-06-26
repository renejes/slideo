import type { Presentation, AssetMap } from '@/types'
import { renderPrintPage } from './renderer'

// PDF-Export über den System-/WebView-Druckdialog (Spec §18.4).
// Die print-optimierte Page (jede Zone = eine 16:9-Seite) wird in ein
// verstecktes Iframe geladen; dessen Druck öffnet „Als PDF sichern".
// Dependency-frei und plattformübergreifend.
export function exportPdfViaPrint(presentation: Presentation, assets: AssetMap): void {
  const html = renderPrintPage(presentation, assets)

  const iframe = document.createElement('iframe')
  Object.assign(iframe.style, {
    position: 'fixed',
    right: '0',
    bottom: '0',
    width: '1px',
    height: '1px',
    opacity: '0',
    border: '0',
    pointerEvents: 'none',
  } as Partial<CSSStyleDeclaration>)
  iframe.setAttribute('aria-hidden', 'true')
  // Isoliert (Audit S5): KEIN allow-same-origin → das (ggf. nutzer-/KI-erzeugte)
  // Deck-HTML kann nicht auf den App-Origin zugreifen. Weil eine sandboxed
  // contentWindow vom Parent nicht ansteuerbar ist, liegt der Druck-Trigger IM
  // Iframe (allow-modals für den Druckdialog).
  iframe.setAttribute('sandbox', 'allow-scripts allow-modals')

  // afterprint ist cross-origin nicht lesbar → nach großzügiger Frist aufräumen.
  iframe.onload = () => window.setTimeout(() => iframe.remove(), 60000)

  const trigger =
    "<script>window.addEventListener('load',function(){" +
    "setTimeout(function(){try{window.focus();window.print();}catch(e){}},50);});<" +
    '/script>'
  const i = html.lastIndexOf('</body>')
  iframe.srcdoc = i >= 0 ? html.slice(0, i) + trigger + html.slice(i) : html + trigger
  document.body.appendChild(iframe)
}
