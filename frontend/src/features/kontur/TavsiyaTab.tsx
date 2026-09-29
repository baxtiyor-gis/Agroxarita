import { useState } from 'react'
import { AlertTriangle, Ban, Check, ChevronDown, Droplets } from 'lucide-react'
import { cn } from '@/lib/cn'
import { MAVSUM_NOM, ballNom, ballRang, tavsiyaMock, type Mavsum, type Sabab, type Tavsiya } from './mock'
import { NamunaBelgi } from './ui'

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

function TavsiyaQator({ t, ochiq, onToggle }: { t: Tavsiya; ochiq: boolean; onToggle: () => void }) {
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
        <span className="flex-1 truncate text-[13px] font-medium text-ink">{t.nom}</span>
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
            {t.muddat}
          </div>
          <div className="flex gap-1 text-[11px] text-muted">
            <Droplets className="mt-[2px] size-3 shrink-0 text-water" strokeWidth={2} />
            {t.suv}
          </div>
        </div>
      )}
    </div>
  )
}

/** V1 Tavsiya tabi: mavsum bo'yicha guruhlangan ekinlar (ball, sabablar), pastda "Mos kelmaydi" */
export function TavsiyaTab({ id }: { id: number }) {
  const [ochiq, setOchiq] = useState<string | null>(null)
  const tav = tavsiyaMock(id)
  const mos = tav.filter((t) => t.ball >= 25)
  const nomos = tav.filter((t) => t.ball < 25)

  return (
    <>
      <div className="px-2.5 pb-2">
        <NamunaBelgi />
      </div>
      {mos.length === 0 && (
        <div className="px-2 py-8 text-center text-[12px] text-muted">
          Bu konturga mos ekin topilmadi.
          <div className="mt-1 text-[11px] text-faint">
            {nomos[0]?.radSabab ?? "Shart-sharoit qishloq xo'jaligiga yaroqsiz"}
          </div>
        </div>
      )}

      {MAVSUMLAR.map(([msm, nom]) => {
        const list = mos.filter((t) => t.mavsum === msm).slice(0, 5)
        if (!list.length) return null
        return (
          <div key={msm} className="mb-2.5">
            <div className="mb-1 flex items-center gap-1.5 px-2.5">
              <span className="text-[11.5px] font-semibold text-navy">{nom}</span>
              <span className="h-px flex-1 bg-line" />
            </div>
            <div className="space-y-0.5">
              {list.map((t, i) => (
                <div key={t.id} className="flex items-start gap-1.5">
                  <span className="nums mt-2 w-3.5 shrink-0 text-right text-[11px] text-faint">{i + 1}</span>
                  <div className="min-w-0 flex-1">
                    <TavsiyaQator
                      t={t}
                      ochiq={ochiq === t.id}
                      onToggle={() => setOchiq(ochiq === t.id ? null : t.id)}
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
                key={t.id}
                title={t.radSabab ?? ''}
                className="cursor-help rounded-full bg-sunken px-2 py-0.5 text-[11.5px] text-muted"
              >
                {t.nom}
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
