import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Tematik ranglash (V1 `old/src/lib/ranglar.ts`): klasslangan shkala.
 * Kontur MVT atributlari: bonitet (ball), shorlanish (1-5), gumus (1-6), fosfor (1-5),
 * kaliy (1-5), balandlik (m). Atribut yo'q = ma'lumot yo'q.
 */
export type TematikId = 'bonitet' | 'shorlanish' | 'gumus' | 'fosfor' | 'kaliy' | 'balandlik'

export interface Klass {
  /** Quyi chegara (shu qiymatdan boshlab shu klass) */
  min: number
  /** Yuqori chegara (kiritilmaydi), oxirgi klassda Infinity */
  max: number
  rang: string
  nom: string
  /** Legendada ko'rsatiladigan diapazon matni */
  oraliq?: string
}

export interface Shkala {
  nom: string
  izoh: string
  /** MVT atribut nomi */
  atribut: TematikId
  klasslar: Klass[]
}

export const YOQ_RANG = '#b9bfb6'
export const YOQ_NOM = "Ma'lumot yo'q"

/** Tematik rejimda kontur chizig'i: sputnikda oq, OSMda to'q yashil-kulrang (V1) */
export const CHIZIQ_SPUTNIK = '#ffffff'
export const CHIZIQ_OSM = '#2b3a30'

const BONITET: Klass[] = [
  { min: -Infinity, max: 41, rang: '#fff8d6', nom: 'Juda past', oraliq: '< 41' },
  { min: 41, max: 51, rang: '#dbeda0', nom: 'Past', oraliq: '41–50' },
  { min: 51, max: 61, rang: '#a2d47f', nom: "O'rtacha", oraliq: '51–60' },
  { min: 61, max: 71, rang: '#55ab5c', nom: 'Yaxshi', oraliq: '61–70' },
  { min: 71, max: Infinity, rang: '#1c7a3e', nom: 'Yuqori', oraliq: '71+' },
]

/** Agrokimyo darajalari (1..5) — uch ko'rsatkich uchun bir xil palitra */
const DARAJA: Klass[] = [
  { min: -Infinity, max: 2, rang: '#fff8d6', nom: 'Juda kam' },
  { min: 2, max: 3, rang: '#dbeda0', nom: 'Kam' },
  { min: 3, max: 4, rang: '#a2d47f', nom: "O'rtacha" },
  { min: 4, max: 5, rang: '#55ab5c', nom: "Ko'p" },
  { min: 5, max: Infinity, rang: '#1c7a3e', nom: "Juda ko'p" },
]

/** Gumus — 6 daraja (backend: Ko'proq qo'shilgan, eng yuqorisi "Yuqori"); 6-rang V1 da yo'q — to'qroq yashil qo'shildi */
const GUMUS: Klass[] = [
  { min: -Infinity, max: 2, rang: '#fff8d6', nom: 'Juda kam' },
  { min: 2, max: 3, rang: '#dbeda0', nom: 'Kam' },
  { min: 3, max: 4, rang: '#a2d47f', nom: "O'rtacha" },
  { min: 4, max: 5, rang: '#55ab5c', nom: "Ko'proq" },
  { min: 5, max: 6, rang: '#1c7a3e', nom: "Ko'p" },
  { min: 6, max: Infinity, rang: '#0e5028', nom: 'Yuqori' },
]

/** Sho'rlanish — teskari: yuqori = yomon, issiq palitra (1..5) */
const SHOR: Klass[] = [
  { min: -Infinity, max: 2, rang: '#f2f6ee', nom: "Sho'rlanmagan" },
  { min: 2, max: 3, rang: '#fcd9a8', nom: 'Kuchsiz' },
  { min: 3, max: 4, rang: '#f2a465', nom: "O'rtacha" },
  { min: 4, max: 5, rang: '#d96a4a', nom: 'Kuchli' },
  { min: 5, max: Infinity, rang: '#9e3535', nom: "Sho'rxok" },
]

