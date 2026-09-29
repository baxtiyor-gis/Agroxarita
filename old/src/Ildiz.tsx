import { Suspense, lazy } from 'react'
import App from './App.tsx'

// Xo'jalik konturlari sahifasi (/map?tax_number=...) — alohida chunk,
// asosiy ilova bundle'iga qo'shilmaydi
const XojalikSahifa = lazy(() => import('./pages/xojalik/XojalikSahifa.tsx'))

/** Router kutubxonasisiz minimal marshrut: BASE_URL dan keyingi yo'l */
function yol(): string {
  const base = import.meta.env.BASE_URL
  let p = window.location.pathname
  if (p.startsWith(base)) p = p.slice(base.length)
  return p.replace(/^\/+|\/+$/g, '')
}

/** `/map` — xo'jalik sahifasi, qolgan barcha yo'llar — asosiy ilova (avvalgidek) */
export default function Ildiz() {
  if (yol() === 'map')
    return (
      <Suspense fallback={null}>
        <XojalikSahifa />
      </Suspense>
    )
  return <App />
}
