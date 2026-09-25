import { useEffect, useRef, useState } from 'react'
import { ChevronDown, Info, MapPin, MapPinOff } from 'lucide-react'
import { InfoOyna } from '@/components/InfoOyna'
import { Xarita, type XaritaAPI } from '@/components/Xarita'
// import { StatPanel } from '@/components/StatPanel' — sidebar vaqtincha yashirilgan
import { KonturKarta } from '@/components/KonturKarta'
import { XaritaBoshqaruv } from '@/components/XaritaBoshqaruv'
import { EkinTanlov } from '@/components/EkinTanlov'
import { Legenda } from '@/components/Legenda'
// import { Logo } from '@/components/Logo' — sidebar vaqtincha yashirilgan
import { useApp } from '@/store/useApp'
import { BekorXato, yukla } from '@/lib/data'
import { MalumotYoqXato, SUKUT_TUMAN, TUMANLAR, tumanOl, urlgaYoz } from '@/lib/tuman'

export default function App() {
  const { xaritaTayyor, setTayyor, hisobla, tuman, setTuman, yuklashXato, setYuklashXato } = useApp()
  const joriy = tumanOl(tuman)
  const [info, setInfo] = useState(false)
  const xarita = useRef<XaritaAPI | null>(null)

  // Tuman almashsa (yoki birinchi ochilishda) — URL, sarlavha va ma'lumotlar.
  // setTuman allaqachon tayyor = false qilgan: xarita va panellar yangi
  // ma'lumot kelguncha loader ortida turadi, keyin `key={tuman}` bilan
  // noldan quriladi (yangi extent, manba, legenda, statistika).
  useEffect(() => {
    urlgaYoz(tuman)
    document.title = `Agroxarita — ${tumanOl(tuman).nom}`
    let tirik = true
    yukla(tuman)
      .then(() => {
        if (!tirik) return
        setTayyor(true)
        hisobla()
      })
      .catch((e) => {
        if (!tirik || e instanceof BekorXato) return
        if (e instanceof MalumotYoqXato) {
          setYuklashXato('yoq')
        } else {
          console.error("Ma'lumot yuklanmadi:", e)
          setYuklashXato('boshqa')
        }
      })
    return () => {
      tirik = false
    }
  }, [tuman, setTayyor, hisobla, setYuklashXato])

  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') useApp.getState().setTanlangan(null)
    }
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [])

  return (
    <div className="flex h-full">
      {/* Sidebar vaqtincha yashirilgan — qaytarish uchun izohdan chiqaring
      (Chap: to'q ko'k sidebar — logo va statistika)
      <aside className="sidebar-navy z-30 flex w-[320px] shrink-0 flex-col">
        <div className="flex h-[68px] shrink-0 items-center gap-2.5 px-4">
          <Logo size={34} />
          <div className="flex items-baseline">
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-leaf">agro</span>
            <span className="text-[22px] font-semibold tracking-[-0.02em] text-white">xarita</span>
          </div>
        </div>
        <div className="min-h-0 flex-1">
          <StatPanel key={tuman} />
        </div>
      </aside>
      */}

      <div className="flex min-w-0 flex-1 flex-col">
        <header className="z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-line bg-surface px-6">
          <span className="shrink-0 text-[20px] font-semibold tracking-[-0.02em]">
            <span className="text-leaf">agro</span>
            <span className="text-navy">xarita</span>
          </span>
          <span className="h-7 w-px shrink-0 bg-line" />
          <div className="min-w-0 truncate text-[14px] font-medium text-body">
            Qishloq xo'jaligi yerlariga eng maqbul ekin turlarini joylashtirish
          </div>

          <button
            onClick={() => setInfo(true)}
            className="ml-auto flex h-10 items-center gap-2 rounded-card border border-line px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-sunken"
          >
            <Info className="size-4 text-leaf" />
            Loyiha haqida
          </button>

          {/* Tuman tanlovi — ma'lumotlar public/data/<tuman>/ dan, URL: ?tuman= */}
          <div className="relative">
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
        <InfoOyna ochiq={info} onYop={() => setInfo(false)} />

        <main className="relative min-h-0 flex-1">
          <Xarita key={tuman} apiRef={xarita} />
          {yuklashXato && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-paper">
              <div className="flex max-w-[380px] flex-col items-center gap-3 px-6 text-center">
                <span className="flex size-11 items-center justify-center rounded-full bg-sunken text-muted">
                  <MapPinOff className="size-5" strokeWidth={1.8} />
                </span>
                <div className="text-[15px] font-semibold text-navy">
                  {yuklashXato === 'yoq'
                    ? `${joriy.nom} ma'lumotlari hali yuklanmagan`
                    : `${joriy.nom} ma'lumotlarini yuklab bo'lmadi`}
                </div>
                <div className="text-[12.5px] leading-relaxed text-muted">
                  {yuklashXato === 'yoq'
                    ? "Kontur, tuproq va iqlim ma'lumotlari tayyorlanmoqda. Hozircha boshqa tumanni tanlang."
                    : "Tarmoq ulanishini tekshirib, sahifani qayta yuklang yoki boshqa tumanni tanlang."}
                </div>
                {tuman !== SUKUT_TUMAN && (
                  <button
                    onClick={() => setTuman(SUKUT_TUMAN)}
                    className="mt-1 h-9 rounded-card bg-leaf px-4 text-[13px] font-medium text-white transition-colors hover:bg-leaf-dark"
                  >
                    {tumanOl(SUKUT_TUMAN).nom}ga o'tish
                  </button>
                )}
              </div>
            </div>
          )}
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
