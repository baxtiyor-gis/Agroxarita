import { useEffect, useMemo, useRef, useState } from 'react'
import { Layers, Home, Plus, Minus, X, Check } from 'lucide-react'
import { useApp, type Qatlam } from '@/store/useApp'
import { ekinYillar, extent } from '@/lib/data'
import { relyefMeta } from '@/lib/relyef'
import { tumanOl } from '@/lib/tuman'
import { SHKALA, ekinYili } from '@/lib/ranglar'
import { cn } from '@/lib/utils'

/** Xarita ustidagi tugma — chap tomonda nomi chiqadigan tooltip bilan */
function Tugma({
  onClick,
  title,
  faol,
  tooltip = true,
  children,
}: {
  onClick: () => void
  title: string
  faol?: boolean
  /** Yonidagi panel ochiq bo'lsa tooltip uning ustiga chiqmasin */
  tooltip?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      aria-label={title}
      aria-pressed={faol}
      className={cn(
        'group relative flex size-10 items-center justify-center transition-colors',
        faol ? 'bg-navy text-white' : 'text-body hover:bg-sunken hover:text-navy',
      )}
    >
      {children}
      {tooltip && !faol && (
        <span className="pointer-events-none absolute top-1/2 right-full mr-2.5 -translate-y-1/2 rounded-md bg-navy px-2 py-1 text-[11.5px] font-medium whitespace-nowrap text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100">
          {title}
        </span>
      )}
    </button>
  )
}

/** Switch qatori — nom, izoh va o'ngda almashtirgich */
function Switch({
  nom,
  izoh,
  yoqilgan,
  onToggle,
}: {
  nom: string
  izoh?: string
  yoqilgan: boolean
  onToggle: () => void
}) {
  return (
    <label className="flex cursor-pointer items-center gap-3 rounded-lg px-2 py-2 transition-colors hover:bg-sunken">
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-medium text-ink">{nom}</span>
        {izoh && <span className="mt-0.5 block text-[11px] text-muted">{izoh}</span>}
      </span>
      <input type="checkbox" checked={yoqilgan} onChange={onToggle} className="peer sr-only" />
      <span
        aria-hidden
        className={cn(
          'relative h-5 w-9 shrink-0 rounded-full transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-leaf/40',
          yoqilgan ? 'bg-leaf' : 'bg-line-strong',
        )}
      >
        <span
          className={cn(
            'absolute top-0.5 left-0.5 size-4 rounded-full bg-white shadow transition-transform',
            yoqilgan && 'translate-x-4',
          )}
        />
      </span>
    </label>
  )
}

