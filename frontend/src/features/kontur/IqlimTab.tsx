import { useState } from 'react'
import { Droplets, Flame, Snowflake, Sprout, Sun, Thermometer, TriangleAlert } from 'lucide-react'
import { ApiXato } from '@/features/border/api'
import { cn } from '@/lib/cn'
import { useIqlim } from './api'
import type { Iqlim } from './types'

const rl = (v: number) => v.toLocaleString('ru')

const OYLAR = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
const OY_KUN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const KUN_OY = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek']

/** Yil kunini "12-apr" ko'rinishiga */
function kunSana(doy: number | null): string {
  if (doy == null) return '—'
  let d = Math.round(doy)
  for (let m = 0; m < 12; m++) {
    if (d <= OY_KUN[m]) return `${d}-${KUN_OY[m]}`
    d -= OY_KUN[m]
  }
  return '—'
}

/** Kech sovuqli yillar ulushi shundan yuqori bo'lsa — ogohlantirish (V1: 10 yilda 4 ta) */
const KECH_SOVUQ_OGOH = 0.4

const vergul = (v: number | null, d = 1) => (v == null ? '—' : v.toFixed(d).replace('.', ',').replace('-', '−'))

/** Iqlim tabi (V1 tuzilishi): ko'rsatkichlar, klimatogramma, yillar × oylar, suv balansi — API (ERA5-Land katagi) */
export function IqlimTab({ id }: { id: number }) {
  const q = useIqlim(id)
  if (q.isPending) return <div className="py-10 text-center text-[12px] text-muted">Yuklanmoqda…</div>
  if (q.isError) {
    if (q.error instanceof ApiXato && q.error.status === 404)
      return (
        <div className="mx-2.5 rounded-lg border border-line bg-sunken/60 px-3 py-3 text-[12px] leading-snug text-muted">
          Iqlim ma'lumoti yo'q — kontur iqlim katagidan tashqarida.
        </div>
      )
    return (
      <div className="mx-2.5 flex items-start gap-2 rounded-lg border border-clay/30 bg-clay-soft px-3 py-2.5 text-[12px] text-clay">
        <TriangleAlert className="mt-px size-4 shrink-0" />
        <span>
          Iqlim ma'lumotini yuklab bo'lmadi: {q.error.message}
          <button onClick={() => q.refetch()} className="ml-2 font-semibold underline">
            Qayta urinish
          </button>
        </span>
      </div>
    )
  }
  return <IqlimKorinish d={q.data} />
}

function IqlimKorinish({ d }: { d: Iqlim }) {
  const k = d.korsatkich
  const toliqSoni = d.yillik.filter((y) => y.toliq).length
  const qismanYillar = d.yillik.filter((y) => !y.toliq).map((y) => y.yil)
  const kechOgoh = toliqSoni > 0 && k.kech_sovuq_yillar / toliqSoni >= KECH_SOVUQ_OGOH
  return (
    <div className="px-2.5 pb-1">
      <div className="pb-2 text-[11px] text-faint">
        ERA5-Land, {d.davr[0]}–{d.davr[1]}
        {qismanYillar.length > 0 && ` · ${qismanYillar.join(', ')} — qisman yil`}
        {" · ko'rsatkichlar to'liq yillar o'rtachasi"}
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Korsatkich
          icon={Sun}
          rang="#e0891f"
          nom="Faol haroratlar yig'indisi"
          qiymat={k.fah == null ? '—' : rl(Math.round(k.fah))}
          birlik="°C"
          izoh=">10 °C kunlar"
        />
        <Korsatkich
          icon={Sprout}
          rang="#469d18"
          nom="Sovuqsiz davr"
          qiymat={k.sovuqsiz == null ? '—' : String(Math.round(k.sovuqsiz))}
          birlik="kun"
        />
        <Korsatkich
          icon={Snowflake}
          rang="#2c8ec4"
          nom="Bahorgi oxirgi sovuq"
          qiymat={kunSana(k.bahorgi_sovuq)}
          izoh={`${k.kech_sovuq_yillar} / ${toliqSoni} yilda 10-apreldan keyin`}
          ogoh={kechOgoh}
        />
        <Korsatkich icon={Snowflake} rang="#5b6fd1" nom="Kuzgi birinchi sovuq" qiymat={kunSana(k.kuzgi_sovuq)} />
        <Korsatkich
          icon={Flame}
          rang="#d9482b"
          nom="Issiq kunlar"
          qiymat={vergul(k.issiq_kun)}
          birlik="kun/yil"
          izoh="≥ 35 °C"
        />
        <Korsatkich
          icon={Thermometer}
          rang="#3d6fb6"
          nom="Qishki eng past"
          qiymat={vergul(k.min_t)}
          birlik="°C"
          izoh="yillik o'rtacha"
        />
      </div>

      <div className="mt-4">
        <div className="mb-1.5 flex items-baseline justify-between">
          <span className="text-[12.5px] font-semibold text-navy">Yil davomida</span>
          <span className="flex items-center gap-3 text-[10.5px] text-muted">
            <Belgi rang="#e0572b" chiziq /> Harorat
            <Belgi rang="#5aa9e6" /> Yog'in
            <Belgi rang="#f2c94c" /> ET₀
          </span>
        </div>
        <Klimatogramma oylik={d.oylik_ortacha} />
      </div>

      <YillarOylar d={d} />

      <div className="mt-3 rounded-lg border border-line px-3 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-navy">
          <Droplets className="size-4 text-water" strokeWidth={2} />
          Suv balansi (yillik)
        </div>
        <div className="nums mt-2 grid grid-cols-3 gap-2 text-center">
          <Balans nom="Yog'in" v={d.suv_balansi.yogin} />
          <Balans nom="Bug'lanish talabi" v={d.suv_balansi.et0} />
          <Balans nom="Tanqislik" v={d.suv_balansi.tanqislik} ogoh />
        </div>
        {d.suv_balansi.tanqislik > 0 && (
          <div className="mt-2 text-[11.5px] leading-snug text-muted">
            Tanqislik sug'orish bilan qoplanadi — yozda yog'in deyarli yo'q.
          </div>
        )}
      </div>
    </div>
  )
}

