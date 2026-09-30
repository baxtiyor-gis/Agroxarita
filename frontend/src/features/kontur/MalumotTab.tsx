import type { Kontur } from './types'
import { ga } from './format'
import { Satr } from './ui'

/** Konturning asosiy yer turlari — doim ko'rinadi (0 bo'lsa ham); kod — API `yer_turlari[].kod` */
const ASOSIY: { kod: string; nom: string }[] = [
  { kod: 'jami_qx_yeri', nom: 'Jami QX yeri' },
  { kod: 'jami_qx_sug_yeri', nom: "Jami QX sug'oriladigan yeri" },
  { kod: 'haydalma_yer_sug', nom: "Haydalma (sug'oriladigan)" },
  { kod: 'haydalma_lalmi', nom: 'Haydalma (lalmi)' },
  { kod: 'boglar_sug', nom: "Bog'lar (sug'oriladigan)" },
  { kod: 'tomarqa', nom: 'Tomorqa' },
]

/** Kontur raqami, maydoni, MFY, massiv, tuman, viloyat; tagida asosiy yer ma'lumotlari */
export function MalumotTab({ k }: { k: Kontur }) {
  const bor = new Map(k.yer_turlari.map((y) => [y.kod, y]))
  const asosiyKod = new Set(ASOSIY.map((a) => a.kod))
  const yerlar = [
    ...ASOSIY.map((a) => ({ kod: a.kod, nom: a.nom, maydon: bor.get(a.kod)?.maydon ?? 0 })),
    // qolgan 0 dan katta yer turlari
    ...k.yer_turlari.filter((y) => !asosiyKod.has(y.kod)),
  ]

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