/** Balandlik (DEM) — namuna ranglari; haqiqiy chegaralar tuman bo'yicha backenddan (`/relyef/`) */
export const BALANDLIK_RANGLAR = ['#4b8c5a', '#9cbd6c', '#e2cc84', '#c99a63', '#9a6a4c']
const BALANDLIK_NOMLAR = ['Eng past', 'Past', "O'rtacha", 'Baland', 'Eng baland']

const BALANDLIK: Klass[] = BALANDLIK_RANGLAR.map((rang, i) => ({
  min: i,
  max: i + 1,
  rang,
  nom: BALANDLIK_NOMLAR[i],
}))

export const SHKALA: Record<TematikId, Shkala> = {
  bonitet: { nom: 'Tuproq boniteti', izoh: 'ball', atribut: 'bonitet', klasslar: BONITET },
  shorlanish: { nom: "Sho'rlanish", izoh: 'daraja', atribut: 'shorlanish', klasslar: SHOR },
  gumus: { nom: 'Gumus', izoh: 'chirindi miqdori', atribut: 'gumus', klasslar: GUMUS },
  fosfor: { nom: 'Fosfor', izoh: 'P₂O₅', atribut: 'fosfor', klasslar: DARAJA },
  kaliy: { nom: 'Kaliy', izoh: 'K₂O', atribut: 'kaliy', klasslar: DARAJA },
  balandlik: { nom: 'Balandlik (DEM)', izoh: 'dengiz sathidan, m', atribut: 'balandlik', klasslar: BALANDLIK },
}

/** Radio ro'yxat: bo'lim sarlavhasi bilan */
export const TEMATIK_GURUHLAR: { nom: string; idlar: TematikId[] }[] = [
  { nom: 'Tuproq', idlar: ['bonitet', 'shorlanish'] },
  { nom: 'Agrokimyo', idlar: ['gumus', 'fosfor', 'kaliy'] },
  { nom: 'Relyef', idlar: ['balandlik'] },
]

/** Balandlik (DEM) — raster; kontur fill rang olmaydi */
export const rasterTematikmi = (id: TematikId | null) => id === 'balandlik'

/** Legenda / radio swatch uchun: klass ranglaridan diskret gradient (V1: teng bo'laklar) */
export function gradient(klasslar: { rang: string }[]): string {
  const n = klasslar.length
  const bolak = klasslar.map((k, i) => `${k.rang} ${(i / n) * 100}% ${((i + 1) / n) * 100}%`)
  return `linear-gradient(to right, ${bolak.join(', ')})`
}

/** Kontur fill rangi: atribut yo'q -> YOQ_RANG, aks holda klass chegaralari bo'yicha `step` */
export function rangIfoda(id: TematikId): ExpressionSpecification {
  const { atribut, klasslar } = SHKALA[id]
  const step: unknown[] = ['step', ['get', atribut], klasslar[0].rang]
  for (let i = 1; i < klasslar.length; i++) step.push(klasslar[i].min, klasslar[i].rang)
  return ["case", ["has", atribut], step, YOQ_RANG] as unknown as ExpressionSpecification
}

/**
 * Legenda klassi filtri: klassIdx >= 0 — shu klass; YOQ_KLASS — ma'lumotsizlar; null — filtr yo'q.
 */
export const YOQ_KLASS = -2

export function klassFiltri(id: TematikId, klassIdx: number | null): ExpressionSpecification | null {
  if (klassIdx == null) return null
  const { atribut, klasslar } = SHKALA[id]
  if (klassIdx === YOQ_KLASS) return ['!', ['has', atribut]] as ExpressionSpecification
  const k = klasslar[klassIdx]
  if (!k) return null
  const shartlar: unknown[] = [['has', atribut]]
  if (Number.isFinite(k.min)) shartlar.push(['>=', ['get', atribut], k.min])
  if (Number.isFinite(k.max)) shartlar.push(['<', ['get', atribut], k.max])
  return ['all', ...shartlar] as ExpressionSpecification
}
