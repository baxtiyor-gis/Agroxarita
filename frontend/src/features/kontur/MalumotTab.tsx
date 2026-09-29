import type { Kontur } from './types'
import { TUR_NOMI, ga } from './format'
import { Satr } from './ui'

/** V1: Kontur raqami, Massiv, MFY (+ API dan qo'shimcha identifikator/hudud qatorlari va yer turlari) */
export function MalumotTab({ k }: { k: Kontur }) {
  const oddiy = k.yer_turlari.filter((y) => !y.jami)
  const jami = k.yer_turlari.filter((y) => y.jami)
  const ulush = (m: number) => (k.maydon > 0 ? `${((m / k.maydon) * 100).toFixed(1)} %` : '—')

  return (
    <>
      <div className="divide-y divide-line px-2.5">
        <Satr nom="Kontur raqami" qiymat={String(k.kontur_raqami)} />
        <Satr nom="Yagona kontur" qiymat={k.yagona_kontur} />
        <Satr nom="ID" qiymat={String(k.id)} />
        <Satr nom="Tuman" qiymat={k.tuman.nom} />
        <Satr nom="Viloyat" qiymat={k.viloyat.nom} />
        <Satr nom="Massiv" qiymat={k.massiv ?? '—'} />
        <Satr nom="MFY" qiymat={k.mfy ?? '—'} />
        <Satr nom="Tur" qiymat={TUR_NOMI[k.tur] ?? k.tur} />
      </div>

      <div className="mt-3 border-t border-line px-2.5 pt-2.5">
        <div className="mb-1.5 text-[11.5px] font-semibold text-navy">Yer turlari</div>
        {k.yer_turlari.length === 0 ? (
          <div className="text-[12px] text-faint">Ma'lumot yo'q</div>
        ) : (
          <div className="nums text-[12.5px]">
            <div className="flex gap-2 pb-1 text-[10.5px] text-muted">
              <span className="flex-1">Nom</span>
              <span className="w-16 text-right">ga</span>
              <span className="w-14 text-right">Ulush</span>
            </div>
            <div className="divide-y divide-line">
              {oddiy.map((y) => (
                <div key={y.kod} className="flex gap-2 py-1.5">
                  <span className="min-w-0 flex-1 text-body">{y.nom}</span>
                  <span className="w-16 text-right text-ink">{ga(y.maydon)}</span>
                  <span className="w-14 text-right text-muted">{ulush(y.maydon)}</span>
                </div>
              ))}
            </div>
            {jami.length > 0 && (
              <div className="mt-1 divide-y divide-line border-t border-line-strong">
                {jami.map((y) => (
                  <div key={y.kod} className="flex gap-2 py-1.5 font-semibold">
                    <span className="min-w-0 flex-1 text-navy">{y.nom}</span>
                    <span className="w-16 text-right text-navy">{ga(y.maydon)}</span>
                    <span className="w-14 text-right text-navy">{ulush(y.maydon)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  )
}
