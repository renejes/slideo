import type { Config } from 'tailwindcss'

// WICHTIG: Dieses Tailwind betrifft NUR das UI der App selbst (App-Chrome:
// Topbar, Sidebars, Toolbars, Cards). Der gerenderte Slide-Inhalt im Iframe
// wird über CSS-Custom-Properties (Design Tokens) + eigenes Stylesheet gestylt
// (siehe src/lib/renderer.ts) und ist davon vollständig unabhängig.
//
// Ästhetik: light, minimalistisch, premium — orientiert an Penwright.
// Ein ruhiger Blau-Akzent, sehr dünne Borders, Hierarchie über Typografie
// statt über Schatten/Tiefe. Kontraste erfüllen WCAG AA.
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        chrome: {
          bg: '#fafafa', // App-Hintergrund (Sidebar, Canvas)
          surface: '#ffffff', // Panels, Topbar, Cards
          'surface-2': '#f4f4f5', // subtile Füllung (Inputs, Hover)
          border: '#ececec', // hauchdünne Divider (1px)
          'border-strong': '#e2e2e2',
          text: '#1a1a1a', // primärer Text
          secondary: '#5a5a5a', // sekundärer Text (AA)
          muted: '#737373', // Captions/Hints (AA)
          faint: '#a3a3a3', // dekorativ / ruhende Icons
          accent: '#4f7df9', // ruhiges Blau (Borders, Focus, Icon-Akzent)
          'accent-600': '#2f63e6', // tieferes Blau (Buttons, Text auf Weiß — AA)
          'accent-soft': '#eef3ff', // aktive Füllung
          warn: '#c4622d', // Status/Custom-HTML (gedämpfte Terrakotta)
          'warn-soft': '#fbf0e9',
          danger: '#d24b3f', // destruktiv
        },
      },
      fontFamily: {
        sans: [
          '-apple-system',
          'BlinkMacSystemFont',
          'Inter',
          'Segoe UI',
          'system-ui',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        // sehr zurückhaltende Elevation, nur für Overlays/Cards
        card: '0 1px 2px rgba(0, 0, 0, 0.04)',
        pop: '0 8px 24px rgba(0, 0, 0, 0.12)',
      },
    },
  },
  plugins: [],
} satisfies Config
