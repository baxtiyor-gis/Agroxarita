import type { Kontur } from './types'
import { ga } from './format'
import { Satr } from './ui'

/** Kontur raqami, maydoni, MFY, massiv, tuman, viloyat; tagida asosiy yer ma'lumotlari (0 dan katta yer turlari) */
export function MalumotTab({ k }: { k: Kontur }) {
  // jami qatorlar (Jami QX yeri, Jami sug'oriladigan) — birinchi
  const yerlar = [...k.yer_turlari.filter((y) => y.jami), ...k.yer_turlari.filter((y) => !y.jami)]

  return (
    <>
      <div className="divide-y divide-line px-2.5">
        <Satr nom="Kontur raqami" qiymat={String(k.kontur_raqami)} />
        <Satr nom="Maydoni" qiymat={`${ga(k.maydon)} ga`} />
        <Satr nom="MFY" qiymat={k.mfy ?? '—'} />
        <Satr nom="Massiv" qiymat={k.massiv ?? '—'} />
        <Satr nom="Tuman" qiymat={k.tuman.nom} />
        <Satr nom="Viloyat" qiymat={k.viloyat.nom} />
      </div>

      <div className="mt-3 border-t border-line px-2.5 pt-2.5">
        <div className="px-1 pb-1 text-[11.5px] font-semibold text-navy">Asosiy yer ma'lumotlari</div>
        {yerlar.length === 0 ? (
          <div className="px-1 py-2 text-[12px] text-faint">Ma'lumot yo'q</div>
        ) : (
          <div className="divide-y divide-line">
            {yerlar.map((y) => (
              <Satr key={y.kod} nom={y.nom} qiymat={`${ga(y.maydon)} ga`} />
            ))}
          </div>
        )}
      </div>
    </>
  )
}
