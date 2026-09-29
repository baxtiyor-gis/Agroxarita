import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import { DARAJA_NOM, agrokimyoMock } from './mock'
import type { Kontur } from './types'
import { bosh } from './format'
import { Darajalar, Satr, Shkala } from './ui'

/** V1 tuzilishi: Bonitet, Gumus, Fosfor, Kaliy, Mexanika, Sho'rlanish, Yer osti suvi.
 *  Bonitet/mexanika/sho'rlanish/yer osti suvi — API; gumus/fosfor/kaliy — namuna. */
export function TuproqTab({ k }: { k: Kontur }) {
  const t = k.tuproq
  const ishonchsiz = t != null && t.qoplanish < 0.1
  const agro = agrokimyoMock(k.id)
  const yoq = "Ma'lumot yo'q"

  return (
    <>
      {(t == null || ishonchsiz) && (
        <div className="mx-2.5 mb-2 flex items-start gap-2 rounded-lg border border-wheat/30 bg-wheat-soft px-3 py-2.5 text-[12px] leading-snug text-wheat">
          <AlertTriangle className="mt-px size-4 shrink-0" strokeWidth={2.2} />
          <span>
            {t == null
              ? "Tuproq ma'lumoti yo'q — kontur tuproq xaritasi bilan kesishmaydi."
              : `Tuproq ma'lumoti ishonchsiz (qoplanish ${(t.qoplanish * 100).toFixed(0)} %) — qiymatlar konturning kichik qismi uchun.`}
          </span>
        </div>
      )}

      <div className="divide-y divide-line px-2.5">
        <div className={cn(ishonchsiz && 'opacity-50')}>
          <Satr nom="Bonitet" qiymat={t?.bonitet != null ? `${t.bonitet} ball` : "O'rganilmagan"}>
            {t?.bonitet != null && (
              <div className="mt-1.5 pr-1">
                <Shkala qiymat={t.bonitet} min={35} max={85} />
                <div className="nums mt-1 flex justify-between text-[9.5px] text-faint">
                  <span>35</span>
                  <span>85</span>
                </div>
              </div>
            )}
          </Satr>
        </div>

        {(
          [
            ['Gumus', agro.gumus],
            ['Fosfor', agro.fosfor],
            ['Kaliy', agro.kaliy],
          ] as const
        ).map(([nom, a]) => (
          <Satr key={nom} nom={nom} qiymat={`${DARAJA_NOM[a.daraja]} · ${a.grad}`} namuna>
            <div className="mt-1.5">
              <Darajalar daraja={a.daraja} />
            </div>
          </Satr>
        ))}

        <div className={cn('divide-y divide-line', ishonchsiz && 'opacity-50')}>
          <Satr nom="Mexanika" qiymat={bosh(t?.mexanika) ?? yoq} />
          <Satr nom="Sho'rlanish" qiymat={bosh(t?.shorlanish) ?? yoq} />
          <Satr nom="Yer osti suvi" qiymat={t?.yer_osti_suvi ? `${t.yer_osti_suvi} m` : yoq} />
          <Satr nom="Yuvilish" qiymat={bosh(t?.yuvilish) ?? yoq} />
          <Satr nom="Toshlanish" qiymat={bosh(t?.toshlanish) ?? yoq} />
          <Satr nom="Klass" qiymat={t?.klass ?? yoq} />
          <Satr nom="Qoplanish" qiymat={t ? `${(t.qoplanish * 100).toFixed(0)} %` : yoq}>
            {t && (
              <div className="mt-1.5 pr-1">
                <Shkala qiymat={t.qoplanish * 100} min={0} max={100} />
              </div>
            )}
          </Satr>
        </div>
      </div>
    </>
  )
}
