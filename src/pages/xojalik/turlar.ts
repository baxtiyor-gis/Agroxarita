type Pos = number[]
interface Polygon {
  type: 'Polygon'
  coordinates: Pos[][]
}
interface MultiPolygon {
  type: 'MultiPolygon'
  coordinates: Pos[][][]
}

/** Tavsiya sababi — [turi: 0 ok / 1 ogoh / 2 xato, AttrsFayl.lug indeksi] */
export type SababKod = [number, number]

export interface EkinBall {
  ekin: string
  ball: number
  sabab: SababKod[]
}

/** public/data/xojalik_attrs.json */
export interface AttrsFayl {
  /** Sabab matnlari lug'ati */
  lug: string[]
  konturlar: KonturXos[]
}

/**
 * public/data/xojalik_attrs.json dagi bitta yozuv. Geometriya alohida —
 * xojalik_geom.geojson, bog'lanish `id` orqali.
 */
export interface KonturXos {
  id: number
  tax_number: string
  cadastral_number: string | null
  contour_number: number | null
  area: number | null
  ball_bonitet: number | null
  /** Asosiy app konturi — eng katta kesishma (intersect, UTM 42N) */
  kontur: { id: number; kod: string; ulush: number } | null
  tuproq: { bonitet: number | null; mexanika: string | null; shor: string | null; yos: string | null } | null
  agrokimyo: { gumus: string | null; fosfor: string | null; kaliy: string | null } | null
  relyef: { balandlik: number | null; qiyalik: number | null; yonalish: string | null } | null
  /** Asosiy app tavsiya algoritmi (yer sug'oriladigan deb), mavsum bo'yicha top-5 */
  tavsiya: { kuzgi: EkinBall[]; bahorgi: EkinBall[] } | null
}

export interface GeomFC {
  type: 'FeatureCollection'
  features: { type: 'Feature'; id: number; geometry: Polygon | MultiPolygon }[]
}

export interface KonturF {
  type: 'Feature'
  id: number
  properties: KonturXos
  geometry: Polygon | MultiPolygon
}

export interface XojalikFC {
  type: 'FeatureCollection'
  features: KonturF[]
}

export type Bbox = [number, number, number, number]

/** Geometriyaning chegaraviy to'rtburchagi [g'arb, janub, sharq, shimol] */
export function bbox(g: Polygon | MultiPolygon, acc?: Bbox): Bbox {
  const b: Bbox = acc ? [...acc] : [Infinity, Infinity, -Infinity, -Infinity]
  const halqalar = g.type === 'Polygon' ? g.coordinates : g.coordinates.flat()
  for (const halqa of halqalar)
    for (const [x, y] of halqa) {
      if (x < b[0]) b[0] = x
      if (y < b[1]) b[1] = y
      if (x > b[2]) b[2] = x
      if (y > b[3]) b[3] = y
    }
  return b
}

/** Poligonning barcha tashqi halqalari (MultiPolygon uchun har bir qism) */
export function tashqiHalqalar(g: Polygon | MultiPolygon): Pos[][] {
  return g.type === 'Polygon' ? [g.coordinates[0]] : g.coordinates.map((p) => p[0])
}

/** Halqa maydoni (koordinata birligida) — faqat solishtirish uchun */
export function halqaMaydon(h: Pos[]): number {
  let a = 0
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) a += h[j][0] * h[i][1] - h[i][0] * h[j][1]
  return Math.abs(a / 2)
}

/** Nuqta halqa ichidami (ray casting) */
function ichida(x: number, y: number, h: Pos[]): boolean {
  let ic = false
  for (let i = 0, j = h.length - 1; i < h.length; j = i++) {
    const [xi, yi] = h[i]
    const [xj, yj] = h[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) ic = !ic
  }
  return ic
}

/** Nuqtadan kesmagacha masofa kvadrati */
function kesmaMasofa2(x: number, y: number, a: Pos, b: Pos): number {
  let [px, py] = a
  let dx = b[0] - px
  let dy = b[1] - py
  if (dx !== 0 || dy !== 0) {
    const t = ((x - px) * dx + (y - py) * dy) / (dx * dx + dy * dy)
    if (t > 1) [px, py] = b
    else if (t > 0) {
      px += dx * t
      py += dy * t
    }
  }
  dx = x - px
  dy = y - py
  return dx * dx + dy * dy
}

/**
 * Yorliq nuqtasi — polylabel ("pole of inaccessibility"): poligon ICHIDAGI,
 * chegaralardan eng uzoq nuqta. Og'irlik markazidan farqli, botiq shaklda ham
 * doim kontur ichida bo'ladi.
 *
 * `tosiqlar` — ustma-ust tushgan kichikroq konturlar: ular teshik sifatida
 * qaraladi, shunda katta konturning yorlig'i faqat o'ziga tegishli qismga tushadi.
 */
