import { attrs } from './data'

/**
 * Konturning iqlim ko'rsatkichlari — ERA5-Land (2016–2025).
 *
 * Manba: public/data/iqlim.json (ustunli, attrs.json col.id tartibida).
 * Fayl hali tayyor bo'lmasa — NAMUNA ma'lumot: Samarqand iqlim me'yorlari
 * balandlik bo'yicha tuzatilgan (−0,65 °C / 100 m). UI buni `namuna` bilan
 * ochiq ko'rsatadi.
 */
export interface Iqlim {
  namuna: boolean
  /** Oylik o'rtacha harorat, °C (12 ta) */
  harorat: number[]
  /** Oylik yog'in, mm */
  yogin: number[]
  /** Oylik bug'lanish talabi ET₀, mm */
  et0: number[]
  /** Oylik tuproq harorati (0–7 sm), °C */
  tuproqT: number[]
  /** Faol haroratlar yig'indisi (>10 °C kunlar o'rtacha haroratlari yig'indisi) */
  fah: number
  /** Sovuqsiz davr, kun */
  sovuqsiz: number
  /** Bahorgi oxirgi sovuq, yil kuni */
  bahorgiSovuq: number
  /** Kuzgi birinchi sovuq, yil kuni */
  kuzgiSovuq: number
  /** 10 yildan nechtasida oxirgi sovuq 10-apreldan keyin bo'lgan */
  kechSovuqYil: number
  /** Tmax ≥ 35 °C kunlar, yiliga */
  issiqKun: number
  /** Yillik eng past harorat (o'rtacha), °C */
  minT: number
  yillikYogin: number
  yillikEt0: number
  suvTanqislik: number
}

export const OYLAR = ['Yan', 'Fev', 'Mar', 'Apr', 'May', 'Iyun', 'Iyul', 'Avg', 'Sen', 'Okt', 'Noy', 'Dek']
const OY_KUN = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]

interface IqlimFayl {
  kontur: {
    id: number[]
    harorat: number[][]
    yogin: number[][]
    et0: number[][]
    tuproqT: number[][]
    fah: number[]
    sovuqsiz: number[]
    bahorgiSovuq: number[]
    kuzgiSovuq: number[]
    kechSovuqYil: number[]
    issiqKun: number[]
    minT: number[]
    yillikYogin: number[]
    yillikEt0: number[]
    suvTanqislik: number[]
  }
}

let fayl: IqlimFayl | null = null
let idIdx: Map<number, number> | null = null
let yuklash: Promise<void> | null = null

/** iqlim.json ni bir marta yuklashga urinadi; yo'q bo'lsa — namuna rejimi */
export function iqlimYukla(): Promise<void> {
  yuklash ??= fetch(`${import.meta.env.BASE_URL}data/iqlim.json`)
    .then((r) => (r.ok ? r.json() : null))
    .then((d: IqlimFayl | null) => {
      if (d?.kontur?.id?.length) {
        fayl = d
        idIdx = new Map(d.kontur.id.map((v, i) => [v, i]))
      }
    })
    // Fayl yo'q (index.html qaytadi → JSON xato) — namuna ishlatiladi
    .catch(() => {})
  return yuklash
}

/** Kontur indeksi bo'yicha iqlim; haqiqiy ma'lumot bo'lmasa — namuna */
export function iqlim(i: number): Iqlim {
  const p = attrs()
  const j = fayl && idIdx ? idIdx.get(p.col.id[i]) : undefined
  if (fayl && j !== undefined) {
    const k = fayl.kontur
    return {
      namuna: false,
      harorat: k.harorat[j],
      yogin: k.yogin[j],
      et0: k.et0[j],
      tuproqT: k.tuproqT[j],
      fah: k.fah[j],
      sovuqsiz: k.sovuqsiz[j],
      bahorgiSovuq: k.bahorgiSovuq[j],
      kuzgiSovuq: k.kuzgiSovuq[j],
      kechSovuqYil: k.kechSovuqYil[j],
      issiqKun: k.issiqKun[j],
      minT: k.minT[j],
      yillikYogin: k.yillikYogin[j],
      yillikEt0: k.yillikEt0[j],
      suvTanqislik: k.suvTanqislik[j],
    }
  }
  return namuna(p.col.balandlik[i])
}

// --------------------------------------------------------------- namuna
/** Samarqand (≈725 m) oylik me'yorlari — namuna uchun asos */
const ASOS_BALANDLIK = 725
const ASOS_T = [0.2, 2.5, 8.0, 14.5, 19.5, 24.5, 26.5, 24.8, 19.5, 12.8, 7.0, 2.0]
const ASOS_YOGIN = [45, 40, 68, 55, 28, 6, 3, 1, 3, 20, 32, 42]
const ASOS_ET0 = [15, 22, 48, 85, 135, 175, 195, 170, 120, 70, 32, 18]

function namuna(balandlik: number): Iqlim {
  const h = balandlik >= 0 ? balandlik : ASOS_BALANDLIK
  const dh = h - ASOS_BALANDLIK
  const dT = -0.0065 * dh
  const harorat = ASOS_T.map((t) => r1(t + dT))
  // Baland joyda yog'in biroz ko'p, bug'lanish biroz kam
  const yogin = ASOS_YOGIN.map((y) => Math.round(y * (1 + dh / 2500)))
  const et0 = ASOS_ET0.map((e) => Math.round(e * (1 - dh / 4000)))
  const tuproqT = harorat.map((t) => r1(t + (t > 5 ? 1.5 : 0.5)))
  const fah = Math.round(harorat.reduce((s, t, m) => s + (t > 10 ? t * OY_KUN[m] : 0), 0))
  const yillikYogin = yogin.reduce((a, b) => a + b, 0)
  const yillikEt0 = et0.reduce((a, b) => a + b, 0)
  const bahorgiSovuq = Math.round(88 + dh * 0.035)
  const kuzgiSovuq = Math.round(305 - dh * 0.035)
  return {
    namuna: true,
    harorat,
    yogin,
    et0,
    tuproqT,
    fah,
    sovuqsiz: kuzgiSovuq - bahorgiSovuq,
    bahorgiSovuq,
    kuzgiSovuq,
    kechSovuqYil: Math.max(0, Math.min(10, Math.round(2 + dh / 120))),
    issiqKun: r1(Math.max(0, 42 - dh * 0.09)),
    minT: r1(-13 + dT),
    yillikYogin,
    yillikEt0,
    suvTanqislik: yillikEt0 - yillikYogin,
  }
}

const r1 = (v: number) => Math.round(v * 10) / 10

// ------------------------------------------------------------ yordamchi
/** Yil kunini "12-apr" ko'rinishiga */
export function kunSana(doy: number): string {
  const oylar = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek']
  let d = Math.round(doy)
  for (let m = 0; m < 12; m++) {
    if (d <= OY_KUN[m]) return `${d}-${oylar[m]}`
    d -= OY_KUN[m]
  }
  return '—'
}

/** Tuproq harorati birinchi marta ≥ chegara bo'ladigan oy */
export function tuproqIsishOyi(t: number[], chegara = 12): string | null {
  const m = t.findIndex((v, i) => i >= 1 && i <= 6 && v >= chegara)
  return m >= 0 ? OYLAR[m] : null
}
