import { useMemo, useState } from 'react'
import {
  ChevronDown,
  Eye,
  FlaskConical,
  Layers,
  LandPlot,
  MapPinned,
  Mountain,
} from 'lucide-react'
import { useApp, type Qatlam } from '@/store/useApp'
import { attrs, ekinlar26, ustun } from '@/lib/data'
import { SHKALA, YOQ_RANG } from '@/lib/ranglar'
import { cn } from '@/lib/utils'

/** Footer — loyiha egalari */
const TASHKILOTLAR = [
  // {
  //   nom: 'O‘zbekiston Respublikasi Qishloq xo‘jaligi vazirligi',
  //   logo: 'qxv.png',
  //   url: 'https://gov.uz/uz/agro',
  // },
  {
    nom: '“Agrosanoatni raqamlashtirish markazi” MCHJ',
    logo: 'digitagro.png',
    url: 'https://agroportal.digitagro.uz/',
  },
]

const gaFmt = (v: number) => `${Math.round(v).toLocaleString('ru')} ga`
const foizFmt = (v: number) => `${v.toFixed(1).replace('.', ',')} %`

interface Qism {
  nom: string
  rang: string
  soni: number
  maydon: number
}

/** Qatlam klasslari bo'yicha taqsimot: kontur soni va maydon */
function taqsimot(qatlam: Qatlam): Qism[] {
  const p = attrs()
  const arr = ustun(qatlam)
  const ks = SHKALA[qatlam].klasslar
  const out: Qism[] = ks.map((k) => ({ nom: k.nom, rang: k.rang, soni: 0, maydon: 0 }))
  const yoq: Qism = { nom: "Ma'lumot yo'q", rang: YOQ_RANG, soni: 0, maydon: 0 }
  if (!arr) return out
  for (let i = 0; i < p.n; i++) {
    const v = arr[i]
    const m = p.col.maydon[i]
    let q = yoq
    if (v >= 0) {
      const idx = ks.findIndex((k) => v >= k.min && v < k.max)
      q = out[idx >= 0 ? idx : out.length - 1]
    }
    q.soni++
    q.maydon += m
  }
  return yoq.soni ? [...out, yoq] : out
}

/**
 * 2026-yil ekinlari — haqiqiy ekin maydoni: kontur maydoni × kesishma ulushi.
 * Bir konturda bir necha ekin bo'lishi mumkin, har biri o'z ulushi bilan.
 */
function ekinTaqsimot(): Qism[] {
  const p = attrs()
  const out: Qism[] = ekinlar26().map((e) => ({ nom: e.nom, rang: e.rang, soni: 0, maydon: 0 }))
  const col = p.col.ekin26
  if (!col) return out
  for (let i = 0; i < p.n; i++) {
    for (const [e, u] of col[i]) {
      out[e].soni++
      out[e].maydon += (p.col.maydon[i] * u) / 100
    }
  }
  return out
}

/** Massivlar bo'yicha maydon — kamayish tartibida */
function massivlar(): Qism[] {
  const p = attrs()
  const s = new Map<number, Qism>()
  for (let i = 0; i < p.n; i++) {
    const idx = p.col.massiv[i]
    if (idx < 0 || !p.lug.massiv[idx]) continue
    const q = s.get(idx) ?? { nom: p.lug.massiv[idx], rang: 'var(--color-sky)', soni: 0, maydon: 0 }
    q.soni++
    q.maydon += p.col.maydon[i]
    s.set(idx, q)
  }
  return [...s.values()].sort((a, b) => b.maydon - a.maydon)
}

function Korsatkich({ nom, qiymat, birlik }: { nom: string; qiymat: string; birlik?: string }) {
  return (
    <div className="rounded-lg border border-line bg-white/[0.04] px-2.5 py-2">
      <div className="text-[11px] leading-none text-muted">{nom}</div>
      <div className="nums mt-1.5 text-[16px] leading-none font-semibold whitespace-nowrap text-ink">
        {qiymat}
        {birlik && <span className="ml-1 text-[11px] font-normal text-muted">{birlik}</span>}
      </div>
    </div>
  )
}

