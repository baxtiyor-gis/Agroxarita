import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { ga } from './format'
import { almashlabOgoh, ekinTarixiMock, ekinYillarSoni } from './mock'
import { NamunaBelgi } from './ui'

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

/** V1 Ekinlar tabi — yillar bo'yicha ekin tarixi (vaqt chizig'i) */
export function EkinlarTab({ id, maydon }: { id: number; maydon: number }) {
  const tarix = ekinTarixiMock(id)
  const ogoh = almashlabOgoh(tarix)
  const borYil = tarix.filter((t) => t.ekinlar.length).length
  const turlar = new Set(tarix.flatMap((t) => t.ekinlar.map((e) => e.nom)))

  return (
    <div className="px-2.5 pb-1">
      <div className="pb-2">
        <NamunaBelgi />
      </div>
      <div className="grid grid-cols-3 gap-2">
        <Kichik nom="Ma'lumot bor" qiymat={`${borYil} / ${ekinYillarSoni}`} birlik="yil" />
        <Kichik nom="Ekin turlari" qiymat={String(turlar.size)} birlik="ta" />
        <Kichik
          nom={ogoh ? 'Ketma-ket ekilgan' : 'Almashlab ekish'}
          qiymat={ogoh ? `${ogoh.uzunlik} yil` : borYil >= 2 ? (turlar.size > 1 ? 'Bor' : "Yo'q") : '—'}
          ogoh={!!ogoh}
        />
      </div>

      {ogoh && (
        <div className="mt-3 flex items-start gap-2 rounded-lg border border-wheat/30 bg-wheat-soft px-3 py-2.5 text-[12px] leading-snug text-wheat">
          <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={2.2} />
          <span>
            <b className="font-semibold">
              {ogoh.uzunlik} yil ketma-ket ({ogoh.yillar[0]}–{ogoh.yillar[1]}) {ogoh.ekin}
            </b>{' '}
            — tuproq charchashi va kasallik xavfi. Almashlab ekish tavsiya etiladi.
          </span>
        </div>
      )}

      {/* Vaqt chizig'i — eng yangi yil tepada */}
      <ol className="relative mt-4 ml-1.5">
        <span className="absolute top-2 bottom-2 left-[5px] w-px bg-line" aria-hidden />
        {[...tarix].reverse().map(({ yil, ekinlar: l }) => {
          const asosiy = l[0]
          return (
            <li key={yil} className="relative pb-4 pl-6 last:pb-1">
              <span
                className={cn(
                  'absolute top-1 left-0 size-[11px] rounded-full ring-2 ring-surface',
                  !asosiy && 'bg-line-strong',
                )}
                style={asosiy ? { background: asosiy.rang } : undefined}
              />
              <div className="flex items-baseline justify-between gap-2">
                <span className="nums text-[13px] font-semibold text-navy">{yil}</span>
                {l.length > 0 && (
                  <span className="nums text-[11.5px] text-muted">
                    {ga((maydon * Math.min(100, l.reduce((s, e) => s + e.ulush, 0))) / 100)} ga ekilgan
                  </span>
                )}
              </div>
              {l.length === 0 ? (
                <div className="mt-0.5 text-[12px] text-faint">Ma'lumot yo'q</div>
              ) : (
                <>
                  <div className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-sunken">
                    {l.map((e) => (
                      <span
                        key={e.nom}
                        className="h-full border-r border-surface last:border-r-0"
                        style={{ width: `${e.ulush}%`, background: e.rang }}
                        title={`${e.nom} — ${e.ulush} %`}
                      />
                    ))}
                  </div>
                  <div className="mt-1.5 space-y-1">
                    {l.map((e) => (
                      <div key={e.nom} className="flex items-center gap-2 text-[12.5px]">
                        <span
                          className="size-2.5 shrink-0 rounded-[3px] ring-1 ring-black/10"
                          style={{ background: e.rang }}
                        />
                        <span className="min-w-0 flex-1 truncate font-medium text-ink">{e.nom}</span>
                        <span className="nums shrink-0 text-[11.5px] text-muted">
                          {e.ulush} % · {ga((maydon * e.ulush) / 100)} ga
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
