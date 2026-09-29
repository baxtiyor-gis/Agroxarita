import type { Kontur } from './types'
import { Satr } from './ui'

/** Kontur raqami, hudud, massiv, MFY */
export function MalumotTab({ k }: { k: Kontur }) {
  return (
    <div className="divide-y divide-line px-2.5">
      <Satr nom="Kontur raqami" qiymat={String(k.kontur_raqami)} />
      <Satr nom="Tuman" qiymat={k.tuman.nom} />
      <Satr nom="Viloyat" qiymat={k.viloyat.nom} />
      <Satr nom="Massiv" qiymat={k.massiv ?? '—'} />
      <Satr nom="MFY" qiymat={k.mfy ?? '—'} />
    </div>
  )
}
