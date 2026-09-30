/**
 * Namuna (mock) ma'lumotlar — backendda hali yo'q (tavsiya, ekinlar, iqlim, relyef, agrokimyo).
 * Kontur `id` bo'yicha deterministik: bir kontur har safar bir xil ko'rinadi.
 * Tuzilma V1 (`old/src/lib/`) dagi tiplarga mos; haqiqiy API paydo bo'lganda almashtiriladi.
 */

/** id dan 0..1 oralig'ida barqaror tasodifiy son */
function tasodif(id: number, tuz: number): number {
  const x = Math.sin(id * 12.9898 + tuz * 78.233) * 43758.5453
  return x - Math.floor(x)
}
const oraliq = (id: number, tuz: number, min: number, max: number) =>
  min + tasodif(id, tuz) * (max - min)

// ------------------------------------------------------------- agrokimyo
export const DARAJA_NOM = ['Juda kam', 'Kam', "O'rtacha", "Ko'p", "Juda ko'p"]

export interface AgrokimyoQiymat {
  daraja: number
  /** Gradatsiya matni (V1: gradFmt) */
  grad: string
}

export function agrokimyoMock(id: number): { gumus: AgrokimyoQiymat; fosfor: AgrokimyoQiymat; kaliy: AgrokimyoQiymat } {
  const d = (tuz: number) => Math.min(4, Math.floor(tasodif(id, tuz) * 5))
  const gumusG = ['< 0,6 %', '0,6–1,0 %', '1,0–1,5 %', '1,5–2,0 %', '> 2,0 %']
  const fosforG = ['< 15 mg/kg', '15–30 mg/kg', '30–45 mg/kg', '45–60 mg/kg', '> 60 mg/kg']
  const kaliyG = ['< 100 mg/kg', '100–200 mg/kg', '200–300 mg/kg', '300–400 mg/kg', '> 400 mg/kg']
  const a = d(1)
  const b = d(2)
  const c = d(3)
  return {
    gumus: { daraja: a, grad: gumusG[a] },
    fosfor: { daraja: b, grad: fosforG[b] },
    kaliy: { daraja: c, grad: kaliyG[c] },
  }
}

// --------------------------------------------------------------- tavsiya
export type Mavsum = 'kuzgi' | 'bahorgi'
export const MAVSUM_NOM: Record<Mavsum, string> = { kuzgi: 'Kuzgi ekish', bahorgi: 'Bahorgi ekish' }

export interface Sabab {
  turi: 'ok' | 'ogoh' | 'yomon'
  matn: string
}

export interface Tavsiya {
  id: string
  nom: string
  mavsum: Mavsum
  ball: number
  sabablar: Sabab[]
  muddat: string
  suv: string
  radSabab: string | null
}

const EKINLAR: { id: string; nom: string; mavsum: Mavsum; muddat: string; suv: string }[] = [
  { id: 'bugdoy', nom: "Kuzgi bug'doy", mavsum: 'kuzgi', muddat: "Oktyabr o'rtasidan noyabr boshigacha", suv: "3–4 marta sug'orish" },
  { id: 'arpa', nom: 'Kuzgi arpa', mavsum: 'kuzgi', muddat: 'Oktyabr boshidan oktyabr oxirigacha', suv: "2–3 marta sug'orish" },
  { id: 'beda', nom: 'Beda', mavsum: 'kuzgi', muddat: 'Sentyabr oxiridan oktyabr oxirigacha', suv: "2 marta sug'orish" },
  { id: 'goza', nom: "G'o'za", mavsum: 'bahorgi', muddat: 'Aprel boshidan may boshigacha', suv: "4–5 marta sug'orish" },
  { id: 'makkajoxori', nom: "Makkajo'xori", mavsum: 'bahorgi', muddat: 'Aprel oxiridan may oxirigacha', suv: "4–5 marta sug'orish" },
  { id: 'sholi', nom: 'Sholi', mavsum: 'bahorgi', muddat: 'May boshidan may oxirigacha', suv: 'Doimiy suv qatlami' },
  { id: 'kungaboqar', nom: 'Kungaboqar', mavsum: 'bahorgi', muddat: 'Aprel boshidan aprel oxirigacha', suv: "2–3 marta sug'orish" },
  { id: 'pomidor', nom: 'Pomidor', mavsum: 'bahorgi', muddat: 'Mart oxiridan aprel oxirigacha', suv: "8–10 marta sug'orish" },
  { id: 'kartoshka', nom: 'Kartoshka', mavsum: 'bahorgi', muddat: 'Fevral oxiridan mart oxirigacha', suv: "6–8 marta sug'orish" },
  { id: 'soya', nom: 'Soya', mavsum: 'bahorgi', muddat: 'May boshidan may oxirigacha', suv: "4–5 marta sug'orish" },
  { id: 'loviya', nom: 'Loviya', mavsum: 'bahorgi', muddat: 'Aprel oxiridan may oxirigacha', suv: "3–4 marta sug'orish" },
  { id: 'qovun', nom: 'Qovun', mavsum: 'bahorgi', muddat: 'Aprel oxiridan may boshigacha', suv: "4–6 marta sug'orish" },
]

const OK = [
  'Tuproq mexanik tarkibi ekin uchun mos',
  'Vegetatsiya davri ekin talabiga yetarli',
  "Sug'orish suvi bilan ta'minlanish qulay",
  "Sho'rlanish darajasi ekin uchun xavfsiz",
]
const OGOH = [
  "Yer osti suvi sathiga e'tibor kerak",
  "Bahorgi kech sovuq xavfi bor",
  "Fosfor darajasi past — o'g'itlash kerak",
]

