import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { getLocale } from '@/i18n'
import { ProjectorView } from './components/presentation/ProjectorView'
// Selbst-gehostete Material Symbols (offline, kein CDN) — auf die genutzten Icons
// subgesetzt (~42 KB statt ~3,63 MB, Audit P1; regenerieren: npm run icons:subset).
import './styles/material-symbols.css'
import './index.css'

// Das Presenter-Zweitfenster (Spec §19.3) lädt dieselbe App mit `?role=projector`
// und rendert nur die Folien-Ansicht (kein Editor/MCP), gesteuert per Tauri-Events.
const isProjector = new URLSearchParams(window.location.search).get('role') === 'projector'

// `index.html` deklariert statisch `lang="de"`. Das gilt für das APP-DOKUMENT
// (Menüs, Dialoge, Tooltips) und muss der Oberflächensprache folgen, sonst
// spricht ein Screenreader die englische Oberfläche mit deutscher Aussprache.
//
// NICHT zu verwechseln mit der Sprache der FOLIEN: die steht in `meta.language`,
// wandert mit der Datei und landet über `deckLang()` im `lang` der Folien-Iframes
// und aller Exporte. Das Fenster kann also deutsch sein und die Folien englisch —
// genau so soll es sein.
document.documentElement.lang = getLocale()

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isProjector ? <ProjectorView /> : <App />}</React.StrictMode>,
)
