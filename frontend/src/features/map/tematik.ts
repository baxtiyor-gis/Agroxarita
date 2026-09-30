import type { ExpressionSpecification } from 'maplibre-gl'

/**
 * Tematik ranglash (V1 `old/src/lib/ranglar.ts`): klasslangan shkala.
 * Kontur MVT atributlari: bonitet (ball), shorlanish (1-5), gumus (1-6), fosfor (1-5),
 * kaliy (1-5), balandlik (m). Atribut yo'q = ma'lumot yo'q.
 */
export type TematikId =
  | 'ekin_2026'
  | 'ekin_2025'
  | 'bonitet'
  | 'shorlanish'
  | 'gumus'
  | 'fosfor'
  | 'kaliy'
  | 'balandlik'

export interface Klass {
  /** Kategoriyali shkala: atribut qiymati (ekin kodi) */
  kod?: number
  /** "Boshqa": asosiy kodlardan hech biri emas yoki atribut yo'q */
  boshqa?: boolean
  /** Legenda belgisi uchun CSS fon (rang o'rniga, masalan "Boshqa" — ko'p rangli) */
  fon?: string
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
  /** Kategoriyali (match): klass `kod` bo'yicha; aks holda raqamli (step) */
  kategoriyali?: boolean
  /** Atribut yo'q klassi nomi (standart YOQ_NOM) */
  yoqNom?: string
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

/** Agrokimyo darajalari (1..5) — har ko'rsatkichning o'z palitrasi */
const daraja = (ranglar: string[]): Klass[] =>
  ['Juda kam', 'Kam', "O'rtacha", "Ko'p", "Juda ko'p"].map((nom, i) => ({
    min: i === 0 ? -Infinity : i + 1,
    max: i === 4 ? Infinity : i + 2,
    rang: ranglar[i],
    nom,
  }))

/** Fosfor — ko'k */
const FOSFOR = daraja(['#eef1fb', '#c7d2f0', '#93a8dc', '#5c75bd', '#2e4592'])
/** Kaliy — binafsha (sho'rlanishning issiq palitrasidan farqlanadi) */
const KALIY = daraja(['#f5eefa', '#dcc6ec', '#b894d6', '#8a5fb8', '#5b3a8c'])

/** Gumus — 6 daraja, jigarrang (backend: Ko'proq qo'shilgan, eng yuqorisi "Yuqori") */
const GUMUS: Klass[] = [
  { min: -Infinity, max: 2, rang: '#f6efe2', nom: 'Juda kam' },
  { min: 2, max: 3, rang: '#e6d3b3', nom: 'Kam' },
  { min: 3, max: 4, rang: '#c9a877', nom: "O'rtacha" },
  { min: 4, max: 5, rang: '#a47a48', nom: "Ko'proq" },
  { min: 5, max: 6, rang: '#7a5230', nom: "Ko'p" },
  { min: 6, max: Infinity, rang: '#4e3320', nom: 'Yuqori' },
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

/** Asosiy ekinlar (kod = MVT ekin_2026/ekin_2025 qiymati), tartib bilan; qolganlari va ma'lumotsizlar — "Boshqa" */
export const EKIN_ASOSIY: { kod: number; nom: string; rang: string }[] = [
  { kod: 102010000, nom: "G'alla", rang: '#d9a441' },
  { kod: 101010000, nom: 'Paxta', rang: '#8fb8de' },
  { kod: 108010000, nom: 'Beda', rang: '#c5d86d' },
  { kod: 104040000, nom: 'Piyoz', rang: '#d1495b' },
  { kod: 102060000, nom: "Makkajo'xori", rang: '#e6c229' },
  { kod: 107010000, nom: 'Kartoshka', rang: '#a67c52' },
  { kod: 108040000, nom: 'Makka (silos)', rang: '#2e8b3e' },
  { kod: 105020000, nom: 'Qovun', rang: '#e58fb0' },
  { kod: 102080000, nom: 'Sholi', rang: '#7bb662' },
  { kod: 104030000, nom: 'Sabzi', rang: '#f08a24' },
  { kod: 104050000, nom: 'Sarimsoq piyoz', rang: '#8e6bbf' },
  { kod: 103020000, nom: 'Kungaboqar', rang: '#0f8b8d' },
]

/** Asosiy bo'lmagan ekinlar: xaritada har kod o'z rangida (kod -> hue), legendada bitta "Boshqa" */
const HUE_KOEF = 47
const boshqaRangi = (kod: number) => `hsl(${(kod * HUE_KOEF) % 360}, 55%, 62%)`
const BOSHQA_FON = `linear-gradient(135deg, ${[11, 83, 155, 227, 299].map((h) => `hsl(${h}, 55%, 62%)`).join(', ')})`

const EKIN_KLASSLAR: Klass[] = [
  ...EKIN_ASOSIY.map((e, i) => ({ kod: e.kod, min: i, max: i + 1, rang: e.rang, nom: e.nom })),
  { boshqa: true, min: EKIN_ASOSIY.length, max: EKIN_ASOSIY.length + 1, rang: YOQ_RANG, fon: BOSHQA_FON, nom: 'Boshqa' },
]

/** Ekin kodi -> rang (xarita bilan bir xil): asosiylar ro'yxatdan, qolganlari koddan */
export const ekinRangi = (kod: number) => EKIN_ASOSIY.find((e) => e.kod === kod)?.rang ?? boshqaRangi(kod)

export const SHKALA: Record<TematikId, Shkala> = {
  ekin_2026: {
    nom: 'Ekin 2026',
    izoh: 'asosiy ekin',
    atribut: 'ekin_2026',
    klasslar: EKIN_KLASSLAR,
    kategoriyali: true,
  },
  ekin_2025: {
    nom: 'Ekin 2025',
    izoh: 'asosiy ekin',
    atribut: 'ekin_2025',
    klasslar: EKIN_KLASSLAR,
    kategoriyali: true,
  },
  bonitet: { nom: 'Tuproq boniteti', izoh: 'ball', atribut: 'bonitet', klasslar: BONITET },
  shorlanish: { nom: "Sho'rlanish", izoh: 'daraja', atribut: 'shorlanish', klasslar: SHOR },
  gumus: { nom: 'Gumus', izoh: 'chirindi miqdori', atribut: 'gumus', klasslar: GUMUS },
  fosfor: { nom: 'Fosfor', izoh: 'P₂O₅', atribut: 'fosfor', klasslar: FOSFOR },
  kaliy: { nom: 'Kaliy', izoh: 'K₂O', atribut: 'kaliy', klasslar: KALIY },
  balandlik: { nom: 'Balandlik (DEM)', izoh: 'dengiz sathidan, m', atribut: 'balandlik', klasslar: BALANDLIK },
}

/** Radio ro'yxat: bo'lim sarlavhasi bilan */
export const TEMATIK_GURUHLAR: { nom: string; idlar: TematikId[] }[] = [
  { nom: 'Ekin', idlar: ['ekin_2026', 'ekin_2025'] },
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
  const { atribut, klasslar, kategoriyali } = SHKALA[id]
  if (kategoriyali) {
    const match: unknown[] = ['match', ['get', atribut]]
    for (const k of klasslar) if (k.kod != null) match.push(k.kod, k.rang)
    // ro'yxatda yo'q kod — o'z rangi (ekinRangi bilan bir xil formula)
    const hue = ['%', ['*', ['to-number', ['get', atribut]], HUE_KOEF], 360]
    match.push(['to-color', ['concat', 'hsl(', ['to-string', hue], ', 55%, 62%)']])
    return ['case', ['has', atribut], match, YOQ_RANG] as unknown as ExpressionSpecification
  }
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
  const { atribut, klasslar, kategoriyali } = SHKALA[id]
  if (klassIdx === YOQ_KLASS) return ['!', ['has', atribut]] as ExpressionSpecification
  const k = klasslar[klassIdx]
  if (!k) return null
  if (kategoriyali) {
    if (k.boshqa) {
      const kodlar = klasslar.flatMap((x) => (x.kod != null ? [x.kod] : []))
      return ['any', ['!', ['has', atribut]], ['!', ['in', ['get', atribut], ['literal', kodlar]]]] as ExpressionSpecification
    }
    return ['all', ['has', atribut], ['==', ['get', atribut], k.kod ?? 0]] as ExpressionSpecification
  }
  const shartlar: unknown[] = [['has', atribut]]
  if (Number.isFinite(k.min)) shartlar.push(['>=', ['get', atribut], k.min])
  if (Number.isFinite(k.max)) shartlar.push(['<', ['get', atribut], k.max])
  return ['all', ...shartlar] as ExpressionSpecification
}
