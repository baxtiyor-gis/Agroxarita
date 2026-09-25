import type { FeatureCollection } from 'geojson'
import type { AttrPack, Crop, Kontur } from './types'
import { IQLIM_QATLAMLAR, iqlimTavsiya, iqlimUstun, iqlimYukla, type IqlimKorsatkich } from './iqlim'
import { jsonOl, tumanUrl } from './tuman'

let pack: AttrPack | null = null
let cropList: Crop[] = []
let cropVaad: Promise<Crop[]> | null = null
let geomFC: FeatureCollection | null = null
let bbox: [number, number, number, number] | null = null
/** Ketma-ket almashtirishda eski so'rov natijasi yangisini bosib ketmasin */
let yuklashNo = 0

/** Tez almashtirishda eskirgan yuklash — xato emas, jimgina tashlanadi */
export class BekorXato extends Error {
  constructor() {
    super('bekor')
    this.name = 'BekorXato'
  }
}

/**
 * Tuman ma'lumotlarini yuklaydi: attrs va geometriya — tuman papkasidan
 * (public/data/<tuman>/), crops.json — umumiy, bir marta. Hamma fayl kelgach
 * modul holati va keshlari (yer turi, ekin ustunlari, id indeksi, iqlim)
 * birdaniga yangi tumanga almashadi. Fayl yo'q bo'lsa — MalumotYoqXato.
 */
export async function yukla(tuman: string) {
  const no = ++yuklashNo
  cropVaad ??= jsonOl<Crop[]>(`${import.meta.env.BASE_URL}data/crops.json`).catch((e) => {
    cropVaad = null
    throw e
  })
  const [a, c, g] = await Promise.all([
    jsonOl<AttrPack>(tumanUrl(tuman, 'attrs.json')),
    cropVaad,
    // Geometriya ham shu yerda: xarita konturlar extentiga moslab quriladi,
    // shuning uchun u xaritadan oldin kerak
    jsonOl<FeatureCollection>(tumanUrl(tuman, 'geom.geojson')),
    // Iqlim (ERA5-Land) — tavsiya va xarita uni ishlatadi; fayl bo'lmasa namuna rejimi
    iqlimYukla(tuman),
  ])
  if (no !== yuklashNo) throw new BekorXato()
  pack = a
  cropList = c
  geomFC = g
  idIndex = null
  bbox = hisoblaBbox(g)
  yerTuriCol = hisoblaYerTuri(a)
  for (const y of EKIN_YILLAR) {
    ekinCol[y] = ekinUstun(a, y).map((l) => (l.length && l[0][1] >= EKIN_MIN_ULUSH ? l[0][0] : -1))
  }
  // Tumanda ekin xaritasi bor yillar — ustun bor va kamida bitta yozuv bo'sh emas
  mavjudYil = EKIN_YILLAR.filter((y) => ekinUstun(a, y).some((l) => l.length > 0))
  let hMin = Infinity
  let hMax = -Infinity
  for (const h of a.col.balandlik) {
    if (h < 0) continue
    if (h < hMin) hMin = h
    if (h > hMax) hMax = h
  }
  balOraliq = hMin <= hMax ? [hMin, hMax] : [0, 0]
  return { pack: a, crops: c }
}

// ------------------------------------------------------------- yer turi
/**
 * Yer turi — filtr, xarita ranglari va legenda uchun yagona klassifikatsiya.
 * Manbadagi 9 ta foydalanish kodi 8 guruhga keltiriladi: qurilish va
 * tomorqa "Boshqa" ga birlashadi. Tartib — UI'dagi ko'rsatish tartibi.
 *
 * Ranglar sun'iy yo'ldosh ustida to'liq qoplama sifatida ajralib turishi
 * uchun tanlangan: haydalma — somon sariq, ko'p yillik ekinzorlar — yashil
 * va binafsha tuslari, yaylov — och yashil, bo'sh — kulrang.
 */
export const YER_TURLARI = [
  { id: 'haydalma', nom: "Sug'oriladigan (haydalma)", kodlar: ['haydalma'], rang: '#f2c94c' },
  { id: 'lalmi', nom: 'Lalmi', kodlar: ['lalmi'], rang: '#d9a066' },
  { id: 'bog', nom: "Bog'", kodlar: ['bog'], rang: '#2e8b3e' },
  { id: 'uzumzor', nom: 'Uzumzor', kodlar: ['uzumzor'], rang: '#8e5bb5' },
  { id: 'tutzor', nom: 'Tutzor', kodlar: ['tutzor'], rang: '#1fa39a' },
  { id: 'yaylov', nom: 'Yaylov', kodlar: ['yaylov'], rang: '#a8d26b' },
  { id: 'bosh', nom: "Bo'sh", kodlar: ['bosh'], rang: '#b8bcc4' },
  { id: 'boshqa', nom: 'Boshqa (qurilish va tomorqa)', kodlar: ['qurilish', 'tomorqa'], rang: '#e8766b' },
] as const

