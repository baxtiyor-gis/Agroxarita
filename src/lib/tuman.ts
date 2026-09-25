/**
 * Tumanlar — har birining ma'lumotlari alohida papkada:
 * public/data/<id>/ (attrs.json, geom.geojson, iqlim.json, relyef.webp,
 * relyef.json, gorizontal.geojson). crops.json — umumiy, public/data/ da.
 */
export interface Tuman {
  id: string
  /** To'liq nomi: "Bulung'ur tumani" */
  nom: string
  /** Qisqa nomi: "Bulung'ur" */
  qisqa: string
  viloyat: string
  /** Gorizontallar izohi (qatlamlar panelida). relyef.json dagi `gorizontalIzoh` ustun turadi */
  gorizontalIzoh?: string
  /** Kontur kartasidagi balandlik shkalasi, m. Yo'q bo'lsa — konturlar oralig'idan */
  balandlikShkala?: [number, number]
}

export const TUMANLAR: Tuman[] = [
  {
    id: 'bulungur',
    nom: "Bulung'ur tumani",
    qisqa: "Bulung'ur",
    viloyat: 'Samarqand viloyati',
    gorizontalIzoh: 'har 10 m (1100 m gacha), asosiy — 50 m',
    // Dalalarning asosiy qismi; yuqorisi tog' yaylovlari (shkala to'lib qoladi)
    balandlikShkala: [620, 1400],
  },
  {
    id: 'fargona',
    nom: "Farg'ona tumani",
    qisqa: "Farg'ona",
    viloyat: "Farg'ona viloyati",
  },
]

export const SUKUT_TUMAN = TUMANLAR[0].id

export const tumanOl = (id: string): Tuman => TUMANLAR.find((t) => t.id === id) ?? TUMANLAR[0]

/** URL dagi `?tuman=` — noto'g'ri yoki yo'q bo'lsa sukut (Bulung'ur) */
export function urlTuman(): string {
  if (typeof window === 'undefined') return SUKUT_TUMAN
  const id = new URLSearchParams(window.location.search).get('tuman')
  return TUMANLAR.some((t) => t.id === id) ? id! : SUKUT_TUMAN
}

/** Tanlangan tumanni URL ga yozadi (sukut tuman — parametrsiz), tarixga qo'shmaydi */
export function urlgaYoz(id: string) {
  const u = new URL(window.location.href)
  if (id === SUKUT_TUMAN) u.searchParams.delete('tuman')
  else u.searchParams.set('tuman', id)
  if (u.href !== window.location.href) window.history.replaceState(window.history.state, '', u)
}

/** Tuman ma'lumot fayli manzili */
export const tumanUrl = (tuman: string, f: string) => `${import.meta.env.BASE_URL}data/${tuman}/${f}`

/** Tuman ma'lumotlari topilmadi (fayl yo'q — server index.html qaytardi yoki 404) */
export class MalumotYoqXato extends Error {
  fayl: string
  constructor(fayl: string) {
    super(`Ma'lumot topilmadi: ${fayl}`)
    this.fayl = fayl
    this.name = 'MalumotYoqXato'
  }
}

/**
 * JSON faylni o'qish. SPA serveri yo'q faylga index.html (200) qaytaradi —
 * shuning uchun matn `<` bilan boshlansa ham "fayl yo'q" deb hisoblanadi.
 */
export async function jsonOl<T>(url: string, signal?: AbortSignal): Promise<T> {
  const r = await fetch(url, { signal })
  if (!r.ok) throw new MalumotYoqXato(url)
  const t = await r.text()
  if (/^\s*</.test(t)) throw new MalumotYoqXato(url)
  return JSON.parse(t) as T
}
