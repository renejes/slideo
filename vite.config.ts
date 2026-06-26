import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath, URL } from 'node:url'

// Tauri erwartet einen festen Port und liefert die Umgebung über env-Variablen.
const host = process.env.TAURI_DEV_HOST

// https://vitejs.dev/config/
export default defineConfig(async () => ({
  plugins: [react()],

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },

  // Vite-Optionen, die auf Tauri zugeschnitten sind:
  // 1. Tauri lauscht auf einem festen Port, schlägt fehl, wenn nicht verfügbar
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    host: host || false,
    hmr: host
      ? {
          protocol: 'ws',
          host,
          port: 1421,
        }
      : undefined,
    watch: {
      // Tauri-eigene Dateien nicht beobachten
      ignored: ['**/src-tauri/**'],
    },
  },

  // produzierten Code auf moderne WebViews ausrichten
  build: {
    target: process.env.TAURI_ENV_PLATFORM === 'windows' ? 'chrome105' : 'safari13',
    minify: !process.env.TAURI_ENV_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_ENV_DEBUG,
    // Kein modulepreload-Polyfill: moderne WebViews (WKWebView/WebView2) können das
    // nativ. Der Polyfill wäre ein INLINE-Script und würde die strikte App-CSP
    // (script-src 'self', Audit S2) verletzen, sobald Code-Splitting hinzukommt.
    modulePreload: { polyfill: false },
  },
}))