let yerTuriCol: number[] = []
/** Har bir kontur uchun YER_TURLARI indeksi, -1 = noma'lum */
export const yerTuri = () => yerTuriCol

function hisoblaYerTuri(p: AttrPack): number[] {
  const kodGuruh = p.lug.foyd.map((kod) => YER_TURLARI.findIndex((g) => (g.kodlar as readonly string[]).includes(kod)))
  return p.col.foyd.map((f) => kodGuruh[f] ?? -1)
}

// ---------------------------------------------------- ekinlar 2022–2026
/** Ekin xaritasi mavjud yillar (attrs.json da col.ekin22 ... col.ekin26) */
export const EKIN_YILLAR = [2022, 2023, 2024, 2025, 2026] as const
export type EkinYil = (typeof EKIN_YILLAR)[number]

let mavjudYil: EkinYil[] = []
/**
 * Joriy tumanda ekin ma'lumoti bor yillar (masalan, Farg'ona — faqat 2024 va
 * 2026). Qatlamlar ro'yxati va yil almashtirgich faqat shularni ko'rsatadi.
 */
export const ekinYillar = () => mavjudYil

let balOraliq: [number, number] = [0, 0]
/** Tuman konturlari balandligi oralig'i, m: [min, max] */
export const balandlikOraliq = () => balOraliq

/** Yilning attrs.json ustuni: har kontur uchun [[lug.ekin indeksi, ulush %], ...] */
function ekinUstun(p: AttrPack, y: EkinYil): [number, number][][] {
  return p.col[`ekin${y % 100}` as `ekin${22 | 23 | 24 | 25 | 26}`] ?? []
}

/** Asosiy ekin deb hisoblash uchun kontur maydonidan minimal ulush, % */
export const EKIN_MIN_ULUSH = 20

/**
 * Yagona ekin lug'ati (lug.ekin) — rang shu indeks bo'yicha, shuning uchun bir
 * ekin har yili bir xil rangda. Dastlabki 31 tasi 2024–2026 umumiy maydoni
 * bo'yicha tartiblangan; 2022–2023 dagi yangi ekinlar oxiriga qo'shilgan
 * (mavjud ranglar siljimasligi uchun). Boshidagi ranglar eng aniq ajraladiganlari.
 */
const EKIN_PALITRA = [
  '#f2c94c', '#d4904a', '#00a8e8', '#ff8b3d', '#a56cf0', '#e5484d',
  '#2f9e44', '#9ccc65', '#3ec1d3', '#c0ca33', '#7c4dff', '#ff6fb5',
  '#8d6e63', '#26a69a', '#1565c0', '#ad1457', '#ffb74d', '#b39ddb',
  '#5c6bc0', '#e6d690', '#80deea', '#558b2f', '#cddc39', '#f06292',
  '#00695c', '#bcaaa4', '#d81b60', '#827717', '#ffe082', '#90a4ae',
  '#6a1b9a',
  // 2022–2023 dan qo'shilganlar (indeks 31+): Noma'lum (kod 1) — kulrang, Gulkaram,
  // Soya, Makkajo'xori don uchun, Xashaki lavlagi, Paxta — oq, Qand lavlagi
  '#9e9e9e', '#f8bbd0', '#4e342e', '#ff9e80', '#004d40', '#f5f5f5', '#b71c1c',
]

const ekinCol: Record<EkinYil, number[]> = { 2022: [], 2023: [], 2024: [], 2025: [], 2026: [] }

/** Barcha yillar ekinlari: nom va rang, lug'at tartibida */
export function ekinlar(): { nom: string; rang: string }[] {
  return (pack?.lug.ekin ?? []).map((nom, i) => ({
    nom,
    rang: EKIN_PALITRA[i % EKIN_PALITRA.length],
  }))
}

/** Ekin rangi nomi bo'yicha (lug'atda yo'q bo'lsa — kulrang) */
export function ekinRang(nom: string): string {
  const i = pack?.lug.ekin?.indexOf(nom) ?? -1
  return i >= 0 ? EKIN_PALITRA[i % EKIN_PALITRA.length] : '#b8bcc4'
}