function Korsatkich({
  icon: Icon,
  rang,
  nom,
  qiymat,
  birlik,
  izoh,
  ogoh,
}: {
  icon: typeof Sun
  rang: string
  nom: string
  qiymat: string
  birlik?: string
  izoh?: string
  ogoh?: boolean
}) {
  return (
    <div className={cn('rounded-lg border px-2.5 py-2', ogoh ? 'border-wheat/40 bg-wheat-soft' : 'border-line')}>
      <div className="flex items-center gap-1.5 text-[10.5px] leading-tight text-muted">
        <Icon className="size-3.5 shrink-0" style={{ color: rang }} strokeWidth={2} />
        <span className="truncate">{nom}</span>
      </div>
      <div className="nums mt-1 text-[16px] leading-none font-semibold text-ink">
        {qiymat}
        {birlik && <span className="ml-1 text-[10.5px] font-normal text-muted">{birlik}</span>}
      </div>
      {izoh && <div className={cn('mt-1 text-[10.5px]', ogoh ? 'text-wheat' : 'text-faint')}>{izoh}</div>}
    </div>
  )
}

function Balans({ nom, v, ogoh }: { nom: string; v: number; ogoh?: boolean }) {
  return (
    <div>
      <div className={cn('text-[15px] font-semibold', ogoh ? 'text-clay' : 'text-ink')}>
        {rl(v)}
        <span className="ml-0.5 text-[10.5px] font-normal text-muted">mm</span>
      </div>
      <div className="text-[10.5px] text-muted">{nom}</div>
    </div>
  )
}

function Belgi({ rang, chiziq }: { rang: string; chiziq?: boolean }) {
  return (
    <span
      className={cn('inline-block', chiziq ? 'h-[2.5px] w-3 rounded-full' : 'size-2.5 rounded-[2px]')}
      style={{ background: rang }}
    />
  )
}

