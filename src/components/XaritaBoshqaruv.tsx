import { useEffect, useRef, useState } from 'react'
import {
  Layers,
  Home,
  Plus,
  Minus,
  Satellite,
  Map as MapIcon,
  X,
} from 'lucide-react'
import { useApp } from '@/store/useApp'
import { cn } from '@/lib/utils'

function Tugma({
  onClick,
  title,
  faol,
  children,
}: {
  onClick: () => void
  title: string
  faol?: boolean
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      title={title}
      className={cn(
        'flex size-8 items-center justify-center transition-colors',
        faol ? 'bg-leaf-soft text-leaf-dark' : 'text-muted hover:bg-paper hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

/** Qatlam qatori — chap tomonda ko'rsatkich, o'ngda boshqaruv */
function Qator({
  nom,
  izoh,
  yoqilgan,
  onToggle,
  children,
}: {
  nom: string
  izoh?: string
  yoqilgan: boolean
  onToggle: () => void
  children?: React.ReactNode
}) {
  return (
    <div className="px-2.5 py-2">
      <label className="flex cursor-pointer items-start gap-2">
        <input
          type="checkbox"
          checked={yoqilgan}
          onChange={onToggle}
          className="mt-[3px] accent-leaf"
        />
        <span className="min-w-0 flex-1">
          <span className="block text-[12px] leading-tight font-medium">{nom}</span>
          {izoh && <span className="mt-0.5 block text-[10.5px] text-faint">{izoh}</span>}
        </span>
      </label>
      {yoqilgan && children && <div className="mt-2 pl-[22px]">{children}</div>}
    </div>
  )
}

export function XaritaBoshqaruv({
  onZoom,
  onHome,
}: {
  onZoom: (d: number) => void
  onHome: () => void
}) {
  const {
    asos,
    setAsos,
    hillshade,
    toggleHillshade,
    konturKorinsin,
    toggleKonturKorinsin,
  } = useApp()

  const [ochiq, setOchiq] = useState(false)
  const panel = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!ochiq) return
    const h = (e: MouseEvent) => {
      if (panel.current && !panel.current.contains(e.target as Node)) setOchiq(false)
    }
    document.addEventListener('mousedown', h)
    return () => document.removeEventListener('mousedown', h)
  }, [ochiq])

  return (
    <div className="pointer-events-auto flex items-start gap-1.5">
      {ochiq && (
        <div
          ref={panel}
          className="w-[228px] overflow-hidden rounded-card float-panel"
        >
          <div className="flex items-center justify-between border-b border-line px-2.5 py-1.5">
            <span className="text-[11px] font-medium tracking-wide text-muted uppercase">
              Qatlamlar
            </span>
            <button
              onClick={() => setOchiq(false)}
              className="-mr-1 rounded p-0.5 text-faint hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          </div>

          {/* Basemap */}
          <div className="border-b border-line px-2.5 py-2">
            <div className="mb-1.5 text-[12px] font-medium">Asos xarita</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(
                [
                  ['sputnik', "Sun'iy yo'ldosh", Satellite],
                  ['osm', 'OpenStreetMap', MapIcon],
                ] as const
              ).map(([id, nom, Icon]) => (
                <button
                  key={id}
                  onClick={() => setAsos(id)}
                  className={cn(
                    'flex flex-col items-center gap-1 rounded-card border py-2 text-[10.5px] transition-colors',
                    asos === id
                      ? 'border-leaf bg-leaf-soft font-medium text-leaf-dark'
                      : 'border-line text-muted hover:border-line-strong hover:text-ink',
                  )}
                >
                  <Icon className="size-4" strokeWidth={1.6} />
                  {nom}
                </button>
              ))}
            </div>
          </div>

          {/* DEM */}
          <div className="border-b border-line">
            <Qator nom="Relyef (DEM)" yoqilgan={hillshade} onToggle={toggleHillshade} />
          </div>

          {/* Kontur */}
          <Qator nom="Konturlar" yoqilgan={konturKorinsin} onToggle={toggleKonturKorinsin} />
        </div>
      )}

      {/* Vertikal boshqaruv ustuni */}
      <div className="flex flex-col overflow-hidden rounded-card float-panel">
        <Tugma onClick={() => setOchiq(!ochiq)} title="Qatlamlar" faol={ochiq}>
          <Layers className="size-4" strokeWidth={1.7} />
        </Tugma>
        <div className="h-px bg-line" />
        <Tugma onClick={onHome} title="Butun tumanni ko'rsatish">
          <Home className="size-4" strokeWidth={1.7} />
        </Tugma>
        <div className="h-px bg-line" />
        <Tugma onClick={() => onZoom(1)} title="Yaqinlashtirish">
          <Plus className="size-4" strokeWidth={1.9} />
        </Tugma>
        <div className="h-px bg-line" />
        <Tugma onClick={() => onZoom(-1)} title="Uzoqlashtirish">
          <Minus className="size-4" strokeWidth={1.9} />
        </Tugma>
      </div>
    </div>
  )
}
