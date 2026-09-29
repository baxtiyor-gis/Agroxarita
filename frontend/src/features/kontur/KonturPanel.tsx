import { useEffect, useState } from 'react'
import { CloudSun, Info, Layers, Loader2, Mountain, Sprout, TriangleAlert, Wheat, X } from 'lucide-react'
import { useTanlov } from '@/features/border/useTanlov'
import { cn } from '@/lib/cn'
import { useKontur } from './api'
import { EkinlarTab } from './EkinlarTab'
import { TUR_NOMI, ga } from './format'
import { IqlimTab } from './IqlimTab'
import { MalumotTab } from './MalumotTab'
import { RelyefTab } from './RelyefTab'
import { TavsiyaTab } from './TavsiyaTab'
import { TuproqTab } from './TuproqTab'

type Tab = 'tavsiya' | 'ekinlar' | 'iqlim' | 'tuproq' | 'relyef' | 'malumot'

/** V1 tartibi va ikonkalari */
const TABLAR: { id: Tab; nom: string; icon: typeof Sprout }[] = [
  { id: 'tavsiya', nom: 'Tavsiya', icon: Sprout },
  { id: 'ekinlar', nom: 'Ekinlar', icon: Wheat },
  { id: 'iqlim', nom: 'Iqlim', icon: CloudSun },
  { id: 'tuproq', nom: 'Tuproq', icon: Layers },
  { id: 'relyef', nom: 'Relyef', icon: Mountain },
  { id: 'malumot', nom: "Ma'lumot", icon: Info },
]

/**
 * Tanlangan kontur paneli (`?kontur={id}`) — V1 `KonturKarta` tuzilishi.
 * X yoki Esc — yopadi.
 */
export function KonturPanel() {
  const { kontur, setKontur } = useTanlov()
  const q = useKontur(kontur)
  const [tab, setTab] = useState<Tab>('tavsiya')

  const ochiq = kontur != null
  useEffect(() => {
    if (!ochiq) return
    const bosildi = (e: KeyboardEvent) => e.key === 'Escape' && setKontur(null)
    window.addEventListener('keydown', bosildi)
    return () => window.removeEventListener('keydown', bosildi)
  }, [ochiq, setKontur])

  if (kontur == null) return null
  const k = q.data

  return (
    <div
      aria-label="Kontur ma'lumoti"
      className="float-panel absolute top-3 bottom-3 left-3 z-20 flex max-h-[820px] w-[400px] flex-col overflow-hidden rounded-card"
    >
      {/* Sarlavha */}
      <div className="shrink-0 bg-surface px-4 pt-3.5 pb-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="nums text-[18px] leading-tight font-semibold tracking-tight text-navy">
              Kontur {k ? k.kontur_raqami : kontur}
            </div>
            <div className="mt-0.5 truncate text-[12px] text-muted">
              {k
                ? `${k.massiv ? `${k.massiv} massivi` : k.tuman.nom}${k.mfy ? ` · ${k.mfy} MFY` : ''}`
                : ' '}
            </div>
          </div>
          <button
            onClick={() => setKontur(null)}
            aria-label="Yopish"
            title="Yopish (Esc)"
            className="-mt-0.5 -mr-1.5 rounded-md p-1.5 text-muted hover:bg-sunken hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        {k && (
          <div className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11.5px]">
            <span className="nums rounded-full bg-sunken px-2.5 py-[3px] font-semibold text-ink">
              {ga(k.maydon)} ga
            </span>
            <span className="flex items-center gap-1.5 rounded-full bg-sunken px-2.5 py-[3px] text-body">
              <span
                className={cn(
                  'size-2.5 rounded-full ring-1 ring-black/10',
                  k.tur === 'sugoriladigan' ? 'bg-clay' : 'bg-water',
                )}
              />
              {TUR_NOMI[k.tur] ?? k.tur}
            </span>
          </div>
        )}
      </div>

      {/* Tablar */}
      <div
        role="tablist"
        aria-label="Kontur ma'lumotlari"
        className="grid shrink-0 grid-cols-6 border-y border-line bg-surface"
      >
        {TABLAR.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            role="tab"
            aria-selected={tab === t.id}
            className={cn(
              '-mb-px flex flex-col items-center justify-center gap-1 border-b-2 pt-2 pb-1.5 text-[11px] transition-colors',
              tab === t.id ? 'border-leaf font-semibold text-navy' : 'border-transparent text-muted hover:text-ink',
            )}
          >
            <t.icon className="size-4" strokeWidth={1.8} />
            {t.nom}
          </button>
        ))}
      </div>

      {/* Mazmun */}
      <div className="scrollbar-thin min-h-0 flex-auto overflow-y-auto px-2 py-2.5">
        {q.isPending && (
          <div className="flex items-center justify-center gap-2 py-10 text-[12px] text-muted">
            <Loader2 className="size-4 animate-spin" />
            Yuklanmoqda…
          </div>
        )}
        {q.isError && (
          <div className="mx-2.5 flex items-start gap-2 rounded-lg border border-clay/30 bg-clay-soft px-3 py-2.5 text-[12px] text-clay">
            <TriangleAlert className="mt-px size-4 shrink-0" />
            <span>
              Kontur ma'lumotini yuklab bo'lmadi: {q.error.message}
              <button onClick={() => q.refetch()} className="ml-2 font-semibold underline">
                Qayta urinish
              </button>
            </span>
          </div>
        )}
        {k && tab === 'tavsiya' && <TavsiyaTab id={k.id} />}
        {k && tab === 'ekinlar' && <EkinlarTab id={k.id} maydon={k.maydon} />}
        {k && tab === 'iqlim' && <IqlimTab id={k.id} />}
        {k && tab === 'tuproq' && <TuproqTab k={k} />}
        {k && tab === 'relyef' && <RelyefTab k={k} />}
        {k && tab === 'malumot' && <MalumotTab k={k} />}
      </div>
    </div>
  )
}
