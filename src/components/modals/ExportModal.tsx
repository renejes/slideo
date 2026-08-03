import { useMemo } from 'react'
import { Modal, modalGhostBtn } from '@/components/ui/Modal'
import { Icon } from '@/components/ui/Icon'
import { usePresentationStore } from '@/store/presentation'
import { useUiStore } from '@/store/ui'
import { isTauri } from '@/lib/tauri'
import { t, tp } from '@/i18n'

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
      title: t('modal.export.html.title'),
      lead: t('modal.export.html.lead'),
      caveats: [t('modal.export.html.media'), t('modal.export.html.notes')],
      run: exportHtml,
      needsTauri: true,
    },
    {
      key: 'pdf',
      icon: 'picture_as_pdf',
      title: t('modal.export.pdf.title'),
      lead: t('modal.export.pdf.lead'),
      caveats: [
        t('modal.export.pdf.margins'),
        ...(facts.builds ? [tp('modal.export.pdf.builds', facts.builds)] : []),
      ],
      run: exportPdf,
      needsTauri: false,
    },
    {
      key: 'pptx',
      icon: 'slideshow',
      title: t('modal.export.pptx.title'),
      lead: t('modal.export.pptx.lead'),
      caveats: [
        ...(facts.html
          ? [t('modal.export.pptx.htmlZones', { count: facts.html, total: facts.total })]
          : []),
        ...(facts.splitWithImages
          ? [tp('modal.export.pptx.split', facts.splitWithImages)]
          : []),
        ...(facts.notes ? [t('modal.export.pptx.notes', { count: facts.notes })] : []),
        t('modal.export.pptx.css'),
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
      title={t('modal.export.title')}
      onClose={closeModal}
      footer={
        <button className={modalGhostBtn} onClick={closeModal}>
          {t('common.close')}
        </button>
      }
    >
      <div className="flex flex-col gap-2.5">
        <p className="text-[12px] leading-relaxed text-chrome-muted">
          {t('modal.export.intro')}
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
                <span className="text-[11px] text-chrome-faint">{t('modal.desktopOnly')}</span>
              )}
            </button>
          )
        })}
      </div>
    </Modal>
  )
}
