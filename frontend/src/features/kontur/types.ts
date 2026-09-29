export type KonturTur = 'sugoriladigan' | 'aniqlanmagan'

export interface YerTuri {
  kod: string
  nom: string
  /** ga */
  maydon: number
  /** yig'indi qator — boshqa turlarning yig'indisi */
  jami: boolean
}

export interface Tuproq {
  bonitet: number | null
  mexanika: string | null
  shorlanish: string | null
  yuvilish: string | null
  toshlanish: string | null
  klass: string | null
  yer_osti_suvi: string | null
  /** 0..1 — kontur maydonining tuproq bilan qoplangan ulushi */
  qoplanish: number
}

/** GET /api/konturlar/{id}/ */
export interface Kontur {
  id: number
  kontur_raqami: number
  yagona_kontur: string
  maydon: number
  tur: KonturTur
  tuman: { kod: number; nom: string }
  viloyat: { region_id: number; nom: string }
  massiv: string | null
  mfy: string | null
  yer_turlari: YerTuri[]
  tuproq: Tuproq | null
  bbox: [number, number, number, number]
}
