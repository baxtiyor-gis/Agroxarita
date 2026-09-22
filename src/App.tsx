import { useEffect, useRef } from 'react'
import { Loader2 } from 'lucide-react'
import { Xarita, type XaritaAPI } from '@/components/Xarita'
import { FiltrPanel } from '@/components/FiltrPanel'
import { KonturKarta } from '@/components/KonturKarta'
import { XaritaBoshqaruv } from '@/components/XaritaBoshqaruv'
import { EkinTanlov } from '@/components/EkinTanlov'
import { Legenda } from '@/components/Legenda'
import { Logo } from '@/components/Logo'
import { useApp } from '@/store/useApp'
import { yukla } from '@/lib/data'

export default function App() {
  const { tayyor, setTayyor, hisobla } = useApp()
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
    <div className="flex h-full flex-col">
      <header className="z-30 flex h-[52px] shrink-0 items-center gap-2.5 border-b border-line bg-surface px-3.5">
        <Logo />
        <div className="flex items-baseline">
          <span className="text-[17px] font-semibold tracking-[-0.015em] text-ink">Agro</span>
          <span className="text-[17px] font-semibold tracking-[-0.015em] text-leaf">xarita</span>
        </div>
        <span className="h-4 w-px bg-line" />
        <span className="text-[11.5px] text-muted">Bulung'ur tumani</span>

        {!tayyor && (
          <span className="ml-auto flex items-center gap-1.5 text-[11.5px] text-muted">
            <Loader2 className="size-3.5 animate-spin" />
            Yuklanmoqda
          </span>
        )}
      </header>

      <div className="relative flex min-h-0 flex-1">
        <aside className="w-[290px] shrink-0 border-r border-line">
          <FiltrPanel />
        </aside>

        <main className="relative min-w-0 flex-1">
          <Xarita apiRef={xarita} />
          {tayyor && (
            <>
              {/* O'ng tepadagi vertikal boshqaruv ustuni */}
              <div className="pointer-events-none absolute top-3 right-3 z-20 flex flex-col items-end gap-1.5">
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
