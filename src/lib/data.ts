import type { FeatureCollection } from 'geojson'
import type { AttrPack, Crop, Kontur } from './types'

let pack: AttrPack | null = null
let cropList: Crop[] = []
let geomFC: FeatureCollection | null = null
let bbox: [number, number, number, number] | null = null

export async function yukla() {
  const url = (f: string) => `${import.meta.env.BASE_URL}data/${f}`
  const [a, c, g] = await Promise.all([
    fetch(url('attrs.json')).then((r) => r.json() as Promise<AttrPack>),
    fetch(url('crops.json')).then((r) => r.json() as Promise<Crop[]>),
    // Geometriya ham shu yerda: xarita konturlar extentiga moslab quriladi,
    // shuning uchun u xaritadan oldin kerak
    fetch(url('geom.geojson')).then((r) => r.json() as Promise<FeatureCollection>),
  ])
  pack = a
  cropList = c
  geomFC = g
  bbox = hisoblaBbox(g)
  yerTuriCol = hisoblaYerTuri(a)
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

/** Tematik qatlam uchun kontur qiymatlari ustuni (-1 = ma'lumot yo'q) */
export function ustun(qatlam: string): number[] | null {
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
  }
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

export const SIFAT_NOM = ["Bog'lanmagan", 'Past', "O'rta", 'Yuqori']

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
