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
          className="scrollbar-thin max-h-[calc(100vh-12rem)] w-[268px] overflow-y-auto rounded-card float-panel"
        >
          <div className="sticky top-0 z-10 border-b border-line bg-surface p-2">
            <div className="relative">
              <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
              <input
                autoFocus
                value={qidiruv}
                onChange={(e) => setQidiruv(e.target.value)}
                placeholder="Ekin nomi"
                className="w-full rounded-card border border-line bg-paper py-1.5 pr-2 pl-7 text-[12px] placeholder:text-faint focus:border-leaf focus:outline-none"
              />
            </div>
          </div>

          {daraxt.length === 0 && (
            <div className="px-3 py-6 text-center text-[11.5px] text-muted">Ekin topilmadi</div>
          )}

          {daraxt.map(({ msm, guruhlar }) => (
            <div key={msm} className="border-b border-line p-2 last:border-b-0">
              <div className="mb-1 px-1 text-[10px] font-medium tracking-wide text-faint uppercase">
                {MAVSUM_NOM[msm]}
              </div>
              {guruhlar.map(([g, list]) => (
                <div key={g} className="mb-1.5 last:mb-0">
                  <div className="px-1 py-0.5 text-[10px] text-faint">{GURUH_NOM[g] ?? g}</div>
                  <div className="flex flex-wrap gap-1">
                    {list.map((c) => (
                      <button
                        key={c.id}
                        onClick={() => {
                          setTavsiyaEkin(tavsiyaEkin === c.id ? null : c.id)
                          setOchiq(false)
                        }}
                        className={cn(
                          'rounded-sm border px-1.5 py-[3px] text-[11px] transition-colors',
                          tavsiyaEkin === c.id
                            ? 'border-leaf bg-leaf-soft font-medium text-leaf-dark'
                            : 'border-line text-muted hover:border-line-strong hover:text-ink',
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
      )}

      <button
        onClick={() => setOchiq(!ochiq)}
        title={tanlangan ? `${tanlangan.nom} mosligi — bekor qilish uchun X` : 'Ekin mosligi'}
        className={cn(
          'flex size-8 shrink-0 items-center justify-center rounded-card transition-colors',
          tanlangan
            ? 'border border-leaf bg-leaf text-white shadow-[0_1px_2px_rgb(22_32_26/0.12)]'
            : ochiq
              ? 'float-panel bg-leaf-soft! text-leaf-dark'
              : 'float-panel text-muted hover:text-ink',
        )}
      >
        <Sprout className="size-4" strokeWidth={1.75} />
      </button>

      {tanlangan && (
        <button
          onClick={() => {
            setTavsiyaEkin(null)
            setOchiq(false)
          }}
          title="Ekin mosligini bekor qilish"
          className="float-panel flex size-8 shrink-0 items-center justify-center rounded-card text-muted transition-colors hover:text-ink"
        >
          <X className="size-4" strokeWidth={1.9} />
        </button>
      )}
    </div>
  )
}
