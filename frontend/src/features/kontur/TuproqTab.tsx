import { AlertTriangle } from 'lucide-react'
import { cn } from '@/lib/cn'
import type { Kontur } from './types'
import { bosh } from './format'
import { Darajalar, Satr, Shkala } from './ui'

const AGRO = [
  { nom: 'Gumus', kalit: 'gumus', birlik: '%', soni: 6 },
  { nom: 'Fosfor', kalit: 'fosfor', birlik: 'mg/kg', soni: 5 },
  { nom: 'Kaliy', kalit: 'kaliy', birlik: 'mg/kg', soni: 5 },
] as const

/** V1 tuzilishi: Bonitet, Gumus, Fosfor, Kaliy, Mexanika, Sho'rlanish, Yer osti suvi.
 *  Hammasi API: tuproq (bonitet, mexanika, …) va agrokimyo (gumus, fosfor, kaliy). */
export function TuproqTab({ k }: { k: Kontur }) {
  const t = k.tuproq
  const ishonchsiz = t != null && t.qoplanish < 0.1
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

        {/* Agrokimyo — haqiqiy (eng so'nggi yil, eng katta kesishuv); qoplanish past bo'lsa xira.
            API darajasi 1 dan (gumus 1..6, fosfor/kaliy 1..5), Darajalar — 0 dan */}
        {AGRO.map(({ nom, kalit, birlik, soni }) => {
          const a = k.agrokimyo?.[kalit] ?? null
          return (
            <div key={kalit} className={cn(a != null && a.qoplanish < 0.1 && 'opacity-50')}>
              <Satr
                nom={nom}
                qiymat={
                  a?.daraja != null
                    ? [a.daraja_nom, a.gradatsiya && `${a.gradatsiya} ${birlik}`, a.yil].filter(Boolean).join(' · ')
                    : yoq
                }
              >
                {a?.daraja != null && (
                  <div className="mt-1.5">
                    <Darajalar daraja={a.daraja - 1} soni={soni} />
                  </div>
                )}
              </Satr>
            </div>
          )
        })}

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
