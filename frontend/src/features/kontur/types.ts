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
  /** fosfor — yilsiz (null) */
  yil: number | null
  qoplanish: number
}

/** Copernicus DEM bo'yicha (faqat sug'oriladigan konturlar uchun hisoblangan) */
export interface Relyef {
  balandlik: { min: number | null; ortacha: number | null; max: number | null }
  qiyalik: { ortacha: number | null; sinf: 'tekis' | 'yengil' | 'orta' | 'tik' | null; sinf_nom: string | null }
  yonalish: { kod: string | null; nom: string | null; gradus: number | null }
}

/** Kontur bilan bog'langan ekin (yil kamayish, maydon kamayish tartibida) */
export interface EkinQator {
  yil: number
  kod: number
  nom: string
  /** ga */
  maydon: number
  /** shu yilda konturdagi eng katta jami maydonli ekin */
  asosiy: boolean
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
  agrokimyo?: {
    kaliy: AgrokimyoQiymat | null
    fosfor: AgrokimyoQiymat | null
    gumus: AgrokimyoQiymat | null
  }
  relyef?: Relyef | null
  ekinlar?: EkinQator[]
  bbox: [number, number, number, number]
}

export interface IqlimEkstremum {
  yil: number
  qiymat: number
}

/** Yillik ko'rsatkichlar; qisman yilda (`toliq: false`) fah/sovuqsiz/sovuq sanalari null */
export interface IqlimYil {
  yil: number
  fah: number | null
  sovuqsiz: number | null
  /** yil kuni (1..366), sovuq bo'lmasa null */
  bahorgi_sovuq: number | null
  kuzgi_sovuq: number | null
  issiq_kun: number | null
  min_t: number | null
  yogin: number | null
  et0: number | null
  t_ort: number | null
  toliq: boolean
}

/** GET /api/konturlar/{id}/iqlim/ (ERA5-Land katagi bo'yicha; 404 — katak yo'q) */
export interface Iqlim {
  katak: { id: number; lat: number; lon: number; balandlik: number | null }
  /** [birinchi yil, oxirgi yil] */
  davr: [number, number]
  yillar: number[]
  /** to'liq yillar o'rtachasi */
  korsatkich: {
    fah: number | null
    sovuqsiz: number | null
    bahorgi_sovuq: number | null
    kuzgi_sovuq: number | null
    issiq_kun: number | null
    min_t: number | null
    kech_sovuq_yillar: number
  }
  yillik: IqlimYil[]
  oylik_ortacha: { oy: number; t_ort: number | null; yogin: number | null; et0: number | null }[]
  yillar_oylar: { yil: number; oylar: { oy: number; t_ort: number | null; yogin: number | null }[] }[]
  suv_balansi: { yogin: number; et0: number; tanqislik: number }
  xavf: {
    eng_issiq: IqlimEkstremum | null
    eng_sovuq: IqlimEkstremum | null
    eng_nam: IqlimEkstremum | null
    eng_quruq: IqlimEkstremum | null
  }
}
