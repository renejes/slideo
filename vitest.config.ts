import { defineConfig } from 'vitest/config'
import { fileURLToPath, URL } from 'node:url'

// Eigene Vitest-Config (nicht die tauri-getunte vite.config.ts erweitern — die
// trägt Dev-Server-/Build-Optionen, die für Tests irrelevant sind und deren
// `build.target` die Transform-Pipeline unnötig einschränkt).
//
// Zweck (Review 2026-08, Maßnahme #1): ein minimales Netz unter dem Code, der
// bisher gar keines hatte — die reinen Funktionen der Render-/Edit-Pipeline und
// die von Hand gespiegelten Konstanten über die FFI-Grenze.
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    // jsdom: dom-edit.ts arbeitet über DOMParser auf dem rohen zone.html.
    environment: 'jsdom',
    include: ['src/**/*.test.ts'],
    reporters: 'dot',
  },
})
