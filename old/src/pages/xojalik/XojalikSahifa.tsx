import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertTriangle,
  Ban,
  Check,
  ChevronDown,
  FlaskConical,
  Layers,
  Loader2,
  Maximize,
  Minus,
  Mountain,
  Plus,
  Sprout,
} from 'lucide-react'
import { Logo } from '@/components/Logo'
import { ballNom, ballRang } from '@/lib/tavsiya'
import { cn } from '@/lib/utils'
import { XojalikXarita, type XojalikXaritaAPI } from './XojalikXarita'
import {
  bbox,
  tekshir,
  type AttrsFayl,
  type Bbox,
  type EkinBall,
  type GeomFC,
  type KonturXos,
  type XojalikFC,
} from './turlar'

/** STIR — 9 xonali raqam */
const STIR = /^\d{9}$/
/** Kadastr raqami: 14:01:000122682 yoki eski uslub 14:01:40:02:02:0257 */
const KADASTR = /^\d{2}(:\d+)+$/

type Holat =
  | { turi: 'yuklanmoqda' }
  | { turi: 'tayyor'; fc: XojalikFC; lug: string[] }
  | { turi: '404'; sabab: 'yoq' | 'notogri' | 'topilmadi' }

/**
 * /map?tax_number=XXXXXXXXX&cad_number=14:01:XXXXXXXXX — kontur(lar), faqat xarita.
 * Konturlar STIR VA kadastr raqami ikkalasi mos kelganda chiqariladi.
 *
 * Ma'lumot: public/data/xojalik_attrs.json (atributlar, tavsiya) va
 * xojalik_geom.geojson (geometriya) — `id` orqali bog'lanadi.
 * 404 — klient tomonda chiziladi (hosting statik, HTTP status 200 qoladi).
 */
export default function XojalikSahifa() {
  const [stir, kadastr] = useMemo(() => {
    const q = new URLSearchParams(window.location.search)
    return [q.get('tax_number')?.trim() ?? '', q.get('cad_number')?.trim() ?? '']
  }, [])
  const [holat, setHolat] = useState<Holat>(() =>
    !stir || !kadastr
      ? { turi: '404', sabab: 'yoq' }
      : !STIR.test(stir) || !KADASTR.test(kadastr)
        ? { turi: '404', sabab: 'notogri' }
        : { turi: 'yuklanmoqda' },
  )

  useEffect(() => {
    if (holat.turi !== 'yuklanmoqda') return
    const ctrl = new AbortController()
    // content-type tekshirilmaydi: nginx .geojson ni JSON deb tanimasligi mumkin.
    // Fayl yo'q bo'lsa index.html qaytadi — r.json() xato beradi → 404
    const ol = (f: string) =>
      fetch(`${import.meta.env.BASE_URL}data/${f}`, { signal: ctrl.signal }).then((r) => {
        if (!r.ok) throw new Error('yuklanmadi')
        return r.json()
      })
    Promise.all([ol('xojalik_attrs.json') as Promise<AttrsFayl>, ol('xojalik_geom.geojson') as Promise<GeomFC>])
      .then(([attrs, geom]) => {
        // STIR VA kadastr raqami — ikkalasi ham mos kelishi shart
        const mos = attrs.konturlar.filter((a) => a.tax_number === stir && a.cadastral_number === kadastr)
        const g = new Map(geom.features.map((f) => [f.id, f.geometry]))
        const fc: XojalikFC = {
          type: 'FeatureCollection',
          features: mos
            .filter((a) => g.has(a.id))
            .map((a) => ({ type: 'Feature', id: a.id, properties: a, geometry: g.get(a.id)! })),
        }
        if (!tekshir(fc)) throw new Error('topilmadi')
        setHolat({ turi: 'tayyor', fc, lug: attrs.lug })
      })
      .catch((e) => {
        if (e.name !== 'AbortError') setHolat({ turi: '404', sabab: 'topilmadi' })
      })
    return () => ctrl.abort()
  }, [holat.turi, stir, kadastr])

  useEffect(() => {
    document.title = holat.turi === '404' ? 'Topilmadi — Agroxarita' : `${kadastr} — Agroxarita`
  }, [holat.turi, kadastr])

  if (holat.turi === '404') return <Topilmadi sabab={holat.sabab} />
  if (holat.turi === 'yuklanmoqda')
    return (
      <div className="flex h-full items-center justify-center gap-2 bg-paper text-[13px] text-muted">
        <Loader2 className="size-5 animate-spin text-leaf" />
        Yuklanmoqda
      </div>
    )
  return <XaritaSahifa fc={holat.fc} lug={holat.lug} />
}

