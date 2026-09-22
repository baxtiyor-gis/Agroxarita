import { useState } from 'react'
import { Search, ChevronDown, RotateCcw, X } from 'lucide-react'
import { useApp, faolFiltrSoni, type Filtr } from '@/store/useApp'
import { attrs, DARAJA_NOM, FOYD_NOM, SHOR_NOM } from '@/lib/data'
import { cn } from '@/lib/utils'

function Bolim({
  nom,
  ochiq,
  onToggle,
  belgi,
  children,
}: {
  nom: string
  ochiq: boolean
  onToggle: () => void
  belgi?: number
  children: React.ReactNode
}) {
  return (
    <div className="border-b border-line">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-3 py-2.5 text-left transition-colors hover:bg-surface"
      >
        <span className="eyebrow flex items-center gap-1.5">
          {nom}
          {!!belgi && (
            <span className="nums rounded-full bg-leaf px-[5px] text-[10px] leading-[15px] font-semibold text-white">
              {belgi}
            </span>
          )}
        </span>
        <ChevronDown
          className={cn('size-3.5 text-faint transition-transform', ochiq && 'rotate-180')}
        />
      </button>
      {ochiq && <div className="space-y-2.5 px-3 pt-0.5 pb-3">{children}</div>}
    </div>
  )
}

function Chip({
  faol,
  onClick,
  children,
}: {
  faol: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        'rounded-[4px] border px-[7px] py-[3px] text-[11px] transition-colors',
        faol
          ? 'border-leaf-line bg-leaf-soft font-medium text-leaf-dark'
          : 'border-line bg-surface text-muted hover:border-line-strong hover:text-ink',
      )}
    >
      {children}
    </button>
  )
}

function Oraliq({
  qiymat,
  min,
  max,
  qadam = 1,
  birlik = '',
  onChange,
}: {
  qiymat: [number, number]
  min: number
  max: number
  qadam?: number
  birlik?: string
  onChange: (v: [number, number]) => void
}) {
  return (
    <div>
      <div className="nums mb-1 flex justify-between text-[11px]">
        <span className="text-ink">
          {qiymat[0]}
          {birlik}
        </span>
        <span className="text-ink">
          {qiymat[1]}
          {birlik}
        </span>
      </div>
      <div className="flex gap-1.5">
        <input
          type="range"
          min={min}
          max={max}
          step={qadam}
          value={qiymat[0]}
          onChange={(e) => onChange([Math.min(+e.target.value, qiymat[1]), qiymat[1]])}
          className="h-1 flex-1 accent-leaf"
        />
        <input
          type="range"
          min={min}
          max={max}
          step={qadam}
          value={qiymat[1]}
          onChange={(e) => onChange([qiymat[0], Math.max(+e.target.value, qiymat[0])])}
          className="h-1 flex-1 accent-leaf"
        />
      </div>
    </div>
  )
}

const köp = (arr: number[], v: number) =>
  arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]