/** Ko'p yillik ekinlar — har yili takrorlanishi tabiiy, almashlab ekish eslatmasi kerak emas */
export const KOP_YILLIK = new Set(['Uzumzor', 'Mevali daraxtlar', 'Tutzor', 'Beda', "G'alla + Beda (ozuqa uchun)"])

/**
 * Kontur ekin tarixi: tumanda ma'lumoti bor yillar (o'sish tartibida);
 * konturda shu yil ma'lumot yo'q bo'lsa ekinlar = []
 */
export function ekinTarixi(i: number): { yil: EkinYil; ekinlar: { nom: string; rang: string; ulush: number }[] }[] {
  const p = pack!
  return mavjudYil.map((yil) => ({
    yil,
    ekinlar: (ekinUstun(p, yil)[i] ?? []).map(([e, u]) => ({
      nom: p.lug.ekin![e],
      rang: EKIN_PALITRA[e % EKIN_PALITRA.length],
      ulush: u,
    })),
  }))
}

/**
 * Almashlab ekish ogohlantirishi: bir xil asosiy ekin (ulushi ≥ EKIN_MIN_ULUSH)
 * ketma-ket 3 va undan ko'p yil. Eng uzun takror qaytariladi (teng bo'lsa —
 * eng oxirgisi). Ko'p yillik ekinlar hisobga olinmaydi.
 */
export function almashlabOgoh(i: number): { ekin: string; yillar: [number, number]; uzunlik: number } | null {
  const p = pack!
  const asosiy = EKIN_YILLAR.map((y) => {
    const e = ekinUstun(p, y)[i]?.[0]
    return e && e[1] >= EKIN_MIN_ULUSH ? p.lug.ekin![e[0]] : null
  })
  let eng: { ekin: string; yillar: [number, number]; uzunlik: number } | null = null
  let bosh = 0
  for (let j = 1; j <= asosiy.length; j++) {
    if (j < asosiy.length && asosiy[j] !== null && asosiy[j] === asosiy[bosh]) continue
    const ekin = asosiy[bosh]
    const uzunlik = j - bosh
    if (ekin && uzunlik >= 3 && !KOP_YILLIK.has(ekin) && uzunlik >= (eng?.uzunlik ?? 0)) {
      eng = { ekin, yillar: [EKIN_YILLAR[bosh], EKIN_YILLAR[j - 1]], uzunlik }
    }
    bosh = j
  }
  return eng
}

/** Tematik qatlam uchun kontur qiymatlari ustuni (-1 = ma'lumot yo'q) */
export function ustun(qatlam: string, oy = 0): number[] | null {
  if ((IQLIM_QATLAMLAR as string[]).includes(qatlam)) return iqlimUstun(qatlam as IqlimKorsatkich, oy)
  const c = pack!.col
  const map: Record<string, number[]> = {
    bonitet: c.bonitet,
    gumus: c.gumus,
    fosfor: c.fosfor,
    kaliy: c.kaliy,
    shor: c.shor,
    balandlik: c.balandlik,
    qiyalik: c.qiyalik,
    foyd: yerTuriCol,
    ekin22: ekinCol[2022],
    ekin23: ekinCol[2023],
    ekin24: ekinCol[2024],
    ekin25: ekinCol[2025],
    ekin26: ekinCol[2026],
  }
  return map[qatlam] ?? null
}

/**
 * Manbadagi gradatsiya matnini ko'rsatish uchun: "10<" → "> 10",
 * "0,41-0,8" → "0,41–0,8". Birlik faqat matnda o'zi bo'lmasa qo'shiladi.
 */
export function gradFmt(g: string | null, birlik = ''): string | null {
  if (!g) return null
  let s = g.trim().replace(/\./g, ',')
  const katta = s.match(/^(?:>\s*([\d,]+)|([\d,]+)\s*<)$/)
  if (katta) s = `> ${katta[1] ?? katta[2]}`
  else s = s.replace(/\s*-\s*/g, '–')
  return birlik && !/[a-z]/i.test(s) ? `${s} ${birlik}` : s
}

export const crops = () => cropList
export const attrs = () => pack!
export const geom = () => geomFC!
/** Konturlar extenti: [g'arb, janub, sharq, shimol] */
export const extent = () => bbox!

function hisoblaBbox(fc: FeatureCollection): [number, number, number, number] {
  let w = Infinity
  let s = Infinity
  let e = -Infinity
  let n = -Infinity
  const nuqta = (c: number[]) => {
    if (c[0] < w) w = c[0]
    if (c[0] > e) e = c[0]
    if (c[1] < s) s = c[1]
    if (c[1] > n) n = c[1]
  }
  for (const f of fc.features) {
    const g = f.geometry
    if (g.type === 'Polygon') g.coordinates.forEach((r) => r.forEach(nuqta))
    else if (g.type === 'MultiPolygon') g.coordinates.forEach((p) => p.forEach((r) => r.forEach(nuqta)))
  }
  return [w, s, e, n]
}

