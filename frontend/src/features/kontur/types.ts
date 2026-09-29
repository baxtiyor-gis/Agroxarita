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

/** Agrokimyo ko'rsatkichi (kontur bilan eng so'nggi yil ichida eng katta kesishuv) */
export interface AgrokimyoQiymat {
  /** 1 juda kam … 5 juda ko'p */
  daraja: number | null
  daraja_nom: string | null
  /** masalan "101-200" (mg/kg) */
  gradatsiya: string | null
  yil: number
  qoplanish: number
}

/** Copernicus DEM bo'yicha (faqat sug'oriladigan konturlar uchun hisoblangan) */
export interface Relyef {
  balandlik: { min: number | null; ortacha: number | null; max: number | null }
  qiyalik: { ortacha: number | null; sinf: 'tekis' | 'yengil' | 'orta' | 'tik' | null; sinf_nom: string | null }
  yonalish: { kod: string | null; nom: string | null; gradus: number | null }
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
  agrokimyo?: { kaliy: AgrokimyoQiymat | null }
  relyef?: Relyef | null
  bbox: [number, number, number, number]
}
