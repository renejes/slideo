import { useMemo } from 'react'
import { Modal, modalGhostBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'

// EIN Export-Dialog statt drei Topbar-Knöpfen (Review 2026-08, Befund M55/H24 +
// Erkenntnis 9 des Reviews).
//
// Vorher: „Teilen", „PDF" und „PPTX" standen gleichwertig nebeneinander, ohne dass
// irgendwo stand, dass die Treue zwischen ihnen STEIL abfällt (HTML ≫ PDF ≫ PPTX).
// Der Nutzer erfuhr den Qualitätsverlust erst beim Empfänger. Dazu hieß „Teilen"
// an zwei Stellen etwas Verschiedenes (hier HTML-Export, im Präsentationsmodus das
// Projektorfenster).
//
// Der Dialog rechnet den Verlust vorher aus — nicht als allgemeine Warnung, sondern
// mit den Zahlen DIESES Decks. Aus stillem Qualitätsverlust wird eine informierte
// Entscheidung; das war laut Review deutlich billiger als der geparkte
// bild-basierte Exporter und wirkt sofort.
export function ExportModal() {
  const closeModal = useUiStore((s) => s.closeModal)
  const presentation = usePresentationStore((s) => s.presentation)
  const exportHtml = usePresentationStore((s) => s.exportHtml)
  const exportPdf = usePresentationStore((s) => s.exportPdf)
  const exportPptx = usePresentationStore((s) => s.exportPptx)
  const tauri = isTauri()

  // Konkrete Kennzahlen dieses Decks für die Treue-Hinweise.
  const facts = useMemo(() => {
    const zones = presentation?.zones ?? []
    return {
      total: zones.length,
      html: zones.filter((z) => z.content_type === 'html').length,
      splitWithImages: zones.filter(
        (z) =>
          z.style.layout === 'split' &&
          /!\[[^\]]*\]\(|<img\b/i.test(z.markdown),
      ).length,
      builds: zones.filter((z) => z.reveal === 'steps').length,
      notes: zones.filter((z) => z.notes.trim()).length,
    }
  }, [presentation])

  const formats = [
    {
      key: 'html',
      icon: 'ios_share',
      title: 'HTML — eigenständige Datei',
      lead: 'Höchste Treue. Läuft offline in jedem Browser, mit Tastatur-Navigation, Übergängen und Builds.',
      caveats: [
        'Alle Medien sind eingebettet — die Datei kann groß werden.',
        'Sprechernotizen sind NICHT enthalten (sie würden im geteilten Deck sichtbar).',
      ],
      run: exportHtml,
      needsTauri: true,
    },
    {
      key: 'pdf',
      icon: 'picture_as_pdf',
      title: 'PDF — zum Drucken und Verschicken',
      lead: 'Eine Folie pro Seite, 16:9. Öffnet die Druckansicht im Standardbrowser.',
      caveats: [
        'Im Druckdialog „Ränder: keine" wählen und Kopf-/Fußzeilen abwählen — sonst steht der Dateipfad auf jeder Folie.',
        ...(facts.builds
          ? [`${facts.builds} Folie${facts.builds === 1 ? '' : 'n'} mit Schritt-Einblendung zeigt alle Punkte auf einmal.`]
          : []),
      ],
      run: exportPdf,
      needsTauri: false,
    },
    {
      key: 'pptx',
      icon: 'slideshow',
      title: 'PowerPoint (.pptx) — weiter bearbeitbar',
      lead: 'Native Rekonstruktion: echte Textfelder, Bilder und Theme-Farben, in PowerPoint editierbar.',
      caveats: [
        ...(facts.html
          ? [
              `${facts.html} von ${facts.total} Folien sind HTML und werden zu reinem Text vereinfacht (Diagramme und Komponenten gehen verloren).`,
            ]
          : []),
        ...(facts.splitWithImages
          ? [`${facts.splitWithImages} zweispaltige Folie${facts.splitWithImages === 1 ? '' : 'n'} mit Bild — Layout wird angenähert.`]
          : []),
        ...(facts.notes ? [`Sprechernotizen (${facts.notes}) werden übernommen.`] : []),
        'Custom-CSS und Übergänge werden nicht übernommen.',
      ],
      run: exportPptx,
      needsTauri: false,
    },
  ]

  async function run(fn: () => Promise<void>) {
    closeModal()
    await fn()
  }

  return (
    <Modal
      title="Exportieren"
      onClose={closeModal}
      footer={
        <button className={modalGhostBtn} onClick={closeModal}>
          Schließen
        </button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-[12px] leading-relaxed text-chrome-muted">
          Die Formate unterscheiden sich in der Wiedergabetreue — hier steht, was in
          diesem Deck jeweils verloren geht.
        </p>
        {formats.map((f) => {
          const disabled = f.needsTauri && !tauri
          return (
            <button
              key={f.key}
              onClick={() => void run(f.run)}
              disabled={disabled}
              className={
                'flex flex-col gap-1.5 rounded-lg border border-chrome-border p-3 text-left transition-colors ' +
                'hover:border-chrome-accent hover:bg-chrome-accent-soft focus-visible:outline-none ' +
                'focus-visible:ring-2 focus-visible:ring-chrome-accent/40 ' +
                'disabled:cursor-not-allowed disabled:opacity-40 disabled:hover:border-chrome-border disabled:hover:bg-transparent'
              }
            >
              <span className="flex items-center gap-2">
                <Icon name={f.icon} size={18} weight={400} className="text-chrome-accent-600" />
                <span className="text-[13px] font-medium text-chrome-text">{f.title}</span>
              </span>
              <span className="text-[12px] leading-relaxed text-chrome-secondary">{f.lead}</span>
              {f.caveats.length > 0 && (
                <ul className="mt-0.5 flex flex-col gap-0.5">
                  {f.caveats.map((c, i) => (
                    <li key={i} className="flex gap-1.5 text-[11px] leading-relaxed text-chrome-muted">
                      <span className="text-chrome-faint">·</span>
                      <span>{c}</span>
                    </li>
                  ))}
                </ul>
              )}
              {disabled && (
                <span className="text-[11px] text-chrome-faint">
                  Nur in der Desktop-App verfügbar.
                </span>
              )}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