/** Indeks bo'yicha konturni yig'ish — ustunli saqlashdan obyektga */
export function kontur(i: number): Kontur {
  const p = pack!
  const q = p.col
  const lug = p.lug
  const txt = (arr: string[], idx: number) => (idx >= 0 ? arr[idx] : null)
  return {
    i,
    id: q.id[i],
    kod: q.kod[i],
    massiv: txt(lug.massiv, q.massiv[i]),
    mfy: txt(lug.mfy, q.mfy[i]),
    maydon: q.maydon[i],
    sug: q.sug[i],
    foyd: lug.foyd[q.foyd[i]],
    bonitet: q.bonitet[i],
    mex: q.mex[i],
    shor: q.shor[i],
    yos: txt(lug.grad, q.yos[i]),
    gumus: q.gumus[i],
    gumusg: txt(lug.grad, q.gumusg[i]),
    fosfor: q.fosfor[i],
    fosforg: txt(lug.grad, q.fosforg[i]),
    kaliy: q.kaliy[i],
    kaliyg: txt(lug.grad, q.kaliyg[i]),
    sifat: q.sifat[i],
    balandlik: q.balandlik[i],
    qiyalik: q.qiyalik[i],
    yonalish: q.yonalish[i],
    ekin: Object.fromEntries(EKIN_YILLAR.map((y) => [y, ekinRoyxat(ekinUstun(p, y)[i], lug.ekin)])) as Kontur['ekin'],
    // Faqat haqiqiy ERA5 ma'lumoti — namuna tavsiyaga ta'sir qilmaydi
    iqlim: iqlimTavsiya(i),
  }
}

function ekinRoyxat(l: [number, number][] | undefined, lug: string[] | undefined) {
  return (l ?? []).map(([e, u]) => ({ nom: lug![e], ulush: u }))
}

/** kontur_raq -> massiv indeksi */
let idIndex: Map<number, number> | null = null
export function indexById(id: number): number | undefined {
  if (!idIndex) {
    idIndex = new Map()
    pack!.col.id.forEach((v, i) => idIndex!.set(v, i))
  }
  return idIndex.get(id)
}

// ------------------------------------------------------- ko'rsatish nomlari
export const FOYD_NOM: Record<string, string> = {
  bosh: "bo'sh",
  haydalma: 'haydalma',
  lalmi: 'lalmi',
  bog: "bog'",
  uzumzor: 'uzumzor',
  tutzor: 'tutzor',
  tomorqa: 'tomorqa',
  yaylov: 'yaylov',
  qurilish: 'qurilish',
}

export const SUG_NOM = ["qx yeri emas", 'lalmi', "sug'oriladigan"]

export const DARAJA_NOM = ['Juda kam', 'Kam', "O'rtacha", "Ko'p", "Juda ko'p"]

export const MEX_NOM: Record<number, string> = {
  1: 'Qumli',
  2: 'Qumoq',
  3: "O'rta qumoq",
  4: "Og'ir qumoq",
  8: 'Gilli',
}

export const SHOR_NOM: Record<number, string> = {
  1: "Sho'rlanmagan",
  2: 'Kuchsiz',
  3: "O'rtacha",
  4: 'Kuchli',
  5: 'Juda kuchli',
  6: "Sho'rxok",
}

/** Tuproq ma'lumotining konturga mos kelish darajasi (fazoviy bog'lash sifati) */
export const SIFAT_NOM = ["Ma'lumot yo'q", 'Past aniqlik', "O'rta aniqlik", 'Yuqori aniqlik']

/** Yo'nalish gradusdan nomga */
export function yonalishNom(deg: number): string {
  if (deg < 0) return '—'
  const n = ['Shimol', 'Shimoli-sharq', 'Sharq', 'Janubi-sharq', 'Janub', "Janubi-g'arb", "G'arb", "Shimoli-g'arb"]
  return n[Math.round(deg / 45) % 8]
}

export const GURUH_NOM: Record<string, string> = {
  boshoqli: "Boshoqli",
  texnika: 'Texnika',
  dukkakli: 'Dukkakli',
  sabzavot: 'Sabzavot',
  poliz: 'Poliz',
  yem: 'Yem-xashak',
  kopyillik: "Ko'p yillik",
  boshqa: 'Boshqa',
}