// ------------------------------------------------------------ xarita
type Amal = 'hammasi' | 'yaqin' | 'uzoq'
const TUGMALAR = [
  ['Barcha konturlar', Maximize, 'hammasi'],
  ['Yaqinlashtirish', Plus, 'yaqin'],
  ['Uzoqlashtirish', Minus, 'uzoq'],
] as const

type Tab = 'tavsiya' | 'tuproq' | 'agrokimyo' | 'relyef'
const TABLAR: { id: Tab; nom: string; icon: typeof Sprout }[] = [
  { id: 'tavsiya', nom: 'Tavsiya', icon: Sprout },
  { id: 'tuproq', nom: 'Tuproq', icon: Layers },
  { id: 'agrokimyo', nom: 'Agrokimyo', icon: FlaskConical },
  { id: 'relyef', nom: 'Relyef', icon: Mountain },
]

const gaFmt = (v: number | null) => (v != null ? `${v.toFixed(2).replace('.', ',')} ga` : '—')

/** Ikki ustun: chapda ma'lumot (tablar), o'ngda xarita */
function XaritaSahifa({ fc, lug }: { fc: XojalikFC; lug: string[] }) {
  const api = useRef<XojalikXaritaAPI | null>(null)
  // Sukut: birinchi kontur tanlangan — chap panel bo'sh turmasin
  const [tanlangan, setTanlangan] = useState<number>(fc.features[0].id)
  const [hover, setHover] = useState<number | null>(null)
  const [tab, setTab] = useState<Tab>('tavsiya')

  const { umumiy, chegaralar } = useMemo(() => {
    const ch = new Map<number, Bbox>()
    let u: Bbox | undefined
    for (const f of fc.features) {
      ch.set(f.id, bbox(f.geometry))
      u = bbox(f.geometry, u)
    }
    return { umumiy: u!, chegaralar: ch }
  }, [fc])

  const k = (fc.features.find((f) => f.id === tanlangan) ?? fc.features[0]).properties
  const jamiMaydon = fc.features.reduce((s, f) => s + (f.properties.area ?? 0), 0)
  const bajar = (amal: Amal) => {
    if (amal === 'hammasi') api.current?.hammasi()
    else api.current?.zoom(amal === 'yaqin' ? 1 : -1)
  }
  const tanla = (id: number | null) => {
    if (id === null) return
    setTanlangan(id)
    api.current?.konturga(id)
  }

  return (
    <div className="flex h-full">
      {/* ------------------------------------------------ chap: ma'lumot */}
      <aside className="flex w-[32%] max-w-[380px] min-w-[300px] shrink-0 flex-col border-r border-line bg-surface">
        <div className="shrink-0 border-b border-line px-5 pt-4 pb-3.5">
          <div className="text-[11.5px] text-muted">Kadastr raqami</div>
          <div className="nums text-[20px] leading-tight font-semibold text-navy">
            {k.cadastral_number ?? '—'}
          </div>
          <div className="nums mt-1.5 flex flex-wrap gap-x-3 text-[12.5px] text-body">
            <span>
              STIR <b className="font-semibold text-ink">{k.tax_number}</b>
            </span>
            <span>
              <b className="font-semibold text-ink">{fc.features.length}</b> kontur
            </span>
            <span>
              <b className="font-semibold text-ink">{gaFmt(jamiMaydon)}</b>
            </span>
          </div>
        </div>

        {/* Kontur tanlovi — bir nechta bo'lsa */}
        {fc.features.length > 1 && (
          <div className="shrink-0 border-b border-line px-5 py-3">
            <div className="mb-2 text-[11.5px] font-medium text-muted">Kontur</div>
            <div className="flex flex-wrap gap-1.5">
              {fc.features.map((f) => (
                <button
                  key={f.id}
                  onClick={() => tanla(f.id)}
                  onMouseEnter={() => setHover(f.id)}
                  onMouseLeave={() => setHover(null)}
                  className={cn(
                    'nums rounded-full border px-3 py-1 text-[12.5px] transition-colors',
                    f.id === tanlangan
                      ? 'border-leaf bg-leaf font-semibold text-white'
                      : 'border-line text-body hover:border-leaf hover:text-leaf-dark',
                  )}
                >
                  {f.properties.contour_number ?? f.id}
                </button>
              ))}
            </div>
          </div>
        )}

        <div className="shrink-0 border-b border-line px-5 py-3">
          <div className="flex items-baseline justify-between">
            <span className="text-[15px] font-semibold text-navy">Kontur {k.contour_number ?? ''}</span>
            <span className="nums text-[13px] font-medium text-ink">{gaFmt(k.area)}</span>
          </div>
        </div>

        {/* Tablar */}
        <div className="grid shrink-0 grid-cols-4 border-b border-line">
          {TABLAR.map((t) => (
            <button
              key={t.id}
              onClick={() => setTab(t.id)}
              className={cn(
                '-mb-px flex items-center justify-center gap-1.5 border-b-2 py-2.5 text-[12.5px] transition-colors',
                tab === t.id
                  ? 'border-leaf font-semibold text-navy'
                  : 'border-transparent text-muted hover:text-ink',
              )}
            >
              <t.icon className="size-4" strokeWidth={1.8} />
              {t.nom}
            </button>
          ))}
        </div>

        <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {!k.kontur ? (
            <div className="py-10 text-center text-[12.5px] text-muted">
              Bu kontur agroxarita konturlari bilan kesishmaydi — ma'lumot yo'q.
            </div>
          ) : tab === 'tavsiya' ? (
            <Tavsiya key={k.id} k={k} lug={lug} />
          ) : tab === 'tuproq' ? (
            <Qatorlar
              qatorlar={[
                ['Bonitet', k.tuproq?.bonitet != null ? `${k.tuproq.bonitet} ball` : null],
                ['Mexanik tarkib', k.tuproq?.mexanika ?? null],
                ["Sho'rlanish", k.tuproq?.shor ?? null],
                ['Yer osti suvi', k.tuproq?.yos ?? null],
              ]}
            />
          ) : tab === 'agrokimyo' ? (
            <Qatorlar
              qatorlar={[
                ['Gumus', k.agrokimyo?.gumus ?? null],
                ['Fosfor', k.agrokimyo?.fosfor ?? null],
                ['Kaliy', k.agrokimyo?.kaliy ?? null],
              ]}
            />
          ) : (
            <Qatorlar
              qatorlar={[
                ['Balandlik', k.relyef?.balandlik != null ? `${k.relyef.balandlik} m` : null],
                [
                  'Qiyalik',
                  k.relyef?.qiyalik != null ? `${String(k.relyef.qiyalik).replace('.', ',')}°` : null,
                ],
                ["Yo'nalish", k.relyef?.yonalish ?? null],
              ]}
            />
          )}
        </div>
      </aside>

      {/* ------------------------------------------------ o'ng: xarita */}
      <main className="relative min-w-0 flex-1">
        <XojalikXarita
          fc={fc}
          umumiy={umumiy}
          chegaralar={chegaralar}
          tanlangan={tanlangan}
          hover={hover}
          onTanla={tanla}
          onHover={setHover}
          apiRef={api}
        />
        <div className="absolute top-3 right-3 z-20 flex flex-col divide-y divide-line overflow-hidden rounded-card float-panel">
          {TUGMALAR.map(([nom, Icon, amal]) => (
            <button
              key={nom}
              onClick={() => bajar(amal)}
              title={nom}
              aria-label={nom}
              className="flex size-10 items-center justify-center text-body transition-colors hover:bg-sunken hover:text-navy"
            >
              <Icon className="size-[18px]" strokeWidth={1.9} />
            </button>
          ))}
        </div>
      </main>
    </div>
  )
}

