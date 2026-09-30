import { useMemo, useState } from 'react'
import { AlertTriangle, Ban, Check, ChevronDown, Droplets } from 'lucide-react'
import { cn } from '@/lib/cn'
import { useIqlim } from './api'
import {
  KOPYILLIK,
  MAVSUM_NOM,
  ballNom,
  ballRang,
  kirishQur,
  mavsum,
  tavsiyalar,
  type Mavsum,
  type Sabab,
  type Tavsiya,
} from './tavsiya'
import type { Kontur } from './types'

const MAVSUMLAR: [Mavsum, string][] = [
  ['kuzgi', MAVSUM_NOM.kuzgi],
  ['bahorgi', MAVSUM_NOM.bahorgi],
]

function SababIkon({ turi }: { turi: Sabab['turi'] }) {
  if (turi === 'ok') return <Check className="mt-[2px] size-3 shrink-0 text-leaf" strokeWidth={2.5} />
  if (turi === 'ogoh')
    return <AlertTriangle className="mt-[2px] size-3 shrink-0 text-wheat" strokeWidth={2.2} />
  return <Ban className="mt-[2px] size-3 shrink-0 text-clay" strokeWidth={2.2} />
}

function TavsiyaQator({
  t,
  ochiq,
  taxminiy,
  onToggle,
}: {
  t: Tavsiya
  ochiq: boolean
  taxminiy: boolean
  onToggle: () => void
}) {
  const rang = ballRang(t.ball)
  return (
    <div
      className={cn(
        'rounded-card border transition-colors',
        ochiq
          ? 'border-line-strong bg-surface shadow-[0_1px_2px_rgb(22_32_26/0.05)]'
          : 'border-transparent hover:bg-surface',
      )}
    >
      <button onClick={onToggle} className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left">
        <span className="flex-1 truncate text-[13px] font-medium text-ink">{t.crop.nom}</span>
        {taxminiy && (
          <span
            title="Tuproq ma'lumoti yo'q yoki ishonchsiz — ball taxminiy"
            className="shrink-0 rounded-full bg-wheat-soft px-1.5 py-px text-[9.5px] leading-tight font-medium text-wheat"
          >
            Taxminiy
          </span>
        )}
        <span className="nums shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: rang }}>
          {t.ball}
        </span>
        <span className="w-14 shrink-0 text-right text-[10px] text-muted">{ballNom(t.ball)}</span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-faint transition-transform', ochiq && 'rotate-180')}
        />
      </button>
      <div className="px-2.5 pb-1.5">
        <div className="h-[4px] w-full overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full transition-all" style={{ width: `${t.ball}%`, background: rang }} />
        </div>
      </div>
      {ochiq && (
        <div className="space-y-1.5 border-t border-line px-2.5 py-2.5">
          {t.sabablar.map((s, i) => (
            <div key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed text-body">
              <SababIkon turi={s.turi} />
              <span>{s.matn.charAt(0).toUpperCase() + s.matn.slice(1)}</span>
            </div>
          ))}
          <div className="mt-2 border-t border-line pt-2 text-[11px] leading-snug text-muted">
            <span className="text-faint">Ekish muddati: </span>
            {t.crop.muddat}
          </div>
          <div className="flex gap-1 text-[11px] text-muted">
            <Droplets className="mt-[2px] size-3 shrink-0 text-water" strokeWidth={2} />
            {t.crop.suv_matn}
          </div>
        </div>
      )}
    </div>
  )
}

/** V1 Tavsiya tabi: mavsum bo'yicha guruhlangan ekinlar (ball, sabablar), pastda "Mos kelmaydi" */
export function TavsiyaTab({ kontur }: { kontur: Kontur }) {
  const [ochiq, setOchiq] = useState<string | null>(null)
  const iq = useIqlim(kontur.id)
  // Iqlim 404 (katak yo'q) yoki xato — omil 1,0, sabablarda "iqlim ma'lumoti yo'q"
  const kutilmoqda = iq.isPending
  const kirish = useMemo(() => kirishQur(kontur, iq.data), [kontur, iq.data])
  const tav = useMemo(() => tavsiyalar(kirish), [kirish])
  const mos = tav.filter((t) => t.ball >= 25)
  const nomos = tav.filter((t) => t.ball < 25)

  return (
    <>
      {kutilmoqda && <div className="px-2.5 pb-2 text-[11px] text-faint">Iqlim ma'lumoti yuklanmoqda…</div>}
      {kirish.tuproqYoq && (
        <div className="mx-2.5 mb-2.5 flex items-start gap-1.5 rounded-card border border-wheat/30 bg-wheat-soft px-2.5 py-2 text-[11.5px] leading-relaxed text-wheat">
          <AlertTriangle className="mt-[2px] size-3 shrink-0" strokeWidth={2.2} />
          <span>
            Konturda tuproq ma'lumoti yo'q yoki ishonchsiz — ballar taxminiy, dala tekshiruvi tavsiya etiladi.
          </span>
        </div>
      )}
      {KOPYILLIK.includes(kirish.foyd) && mos.length > 0 && (
        <div className="mx-2.5 mb-2.5 rounded-card border border-leaf-line bg-leaf-soft px-2.5 py-2 text-[11.5px] leading-relaxed text-leaf-dark">
          Konturda {kirish.foyd === 'bog' ? "bog'" : kirish.foyd} mavjud va u saqlanadi. Quyidagi ekinlar{' '}
          <span className="font-medium">qatorlar orasiga</span> ekish uchun tavsiya etiladi.
        </div>
      )}
      {mos.length === 0 && (
        <div className="px-2 py-8 text-center text-[12px] text-muted">
          Bu konturga mos ekin topilmadi.
          <div className="mt-1 text-[11px] text-faint">
            {nomos[0]?.radSabab ?? "Shart-sharoit qishloq xo'jaligiga yaroqsiz"}
          </div>
        </div>
      )}

      {MAVSUMLAR.map(([msm, nom]) => {
        const list = mos.filter((t) => mavsum(t.crop) === msm).slice(0, 5)
        if (!list.length) return null
        return (
          <div key={msm} className="mb-2.5">
            <div className="mb-1 flex items-center gap-1.5 px-2.5">
              <span className="text-[11.5px] font-semibold text-navy">{nom}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="space-y-0.5">
              {list.map((t, i) => (
                <div key={t.crop.id} className="flex items-start gap-1.5">
                  <span className="nums mt-2 w-3.5 shrink-0 text-right text-[11px] text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <TavsiyaQator
                      t={t}
                      ochiq={ochiq === t.crop.id}
                      taxminiy={kirish.tuproqYoq}
                      onToggle={() => setOchiq(ochiq === t.crop.id ? null : t.crop.id)}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )
      })}

      {nomos.length > 0 && (
        <div className="mt-3 border-t border-line px-2.5 pt-2.5">
          <div className="mb-1.5 text-[11.5px] font-semibold text-muted">Mos kelmaydi ({nomos.length})</div>
          <div className="flex flex-wrap gap-1">
            {nomos.slice(0, 10).map((t) => (
              <span
                key={t.crop.id}
                title={t.radSabab ?? ''}
                className="cursor-help rounded-full bg-sunken px-2 py-0.5 text-[11.5px] text-muted"
              >
                {t.crop.nom}
              </span>
            ))}
          </div>
          {mos.length > 0 && nomos[0]?.radSabab && (
            <div className="mt-1.5 text-[10.5px] text-faint">
              Asosiy sabab: {nomos[0].radSabab.toLowerCase()}
            </div>
          )}
        </div>
      )}
    </>
  )
}
