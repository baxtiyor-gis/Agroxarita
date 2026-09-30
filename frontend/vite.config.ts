import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import fs from 'node:fs'
import path from 'node:path'

// maplibre-gl 6 worker'ni asosiy bundle yonidan (import.meta.url → /assets/) alohida ES modul sifatida yuklaydi,
// worker esa ./maplibre-gl-shared.mjs ni import qiladi. Vite ularni o'zi chiqarmaydi — build'ga asl nomi bilan qo'shamiz.
function maplibreWorker(): Plugin {
  return {
    name: 'maplibre-worker',
    apply: 'build',
    generateBundle() {
      for (const fayl of ['maplibre-gl-worker.mjs', 'maplibre-gl-shared.mjs']) {
        this.emitFile({
          type: 'asset',
          fileName: `assets/${fayl}`,
          source: fs.readFileSync(path.resolve(import.meta.dirname, 'node_modules/maplibre-gl/dist', fayl)),
        })
      }
    },
  }
}

export default defineConfig({
  plugins: [react(), tailwindcss(), maplibreWorker()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  // maplibre-gl 6 worker faylini alohida yuklaydi — dev'da prebundle qilinmasin
  optimizeDeps: { exclude: ['maplibre-gl'] },
  server: {
    port: 5173,
    proxy: {
      '/api': 'http://127.0.0.1:8000',
      '/tiles': 'http://127.0.0.1:8000',
    },
  },
})
