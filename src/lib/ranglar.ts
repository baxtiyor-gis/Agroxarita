import type { Qatlam } from '@/store/useApp'
import { oylikKlasslar } from './iqlim'
import { YER_TURLARI, ekinlar, EKIN_YILLAR, ustun, type EkinYil } from './data'

/**
 * Klasslangan (classified) shkala — cho'zilgan gradient emas.
 *
 * Har bir klass o'z chegarasi va nomi bilan: agronom "62 ball" ni emas,
 * "yaxshi" toifani ko'radi va legendadan aniq o'qiydi. Xaritadagi rang
 * to'g'ridan-to'g'ri legenda katagiga mos keladi.
 */
export interface Klass {
  /** Quyi chegara (shu qiymatdan boshlab shu klass) */
  min: number
  /** Yuqori chegara, oxirgi klassda Infinity */
  max: number
  rang: string
  nom: string
  /** Legendada ko'rsatiladigan diapazon matni */
  oraliq?: string
}

export interface Shkala {
  nom: string
  izoh: string
  klasslar: Klass[]
  /** Diskret kategoriya qatlami (foydalanish turi) */
  kategoriyami?: boolean
}

const YOQ_RANG = '#b9bfb6'

// Bonitet — YlGn asosida, sun'iy yo'ldoshda aniq ajraladi
const BONITET: Klass[] = [
  { min: -Infinity, max: 41, rang: '#fff8d6', nom: 'Juda past', oraliq: '< 41' },
  { min: 41, max: 51, rang: '#dbeda0', nom: 'Past', oraliq: '41–50' },
  { min: 51, max: 61, rang: '#a2d47f', nom: "O'rtacha", oraliq: '51–60' },
  { min: 61, max: 71, rang: '#55ab5c', nom: 'Yaxshi', oraliq: '61–70' },
  { min: 71, max: Infinity, rang: '#1c7a3e', nom: 'Yuqori', oraliq: '71+' },
]

// Agrokimyo darajalari — 0..4, bir xil palitra uch ko'rsatkich uchun
const DARAJA: Klass[] = [
  { min: 0, max: 1, rang: '#fff8d6', nom: 'Juda kam' },
  { min: 1, max: 2, rang: '#dbeda0', nom: 'Kam' },
  { min: 2, max: 3, rang: '#a2d47f', nom: "O'rtacha" },
  { min: 3, max: 4, rang: '#55ab5c', nom: "Ko'p" },
  { min: 4, max: Infinity, rang: '#1c7a3e', nom: "Juda ko'p" },
]

// Sho'rlanish — teskari: yuqori = yomon, shuning uchun issiq palitra
const SHOR: Klass[] = [
  { min: 0, max: 2, rang: '#f2f6ee', nom: "Sho'rlanmagan" },
  { min: 2, max: 3, rang: '#fcd9a8', nom: 'Kuchsiz' },
  { min: 3, max: 4, rang: '#f2a465', nom: "O'rtacha" },
  { min: 4, max: 6, rang: '#d96a4a', nom: 'Kuchli' },
  { min: 6, max: Infinity, rang: '#9e3535', nom: "Sho'rxok" },
]

// Balandlik — gipsometrik, hudud diapazoni 711–1123 m
const BALANDLIK: Klass[] = [
  { min: -Infinity, max: 750, rang: '#4b8c5a', nom: 'Past tekislik', oraliq: '< 750 m' },
  { min: 750, max: 800, rang: '#9cbd6c', nom: 'Tekislik', oraliq: '750–800' },
  { min: 800, max: 870, rang: '#e2cc84', nom: 'Adirlar etagi', oraliq: '800–870' },
  { min: 870, max: 960, rang: '#c99a63', nom: 'Adirlar', oraliq: '870–960' },
  { min: 960, max: Infinity, rang: '#9a6a4c', nom: "Tog'oldi", oraliq: '960+' },
]

// Qiyalik — agrotexnika nuqtai nazaridan, yuqori = muammo
const QIYALIK: Klass[] = [
  { min: 0, max: 1, rang: '#eef4ea', nom: 'Tekis', oraliq: '< 1°' },
  { min: 1, max: 3, rang: '#d5e3c4', nom: 'Deyarli tekis', oraliq: '1–3°' },
  { min: 3, max: 8, rang: '#f0c273', nom: 'Yengil nishab', oraliq: '3–8°' },
  { min: 8, max: 15, rang: '#dc8452', nom: 'Nishab', oraliq: '8–15°' },
  { min: 15, max: Infinity, rang: '#a04430', nom: 'Tik', oraliq: '15°+' },
]

