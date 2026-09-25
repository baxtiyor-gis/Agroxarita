import type { EkinYil } from './data'

export interface Crop {
  id: string
  nom: string
  nom_kr: string
  guruh: 'boshoqli' | 'texnika' | 'dukkakli' | 'sabzavot' | 'poliz' | 'yem' | 'kopyillik' | 'boshqa'
  bonitet_min: number
  bonitet_max: number
  /** 0 = chidamsiz, 1 = past-o'rtacha, 2 = o'rtacha, 3 = yuqori */
  shor_chidam: number
  suv_min: number | null
  suv_max: number | null
  tur: string | null
  muddat: string | null
  shor_matn: string | null
  bonitet_matn: string | null
  urugmeyor: string | null
  suv_matn: string | null
  ogit: { azot: string | null; fosfor: string | null; kaliy: string | null }
  tayyorlash: {
    shudgor: string | null
    tekislash: string | null
    shoryuvish: string | null
    bahorgi: string | null
  }
  parvarish: string | null
  hosil: string | null
  himoya: { begona_ot: string | null; kasallik: string | null; zararkunanda: string | null }
}

/** Ustunli saqlash — 9257 obyekt uchun obyektlar massividan ~4x ixcham */
export interface AttrPack {
  n: number
  lug: { massiv: string[]; mfy: string[]; grad: string[]; foyd: string[]; ekin?: string[] }
  col: {
    id: number[]
    kod: string[]
    massiv: number[]
    mfy: number[]
    maydon: number[]
    /** 2 = sug'oriladigan, 1 = lalmi, 0 = qx emas */
    sug: number[]
    foyd: number[]
    bonitet: number[]
    mex: number[]
    shor: number[]
    yos: number[]
    /** 0..4 daraja, -1 = ma'lumot yo'q */
    gumus: number[]
    gumusg: number[]
    fosfor: number[]
    fosforg: number[]
    kaliy: number[]
    kaliyg: number[]
    /** 3 = yuqori, 2 = o'rta, 1 = past, 0 = bog'lanmagan */
    sifat: number[]
    balandlik: number[]
    qiyalik: number[]
    yonalish: number[]
    /** Yil ekinlari (ekin_20XX bilan intersect): [[lug.ekin indeksi, ulush %], ...] */
    ekin22?: [number, number][][]
    ekin23?: [number, number][][]
    ekin24?: [number, number][][]
    ekin25?: [number, number][][]
    ekin26?: [number, number][][]
  }
}

/** Bitta kontur — ustunlardan yig'ilgan ko'rinish */
export interface Kontur {
  i: number
  id: number
  kod: string
  massiv: string | null
  mfy: string | null
  maydon: number
  sug: number
  foyd: string
  bonitet: number
  mex: number
  shor: number
  yos: string | null
  gumus: number
  gumusg: string | null
  fosfor: number
  fosforg: string | null
  kaliy: number
  kaliyg: string | null
  sifat: number
  balandlik: number
  qiyalik: number
  yonalish: number
  /** Yillar bo'yicha ekilgan ekinlar (2022–2026) — ulush kamayish tartibida */
  ekin: Record<EkinYil, { nom: string; ulush: number }[]>
}

export type SababTuri = 'ok' | 'ogoh' | 'xato'

export interface Sabab {
  turi: SababTuri
  matn: string
}

export interface Tavsiya {
  crop: Crop
  ball: number
  sabablar: Sabab[]
  /** Nega mos emas — 0 ball bo'lganda */
  radSabab: string | null
}
