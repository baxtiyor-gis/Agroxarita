import { useEffect, useMemo, useRef, useState } from 'react'
import { BookOpen, Database, FileText, Globe2, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { attrs } from '@/lib/data'
import { TUMANLAR } from '@/lib/tuman'
import { useApp } from '@/store/useApp'

type Tab = 'loyiha' | 'farmon' | 'malumot' | 'uslub'

const TABLAR: { id: Tab; nom: string; icon: typeof BookOpen }[] = [
  { id: 'loyiha', nom: 'Loyiha', icon: BookOpen },
  { id: 'farmon', nom: 'Farmon', icon: FileText },
  { id: 'malumot', nom: "Ma'lumotlar", icon: Database },
  { id: 'uslub', nom: 'Uslub va tajriba', icon: Globe2 },
]

/** Ma'lumot manbalari — kim tayyorlagan va nima uchun ishlatilgan */
const MANBALAR: { nom: string; manba: string; izoh: string }[] = [
  {
    nom: 'Ekin konturlari',
    manba: 'Kadastr agentligi',
    izoh: 'Har bir kontur: chegara, maydon, massiv, MFY, yer turi',
  },
  {
    nom: 'Ekilgan ekinlar',
    manba: "Qishloq xo'jaligi vazirligi geoaxborot tizimi",
    izoh: "2022–2026 (tumanda mavjud yillar); dalaga chiqib aniqlangan, konturlarga fazoviy bog'langan",
  },
  {
    nom: 'Tuproq va agrokimyo',
    manba: 'Tuproqshunoslik va agrokimyoviy tadqiqotlar instituti',
    izoh: "Bonitet, mexanik tarkib, sho'rlanish, gumus, fosfor, kaliy",
  },
  {
    nom: 'Relyef',
    manba: 'Copernicus DEM GLO-30 (ESA), SRTM',
    izoh: "30 m: balandlik, qiyalik, yo'nalish, gorizontallar",
  },
  {
    nom: 'Iqlim (2016–2025)',
    manba: 'ERA5-Land — Copernicus Climate Change Service',
    izoh: "Harorat, yog'in, bug'lanish, sovuq sanalari, balandlik bo'yicha tuzatilgan",
  },
  {
    nom: 'Ekin me\'yorlari',
    manba: 'Agrotexnik qo\'llanmalar, FAO',
    izoh: "37 ekin: bonitet, sho'rlanish, suv, o'g'it va iqlim talablari",
  },
  {
    nom: 'Asos xarita',
    manba: "Google sun'iy yo'ldosh tasviri, OpenStreetMap",
    izoh: 'Faqat fon sifatida',
  },
]

const TAJRIBA: { davlat: string; tajriba: string; orni: string }[] = [
  { davlat: 'Germaniya', tajriba: 'Bodenschätzung — tuproq bonitirovkasi', orni: 'Tuproq unumdorligi (bonitet) omili' },
  { davlat: 'Ispaniya', tajriba: 'SIGPAC — kontur (parsel) reestri', orni: 'Har bir kontur bo\'yicha tahlil' },
  { davlat: 'Koreya Respublikasi', tajriba: 'Heuktoram — ekin mosligi xaritasi', orni: 'Ekin mosligi bali va xaritasi' },
  { davlat: 'Xitoy', tajriba: "Tuproq tahliliga asoslangan o'g'itlash", orni: "Agrokimyo va o'g'it me'yorlari" },
]

export function InfoOyna({ ochiq, onYop }: { ochiq: boolean; onYop: () => void }) {
  const [tab, setTab] = useState<Tab>('loyiha')
  const tayyor = useApp((s) => s.tayyor)
  // Joriy tuman raqamlari — yuklangan ma'lumotdan
  const raqam = useMemo(() => {
    if (!tayyor) return null
    const p = attrs()
    const maydon = p.col.maydon.reduce((s, m) => s + m, 0)
    return { soni: p.n.toLocaleString('ru'), maydon: Math.round(maydon).toLocaleString('ru') }
  }, [tayyor])
  const yopBtn = useRef<HTMLButtonElement>(null)
  const onYopRef = useRef(onYop)
  useEffect(() => {
    onYopRef.current = onYop
  }, [onYop])

  // Ochilganda fokus oynaga o'tadi (klaviatura, ekran o'quvchi); Esc — yopish
  useEffect(() => {
    if (!ochiq) return
    const oldingi = document.activeElement as HTMLElement | null
    yopBtn.current?.focus()
    const h = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onYopRef.current()
      }
    }
    document.addEventListener('keydown', h, true)
    return () => {
      document.removeEventListener('keydown', h, true)
      oldingi?.focus?.()
    }
  }, [ochiq])

  if (!ochiq) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-navy/40 p-6 backdrop-blur-[2px]"
      onMouseDown={(e) => e.target === e.currentTarget && onYop()}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="info-sarlavha"
        className="flex max-h-[min(720px,100%)] w-[640px] flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_24px_64px_-16px_rgb(0_21_90/0.45)]"
      >
        {/* Sarlavha */}
        <div className="flex items-start justify-between gap-4 bg-navy px-6 pt-5 pb-4 text-white">
          <div>
            <div className="text-[11.5px] font-medium tracking-wide text-sky uppercase">Tajriba-sinov</div>
            <h2 id="info-sarlavha" className="mt-1 text-[20px] font-semibold">
              Raqamli agroxarita
            </h2>
            <p className="mt-1 text-[13px] text-white/70">
              Qishloq xo'jaligi yerlariga eng maqbul ekin turlarini joylashtirish
            </p>
          </div>
          <button
            ref={yopBtn}
            onClick={onYop}
            aria-label="Yopish"
            className="-mr-2 rounded-md p-1.5 text-white/70 hover:bg-white/10 hover:text-white"
          >
            <X className="size-5" />
          </button>
        </div>

        {/* Tablar */}
        <div role="tablist" className="flex shrink-0 gap-1 border-b border-line px-4">
          {TABLAR.map((t) => (
            <button
              key={t.id}
              role="tab"
              aria-selected={tab === t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px flex items-center gap-1.5 border-b-2 px-3 py-3 text-[13px] transition-colors',
                tab === t.id ? 'border-leaf font-semibold text-navy' : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <t.icon className="size-4" strokeWidth={1.8} />
              {t.nom}
            </button>
          ))}
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-6 py-5 text-[13.5px] leading-relaxed text-body">
          {tab === 'loyiha' && (
            <div className="space-y-4">
              <p>
                Agroxarita har bir kontur bo'yicha <b className="text-ink">tuproq tarkibi, relyef, iqlim</b> va{' '}
                <b className="text-ink">so'nggi yillarda ekilgan ekinlar</b>ni tahlil qilib, 37 ta ekinning shu yerga
                mosligini 0–100 ballda baholaydi va har bir bahoning sababini ko'rsatadi.
              </p>
              <div className="grid grid-cols-3 gap-2.5">
                <Raqam qiymat={raqam?.soni ?? '—'} nom="kontur" />
                <Raqam qiymat={raqam?.maydon ?? '—'} nom="gektar" />
                <Raqam qiymat="37" nom="ekin baholanadi" />
              </div>
              <div>
                <Sarlavha>Imkoniyatlar</Sarlavha>
                <ul className="list-disc space-y-1 pl-5">
                  <li>Kontur bo'yicha ekin tavsiyasi — kuzgi va bahorgi ekish, sabablari bilan</li>
                  <li>Tanlangan ekin uchun butun tuman bo'yicha moslik xaritasi</li>
                  <li>Yillar bo'yicha ekin tarixi va almashlab ekish ogohlantirishi</li>
                  <li>Tuproq, agrokimyo, relyef va iqlim qatlamlari, statistika</li>
                </ul>
              </div>
              <div>
                <Sarlavha>Sun'iy intellekt</Sarlavha>
                <p>
                  Bulung‘ur tumani uchun 2022–2026-yillardagi ekin xaritalari, tuproq, relyef va iqlim ma’lumotlarida CatBoostClassifier (MultiClass) modeli o‘qitildi. Model keyingi yilning asosiy tarixiy ekin sinfini bashorat qildi; 2025 va 2026-yillar bo‘yicha top‑1 aniqligi ma’lum sinflarda 39% va 47% bo‘ldi, sodda bazaviy mezon esa 31% va 22% ko‘rsatdi. SHAP tahlili bashoratga ta’sir qilgan omillarni umumiy miqyosda ko‘rsatdi, natijalar esa alohida faylga saqlandi. Bu tarixiy ekin tanlovi bashorati bo‘lib, hosildorlik yoki eng maqbul ekin prognozi emas.
                </p>
              </div>
              <p className="rounded-lg bg-sunken px-3.5 py-2.5 text-[12.5px] text-muted">
                Tajriba-sinov hududlari —{' '}
                {TUMANLAR.map((t, i) => (
                  <span key={t.id}>
                    {i > 0 && (i === TUMANLAR.length - 1 ? ' va ' : ', ')}
                    <b className="text-ink">{t.nom}</b> ({t.viloyat})
                  </span>
                ))}
                . Tumanni sarlavhadagi ro'yxatdan tanlang.
              </p>
            </div>
          )}

          {tab === 'farmon' && (
            <div className="space-y-4">
              <div className="rounded-lg border border-line px-4 py-3">
                <div className="text-[12px] text-muted">Asos</div>
                <div className="mt-0.5 font-semibold text-ink">
                  O'zbekiston Respublikasi Prezidentining PF-68-son Farmoni, 24.04.2026
                </div>
                <div className="mt-1 text-[12.5px]">
                  "Qishloq xo'jaligi ishlab chiqaruvchilarining yerdan foydalanishdagi mustaqilligini ta'minlashga
                  qaratilgan navbatdagi chora-tadbirlar to'g'risida"
                </div>
                <a
                  href="https://lex.uz/uz/docs/-8167799"
                  target="_blank"
                  rel="noreferrer"
                  className="mt-1.5 inline-block text-[12.5px] font-medium text-leaf-dark hover:underline"
                >
                  lex.uz da o'qish →
                </a>
              </div>
              <blockquote className="border-l-[3px] border-leaf pl-3.5 text-[13px] text-body italic">
                "…Farg'ona va Bulung'ur tumanlaridagi qishloq xo'jaligi yer maydonlarida har bir kontur bo'yicha
                tuproq tarkibi, joylashuv relyefi, suv bilan ta'minlanganlik darajasi, so'nggi o'n yillikdagi
                meteorologik va agrotexnik ko'rsatkichlarni tahlil qilib, eng maqbul ekin turlarini joylashtirish
                bo'yicha raqamli agroxarita ishlab chiqilsin."
              </blockquote>
              <div>
                <Sarlavha>Keyingi bosqich</Sarlavha>
                <p>
                  Pilot natijalari asosida respublikaning barcha tumanlari agroxaritalarini tayyorlash va yerlarning
                  normativ qiymati o'rniga bozor qiymatini belgilash bo'yicha takliflar ishlab chiqish.
                </p>
              </div>
            </div>
          )}

          {tab === 'malumot' && (
            <div className="divide-y divide-line">
              {MANBALAR.map((m) => (
                <div key={m.nom} className="grid grid-cols-[150px_1fr] gap-3 py-2.5 first:pt-0">
                  <div className="font-semibold text-ink">{m.nom}</div>
                  <div>
                    <div className="text-ink">{m.manba}</div>
                    <div className="text-[12px] text-muted">{m.izoh}</div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {tab === 'uslub' && (
            <div className="space-y-5">
              <div>
                <Sarlavha>Qanday baholanadi</Sarlavha>
                <p>
                  Har bir ekin uchun ball bir necha omilning ko'paytmasidan hisoblanadi: tuproq boniteti,
                  sho'rlanish, mexanik tarkib, qiyalik, iqlim (faol haroratlar, sovuq xavfi, jazirama), hozirgi
                  foydalanish va ekinning hudud uchun ahamiyati. Agrokimyoviy tanqislik (gumus, fosfor, kaliy)
                  o'g'it talabiga qarab ayriladi. Har bir omil kartada sabab sifatida ko'rsatiladi.
                </p>
              </div>
              <div>
                <Sarlavha>Jahon tajribasi</Sarlavha>
                <div className="overflow-hidden rounded-lg border border-line">
                  {TAJRIBA.map((t, i) => (
                    <div
                      key={t.davlat}
                      className={cn('grid grid-cols-[130px_1fr] gap-3 px-3.5 py-2.5', i > 0 && 'border-t border-line')}
                    >
                      <div className="font-semibold text-ink">{t.davlat}</div>
                      <div>
                        <div className="text-ink">{t.tajriba}</div>
                        <div className="text-[12px] text-muted">Loyihada: {t.orni}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>

        <div className="shrink-0 border-t border-line px-6 py-3 text-[12px] text-muted">
          © Qishloq xo'jaligi vazirligi · “Agrosanoatni raqamlashtirish markazi” MCHJ
        </div>
      </div>
    </div>
  )
}

function Sarlavha({ children }: { children: React.ReactNode }) {
  return <div className="mb-1.5 text-[13px] font-semibold text-navy">{children}</div>
}

function Raqam({ qiymat, nom }: { qiymat: string; nom: string }) {
  return (
    <div className="rounded-lg border border-line px-3 py-2.5 text-center">
      <div className="nums text-[20px] leading-none font-semibold text-navy">{qiymat}</div>
      <div className="mt-1 text-[11.5px] text-muted">{nom}</div>
    </div>
  )
}
