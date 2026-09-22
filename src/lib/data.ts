import type { AttrPack, Crop, Kontur } from './types'

let pack: AttrPack | null = null
let cropList: Crop[] = []

export async function yukla() {
  const [a, c] = await Promise.all([
    fetch(`${import.meta.env.BASE_URL}data/attrs.json`).then((r) => r.json() as Promise<AttrPack>),
    fetch(`${import.meta.env.BASE_URL}data/crops.json`).then((r) => r.json() as Promise<Crop[]>),
  ])
  pack = a
  cropList = c
  return { pack: a, crops: c }
}

export const crops = () => cropList
export const attrs = () => pack!

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

export const DARAJA_NOM = ['juda kam', 'kam', "o'rtacha", "ko'p", "juda ko'p"]

export const MEX_NOM: Record<number, string> = {
  1: 'qumli',
  2: 'qumoq',
  3: "o'rta qumoq",
  4: "og'ir qumoq",
  8: 'gilli',
}

export const SHOR_NOM: Record<number, string> = {
  1: "sho'rlanmagan",
  2: 'kuchsiz',
  3: "o'rtacha",
  4: 'kuchli',
  5: 'juda kuchli',
  6: "sho'rxok",
}

export const SIFAT_NOM = ["bog'lanmagan", 'past', "o'rta", 'yuqori']

/** Yo'nalish gradusdan nomga */
export function yonalishNom(deg: number): string {
  if (deg < 0) return '—'
  const n = ['shimol', "shimoli-sharq", 'sharq', "janubi-sharq", 'janub', "janubi-g'arb", "g'arb", "shimoli-g'arb"]
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