// Tavsiya bali — divergent: yaroqsizdan a'loga
const TAVSIYA: Klass[] = [
  { min: -Infinity, max: 25, rang: '#a4473c', nom: 'Mos emas', oraliq: '< 25' },
  { min: 25, max: 45, rang: '#d9834a', nom: 'Zaif', oraliq: '25–44' },
  { min: 45, max: 62, rang: '#f0cc63', nom: "O'rtacha", oraliq: '45–61' },
  { min: 62, max: 78, rang: '#8fc45f', nom: 'Yaxshi', oraliq: '62–77' },
  { min: 78, max: Infinity, rang: '#1c7a3e', nom: "A'lo", oraliq: '78+' },
]

// Yer turi — kategoriya: indeks = YER_TURLARI tartibi (data.ts)
const FOYD: Klass[] = YER_TURLARI.map((g, i) => ({
  min: i,
  max: i + 1,
  rang: g.rang,
  nom: g.nom,
}))

/** Tematik ranglashsiz rejimda kontur chegarasi — qizil */
export const KONTUR_CHEGARA = '#ff3b30'

/** Ekin qatlami — barcha yillar uchun bir xil klasslar (yagona lug'at, yagona ranglar) */
function ekinShkala(yil: string): Shkala {
  return {
    nom: `Ekilgan ekin (${yil})`,
    izoh: 'asosiy ekin',
    // Lug'at ma'lumot yuklangandan keyin ma'lum — shuning uchun getter
    get klasslar() {
      return ekinlar().map((e, i) => ({ min: i, max: i + 1, rang: e.rang, nom: e.nom }))
    },
    kategoriyami: true,
  }
}

/** Ekin qatlamimi (ma'lumotsiz konturlar bo'yalmaydi, legendada faqat bor ekinlar) */
export const ekinQatlami = (q: Qatlam) => ekinYili(q) !== null

/** Yilning xarita qatlami: 2022 → 'ekin22' */
export const ekinQatlamId = (y: EkinYil) => `ekin${y % 100}` as Extract<Qatlam, `ekin${number}`>

/** Ekin qatlamining yili ('ekin22' → 2022), boshqa qatlamda null */
export function ekinYili(q: Qatlam): EkinYil | null {
  return EKIN_YILLAR.find((y) => ekinQatlamId(y) === q) ?? null
}

// ---------------------------------------------------------------- iqlim
const ISSIQLIK = ['#ffffb2', '#fed976', '#feb24c', '#fd8d3c', '#e31a1c']
const SOVUQSIZ_R = ['#c6dbef', '#9ecae1', '#6baed6', '#74c476', '#238b45']
const YOGIN_R = ['#f7fbff', '#c6dbef', '#6baed6', '#2171b5', '#08306b']

// ------------------------------------------------ tumanga moslashuvchi shkala
/**
 * Klass chegaralari joriy tuman qiymatlaridan (kvantillar, yumaloqlangan).
 * Qat'iy chegaralar bitta tumanga moslangan edi — boshqasida hamma kontur
 * bitta klassga tushardi. Ustun massivi tuman almashganda yangilanadi,
 * shuning uchun kesh massiv bo'yicha.
 */
const dinKesh = new WeakMap<number[], Klass[]>()
function dinamik(qatlam: string, ranglar: string[], nomlar: string[], qadam: number, fmt: (v: number) => string): Klass[] {
  const arr = ustun(qatlam)
  if (!arr) return []
  const bor = dinKesh.get(arr)
  if (bor) return bor
  const v = arr.filter((x) => x >= 0).sort((a, b) => a - b)
  if (!v.length) return []
  const k = ranglar.length
  const ch: number[] = []
  for (let i = 1; i < k; i++) {
    const q = Math.round(v[Math.floor((v.length * i) / k)] / qadam) * qadam
    if (!ch.length || q > ch[ch.length - 1]) ch.push(q)
  }
  const n = ch.length + 1
  const tanla = (i: number) => Math.round((i * (k - 1)) / Math.max(1, n - 1))
  const out: Klass[] = Array.from({ length: n }, (_, i) => ({
    min: i === 0 ? -Infinity : ch[i - 1],
    max: i === n - 1 ? Infinity : ch[i],
    rang: ranglar[tanla(i)],
    nom: nomlar[tanla(i)],
    oraliq: i === 0 ? `< ${fmt(ch[0])}` : i === n - 1 ? `${fmt(ch[i - 1])}+` : `${fmt(ch[i - 1])}–${fmt(ch[i])}`,
  }))
  dinKesh.set(arr, out)
  return out
}
const son = (v: number) => Math.round(v).toLocaleString('ru')
const OY_Q = ['yan', 'fev', 'mar', 'apr', 'may', 'iyun', 'iyul', 'avg', 'sen', 'okt', 'noy', 'dek']
const OY_K = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31]
const sana = (doy: number) => {
  let d = Math.round(doy)
  for (let m = 0; m < 12; m++) {
    if (d <= OY_K[m]) return `${d}-${OY_Q[m]}`
    d -= OY_K[m]
  }
  return '—'
}
const D5 = ['Eng past', 'Past', "O'rtacha", 'Yuqori', 'Eng yuqori']

