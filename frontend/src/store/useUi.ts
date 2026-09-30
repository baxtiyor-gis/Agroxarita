import { create } from 'zustand'
import type { AsosiyXarita } from '@/features/map/config'
import type { TematikId } from '@/features/map/tematik'

export type BolimId = 'hudud' | 'yer' | 'tuproq' | 'agrokimyo' | 'relyef'
/** qx — qishloq xo'jaligi yerlari (tur = sugoriladigan), qolgan — qolgan konturlar */
export type QatlamId = 'viloyat' | 'tuman' | 'massiv' | 'qx' | 'qolgan'

const KALIT = 'agroxarita.xarita'

interface Saqlangan {
  asosiy: AsosiyXarita
  qatlamlar: Record<QatlamId, boolean>
}

const BOSHLANGICH: Saqlangan = {
  asosiy: 'sputnik',
  qatlamlar: { viloyat: true, tuman: true, massiv: true, qx: true, qolgan: false },
}

function oqish(): Saqlangan {
  try {
    const xom = localStorage.getItem(KALIT)
    if (!xom) return BOSHLANGICH
    const v = JSON.parse(xom) as Partial<Saqlangan>
    return {
      asosiy: v.asosiy === 'osm' ? 'osm' : 'sputnik',
      qatlamlar: { ...BOSHLANGICH.qatlamlar, ...v.qatlamlar },
    }
  } catch {
    return BOSHLANGICH
  }
}

function yozish(s: Saqlangan) {
  try {
    localStorage.setItem(KALIT, JSON.stringify({ asosiy: s.asosiy, qatlamlar: s.qatlamlar }))
  } catch {
    /* localStorage mavjud emas */
  }
}

interface UiState extends Saqlangan {
  /** Sidebarda ochiq bo'lim (bir vaqtda bittasi) */
  faolBolim: BolimId | null
  toggleBolim: (id: BolimId) => void
  setAsosiy: (a: AsosiyXarita) => void
  toggleQatlam: (id: QatlamId) => void
  /** Xaritani ranglash (null — oddiy ko'rinish) */
  tematik: TematikId | null
  /** Legendada tanlangan klass (indeks; YOQ_KLASS — ma'lumotsizlar), null — filtr yo'q */
  klassFiltr: number | null
  setTematik: (id: TematikId | null) => void
  setKlassFiltr: (i: number | null) => void
}

export const useUi = create<UiState>((set, get) => ({
  ...oqish(),
  faolBolim: null,
  toggleBolim: (id) => set((s) => ({ faolBolim: s.faolBolim === id ? null : id })),
  setAsosiy: (asosiy) => {
    set({ asosiy })
    yozish(get())
  },
  tematik: null,
  klassFiltr: null,
  setTematik: (tematik) => set({ tematik, klassFiltr: null }),
  setKlassFiltr: (klassFiltr) => set({ klassFiltr }),
  toggleQatlam: (id) => {
    set((s) => ({ qatlamlar: { ...s.qatlamlar, [id]: !s.qatlamlar[id] } }))
    yozish(get())
  },
}))
