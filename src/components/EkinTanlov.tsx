import { useEffect, useMemo, useRef, useState } from 'react'
import { Sprout, X, Search } from 'lucide-react'
import { useApp } from '@/store/useApp'
import { crops, GURUH_NOM } from '@/lib/data'
import { mavsum, MAVSUM_NOM, type Mavsum } from '@/lib/tavsiya'
import { cn } from '@/lib/utils'

const TARTIB: Mavsum[] = ['kuzgi', 'bahorgi']

/**
 * Ekin mosligi — alohida boshqaruv.
 *
 * Ekin tanlanganda xarita o'sha ekin uchun moslik bali bo'yicha ranglanadi:
 * agronom "qaysi konturga bug'doy?" degan savolga bir qarashda javob oladi.
 */
export function EkinTanlov() {
  const { tavsiyaEkin, setTavsiyaEkin } = useApp()
  const [ochiq, setOchiq] = useState(false)
  const [qidiruv, setQidiruv] = useState('')
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ochiq) return
    const h = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOchiq(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ochiq])

  const tanlangan = crops().find((c) => c.id === tavsiyaEkin)

  // Mavsum → guruh → ekinlar
  const daraxt = useMemo(() => {
    const q = qidiruv.trim().toLowerCase()
    const list = q ? crops().filter((c) => c.nom.toLowerCase().includes(q)) : crops()
    const out: { msm: Mavsum; guruhlar: [string, typeof list][] }[] = []
    for (const msm of TARTIB) {
      const mavsumda = list.filter((c) => mavsum(c) === msm)
      if (!mavsumda.length) continue
      const g = new Map<string, typeof list>()
      for (const c of mavsumda) {
        const arr = g.get(c.guruh) ?? []
        arr.push(c)
        g.set(c.guruh, arr)
      }
      out.push({ msm, guruhlar: [...g.entries()] })
    }
    return out
  }, [qidiruv])

  return (
    <div className="pointer-events-auto flex items-start justify-end gap-1.5">
      {ochiq && (
        <div
          ref={panel}
          className="flex max-h-[calc(100vh-320px)] min-h-[240px] w-[300px] flex-col overflow-hidden rounded-card float-panel"
        >
          <div className="shrink-0 border-b border-line px-3.5 pt-3 pb-3">
            <div className="flex items-start justify-between gap-2">
              <div>
                <div className="text-[14px] font-semibold text-navy">Ekin mosligi</div>
                <div className="mt-0.5 text-[11.5px] leading-snug text-muted">
                  Tanlangan ekin uchun har bir kontur baholanadi
                </div>
              </div>
              <button
                onClick={() => setOchiq(false)}
                aria-label="Yopish"
                className="-mr-1 rounded-md p-1 text-muted hover:bg-sunken hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <div className="relative mt-2.5">
              <Search className="absolute top-1/2 left-2.5 size-4 -translate-y-1/2 text-faint" />
              <input
                autoFocus
                value={qidiruv}
                onChange={(e) => setQidiruv(e.target.value)}
                placeholder="Ekin nomi bo'yicha qidirish"
                className="h-9 w-full rounded-lg border border-line bg-surface pr-2 pl-8 text-[13px] text-ink placeholder:text-faint focus:border-leaf focus:ring-2 focus:ring-leaf-soft focus:outline-none"
              />
            </div>
          </div>

          <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
            {daraxt.length === 0 && (
              <div className="px-3 py-8 text-center text-[12px] text-muted">Ekin topilmadi</div>
            )}

            {daraxt.map(({ msm, guruhlar }) => (
              <div key={msm} className="border-b border-line px-3.5 py-3 last:border-b-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="size-1.5 rounded-full bg-leaf" />
                  <span className="text-[12.5px] font-semibold text-ink">{MAVSUM_NOM[msm]}</span>
                </div>
                {guruhlar.map(([g, list]) => (
                  <div key={g} className="mb-2.5 last:mb-0">
                    <div className="mb-1 text-[11px] text-muted">{GURUH_NOM[g] ?? g}</div>
                    <div className="flex flex-wrap gap-1.5">
                      {list.map((c) => (
                        <button
                          key={c.id}
                          onClick={() => {
                            setTavsiyaEkin(tavsiyaEkin === c.id ? null : c.id)
                            setOchiq(false)
                          }}
                          aria-pressed={tavsiyaEkin === c.id}
                          className={cn(
                            'rounded-full border px-2.5 py-1 text-[12px] leading-none transition-colors',
                            tavsiyaEkin === c.id
                              ? 'border-leaf bg-leaf font-medium text-white'
                              : 'border-line text-body hover:border-leaf hover:text-leaf-dark',
                          )}
                        >
                          {c.nom}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      {tanlangan ? (
        <div className="flex h-10 items-center overflow-hidden rounded-card bg-leaf text-white shadow-[0_4px_12px_-2px_rgb(70_157_24/0.45)]">
          <button
            onClick={() => setOchiq(!ochiq)}
            title="Boshqa ekin tanlash"
            className="flex h-full items-center gap-1.5 pr-2.5 pl-3 text-[13px] font-medium transition-colors hover:bg-leaf-dark"
          >
            <Sprout className="size-4" strokeWidth={1.9} />
            {tanlangan.nom}
          </button>
          <button
            onClick={() => {
              setTavsiyaEkin(null)
              setOchiq(false)
            }}
            title="Ekin mosligini bekor qilish"
            aria-label="Ekin mosligini bekor qilish"
            className="flex h-full items-center border-l border-white/25 px-2.5 transition-colors hover:bg-leaf-dark"
          >
            <X className="size-4" strokeWidth={2} />
          </button>
        </div>
      ) : (
        <button
          onClick={() => setOchiq(!ochiq)}
          title="Ekin mosligi"
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-card float-panel transition-colors',
            ochiq ? 'bg-navy! text-white' : 'text-body hover:text-navy',
          )}
        >
          <Sprout className="size-[18px]" strokeWidth={1.8} />
        </button>
      )}
    </div>
  )
}
