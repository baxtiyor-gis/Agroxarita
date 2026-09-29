import { create } from 'zustand'
import { setJoriyOy } from '@/lib/iqlim'
import { attrs, yerTuri } from '@/lib/data'
import { urlTuman } from '@/lib/tuman'

export type Qatlam =
  /** Tematik ranglash yo'q — faqat kontur chegaralari */
  | 'yoq'
  | 'tavsiya'
  | 'bonitet'
  | 'gumus'
  | 'fosfor'
  | 'kaliy'
  | 'shor'
  | 'balandlik'
  | 'qiyalik'
  | 'foyd'
  | 'ekin22'
  | 'ekin23'
  | 'ekin24'
  | 'ekin25'
  | 'ekin26'
  | 'fah'
  | 'sovuqsiz'
  | 'bahorgiSovuq'
  | 'issiqKun'
  | 'yillikYogin'
  | 'suvTanqislik'
  | 'oyHarorat'
  | 'oyYogin'

export interface Filtr {
  qidiruv: string
  massiv: number[]
  mfy: number[]
  sug: number[]
  /** YER_TURLARI indekslari */
  foyd: number[]
  maydon: [number, number]
  bonitet: [number, number]
  shor: number[]
  gumus: number[]
  fosfor: number[]
  kaliy: number[]
  balandlik: [number, number]
  qiyalik: [number, number]
  faqatIshonchli: boolean
}

export const BOSH_FILTR: Filtr = {
  qidiruv: '',
  massiv: [],
  mfy: [],
  sug: [],
  foyd: [],
  maydon: [0, 302],
  bonitet: [30, 90],
  shor: [],
  gumus: [],
  fosfor: [],
  kaliy: [],
  balandlik: [600, 1400],
  qiyalik: [0, 70],
  faqatIshonchli: false,
}

interface App {
  /** Joriy tuman (TUMANLAR id si) — URL dagi ?tuman= bilan bir xil */
  tuman: string
  /**
   * Boshqa tumanga o'tish: ma'lumot qayta yuklanguncha tayyor = false,
   * tanlov, filtr va tematik qatlam tozalanadi (yangi tumanda ma'nosi yo'q)
   */
  setTuman: (id: string) => void
  /** Tuman ma'lumotlarini yuklash xatosi: 'yoq' — fayllar hali qo'yilmagan */
  yuklashXato: 'yoq' | 'boshqa' | null
  setYuklashXato: (x: 'yoq' | 'boshqa' | null) => void

  tayyor: boolean
  setTayyor: (v: boolean) => void
  /** Xarita birinchi marta to'liq chizildi: asos xarita va konturlar */
  xaritaTayyor: boolean
  setXaritaTayyor: (v: boolean) => void

  qatlam: Qatlam
  setQatlam: (q: Qatlam) => void
  /** Oylik iqlim qatlamlari uchun tanlangan oy, 0 = yanvar */
  iqlimOy: number
  setIqlimOy: (oy: number) => void
  /** Tavsiya qatlami qaysi ekin bo'yicha ranglanadi */
  tavsiyaEkin: string | null
  setTavsiyaEkin: (id: string | null) => void

  /** Asos xarita: sun'iy yo'ldosh (sukut) yoki OpenStreetMap */
  asos: 'sputnik' | 'osm'
  setAsos: (a: 'sputnik' | 'osm') => void
  /** Kontur qatlami ko'rinadimi */
  konturKorinsin: boolean
  toggleKonturKorinsin: () => void
  /** Relyef (DEM) rasmi va gorizontallar — sukut bo'yicha o'chiq */
  relyefKorinsin: boolean
  toggleRelyef: () => void
  gorizontalKorinsin: boolean
  toggleGorizontal: () => void

  tanlangan: number | null
  setTanlangan: (i: number | null) => void


  /** Legendadan tanlangan klass: indeks, -2 = "ma'lumot yo'q", null = hammasi */
  klassFiltr: number | null
  setKlassFiltr: (i: number | null) => void

  filtr: Filtr
  setFiltr: (f: Partial<Filtr>) => void
  tozalaFiltr: () => void

  /** Filtrdan o'tgan kontur indekslari */
  natija: Set<number>
  hisobla: () => void
}