/** Oylik harorat (chiziq) + yog'in va ET₀ (ustunlar) — inline SVG */
function Klimatogramma({ oylik }: { oylik: Iqlim['oylik_ortacha'] }) {
  const W = 356
  const H = 150
  const pad = { l: 26, r: 26, t: 8, b: 20 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const bw = iw / 12

  const oy = (m: number) => oylik.find((o) => o.oy === m + 1)
  const harorat = OYLAR.map((_, m) => oy(m)?.t_ort ?? null)
  const yogin = OYLAR.map((_, m) => oy(m)?.yogin ?? 0)
  const et0 = OYLAR.map((_, m) => oy(m)?.et0 ?? 0)
  const tBor = harorat.filter((t): t is number => t != null)
  if (tBor.length === 0) return null

  const tMin = Math.min(-5, Math.floor(Math.min(...tBor) / 5) * 5)
  const tMax = Math.max(30, Math.ceil(Math.max(...tBor) / 5) * 5)
  const mMax = Math.max(50, Math.ceil(Math.max(...et0, ...yogin) / 50) * 50)
  const yT = (t: number) => pad.t + ih - ((t - tMin) / (tMax - tMin)) * ih
  const yM = (v: number) => pad.t + ih - (v / mMax) * ih
  const xC = (i: number) => pad.l + bw * i + bw / 2

  const yol = harorat
    .flatMap((t, i) => (t == null ? [] : [{ t, i }]))
    .map(({ t, i }, j) => `${j ? 'L' : 'M'}${xC(i).toFixed(1)},${yT(t).toFixed(1)}`)
    .join('')
  const tTicks: number[] = []
  for (let t = tMin; t <= tMax; t += 10) tTicks.push(t)

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img" aria-label="Oylik harorat va yog'in">
      {tTicks.map((t) => (
        <g key={t}>
          <line x1={pad.l} x2={W - pad.r} y1={yT(t)} y2={yT(t)} stroke="var(--color-line)" strokeWidth={t === 0 ? 1 : 0.6} />
          <text x={pad.l - 4} y={yT(t) + 3} textAnchor="end" fontSize="8.5" fill="var(--color-muted)">
            {t}°
          </text>
        </g>
      ))}
      {[0, mMax / 2, mMax].map((v) => (
        <text key={v} x={W - pad.r + 4} y={yM(v) + 3} fontSize="8.5" fill="var(--color-muted)">
          {v}
        </text>
      ))}
      {et0.map((v, i) => (
        <rect key={`e${i}`} x={pad.l + bw * i + 2} y={yM(v)} width={bw - 4} height={yM(0) - yM(v)} rx={1.5} fill="#f2c94c" opacity={0.45} />
      ))}
      {yogin.map((v, i) => (
        <rect key={`y${i}`} x={pad.l + bw * i + bw * 0.28} y={yM(v)} width={bw * 0.44} height={yM(0) - yM(v)} rx={1.5} fill="#5aa9e6" />
      ))}
      <path d={yol} fill="none" stroke="#e0572b" strokeWidth={2} strokeLinejoin="round" />
      {harorat.map((t, i) =>
        t == null ? null : (
          <circle key={i} cx={xC(i)} cy={yT(t)} r={2.2} fill="#fff" stroke="#e0572b" strokeWidth={1.5}>
            <title>{`${OYLAR[i]}: ${vergul(t)} °C, yog'in ${Math.round(yogin[i])} mm, ET₀ ${Math.round(et0[i])} mm`}</title>
          </circle>
        ),
      )}
      {OYLAR.map((m, i) => (
        <text key={m} x={xC(i)} y={H - 6} textAnchor="middle" fontSize="8.5" fill="var(--color-muted)">
          {m.slice(0, 3)}
        </text>
      ))}
    </svg>
  )
}

// ============================================== YILLAR × OYLAR
const OY_TOLIQ = ['yanvar', 'fevral', 'mart', 'aprel', 'may', 'iyun', 'iyul', 'avgust', 'sentabr', 'oktabr', 'noyabr', 'dekabr']
const OY_HARF = ['Y', 'F', 'M', 'A', 'M', 'I', 'I', 'A', 'S', 'O', 'N', 'D']
const bosh = (s: string) => s[0].toUpperCase() + s.slice(1)

/** O'zbekcha son: o'nlik vergul, minus "−" */
const son = (v: number, d = 1) => {
  const s = v.toFixed(d)
  return (Number(s) === 0 ? (0).toFixed(d) : s).replace('.', ',').replace('-', '−')
}
const ishorali = (v: number, d = 1) => (Number(v.toFixed(d)) > 0 ? '+' : '') + son(v, d)

// Diverging shkalalar: [manfiy, o'rta, musbat]
const T_SHKALA = ['#2166ac', '#f7f7f7', '#b2182b']
const P_SHKALA = ['#8c510a', '#f7f7f7', '#2166ac']
const T_CHEGARA = 3 // °C
const P_CHEGARA = 100 // %
const P_QURUQ_OY = 5 // mm
const P_QURUQ_CHEGARA = 10 // mm

function aralash(a: string, b: string, t: number) {
  const h = (s: string, k: number) => parseInt(s.slice(1 + k * 2, 3 + k * 2), 16)
  return `rgb(${[0, 1, 2].map((k) => Math.round(h(a, k) + (h(b, k) - h(a, k)) * t)).join(',')})`
}
/** t ∈ [−1, 1] → rang (chegaradan tashqarisi kesiladi) */
const rang = (shkala: string[], t: number) =>
  t < 0 ? aralash(shkala[1], shkala[0], Math.min(1, -t)) : aralash(shkala[1], shkala[2], Math.min(1, t))