function Sarlavha({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 px-2 text-[11.5px] font-semibold text-muted">{children}</div>
}

/** Tematik qatlamlar — xaritani ko'rsatkich bo'yicha ranglash */
const TEMATIK: { id: Qatlam; guruh: string }[] = [
  { id: 'yoq', guruh: 'Asosiy' },
  { id: 'foyd', guruh: 'Asosiy' },
  { id: 'ekin22', guruh: 'Asosiy' },
  { id: 'ekin23', guruh: 'Asosiy' },
  { id: 'ekin24', guruh: 'Asosiy' },
  { id: 'ekin25', guruh: 'Asosiy' },
  { id: 'ekin26', guruh: 'Asosiy' },
  { id: 'bonitet', guruh: 'Tuproq' },
  { id: 'shor', guruh: 'Tuproq' },
  { id: 'gumus', guruh: 'Agrokimyo' },
  { id: 'fosfor', guruh: 'Agrokimyo' },
  { id: 'kaliy', guruh: 'Agrokimyo' },
  { id: 'balandlik', guruh: 'Relyef' },
  { id: 'qiyalik', guruh: 'Relyef' },
  { id: 'fah', guruh: 'Iqlim' },
  { id: 'sovuqsiz', guruh: 'Iqlim' },
  { id: 'bahorgiSovuq', guruh: 'Iqlim' },
  { id: 'issiqKun', guruh: 'Iqlim' },
  { id: 'yillikYogin', guruh: 'Iqlim' },
  { id: 'suvTanqislik', guruh: 'Iqlim' },
  { id: 'oyHarorat', guruh: 'Iqlim' },
  { id: 'oyYogin', guruh: 'Iqlim' },
]

/** Asos xarita uchun preview — hudud markazidagi haqiqiy plitka */
function plitka(z: number) {
  const [w, s, e, n] = extent()
  const lon = (w + e) / 2
  const lat = (s + n) / 2
  const x = Math.floor(((lon + 180) / 360) * 2 ** z)
  const r = (lat * Math.PI) / 180
  const y = Math.floor(((1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2) * 2 ** z)
  return { x, y, z }
}

export function XaritaBoshqaruv({
  onZoom,
  onHome,
}: {
  onZoom: (d: number) => void
  onHome: () => void
}) {
  const {
    asos,
    setAsos,
    konturKorinsin,
    toggleKonturKorinsin,
    relyefKorinsin,
    toggleRelyef,
    gorizontalKorinsin,
    toggleGorizontal,
    qatlam,
    setQatlam,
    tavsiyaEkin,
    tuman,
  } = useApp()
  const [ochiq, setOchiq] = useState(false)

  // Ekin qatlamlari — faqat tumanda ma'lumoti bor yillar
  const tematik = useMemo(() => {
    const yillar = ekinYillar()
    return TEMATIK.filter(({ id }) => {
      const y = ekinYili(id)
      return y === null || yillar.includes(y)
    })
  }, [])

  // Gorizontallar izohi: relyef.json dagi `gorizontalIzoh`, bo'lmasa tuman sozlamasi
  const [metaIzoh, setMetaIzoh] = useState<string | null>(null)
  useEffect(() => {
    if (!ochiq) return
    let tirik = true
    relyefMeta(tuman)
      .then((m) => tirik && setMetaIzoh(m.gorizontalIzoh ?? null))
      .catch(() => {})
    return () => {
      tirik = false
    }
  }, [ochiq, tuman])
  const gorIzoh = metaIzoh ?? tumanOl(tuman).gorizontalIzoh ?? 'Balandlik chiziqlari'

  const panel = useRef<HTMLDivElement>(null)
  const ustun = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ochiq) return
    const h = (e: MouseEvent) => {
      const t = e.target as Node
      if (panel.current?.contains(t) || ustun.current?.contains(t)) return
      setOchiq(false)
    }
    const k = (e: KeyboardEvent) => e.key === 'Escape' && setOchiq(false)
    document.addEventListener('mousedown', h)
    document.addEventListener('keydown', k)
    return () => {
      document.removeEventListener('mousedown', h)
      document.removeEventListener('keydown', k)
    }
  }, [ochiq])

  const t = useMemo(() => plitka(12), [])
  const asoslar = [
    {
      id: 'sputnik' as const,
      nom: "Sun'iy yo'ldosh",
      rasm: `https://mt1.google.com/vt/lyrs=s&x=${t.x}&y=${t.y}&z=${t.z}`,
    },
    {
      id: 'osm' as const,
      nom: 'Sxematik',
      rasm: `https://tile.openstreetmap.org/${t.z}/${t.x}/${t.y}.png`,
    },
  ]

  return (
    <div className="pointer-events-auto relative">
      {/* Panel absolute — ochilganda boshqaruv ustunining joylashuvini o'zgartirmaydi */}
      {ochiq && (
        <div
          ref={panel}
          className="absolute top-0 right-full mr-2 flex max-h-[calc(100vh-110px)] w-[290px] flex-col overflow-hidden rounded-card float-panel"
        >
          <div className="flex shrink-0 items-center justify-between border-b border-line px-4 py-3">
            <div>
              <div className="text-[14px] font-semibold text-navy">Qatlamlar</div>
              <div className="text-[11.5px] text-muted">Asos xarita va tematik ko'rsatkichlar</div>
            </div>
            <button
              onClick={() => setOchiq(false)}
              aria-label="Yopish"
              className="-mr-1.5 rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink"
            >
              <X className="size-4" />
            </button>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {/* Asos xarita */}
            <div className="border-b border-line px-2 py-3">
              <Sarlavha>Asos xarita</Sarlavha>
              <div className="grid grid-cols-2 gap-2 px-2">
                {asoslar.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => setAsos(a.id)}
                    aria-pressed={asos === a.id}
                    className="group text-left"
                  >
                    <span
                      className={cn(
                        'relative block h-[68px] overflow-hidden rounded-lg bg-sunken ring-2 transition-all',
                        asos === a.id ? 'ring-leaf' : 'ring-transparent group-hover:ring-line-strong',
                      )}
                    >
                      <img src={a.rasm} alt="" loading="lazy" className="size-full object-cover" />
                      {asos === a.id && (
                        <span className="absolute top-1.5 right-1.5 flex size-5 items-center justify-center rounded-full bg-leaf text-white shadow">
                          <Check className="size-3" strokeWidth={3} />
                        </span>
                      )}
                    </span>
                    <span
                      className={cn(
                        'mt-1.5 block text-center text-[12px]',
                        asos === a.id ? 'font-semibold text-ink' : 'text-body',
                      )}
                    >
                      {a.nom}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {/* Tematik ranglash */}
            <div className="border-b border-line px-2 py-3">
              <Sarlavha>Xaritani ranglash</Sarlavha>
              {qatlam === 'tavsiya' && tavsiyaEkin && (
                <div className="mx-2 mb-2 rounded-lg bg-leaf-soft px-2.5 py-2 text-[11.5px] leading-snug text-leaf-dark">
                  Hozir ekin mosligi ko'rsatilmoqda. Boshqa qatlam tanlansa, u o'chadi.
                </div>
              )}
              <div role="radiogroup" aria-label="Tematik qatlam">
                {tematik.map(({ id, guruh }, i) => {
                  const sh = SHKALA[id]
                  const faol = qatlam === id
                  const yangiGuruh = i === 0 || tematik[i - 1].guruh !== guruh
                  return (
                    <div key={id}>
                      {yangiGuruh && guruh !== 'Asosiy' && (
                        <div className="mt-2 mb-0.5 px-2 text-[10.5px] font-medium tracking-wide text-faint uppercase">
                          {guruh}
                        </div>
                      )}
                      <button
                        role="radio"
                        aria-checked={faol}
                        onClick={() => setQatlam(id)}
                        className={cn(
                          'flex w-full items-center gap-2.5 rounded-lg px-2 py-[7px] text-left transition-colors',
                          faol ? 'bg-leaf-soft' : 'hover:bg-sunken',
                        )}
                      >
                        <span
                          className={cn(
                            'flex size-4 shrink-0 items-center justify-center rounded-full border-2 transition-colors',
                            faol ? 'border-leaf' : 'border-line-strong',
                          )}
                        >
                          {faol && <span className="size-2 rounded-full bg-leaf" />}
                        </span>
                        <span
                          className={cn(
                            'min-w-0 flex-1 truncate text-[12.5px]',
                            faol ? 'font-semibold text-ink' : 'text-body',
                          )}
                        >
                          {id === 'yoq' ? 'Faqat kontur chegaralari' : sh.nom}
                        </span>
                        {/* Palitra namunasi */}
                        <span className="flex h-2.5 w-14 shrink-0 overflow-hidden rounded-full ring-1 ring-black/5">
                          {id === 'yoq' ? (
                            <span className="flex-1 border-2 border-outline bg-white" />
                          ) : (
                            sh.klasslar.map((k, i) => (
                              <span key={i} className="flex-1" style={{ background: k.rang }} />
                            ))
                          )}
                        </span>
                      </button>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* Qo'shimcha */}
            <div className="px-2 py-3">
              <Sarlavha>Qo'shimcha</Sarlavha>
              <Switch
                nom="Kontur chegaralari"
                izoh="Kadastr konturlari"
                yoqilgan={konturKorinsin}
                onToggle={toggleKonturKorinsin}
              />
              <Switch
                nom="Relyef (DEM)"
                izoh="Copernicus DEM 30 m"
                yoqilgan={relyefKorinsin}
                onToggle={toggleRelyef}
              />
              <Switch
                nom="Gorizontallar"
                izoh={gorIzoh}
                yoqilgan={gorizontalKorinsin}
                onToggle={toggleGorizontal}
              />
            </div>
          </div>
        </div>
      )}

      {/* Vertikal boshqaruv ustuni */}
      <div ref={ustun} className="flex flex-col gap-2">
        <div className="flex flex-col rounded-card float-panel [&>button]:rounded-card">
          <Tugma onClick={() => setOchiq(!ochiq)} title="Qatlamlar" faol={ochiq}>
            <Layers className="size-[18px]" strokeWidth={1.8} />
          </Tugma>
        </div>
        <div className="flex flex-col divide-y divide-line rounded-card float-panel [&>button:first-child]:rounded-t-card [&>button:last-child]:rounded-b-card">
          <Tugma onClick={onHome} title="Butun hudud" tooltip={!ochiq}>
            <Home className="size-[18px]" strokeWidth={1.8} />
          </Tugma>
          <Tugma onClick={() => onZoom(1)} title="Yaqinlashtirish" tooltip={!ochiq}>
            <Plus className="size-[18px]" strokeWidth={2} />
          </Tugma>
          <Tugma onClick={() => onZoom(-1)} title="Uzoqlashtirish" tooltip={!ochiq}>
            <Minus className="size-[18px]" strokeWidth={2} />
          </Tugma>
        </div>
      </div>
    </div>
  )
}
