import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { setWorkerUrl } from 'maplibre-gl'
// Vite worker'ni o'z bog'liqliklari bilan birga bundle qiladi va URL beradi.
// Yalang'och `dist/maplibre-gl-worker.mjs` ishlamaydi: u `maplibre-gl.js` dan
// import qiladi, brauzer uni yecha olmaydi va worker darhol o'ladi.
import workerUrl from 'maplibre-gl/dist/maplibre-gl-worker.mjs?worker&url'
import './index.css'
import Ildiz from './Ildiz.tsx'

setWorkerUrl(workerUrl)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Ildiz />
  </StrictMode>,
)