type Rejim = 'harorat' | 'yogin'

const BO_SH = '#e3e5e1' // ma'lumot yo'q oy (qisman yil) — kulrang

/** Yillar × oylar heatmap — har katak shu oyning to'liq yillar o'rtachasiga nisbatan anomaliya */
function YillarOylar({ d }: { d: Iqlim }) {
  const [rejim, setRejim] = useState<Rejim>('harorat')
  const harorat = rejim === 'harorat'
  const shkala = harorat ? T_SHKALA : P_SHKALA

  const ort = OYLAR.map((_, m) => d.oylik_ortacha.find((o) => o.oy === m + 1))
  const yillik = new Map(d.yillik.map((y) => [y.yil, y]))
  const toliqlar = d.yillik.filter((y) => y.toliq)
  const orta = (f: (y: Iqlim['yillik'][number]) => number | null) => {
    const v = toliqlar.map(f).filter((x): x is number => x != null)
    return v.length ? v.reduce((a, b) => a + b, 0) / v.length : null
  }
  const ortYilT = orta((y) => y.t_ort)
  const ortYilP = orta((y) => y.yogin)
  const n = toliqlar.length
  const qismanBor = d.yillik.some((y) => !y.toliq)

  const katak = (yil: number, m: number) => {
    const c = d.yillar_oylar.find((y) => y.yil === yil)?.oylar.find((o) => o.oy === m + 1)
    const v = harorat ? c?.t_ort : c?.yogin
    const o = harorat ? ort[m]?.t_ort : ort[m]?.yogin
    const oy = `${yil} · ${bosh(OY_TOLIQ[m])}`
    if (v == null) return { rang: BO_SH, title: `${oy}: ma'lumot yo'q` }
    if (o == null) return { rang: BO_SH, title: `${oy}: ${harorat ? son(v) + ' °C' : Math.round(v) + ' mm'}` }
    const a = v - o
    if (harorat) return { rang: rang(shkala, a / T_CHEGARA), title: `${oy}: ${son(v)} °C (o'rtachadan ${ishorali(a)})` }
    if (o < P_QURUQ_OY)
      return { rang: rang(shkala, a / P_QURUQ_CHEGARA), title: `${oy}: ${Math.round(v)} mm (o'rtachadan ${ishorali(a, 0)} mm)` }
    const f = (a / o) * 100
    return { rang: rang(shkala, f / P_CHEGARA), title: `${oy}: ${Math.round(v)} mm (o'rtachadan ${ishorali(f, 0)} %)` }
  }

  // Xavf xulosasi: yillik ekstremumlar API dan; eng katta oylik harorat anomaliyasi — heatmapdan
  let eng: { yil: number; m: number; a: number } | null = null
  for (const y of d.yillar_oylar)
    for (const c of y.oylar) {
      const o = ort[c.oy - 1]?.t_ort
      if (c.t_ort == null || o == null) continue
      const a = c.t_ort - o
      if (!eng || Math.abs(a) > Math.abs(eng.a)) eng = { yil: y.yil, m: c.oy - 1, a }
    }
  const x = d.xavf

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-navy">{d.yillar.length} yil: yillar × oylar</span>
        <div className="flex rounded-md border border-line bg-sunken p-0.5 text-[11px]" role="group" aria-label="Ko'rsatkich">
          {(['harorat', 'yogin'] as const).map((r) => (
            <button
              key={r}
              type="button"
              aria-pressed={rejim === r}
              onClick={() => setRejim(r)}
              className={cn(
                'rounded-[5px] px-2.5 py-0.5 font-medium transition-colors',
                rejim === r ? 'bg-surface text-navy shadow-sm ring-1 ring-line' : 'text-muted hover:text-body',
              )}
            >
              {r === 'harorat' ? 'Harorat' : "Yog'in"}
            </button>
          ))}
        </div>
      </div>

      <div
        className="nums grid gap-[2px] text-[9.5px] leading-none text-muted"
        style={{ gridTemplateColumns: '30px repeat(12, minmax(0, 1fr)) 38px' }}
      >
        <span />
        {OY_HARF.map((h, m) => (
          <span key={m} className="pb-0.5 text-center" title={bosh(OY_TOLIQ[m])}>
            {h}
          </span>
        ))}
        <span className="pb-0.5 text-right">{harorat ? '°C' : 'mm'}</span>

        {d.yillar.map((yil) => {
          const y = yillik.get(yil)
          const t = y?.t_ort ?? null
          const p = y?.yogin ?? null
          const qisman = y ? !y.toliq : false
          const yTitle =
            (harorat
              ? `${yil}: yillik o'rtacha ${t == null ? '—' : son(t)} °C${t != null && ortYilT != null ? ` (o'rtachadan ${ishorali(t - ortYilT)})` : ''}`
              : `${yil}: yillik yog'in ${p == null ? '—' : Math.round(p)} mm${p != null && ortYilP ? ` (o'rtachadan ${ishorali(((p - ortYilP) / ortYilP) * 100, 0)} %)` : ''}`) +
            (qisman ? ' — qisman yil (mavjud oylar)' : '')
          return (
            <div key={yil} className="contents">
              <span className="flex h-4 items-center text-[10px] text-body" title={yTitle}>
                {yil}
              </span>
              {OYLAR.map((_, m) => {
                const c = katak(yil, m)
                return (
                  <span
                    key={m}
                    className="h-4 rounded-[2px] ring-1 ring-black/[0.06] ring-inset"
                    style={{ background: c.rang }}
                    title={c.title}
                  />
                )
              })}
              <span className="flex h-4 items-center justify-end text-[10px] text-body" title={yTitle}>
                {harorat ? (t == null ? '—' : son(t)) : p == null ? '—' : Math.round(p)}
                {qisman && '*'}
              </span>
            </div>
          )
        })}
      </div>

      <div className="mt-2 flex items-center justify-center gap-1.5 text-[10px] text-muted">
        <span>{harorat ? 'sovuqroq' : 'quruqroq'}</span>
        <span className="nums">{harorat ? `−${T_CHEGARA} °C` : `−${P_CHEGARA} %`}</span>
        <span
          className="h-2 w-24 rounded-full ring-1 ring-black/[0.06] ring-inset"
          style={{ background: `linear-gradient(to right, ${shkala.join(', ')})` }}
        />
        <span className="nums">{harorat ? `+${T_CHEGARA} °C` : `+${P_CHEGARA} %`}</span>
        <span>{harorat ? 'issiqroq' : 'namroq'}</span>
      </div>
      <div className="mt-0.5 text-center text-[10px] text-faint">
        {harorat
          ? `Shu oyning ${n} yillik (to'liq yillar) o'rtachasiga nisbatan farq`
          : `Oy o'rtachasiga nisbatan; o'rtacha < ${P_QURUQ_OY} mm oylarda ±${P_QURUQ_CHEGARA} mm`}
        <span className="ml-1.5 inline-flex items-center gap-1 align-middle">
          <span className="inline-block size-2 rounded-[2px] ring-1 ring-black/[0.06] ring-inset" style={{ background: BO_SH }} />
          {"ma'lumot yo'q"}
        </span>
      </div>

      <div className="mt-2.5 rounded-lg border border-line bg-sunken/60 px-3 py-2 text-[11.5px] leading-snug text-body">
        <div className="mb-0.5 text-[11px] font-semibold text-navy">Xavf xulosasi</div>
        {(x.eng_issiq || x.eng_sovuq) && (
          <div>
            {x.eng_issiq && (
              <>
                Eng issiq yil: <b className="font-semibold">{x.eng_issiq.yil}</b> ({son(x.eng_issiq.qiymat)} °C)
              </>
            )}
            {x.eng_issiq && x.eng_sovuq && ' · '}
            {x.eng_sovuq && (
              <>
                eng sovuq: <b className="font-semibold">{x.eng_sovuq.yil}</b> ({son(x.eng_sovuq.qiymat)} °C)
              </>
            )}
          </div>
        )}
        {(x.eng_quruq || x.eng_nam) && (
          <div>
            {x.eng_quruq && (
              <>
                Eng quruq yil: <b className="font-semibold">{x.eng_quruq.yil}</b> ({Math.round(x.eng_quruq.qiymat)} mm)
              </>
            )}
            {x.eng_quruq && x.eng_nam && ' · '}
            {x.eng_nam && (
              <>
                eng nam: <b className="font-semibold">{x.eng_nam.yil}</b> ({Math.round(x.eng_nam.qiymat)} mm)
              </>
            )}
          </div>
        )}
        {eng && (
          <div>
            Eng {eng.a < 0 ? 'sovuq' : 'issiq'} anomaliya:{' '}
            <b className="font-semibold">
              {eng.yil}-yil {OY_TOLIQ[eng.m]}
            </b>
            , {ishorali(eng.a)} °C
          </div>
        )}
        {qismanBor && <div className="mt-0.5 text-[10.5px] text-faint">* qisman yil — yillik ekstremumlarga kirmaydi</div>}
      </div>
    </div>
  )
}