function Bolim({
  nom,
  icon: Icon,
  ochiq,
  onToggle,
  children,
}: {
  nom: string
  icon: typeof Eye
  ochiq: boolean
  onToggle: () => void
  children: React.ReactNode
}) {
  return (
    <div className={cn('border-b border-line transition-colors', ochiq && 'bg-white/[0.03]')}>
      <button
        onClick={onToggle}
        aria-expanded={ochiq}
        className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-white/[0.05]"
      >
        <span
          className={cn(
            'flex size-7 shrink-0 items-center justify-center rounded-lg transition-colors',
            ochiq ? 'bg-sky/15 text-sky' : 'bg-white/[0.06] text-muted',
          )}
        >
          <Icon className="size-[15px]" strokeWidth={1.9} />
        </span>
        <span className="flex-1 text-[13.5px] font-semibold text-ink">{nom}</span>
        <ChevronDown
          className={cn('size-4 shrink-0 text-muted transition-transform', ochiq && 'rotate-180')}
        />
      </button>
      {ochiq && <div className="space-y-5 px-4 pt-1 pb-5">{children}</div>}
    </div>
  )
}

/** Bitta ko'rsatkich bo'yicha kategoriyalar — ulush chiziqlari bilan */
function Taqsimot({
  nom,
  qismlar,
  qatlam,
  nisbiy = false,
}: {
  nom: string
  qismlar: Qism[]
  /** Berilsa — "Xaritada" tugmasi shu qatlamni yoqadi */
  qatlam?: Qatlam
  /** Chiziq uzunligi eng kattasiga nisbatan (massivlar kabi uzun ro'yxat uchun) */
  nisbiy?: boolean
}) {
  const { qatlam: joriy, setQatlam } = useApp()
  const jami = qismlar.reduce((s, q) => s + q.maydon, 0) || 1
  const engKatta = Math.max(...qismlar.map((q) => q.maydon), 1)
  const faol = qatlam !== undefined && joriy === qatlam

  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <span className="text-[12px] font-semibold text-body">{nom}</span>
        {qatlam && (
          <button
            onClick={() => setQatlam(faol ? 'yoq' : qatlam)}
            aria-pressed={faol}
            className={cn(
              'flex items-center gap-1 rounded-md px-2 py-1 text-[11px] font-medium transition-colors',
              faol ? 'bg-leaf text-white' : 'bg-sky/10 text-sky hover:bg-sky/20',
            )}
          >
            <Eye className="size-3.5" />
            {faol ? 'Xaritada' : "Ko'rsatish"}
          </button>
        )}
      </div>
      {qismlar.map((q) => {
        const ulush = (q.maydon / jami) * 100
        return (
          <div
            key={q.nom}
            className={cn('py-[6px]', q.soni === 0 && 'opacity-40')}
            title={`${q.soni.toLocaleString('ru')} ta kontur`}
          >
            <div className="flex items-baseline gap-2">
              {!nisbiy && (
                <span
                  className="size-2.5 shrink-0 translate-y-[-1px] rounded-[3px]"
                  style={{ background: q.rang }}
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[12.5px] text-body">{q.nom}</span>
              <span className="nums shrink-0 text-[12.5px] font-medium text-ink">{gaFmt(q.maydon)}</span>
              <span className="nums w-[46px] shrink-0 text-right text-[11px] text-faint">
                {foizFmt(ulush)}
              </span>
            </div>
            <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-white/10">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${nisbiy ? (q.maydon / engKatta) * 100 : ulush}%`,
                  background: q.rang,
                  opacity: nisbiy ? 0.75 : 1,
                }}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

export function StatPanel() {
  const { tayyor } = useApp()
  const [ochiq, setOchiq] = useState<string | null>(null)

  const s = useMemo(() => {
    if (!tayyor) return null
    const p = attrs()
    let maydon = 0
    let bonSum = 0
    let bonMaydon = 0
    for (let i = 0; i < p.n; i++) {
      const m = p.col.maydon[i]
      maydon += m
      // Maydon bo'yicha tortilgan o'rtacha — kichik konturlar bahoni buzmasin
      if (p.col.bonitet[i] >= 0) {
        bonSum += p.col.bonitet[i] * m
        bonMaydon += m
      }
    }
    const t = (q: Qatlam) => taqsimot(q)
    const mas = massivlar()
    return {
      soni: p.n,
      maydon,
      bonitet: bonMaydon ? bonSum / bonMaydon : null,
      massiv: mas,
      foyd: t('foyd'),
      ekin: ekinTaqsimot(),
      bonitetT: t('bonitet'),
      shor: t('shor'),
      gumus: t('gumus'),
      fosfor: t('fosfor'),
      kaliy: t('kaliy'),
      balandlik: t('balandlik'),
      qiyalik: t('qiyalik'),
    }
  }, [tayyor])

  if (!s) return null
  const almashtir = (id: string) => setOchiq(ochiq === id ? null : id)

  return (
    <div className="flex h-full flex-col">
      <div className="grid shrink-0 grid-cols-2 gap-1.5 border-b border-line px-4 pb-3">
        <Korsatkich nom="Konturlar" qiymat={s.soni.toLocaleString('ru')} birlik="ta" />
        <Korsatkich
          nom="Umumiy maydon"
          qiymat={Math.round(s.maydon).toLocaleString('ru')}
          birlik="ga"
        />
        <Korsatkich nom="Massivlar" qiymat={String(s.massiv.length)} birlik="ta" />
        <Korsatkich
          nom="O'rtacha bonitet"
          qiymat={s.bonitet ? s.bonitet.toFixed(0) : '—'}
          birlik="ball"
        />
      </div>

      <div className="scrollbar-dark min-h-0 flex-1 overflow-y-auto">
        <Bolim nom="Hudud" icon={MapPinned} ochiq={ochiq === 'hudud'} onToggle={() => almashtir('hudud')}>
          <Taqsimot nom="Massivlar bo'yicha maydon" qismlar={s.massiv} nisbiy />
        </Bolim>

        <Bolim nom="Yer" icon={LandPlot} ochiq={ochiq === 'yer'} onToggle={() => almashtir('yer')}>
          <Taqsimot nom="Yer turi" qismlar={s.foyd} qatlam="foyd" />
          {s.ekin.length > 0 && (
            <Taqsimot nom="Ekilgan ekinlar (2026)" qismlar={s.ekin} qatlam="ekin" />
          )}
        </Bolim>

        <Bolim nom="Tuproq" icon={Layers} ochiq={ochiq === 'tuproq'} onToggle={() => almashtir('tuproq')}>
          <Taqsimot nom="Bonitet" qismlar={s.bonitetT} qatlam="bonitet" />
          <Taqsimot nom="Sho'rlanish" qismlar={s.shor} qatlam="shor" />
        </Bolim>

        <Bolim
          nom="Agrokimyo"
          icon={FlaskConical}
          ochiq={ochiq === 'agro'}
          onToggle={() => almashtir('agro')}
        >
          <Taqsimot nom="Gumus" qismlar={s.gumus} qatlam="gumus" />
          <Taqsimot nom="Fosfor" qismlar={s.fosfor} qatlam="fosfor" />
          <Taqsimot nom="Kaliy" qismlar={s.kaliy} qatlam="kaliy" />
        </Bolim>

        <Bolim nom="Relyef" icon={Mountain} ochiq={ochiq === 'relyef'} onToggle={() => almashtir('relyef')}>
          <Taqsimot nom="Balandlik" qismlar={s.balandlik} qatlam="balandlik" />
          <Taqsimot nom="Qiyalik" qismlar={s.qiyalik} qatlam="qiyalik" />
        </Bolim>
      </div>

      <footer className="shrink-0 space-y-2.5 border-t border-line px-4 py-3.5">
        {TASHKILOTLAR.map((t) => (
          <a
            key={t.url}
            href={t.url}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            <img
              src={`${import.meta.env.BASE_URL}brand/${t.logo}`}
              alt=""
              className="size-8 shrink-0 object-contain"
            />
            <span className="text-[11.5px] leading-snug text-body">{t.nom}</span>
          </a>
        ))}
      </footer>
    </div>
  )
}