export const SHKALA: Record<Qatlam, Shkala> = {
  yoq: { nom: 'Konturlar', izoh: 'tematik ranglashsiz', klasslar: [] },
  fah: { nom: "Faol haroratlar yig'indisi", izoh: '>10 °C kunlar, °C', get klasslar() { return dinamik('fah', ISSIQLIK, ['Salqinroq', "O'rtachadan past", "O'rtacha", "O'rtachadan yuqori", 'Eng issiq'], 50, son) } },
  sovuqsiz: { nom: 'Sovuqsiz davr', izoh: "kun, 10 yillik o'rtacha", get klasslar() { return dinamik('sovuqsiz', SOVUQSIZ_R, ['Eng qisqa', 'Qisqa', "O'rtacha", 'Uzun', 'Eng uzun'], 2, son) } },
  bahorgiSovuq: { nom: 'Bahorgi oxirgi sovuq', izoh: "o'rtacha sana", get klasslar() { return dinamik('bahorgiSovuq', ['#238b45', '#74c476', '#fed976', '#fd8d3c', '#bd0026'], ['Eng erta', 'Erta', "O'rtacha", 'Kech', 'Eng kech'], 1, sana) } },
  issiqKun: { nom: 'Issiq kunlar', izoh: 'Tmax ≥ 35 °C, kun/yil', get klasslar() { return dinamik('issiqKun', ISSIQLIK, D5, 1, son) } },
  yillikYogin: { nom: "Yillik yog'in", izoh: 'mm', get klasslar() { return dinamik('yillikYogin', YOGIN_R, ['Eng kam', 'Kam', "O'rtacha", "Ko'p", "Eng ko'p"], 2, son) } },
  suvTanqislik: { nom: 'Suv tanqisligi', izoh: "ET₀ − yog'in, mm/yil", get klasslar() { return dinamik('suvTanqislik', ['#fff5eb', '#fdd0a2', '#fd8d3c', '#d94801', '#7f2704'], D5, 5, son) } },
  // Oylik — klasslar tanlangan oyga moslab hisoblanadi (iqlim.ts oylikKlasslar)
  oyHarorat: {
    nom: 'Oylik harorat',
    izoh: "o'rtacha, °C",
    get klasslar() {
      return oylikKlasslar('oyHarorat')
    },
  },
  oyYogin: {
    nom: "Oylik yog'in",
    izoh: 'mm',
    get klasslar() {
      return oylikKlasslar('oyYogin')
    },
  },
  bonitet: { nom: 'Tuproq boniteti', izoh: 'ball', klasslar: BONITET },
  gumus: { nom: 'Gumus', izoh: 'chirindi miqdori', klasslar: DARAJA },
  fosfor: { nom: 'Fosfor', izoh: 'P₂O₅', klasslar: DARAJA },
  kaliy: { nom: 'Kaliy', izoh: 'K₂O', klasslar: DARAJA },
  shor: { nom: "Sho'rlanish", izoh: 'daraja', klasslar: SHOR },
  balandlik: { nom: 'Balandlik', izoh: 'dengiz sathidan, m', get klasslar() { return dinamik('balandlik', BALANDLIK.map((k) => k.rang), ['Eng past', 'Past', "O'rtacha", 'Baland', 'Eng baland'], 10, son) } },
  qiyalik: { nom: 'Qiyalik', izoh: 'nishablik', klasslar: QIYALIK },
  tavsiya: { nom: 'Moslik bali', izoh: 'tanlangan ekin uchun', klasslar: TAVSIYA },
  foyd: { nom: 'Yer turi', izoh: 'hozirgi foydalanish', klasslar: FOYD, kategoriyami: true },
  ekin22: ekinShkala('2022'),
  ekin23: ekinShkala('2023'),
  ekin24: ekinShkala('2024'),
  ekin25: ekinShkala('2025'),
  ekin26: ekinShkala('2026'),
}

/** Qiymat qaysi klassga tushadi */
export function klassOl(qatlam: Qatlam, v: number): Klass | null {
  if (v < 0 || v === null || v === undefined) return null
  const ks = SHKALA[qatlam].klasslar
  return ks.find((k) => v >= k.min && v < k.max) ?? ks[ks.length - 1]
}

/** Kontur atributidan rang — CSS uchun */
export function rangOl(qatlam: Qatlam, v: number): string {
  return klassOl(qatlam, v)?.rang ?? YOQ_RANG
}

export { YOQ_RANG }