function filtrla(f: Filtr): Set<number> {
  const p = attrs()
  const c = p.col
  const out = new Set<number>()
  const q = f.qidiruv.trim().toLowerCase()
  const lug = p.lug
  const yt = yerTuri()

  const bosh =
    !q &&
    !f.massiv.length &&
    !f.mfy.length &&
    !f.sug.length &&
    !f.foyd.length &&
    !f.shor.length &&
    !f.gumus.length &&
    !f.fosfor.length &&
    !f.kaliy.length &&
    !f.faqatIshonchli &&
    f.maydon[0] <= BOSH_FILTR.maydon[0] &&
    f.maydon[1] >= BOSH_FILTR.maydon[1] &&
    f.bonitet[0] <= BOSH_FILTR.bonitet[0] &&
    f.bonitet[1] >= BOSH_FILTR.bonitet[1] &&
    f.balandlik[0] <= BOSH_FILTR.balandlik[0] &&
    f.balandlik[1] >= BOSH_FILTR.balandlik[1] &&
    f.qiyalik[0] <= BOSH_FILTR.qiyalik[0] &&
    f.qiyalik[1] >= BOSH_FILTR.qiyalik[1]

  for (let i = 0; i < p.n; i++) {
    if (bosh) {
      out.add(i)
      continue
    }
    if (f.faqatIshonchli && c.sifat[i] < 2) continue
    if (f.massiv.length && !f.massiv.includes(c.massiv[i])) continue
    if (f.mfy.length && !f.mfy.includes(c.mfy[i])) continue
    if (f.sug.length && !f.sug.includes(c.sug[i])) continue
    if (f.foyd.length && !f.foyd.includes(yt[i])) continue
    if (f.shor.length && !f.shor.includes(c.shor[i])) continue
    if (f.gumus.length && !f.gumus.includes(c.gumus[i])) continue
    if (f.fosfor.length && !f.fosfor.includes(c.fosfor[i])) continue
    if (f.kaliy.length && !f.kaliy.includes(c.kaliy[i])) continue

    const m = c.maydon[i]
    if (m < f.maydon[0] || m > f.maydon[1]) continue

    const b = c.bonitet[i]
    if (b >= 0 && (b < f.bonitet[0] || b > f.bonitet[1])) continue

    const h = c.balandlik[i]
    if (h >= 0 && (h < f.balandlik[0] || h > f.balandlik[1])) continue

    const qi = c.qiyalik[i]
    if (qi >= 0 && (qi < f.qiyalik[0] || qi > f.qiyalik[1])) continue

    if (q) {
      const kod = c.kod[i]?.toLowerCase() ?? ''
      const mfy = (c.mfy[i] >= 0 ? lug.mfy[c.mfy[i]] : '')?.toLowerCase() ?? ''
      const mas = (c.massiv[i] >= 0 ? lug.massiv[c.massiv[i]] : '')?.toLowerCase() ?? ''
      if (!kod.includes(q) && !mfy.includes(q) && !mas.includes(q)) continue
    }
    out.add(i)
  }
  return out
}

export const useApp = create<App>((set, get) => ({
  tuman: urlTuman(),
  setTuman: (tuman) => {
    if (tuman === get().tuman) return
    set({
      tuman,
      tayyor: false,
      xaritaTayyor: false,
      yuklashXato: null,
      tanlangan: null,
      qatlam: 'yoq',
      tavsiyaEkin: null,
      klassFiltr: null,
      filtr: BOSH_FILTR,
      natija: new Set<number>(),
    })
  },
  yuklashXato: null,
  setYuklashXato: (yuklashXato) => set({ yuklashXato }),

  tayyor: false,
  setTayyor: (v) => set({ tayyor: v }),
  xaritaTayyor: false,
  setXaritaTayyor: (xaritaTayyor) => set({ xaritaTayyor }),

  // Boshlang'ich holat: asl konturlar, tematik ranglashsiz
  qatlam: 'yoq',
  iqlimOy: 6,
  setIqlimOy: (iqlimOy) => {
    setJoriyOy(iqlimOy)
    set({ iqlimOy, klassFiltr: null })
  },
  // Qatlam almashsa legenda klasslari boshqacha — eski tanlov ma'nosini yo'qotadi
  setQatlam: (qatlam) =>
    set((s) => ({
      qatlam,
      klassFiltr: null,
      tavsiyaEkin: qatlam === 'tavsiya' ? s.tavsiyaEkin : null,
    })),
  tavsiyaEkin: null,
  // Ekin tanlanganda xarita o'sha ekin mosligi bo'yicha ranglanadi va
  // ochiq kontur kartasi yopiladi — ikki rejim bir vaqtda chalkashtiradi
  setTavsiyaEkin: (tavsiyaEkin) =>
    set({
      tavsiyaEkin,
      qatlam: tavsiyaEkin ? 'tavsiya' : 'yoq',
      klassFiltr: null,
      tanlangan: null,
    }),

  asos: 'sputnik',
  setAsos: (asos) => set({ asos }),
  konturKorinsin: true,
  toggleKonturKorinsin: () => set((s) => ({ konturKorinsin: !s.konturKorinsin })),
  relyefKorinsin: false,
  toggleRelyef: () => set((s) => ({ relyefKorinsin: !s.relyefKorinsin })),
  gorizontalKorinsin: false,
  toggleGorizontal: () => set((s) => ({ gorizontalKorinsin: !s.gorizontalKorinsin })),

  tanlangan: null,
  setTanlangan: (tanlangan) => set({ tanlangan }),


  klassFiltr: null,
  setKlassFiltr: (klassFiltr) => set({ klassFiltr }),

  filtr: BOSH_FILTR,
  setFiltr: (f) => {
    set((s) => ({ filtr: { ...s.filtr, ...f } }))
    get().hisobla()
  },
  tozalaFiltr: () => {
    set({ filtr: BOSH_FILTR })
    get().hisobla()
  },

  natija: new Set<number>(),
  hisobla: () => set({ natija: filtrla(get().filtr) }),
}))

/** Nechta filtr faol — panelda ko'rsatish uchun */
export function faolFiltrSoni(f: Filtr): number {
  let n = 0
  if (f.qidiruv.trim()) n++
  if (f.massiv.length) n++
  if (f.mfy.length) n++
  if (f.sug.length) n++
  if (f.foyd.length) n++
  if (f.shor.length) n++
  if (f.gumus.length) n++
  if (f.fosfor.length) n++
  if (f.kaliy.length) n++
  if (f.faqatIshonchli) n++
  if (f.maydon[0] > BOSH_FILTR.maydon[0] || f.maydon[1] < BOSH_FILTR.maydon[1]) n++
  if (f.bonitet[0] > BOSH_FILTR.bonitet[0] || f.bonitet[1] < BOSH_FILTR.bonitet[1]) n++
  if (f.balandlik[0] > BOSH_FILTR.balandlik[0] || f.balandlik[1] < BOSH_FILTR.balandlik[1]) n++
  if (f.qiyalik[0] > BOSH_FILTR.qiyalik[0] || f.qiyalik[1] < BOSH_FILTR.qiyalik[1]) n++
  return n
}
