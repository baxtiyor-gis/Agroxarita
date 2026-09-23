import { useEffect, useRef, useState } from 'react'
import { ChevronDown, MapPin } from 'lucide-react'
import { Xarita, type XaritaAPI } from '@/components/Xarita'
import { StatPanel } from '@/components/StatPanel'
import { KonturKarta } from '@/components/KonturKarta'
import { XaritaBoshqaruv } from '@/components/XaritaBoshqaruv'
import { EkinTanlov } from '@/components/EkinTanlov'
import { Legenda } from '@/components/Legenda'
import { Logo } from '@/components/Logo'
import { useApp } from '@/store/useApp'
import { yukla } from '@/lib/data'

const TUMANLAR = [
  { id: 'bulungur', nom: "Bulung'ur tumani" },
  { id: 'fargona', nom: "Farg'ona tumani" },
]

export default function App() {
  const { xaritaTayyor, setTayyor, hisobla } = useApp()
  const [tuman, setTuman] = useState(TUMANLAR[0].id)
  const xarita = useRef<XaritaAPI | null>(null)

  useEffect(() => {
    yukla()
      .then(() => {
        setTayyor(true)
        hisobla()
      })
      .catch((e) => console.error("Ma'lumot yuklanmadi:", e))
  }, [setTayyor, hisobla])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useApp.getState().setTanlangan(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="flex h-full">
      {/* Chap: to'q ko'k sidebar — logo va filtrlar */}
      <aside className="sidebar-navy z-30 flex w-[320px] shrink-0 flex-col">
        <div className="flex h-[68px] shrink-0 items-center gap-2.5 px-4">
          <Logo size={34} />
          <div className="flex items-baseline">
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-leaf">agro</span>
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-white">xarita</span>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <StatPanel />
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-line bg-surface px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="truncate text-[15px] font-semibold text-navy">Raqamli agroxarita</span>
              <span className="shrink-0 rounded-full bg-leaf-soft px-2 py-px text-[10.5px] font-medium text-leaf-dark">
                Tajriba-sinov
              </span>
            </div>
            <div className="truncate text-[12px] text-muted">
              Qishloq xo'jaligi yerlariga eng maqbul ekin turlarini joylashtirish
            </div>
          </div>

          {/* Hozircha faqat ko'rinish uchun — Farg'ona ma'lumotlari hali yo'q */}
          <div className="relative ml-auto">
            <MapPin className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-leaf" />
            <select
              value={tuman}
              onChange={(e) => setTuman(e.target.value)}
              aria-label="Tuman"
              className="h-10 appearance-none rounded-card border border-line bg-surface pr-9 pl-9 text-[13px] font-medium text-ink transition-colors hover:border-line-strong focus:border-leaf focus:ring-2 focus:ring-leaf-soft focus:outline-none"
            >
              {TUMANLAR.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nom}
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-ink" />
          </div>
        </header>

        <main className="relative min-h-0 flex-1">
          <Xarita apiRef={xarita} />
          {xaritaTayyor && (
            <>
              {/* O'ng tepadagi vertikal boshqaruv ustuni */}
              <div className="pointer-events-none absolute top-3 right-3 z-20 flex flex-col items-end gap-2">
                <XaritaBoshqaruv
                  onZoom={(d) => xarita.current?.zoom(d)}
                  onHome={() => xarita.current?.home()}
                />
                <EkinTanlov />
              </div>
              <Legenda />
              <KonturKarta />
            </>
          )}
        </main>
      </div>
    </div>
  )
}
