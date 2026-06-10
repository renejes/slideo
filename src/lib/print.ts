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

  iframe.onload = () => {
    const win = iframe.contentWindow
    if (!win) {
      iframe.remove()
      return
    }
    const cleanup = () => window.setTimeout(() => iframe.remove(), 500)
    win.onafterprint = cleanup
    try {
      win.focus()
      win.print()
    } catch {
      cleanup()
    }
  }

  iframe.srcdoc = html
  document.body.appendChild(iframe)
}