export function tavsiyaMock(id: number): Tavsiya[] {
  return EKINLAR.map((e, i) => {
    const ball = Math.round(oraliq(id, 20 + i, 8, 98))
    const sabablar: Sabab[] = [
      { turi: 'ok', matn: OK[Math.floor(tasodif(id, 200 + i) * OK.length)] },
      { turi: 'ok', matn: OK[(Math.floor(tasodif(id, 300 + i) * OK.length) + 1) % OK.length] },
    ]
    if (ball < 80) sabablar.push({ turi: 'ogoh', matn: OGOH[Math.floor(tasodif(id, 400 + i) * OGOH.length)] })
    if (ball < 45) sabablar.push({ turi: 'yomon', matn: "Yog'in va suv balansi ekin talabiga to'liq mos emas" })
    return {
      ...e,
      ball,
      sabablar,
      radSabab: ball < 25 ? "Sho'rlanish va yer osti suvi ekin uchun noqulay" : null,
    }
  }).sort((a, b) => b.ball - a.ball)
}

export function ballRang(ball: number): string {
  if (ball >= 85) return 'var(--color-score-90)'
  if (ball >= 70) return 'var(--color-score-70)'
  if (ball >= 50) return 'var(--color-score-50)'
  if (ball >= 25) return 'var(--color-score-30)'
  return 'var(--color-score-0)'
}

export function ballNom(ball: number): string {
  if (ball >= 85) return "A'lo"
  if (ball >= 70) return 'Yaxshi'
  if (ball >= 50) return "O'rtacha"
  if (ball >= 25) return 'Zaif'
  return 'Mos emas'
}

// ---------------------------------------------------------------- ekinlar
export interface EkinYilQator {
  yil: number
  ekinlar: { nom: string; rang: string; ulush: number }[]
}

const EKIN_YILLAR = [2016, 2017, 2018, 2019, 2020, 2021, 2022, 2023, 2024, 2025]
const EKIN_PALITRA: [string, string][] = [
  ["Bug'doy", '#d9a441'],
  ["G'o'za", '#8fb8de'],
  ["Makkajo'xori", '#e6c229'],
  ['Sholi', '#7bb662'],
  ['Kungaboqar', '#f08a24'],
  ['Sabzavot', '#d1495b'],
  ['Kartoshka', '#a67c52'],
  ['Beda', '#5aa9a0'],
]

export function ekinTarixiMock(id: number): EkinYilQator[] {
  // Bir necha yil ketma-ket bir xil ekin bo'lishi mumkin (almashlab ekish ogohlantirishi uchun)
  const asosiyBosh = Math.floor(tasodif(id, 500) * EKIN_PALITRA.length)
  return EKIN_YILLAR.map((yil, i) => {
    if (tasodif(id, 510 + i) < 0.12) return { yil, ekinlar: [] }
    const takror = tasodif(id, 520) < 0.5
    const a = takror && i < 5 ? asosiyBosh : Math.floor(tasodif(id, 530 + i) * EKIN_PALITRA.length)
    const ulush = Math.round(oraliq(id, 540 + i, 62, 100))
    const b = (a + 1 + Math.floor(tasodif(id, 550 + i) * 5)) % EKIN_PALITRA.length
    const ekinlar = [{ nom: EKIN_PALITRA[a][0], rang: EKIN_PALITRA[a][1], ulush }]
    if (ulush < 100) ekinlar.push({ nom: EKIN_PALITRA[b][0], rang: EKIN_PALITRA[b][1], ulush: 100 - ulush })
    return { yil, ekinlar }
  })
}

export const ekinYillarSoni = EKIN_YILLAR.length

/** Bir xil asosiy ekin ketma-ket 3 va undan ko'p yil (V1 almashlabOgoh mantig'i) */
export function almashlabOgoh(t: EkinYilQator[]): { ekin: string; yillar: [number, number]; uzunlik: number } | null {
  const asosiy = t.map((q) => (q.ekinlar[0] && q.ekinlar[0].ulush >= 50 ? q.ekinlar[0].nom : null))
  let eng: { ekin: string; yillar: [number, number]; uzunlik: number } | null = null
  let bosh = 0
  for (let j = 1; j <= asosiy.length; j++) {
    if (j < asosiy.length && asosiy[j] !== null && asosiy[j] === asosiy[bosh]) continue
    const ekin = asosiy[bosh]
    const uzunlik = j - bosh
    if (ekin && uzunlik >= 3 && uzunlik >= (eng?.uzunlik ?? 0)) {
      eng = { ekin, yillar: [t[bosh].yil, t[j - 1].yil], uzunlik }
    }
    bosh = j
  }
  return eng
}

// ----------------------------------------------------------------- relyef
export function relyefMock(id: number) {
  const balandlik = Math.round(oraliq(id, 1100, 380, 900))
  return {
    balandlik,
    qiyalik: +oraliq(id, 1101, 0.2, 10).toFixed(1),
    yonalish: Math.round(oraliq(id, 1102, 0, 359)),
    hMin: 300,
    hMax: 1000,
  }
}

export function yonalishNom(deg: number): string {
  const n = ['Shimol', 'Shimoli-sharq', 'Sharq', 'Janubi-sharq', 'Janub', "Janubi-g'arb", "G'arb", "Shimoli-g'arb"]
  return n[Math.round(deg / 45) % 8]
}