/** Nom / qiymat qatorlari */
function Qatorlar({ qatorlar }: { qatorlar: [string, string | null][] }) {
  return (
    <dl className="divide-y divide-line">
      {qatorlar.map(([n, v]) => (
        <div key={n} className="flex items-baseline gap-3 py-3">
          <dt className="w-[120px] shrink-0 text-[12.5px] text-muted">{n}</dt>
          <dd className="nums min-w-0 flex-1 text-[13.5px] font-medium text-ink">{v ?? '—'}</dd>
        </div>
      ))}
    </dl>
  )
}

// ----------------------------------------------------------- tavsiya
/** Asosiy app tavsiyasi — intersect orqali bog'langan kontur bo'yicha */
function Tavsiya({ k, lug }: { k: KonturXos; lug: string[] }) {
  // Sukut: hammasi yopiq; boshqa kontur tanlansa `key` orqali qayta yopiladi
  const [ochiq, setOchiq] = useState<string | null>(null)
  if (!k.tavsiya) return null
  const guruhlar = [
    ['Kuzgi ekish', k.tavsiya.kuzgi],
    ['Bahorgi ekish', k.tavsiya.bahorgi],
  ] as const
  return (
    <div>
      {guruhlar.map(([nom, list]) =>
        list.length ? (
          <div key={nom} className="mb-4 last:mb-0">
            <div className="mb-1.5 flex items-center gap-2">
              <span className="text-[12.5px] font-semibold text-navy">{nom}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="space-y-1">
              {list.map((e, i) => {
                const id = nom + e.ekin
                return (
                  <EkinQator
                    key={id}
                    e={e}
                    n={i + 1}
                    lug={lug}
                    ochiq={ochiq === id}
                    onToggle={() => setOchiq(ochiq === id ? null : id)}
                  />
                )
              })}
            </div>
          </div>
        ) : null,
      )}
    </div>
  )
}

