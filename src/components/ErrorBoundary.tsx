import { Component, type ErrorInfo, type ReactNode } from 'react'

// Review 2026-08, Befund M49: es gab im gesamten Baum KEINE ErrorBoundary. Ein
// einziger Renderfehler — eine defekte oder von Hand editierte `.slideo`, ein
// unbekannter Layout-Wert, ein Feld, das der Renderer unbedingt dereferenziert —
// hinterließ einen weißen Bildschirm ohne jede Erklärung und ohne Weg zurück.
// Besonders unglücklich, weil das Format ausdrücklich als lesbar und
// git-versionierbar beworben wird und damit zum Handeditieren einlädt.
//
// `normalizePresentation` (Befund S8) fängt den erwartbaren Teil vorher ab; das
// hier ist das Netz für alles Übrige.

interface Props {
  children: ReactNode
  /** Wird gerendert, wenn ein Fehler aufgetreten ist. */
  fallbackTitle?: string
}

interface State {
  error: Error | null
}

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[slideo] Renderfehler:', error, info.componentStack)
  }

  render(): ReactNode {
    const { error } = this.state
    if (!error) return this.props.children

    return (
      <div className="flex flex-1 items-center justify-center bg-chrome-bg p-6">
        <div className="w-[34rem] max-w-full rounded-2xl border border-chrome-border bg-chrome-surface p-8 shadow-card">
          <h2 className="mb-2 text-[15px] font-semibold text-chrome-text">
            {this.props.fallbackTitle ?? 'Diese Ansicht konnte nicht dargestellt werden'}
          </h2>
          <p className="mb-4 text-[13px] leading-relaxed text-chrome-secondary">
            Deine Präsentation ist nicht verloren — sie liegt weiterhin auf der Platte. Häufigste
            Ursache ist eine beschädigte oder von Hand bearbeitete <code>.slideo</code>-Datei.
          </p>
          {/* Fehlertext kopierbar zeigen (Befund M21: Fehler landeten bisher in einem
              6-Sekunden-Toast und in der Konsole, die ein Desktop-Nutzer nicht erreicht). */}
          <pre className="mb-4 max-h-40 overflow-auto rounded-lg border border-chrome-border bg-chrome-surface-2 p-3 text-[11px] leading-relaxed text-chrome-secondary">
            {error.message}
          </pre>
          <div className="flex items-center gap-2">
            <button
              onClick={() => this.setState({ error: null })}
              className="rounded-md bg-chrome-accent-600 px-3 py-1.5 text-[13px] font-medium text-white transition-colors hover:bg-[#2553c9]"
            >
              Erneut versuchen
            </button>
            <button
              onClick={() => window.location.reload()}
              className="rounded-md border border-chrome-border px-3 py-1.5 text-[13px] font-medium text-chrome-secondary transition-colors hover:text-chrome-text"
            >
              App neu laden
            </button>
          </div>
        </div>
      </div>
    )
  }
}
