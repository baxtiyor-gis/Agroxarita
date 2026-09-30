import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ekinRangi } from '@/features/map/tematik'
import { ga } from './format'
import type { EkinQator } from './types'

/** Bazadagi ekin yillari (Crop_2026, Crop_2025) — eng yangisi tepada */
const YILLAR = [2026, 2025]

function Kichik({ nom, qiymat, birlik, ogoh }: { nom: string; qiymat: string; birlik?: string; ogoh?: boolean }) {
  return (
    <div className={cn('rounded-lg border px-2.5 py-2', ogoh ? 'border-wheat/30 bg-wheat-soft' : 'border-line bg-sunken/60')}>
      <div className="text-[10.5px] leading-tight text-muted">{nom}</div>
      <div className={cn('nums mt-1 text-[15px] leading-none font-semibold', ogoh ? 'text-wheat' : 'text-ink')}>
        {qiymat}
        {birlik && <span className="ml-1 text-[10.5px] font-normal text-muted">{birlik}</span>}
      </div>
    </div>
  )
}

/** V1 Ekinlar tabi — bazadagi ekinlar (API `ekinlar`), yillar bo'yicha vaqt chizig'i */
export function EkinlarTab({ maydon, ekinlar }: { id: number; maydon: number; ekinlar: EkinQator[] }) {
  const tarix = YILLAR.map((yil) => ({ yil, l: ekinlar.filter((e) => e.yil === yil) }))
  const borYil = tarix.filter((t) => t.l.length).length
  const turlar = new Set(ekinlar.map((e) => e.kod))
  // ketma-ket yillarda bir xil asosiy ekin — almashlab ekilmagan
  const asosiylar = tarix.map((t) => t.l.find((e) => e.asosiy))
  const takror = asosiylar[0] != null && asosiylar[0].kod === asosiylar[1]?.kod ? asosiylar[0] : null
  const ulush = (m: number) => (maydon > 0 ? Math.min(100, (m / maydon) * 100) : 0)

  return (
    <div className="px-2.5 pb-1">
      <div className="grid grid-cols-3 gap-2">
        <Kichik nom="Ma'lumot bor" qiymat={`${borYil} / ${YILLAR.length}`} birlik="yil" />
        <Kichik nom="Ekin turlari" qiymat={String(turlar.size)} birlik="ta" />
        <Kichik
          nom={takror ? 'Ketma-ket ekilgan' : 'Almashlab ekish'}
          qiymat={takror ? `${YILLAR.length} yil` : borYil >= 2 ? 'Bor' : '—'}
          ogoh={!!takror}
        />
      </div>

      {takror && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-wheat/30 bg-wheat-soft px-3 py-2.5 text-[12px] leading-snug text-wheat">
          <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={2.2} />
          <span>
            <b className="font-semibold">
              {YILLAR.length} yil ketma-ket ({YILLAR[YILLAR.length - 1]}–{YILLAR[0]}) {takror.nom}
            </b>{' '}
            — tuproq charchashi va kasallik xavfi. Almashlab ekish tavsiya etiladi.
          </span>
        </div>
      )}

      {/* Vaqt chizig'i — eng yangi yil tepada */}
      <ol className="relative mt-4 ml-1.5">
        <span className="absolute top-2 bottom-2 left-[5px] w-px bg-line" aria-hidden />
        {tarix.map(({ yil, l }) => {
          const asosiy = l.find((e) => e.asosiy) ?? l[0]
          const jami = l.reduce((s, e) => s + e.maydon, 0)
          return (
            <li key={yil} className="relative pb-4 pl-6 last:pb-1">
              <span
                className={cn('absolute top-1 left-0 size-[11px] rounded-full ring-2 ring-surface', !asosiy && 'bg-line-strong')}
                style={asosiy ? { background: ekinRangi(asosiy.kod) } : undefined}
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="nums text-[13px] font-semibold text-navy">{yil}</span>
                {l.length > 0 && <span className="nums text-[11.5px] text-muted">{ga(jami)} ga ekilgan</span>}
              </div>
              {l.length === 0 ? (
                <div className="mt-0.5 text-[12px] text-faint">Boshqa</div>
              ) : (
                <>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-sunken">
                    {l.map((e) => (
                      <span
                        key={e.kod}
                        className="h-full border-r border-surface last:border-r-0"
                        style={{ width: `${ulush(e.maydon)}%`, background: ekinRangi(e.kod) }}
                        title={`${e.nom} — ${ulush(e.maydon).toFixed(0)} %`}
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {l.map((e) => (
                      <div key={e.kod} className="flex items-center gap-2 text-[12.5px]">
                        <span
                          className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-black/10"
                          style={{ background: ekinRangi(e.kod) }}
                        />
                        <span className={cn('min-w-0 flex-1 truncate text-ink', e.asosiy ? 'font-semibold' : 'font-medium')}>
                          {e.nom}
                        </span>
                        <span className="nums shrink-0 text-[11.5px] text-muted">
                          {ulush(e.maydon).toFixed(0)} % · {ga(e.maydon)} ga
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
