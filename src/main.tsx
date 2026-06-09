import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
// Selbst-gehostete Material Symbols (offline, kein CDN) — "Outlined"-Variante.
import 'material-symbols/outlined.css'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