export function FiltrPanel() {
  const { filtr, setFiltr, tozalaFiltr, tayyor } = useApp()
  const [ochiq, setOchiq] = useState<string | null>('hudud')
  const p = tayyor ? attrs() : null

  const faol = faolFiltrSoni(filtr)
  const t = (k: keyof Filtr, v: unknown) => setFiltr({ [k]: v } as Partial<Filtr>)

  if (!p) return null

  return (
    <div className="flex h-full flex-col bg-paper">
      {/* Qidiruv */}
      <div className="shrink-0 border-b border-line p-2.5">
        <div className="relative">
          <Search className="absolute top-1/2 left-2 size-3.5 -translate-y-1/2 text-faint" />
          <input
            value={filtr.qidiruv}
            onChange={(e) => t('qidiruv', e.target.value)}
            placeholder="14:01:06566 yoki MFY nomi"
            className="nums w-full rounded-card border border-line bg-surface py-[7px] pr-7 pl-7 text-[12px] text-ink placeholder:text-faint focus:border-leaf focus:ring-2 focus:ring-leaf-soft focus:outline-none"
          />
          {filtr.qidiruv && (
            <button
              onClick={() => t('qidiruv', '')}
              className="absolute top-1/2 right-1.5 -translate-y-1/2 rounded p-0.5 text-faint hover:text-ink"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto">
        <Bolim
          nom="Hudud"
          ochiq={ochiq === 'hudud'}
          onToggle={() => setOchiq(ochiq === 'hudud' ? null : 'hudud')}
          belgi={(filtr.massiv.length ? 1 : 0) + (filtr.mfy.length ? 1 : 0)}
        >
          <div>
            <div className="mb-1.5 text-[11px] text-body">Massiv</div>
            <div className="flex flex-wrap gap-1">
              {p.lug.massiv.map((m, i) =>
                m ? (
                  <Chip key={i} faol={filtr.massiv.includes(i)} onClick={() => t('massiv', köp(filtr.massiv, i))}>
                    {m}
                  </Chip>
                ) : null,
              )}
            </div>
          </div>
        </Bolim>

        <Bolim
          nom="Yer"
          ochiq={ochiq === 'yer'}
          onToggle={() => setOchiq(ochiq === 'yer' ? null : 'yer')}
          belgi={filtr.foyd.length ? 1 : 0}
        >
          <div>
            <div className="mb-1.5 text-[11px] text-body">Hozirgi foydalanish</div>
            <div className="flex flex-wrap gap-1">
              {p.lug.foyd.map((f, i) => (
                <Chip key={i} faol={filtr.foyd.includes(i)} onClick={() => t('foyd', köp(filtr.foyd, i))}>
                  {FOYD_NOM[f] ?? f}
                </Chip>
              ))}
            </div>
          </div>
          <div>
            <div className="mb-1.5 text-[11px] text-body">Maydon, ga</div>
            <Oraliq qiymat={filtr.maydon} min={0} max={302} onChange={(v) => t('maydon', v)} />
          </div>
        </Bolim>

        <Bolim
          nom="Tuproq"
          ochiq={ochiq === 'tuproq'}
          onToggle={() => setOchiq(ochiq === 'tuproq' ? null : 'tuproq')}
          belgi={filtr.shor.length ? 1 : 0}
        >
          <div>
            <div className="mb-1.5 text-[11px] text-body">Bonitet, ball</div>
            <Oraliq qiymat={filtr.bonitet} min={30} max={90} onChange={(v) => t('bonitet', v)} />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] text-body">Sho'rlanish</div>
            <div className="flex flex-wrap gap-1">
              {[1, 2, 3, 6].map((v) => (
                <Chip key={v} faol={filtr.shor.includes(v)} onClick={() => t('shor', köp(filtr.shor, v))}>
                  {SHOR_NOM[v]}
                </Chip>
              ))}
            </div>
          </div>
        </Bolim>

        <Bolim
          nom="Agrokimyo"
          ochiq={ochiq === 'agro'}
          onToggle={() => setOchiq(ochiq === 'agro' ? null : 'agro')}
          belgi={
            (filtr.gumus.length ? 1 : 0) + (filtr.fosfor.length ? 1 : 0) + (filtr.kaliy.length ? 1 : 0)
          }
        >
          {(
            [
              ['gumus', 'Gumus'],
              ['fosfor', 'Fosfor'],
              ['kaliy', 'Kaliy'],
            ] as const
          ).map(([key, nom]) => (
            <div key={key}>
              <div className="mb-1.5 text-[11px] text-body">{nom}</div>
              <div className="flex flex-wrap gap-1">
                {[0, 1, 2, 3, 4].map((v) => (
                  <Chip
                    key={v}
                    faol={filtr[key].includes(v)}
                    onClick={() => t(key, köp(filtr[key], v))}
                  >
                    {DARAJA_NOM[v]}
                  </Chip>
                ))}
              </div>
            </div>
          ))}
        </Bolim>

        <Bolim
          nom="Relyef"
          ochiq={ochiq === 'relyef'}
          onToggle={() => setOchiq(ochiq === 'relyef' ? null : 'relyef')}
        >
          <div>
            <div className="mb-1.5 text-[11px] text-body">Balandlik, m</div>
            <Oraliq
              qiymat={filtr.balandlik}
              min={600}
              max={1400}
              qadam={10}
              onChange={(v) => t('balandlik', v)}
            />
          </div>
          <div>
            <div className="mb-1.5 text-[11px] text-body">Qiyalik, °</div>
            <Oraliq
              qiymat={filtr.qiyalik}
              min={0}
              max={70}
              onChange={(v) => t('qiyalik', v)}
            />
          </div>
        </Bolim>

      </div>

      {faol > 0 && (
        <div className="shrink-0 border-t border-line bg-surface px-3 py-2">
          <button
            onClick={tozalaFiltr}
            className="flex items-center gap-1.5 text-[11.5px] text-muted hover:text-ink"
          >
            <RotateCcw className="size-3" />
            {faol} ta filtrni tozalash
          </button>
        </div>
      )}
    </div>
  )
}