const SABAB_IKON = [
  <Check key="ok" className="mt-[2px] size-3.5 shrink-0 text-leaf" strokeWidth={2.5} />,
  <AlertTriangle key="ogoh" className="mt-[2px] size-3.5 shrink-0 text-wheat" strokeWidth={2.2} />,
  <Ban key="xato" className="mt-[2px] size-3.5 shrink-0 text-clay" strokeWidth={2.2} />,
]

/** Ekin qatori — bosilsa nega shu ball olingani (sabablar) ochiladi */
function EkinQator({
  e,
  n,
  lug,
  ochiq,
  onToggle,
}: {
  e: EkinBall
  n: number
  lug: string[]
  ochiq: boolean
  onToggle: () => void
}) {
  const rang = ballRang(e.ball)
  return (
    <div
      className={cn(
        'rounded-card border transition-colors',
        ochiq ? 'border-line-strong bg-surface shadow-[0_1px_2px_rgb(0_21_90/0.06)]' : 'border-transparent hover:bg-sunken',
      )}
    >
      <button onClick={onToggle} aria-expanded={ochiq} className="w-full px-2.5 pt-2 pb-2 text-left">
        <div className="flex items-baseline gap-2 text-[13px]">
          <span className="nums w-4 text-[11px] text-faint">{n}</span>
          <span className="min-w-0 flex-1 truncate font-medium text-ink">{e.ekin}</span>
          <span className="nums font-semibold" style={{ color: rang }}>
            {e.ball}
          </span>
          <span className="w-14 text-right text-[11px] text-muted">{ballNom(e.ball)}</span>
          <ChevronDown
            className={cn('size-3.5 shrink-0 self-center text-faint transition-transform', ochiq && 'rotate-180')}
          />
        </div>
        <div className="mt-1.5 ml-6 h-1 overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full" style={{ width: `${e.ball}%`, background: rang }} />
        </div>
      </button>
      {ochiq && (
        <div className="space-y-1.5 border-t border-line px-3 py-2.5">
          {e.sabab.map(([turi, i]) => {
            const matn = lug[i] ?? ''
            return (
              <div key={i} className="flex gap-2 text-[12px] leading-relaxed text-body">
                {SABAB_IKON[turi]}
                <span>{matn.charAt(0).toUpperCase() + matn.slice(1)}</span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

// --------------------------------------------------------------- 404
function Topilmadi({ sabab }: { sabab: 'yoq' | 'notogri' | 'topilmadi' }) {
  const matn = {
    yoq: [
      "Parametrlar ko'rsatilmagan",
      "Konturni ko'rish uchun manzilda tax_number va cad_number bo'lishi kerak.",
    ],
    notogri: [
      "Parametr noto'g'ri",
      "STIR 9 ta raqamdan, kadastr raqami raqam va ikki nuqtadan iborat bo'lishi kerak.",
    ],
    topilmadi: ['Kontur topilmadi', "Bu STIR va kadastr raqami bo'yicha kontur mavjud emas."],
  }[sabab]
  return (
    <div className="flex h-full flex-col items-center justify-center bg-navy px-6 text-center text-white">
      <Logo size={56} />
      <div className="mt-6 text-[88px] leading-none font-bold tracking-tight">404</div>
      <h1 className="mt-3 text-[22px] font-semibold">{matn[0]}</h1>
      <p className="mt-2 max-w-md text-[14px] text-white/70">{matn[1]}</p>
      <code className="mt-5 rounded-lg bg-white/10 px-3 py-1.5 text-[13px] text-sky">
        /map?tax_number=XXXXXXXXX&amp;cad_number=14:01:XXXXXXXXX
      </code>
    </div>
  )
}
