import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { ProjectorView } from './components/presentation/ProjectorView'
// Selbst-gehostete Material Symbols (offline, kein CDN) — auf die genutzten Icons
// subgesetzt (~42 KB statt ~3,63 MB, Audit P1; regenerieren: npm run icons:subset).
import './styles/material-symbols.css'
import './index.css'

// Das Presenter-Zweitfenster (Spec §19.3) lädt dieselbe App mit `?role=projector`
// und rendert nur die Folien-Ansicht (kein Editor/MCP), gesteuert per Tauri-Events.
const isProjector = new URLSearchParams(window.location.search).get('role') === 'projector'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>{isProjector ? <ProjectorView /> : <App />}</React.StrictMode>,
)
