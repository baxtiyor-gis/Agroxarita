import { useState } from 'react'
import { Droplets, Flame, Snowflake, Sprout, Sun, Thermometer } from 'lucide-react'
import { cn } from '@/lib/cn'
import { OYLAR, iqlimMock, iqlimYillarMock, kunSana, tuproqIsishOyi, type Iqlim } from './mock'
import { NamunaBelgi } from './ui'

const rl = (v: number) => v.toLocaleString('ru')

/** V1 Iqlim tabi: ko'rsatkichlar, klimatogramma, 10 yil heatmap, suv balansi (namuna ma'lumot) */
export function IqlimTab({ id }: { id: number }) {
  const q = iqlimMock(id)
  const isish = tuproqIsishOyi(q.tuproqT)
  return (
    <div className="px-2.5 pb-1">
      <div className="pb-2">
        <NamunaBelgi />
      </div>
      <div className="grid grid-cols-2 gap-2">
        <Korsatkich
          icon={Sun}
          rang="#e0891f"
          nom="Faol haroratlar yig'indisi"
          qiymat={rl(q.fah)}
          birlik="°C"
          izoh=">10 °C kunlar"
        />
        <Korsatkich icon={Sprout} rang="#469d18" nom="Sovuqsiz davr" qiymat={String(q.sovuqsiz)} birlik="kun" />
        <Korsatkich
          icon={Snowflake}
          rang="#2c8ec4"
          nom="Bahorgi oxirgi sovuq"
          qiymat={kunSana(q.bahorgiSovuq)}
          izoh={`${q.kechSovuqYil} yilda 10-apreldan keyin`}
          ogoh={q.kechSovuqYil >= 4}
        />
        <Korsatkich icon={Snowflake} rang="#5b6fd1" nom="Kuzgi birinchi sovuq" qiymat={kunSana(q.kuzgiSovuq)} />
        <Korsatkich
          icon={Flame}
          rang="#d9482b"
          nom="Issiq kunlar"
          qiymat={String(q.issiqKun).replace('.', ',')}
          birlik="kun/yil"
          izoh="≥ 35 °C"
        />
        <Korsatkich
          icon={Thermometer}
          rang="#3d6fb6"
          nom="Qishki eng past"
          qiymat={String(q.minT).replace('.', ',')}
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
        <Klimatogramma q={q} />
      </div>

      <YillarOylar id={id} />

      <div className="mt-3 rounded-lg border border-line px-3 py-2.5">
        <div className="flex items-center gap-2 text-[12.5px] font-semibold text-navy">
          <Droplets className="size-4 text-water" strokeWidth={2} />
          Suv balansi (yillik)
        </div>
        <div className="nums mt-2 grid grid-cols-3 gap-2 text-center">
          <Balans nom="Yog'in" v={q.yillikYogin} />
          <Balans nom="Bug'lanish talabi" v={q.yillikEt0} />
          <Balans nom="Tanqislik" v={q.suvTanqislik} ogoh />
        </div>
        <div className="mt-2 text-[11.5px] leading-snug text-muted">
          Tanqislik sug'orish bilan qoplanadi — yozda yog'in deyarli yo'q.
          {isish && ` Tuproq 12 °C gacha isishi: ${isish.toLowerCase()}.`}
        </div>
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
function Klimatogramma({ q }: { q: Iqlim }) {
  const W = 356
  const H = 150
  const pad = { l: 26, r: 26, t: 8, b: 20 }
  const iw = W - pad.l - pad.r
  const ih = H - pad.t - pad.b
  const bw = iw / 12

  const tMin = Math.min(-5, Math.floor(Math.min(...q.harorat) / 5) * 5)
  const tMax = Math.max(30, Math.ceil(Math.max(...q.harorat) / 5) * 5)
  const mMax = Math.max(50, Math.ceil(Math.max(...q.et0, ...q.yogin) / 50) * 50)
  const yT = (t: number) => pad.t + ih - ((t - tMin) / (tMax - tMin)) * ih
  const yM = (v: number) => pad.t + ih - (v / mMax) * ih
  const xC = (i: number) => pad.l + bw * i + bw / 2

  const yol = q.harorat.map((t, i) => `${i ? 'L' : 'M'}${xC(i).toFixed(1)},${yT(t).toFixed(1)}`).join('')
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
      {q.et0.map((v, i) => (
        <rect key={`e${i}`} x={pad.l + bw * i + 2} y={yM(v)} width={bw - 4} height={yM(0) - yM(v)} rx={1.5} fill="#f2c94c" opacity={0.45} />
      ))}
      {q.yogin.map((v, i) => (
        <rect key={`y${i}`} x={pad.l + bw * i + bw * 0.28} y={yM(v)} width={bw * 0.44} height={yM(0) - yM(v)} rx={1.5} fill="#5aa9e6" />
      ))}
      <path d={yol} fill="none" stroke="#e0572b" strokeWidth={2} strokeLinejoin="round" />
      {q.harorat.map((t, i) => (
        <circle key={i} cx={xC(i)} cy={yT(t)} r={2.2} fill="#fff" stroke="#e0572b" strokeWidth={1.5}>
          <title>{`${OYLAR[i]}: ${String(t).replace('.', ',')} °C, yog'in ${q.yogin[i]} mm, ET₀ ${q.et0[i]} mm`}</title>
        </circle>
      ))}
      {OYLAR.map((m, i) => (
        <text key={m} x={xC(i)} y={H - 6} textAnchor="middle" fontSize="8.5" fill="var(--color-muted)">
          {m.slice(0, 3)}
        </text>
      ))}
    </svg>
  )
}

// ============================================== 10 YIL: YILLAR × OYLAR
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

function YillarOylar({ id }: { id: number }) {
  const [rejim, setRejim] = useState<Rejim>('harorat')
  const d = iqlimYillarMock(id)

  const n = d.yillar.length
  const ortT = OYLAR.map((_, m) => d.harorat.reduce((s, y) => s + y[m], 0) / n)
  const ortP = OYLAR.map((_, m) => d.yogin.reduce((s, y) => s + y[m], 0) / n)
  const yilT = d.harorat.map((y) => y.reduce((a, b) => a + b, 0) / 12)
  const yilP = d.yogin.map((y) => y.reduce((a, b) => a + b, 0))
  const ortYilT = yilT.reduce((a, b) => a + b, 0) / n
  const ortYilP = yilP.reduce((a, b) => a + b, 0) / n

  const harorat = rejim === 'harorat'
  const shkala = harorat ? T_SHKALA : P_SHKALA
  const katak = (yi: number, m: number) => {
    const oy = `${d.yillar[yi]} · ${bosh(OY_TOLIQ[m])}`
    if (harorat) {
      const v = d.harorat[yi][m]
      const a = v - ortT[m]
      return { t: a / T_CHEGARA, title: `${oy}: ${son(v)} °C (o'rtachadan ${ishorali(a)})` }
    }
    const v = d.yogin[yi][m]
    const a = v - ortP[m]
    if (ortP[m] < P_QURUQ_OY)
      return { t: a / P_QURUQ_CHEGARA, title: `${oy}: ${Math.round(v)} mm (o'rtachadan ${ishorali(a, 0)} mm)` }
    const f = (a / ortP[m]) * 100
    return { t: f / P_CHEGARA, title: `${oy}: ${Math.round(v)} mm (o'rtachadan ${ishorali(f, 0)} %)` }
  }

  // Xavf xulosasi
  const ekstr = (v: number[], max: boolean) => v.reduce((b, x, j) => ((max ? x > v[b] : x < v[b]) ? j : b), 0)
  const issiq = ekstr(yilT, true)
  const sovuq = ekstr(yilT, false)
  const quruq = ekstr(yilP, false)
  const nam = ekstr(yilP, true)
  let eng = { yi: 0, m: 0, a: 0 }
  d.harorat.forEach((y, yi) =>
    y.forEach((v, m) => {
      const a = v - ortT[m]
      if (Math.abs(a) > Math.abs(eng.a)) eng = { yi, m, a }
    }),
  )

  return (
    <div className="mt-4">
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[12.5px] font-semibold text-navy">10 yil: yillar × oylar</span>
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

        {d.yillar.map((yil, yi) => {
          const yillik = harorat
            ? `${yil}: yillik o'rtacha ${son(yilT[yi])} °C (o'rtachadan ${ishorali(yilT[yi] - ortYilT)})`
            : `${yil}: yillik yog'in ${Math.round(yilP[yi])} mm (o'rtachadan ${ishorali(((yilP[yi] - ortYilP) / ortYilP) * 100, 0)} %)`
          return (
            <div key={yil} className="contents">
              <span className="flex h-4 items-center text-[10px] text-body" title={yillik}>
                {yil}
              </span>
              {OYLAR.map((_, m) => {
                const c = katak(yi, m)
                return (
                  <span
                    key={m}
                    className="h-4 rounded-[2px] ring-1 ring-black/[0.06] ring-inset"
                    style={{ background: rang(shkala, c.t) }}
                    title={c.title}
                  />
                )
              })}
              <span className="flex h-4 items-center justify-end text-[10px] text-body" title={yillik}>
                {harorat ? son(yilT[yi]) : Math.round(yilP[yi])}
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
          ? "Shu oyning 10 yillik o'rtachasiga nisbatan farq"
          : `Oy o'rtachasiga nisbatan; o'rtacha < ${P_QURUQ_OY} mm oylarda ±${P_QURUQ_CHEGARA} mm`}
      </div>

      <div className="mt-2.5 rounded-lg border border-line bg-sunken/60 px-3 py-2 text-[11.5px] leading-snug text-body">
        <div className="mb-0.5 text-[11px] font-semibold text-navy">Xavf xulosasi</div>
        <div>
          Eng issiq yil: <b className="font-semibold">{d.yillar[issiq]}</b> ({son(yilT[issiq])} °C) · eng sovuq:{' '}
          <b className="font-semibold">{d.yillar[sovuq]}</b> ({son(yilT[sovuq])} °C)
        </div>
        <div>
          Eng quruq yil: <b className="font-semibold">{d.yillar[quruq]}</b> ({Math.round(yilP[quruq])} mm) · eng nam:{' '}
          <b className="font-semibold">{d.yillar[nam]}</b> ({Math.round(yilP[nam])} mm)
        </div>
        <div>
          Eng {eng.a < 0 ? 'sovuq' : 'issiq'} anomaliya:{' '}
          <b className="font-semibold">
            {d.yillar[eng.yi]}-yil {OY_TOLIQ[eng.m]}
          </b>
          , {ishorali(eng.a)} °C
        </div>
      </div>
    </div>
  )
}