export function yorliqNuqta(g: Polygon | MultiPolygon, tosiqlar: Pos[][] = []): [number, number] {
  // MultiPolygon — eng katta qism
  const qism = g.type === 'Polygon' ? g.coordinates : g.coordinates.reduce((a, b) => (halqaMaydon(b[0]) > halqaMaydon(a[0]) ? b : a))
  const tashqi = qism[0]
  const teshiklar = [...qism.slice(1), ...tosiqlar]

  const ichkarida = (x: number, y: number) => ichida(x, y, tashqi) && !teshiklar.some((h) => ichida(x, y, h))
  /** Ishorali masofa: ichkarida musbat, tashqarida manfiy */
  const masofa = (x: number, y: number) => {
    let m = Infinity
    for (const h of [tashqi, ...teshiklar])
      for (let i = 0, j = h.length - 1; i < h.length; j = i++) m = Math.min(m, kesmaMasofa2(x, y, h[j], h[i]))
    return (ichkarida(x, y) ? 1 : -1) * Math.sqrt(m)
  }

  let [x0, y0, x1, y1] = [Infinity, Infinity, -Infinity, -Infinity]
  for (const [x, y] of tashqi) {
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  const kenglik = x1 - x0
  const balandlik = y1 - y0
  const olcham = Math.min(kenglik, balandlik)
  if (olcham === 0) return [x0, y0]
  const aniqlik = olcham / 200

  type Katak = { x: number; y: number; h: number; d: number; max: number }
  const katak = (x: number, y: number, h: number): Katak => {
    const d = masofa(x, y)
    return { x, y, h, d, max: d + h * Math.SQRT2 }
  }

  const navbat: Katak[] = []
  for (let x = x0; x < x1; x += olcham) for (let y = y0; y < y1; y += olcham) navbat.push(katak(x + olcham / 2, y + olcham / 2, olcham / 2))

  // Boshlang'ich eng yaxshi: tashqi halqa uchlarining o'rtachasi (ichkarida bo'lsa)
  const n = tashqi.length
  let eng = katak(tashqi.reduce((s, p) => s + p[0], 0) / n, tashqi.reduce((s, p) => s + p[1], 0) / n, 0)
  if (eng.d < 0) eng = navbat.reduce((a, b) => (b.d > a.d ? b : a), eng)

  while (navbat.length) {
    navbat.sort((a, b) => a.max - b.max)
    const k = navbat.pop()!
    if (k.d > eng.d) eng = k
    if (k.max - eng.d <= aniqlik) continue
    const h = k.h / 2
    navbat.push(katak(k.x - h, k.y - h, h), katak(k.x + h, k.y - h, h), katak(k.x - h, k.y + h, h), katak(k.x + h, k.y + h, h))
  }

  // Tosiqlar konturni butunlay yopgan bo'lsa — tosiqlarsiz qayta hisoblash
  if (eng.d <= 0 && tosiqlar.length) return yorliqNuqta(g)

  // Ko'z uchun o'rta — og'irlik markazi. U ichkarida va chegaradan yetarlicha
  // uzoq bo'lsa (to'rtburchak, oddiy shakllar) — shuni olamiz; botiq/ustma-ust
  // holatda markaz chegaraga yaqin yoki tashqarida — polylabel nuqtasi qoladi
  let a = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = tashqi.length - 1; i < tashqi.length; j = i++) {
    const k = tashqi[j][0] * tashqi[i][1] - tashqi[i][0] * tashqi[j][1]
    a += k
    cx += (tashqi[j][0] + tashqi[i][0]) * k
    cy += (tashqi[j][1] + tashqi[i][1]) * k
  }
  if (a !== 0) {
    const mx = cx / (3 * a)
    const my = cy / (3 * a)
    if (masofa(mx, my) >= eng.d * 0.5) return [mx, my]
  }
  return [eng.x, eng.y]
}

/** Javob haqiqatan ham konturli FeatureCollection ekanini tekshirish */
export function tekshir(d: unknown): d is XojalikFC {
  if (!d || typeof d !== 'object') return false
  const o = d as { type?: unknown; features?: unknown }
  if (o.type !== 'FeatureCollection' || !Array.isArray(o.features) || o.features.length === 0)
    return false
  return o.features.every(
    (f) =>
      f &&
      typeof f === 'object' &&
      typeof (f as KonturF).id === 'number' &&
      (f as KonturF).properties &&
      ((f as KonturF).geometry?.type === 'Polygon' ||
        (f as KonturF).geometry?.type === 'MultiPolygon'),
  )
}
