import { ChevronDown } from 'lucide-react'
import { Logo } from '@/components/Logo'
import { cn } from '@/lib/cn'
import { useUi, type BolimId } from '@/store/useUi'

const BOLIMLAR: { id: BolimId; nom: string }[] = [
  { id: 'hudud', nom: 'Hudud' },
  { id: 'yer', nom: 'Yer' },
  { id: 'tuproq', nom: 'Tuproq' },
  { id: 'agrokimyo', nom: 'Agrokimyo' },
  { id: 'relyef', nom: 'Relyef' },
]

export function Sidebar() {
  const faolBolim = useUi((s) => s.faolBolim)
  const toggleBolim = useUi((s) => s.toggleBolim)

  return (
    <aside className="sidebar-navy z-30 flex w-[320px] shrink-0 flex-col">
      <div className="flex h-[68px] shrink-0 items-center gap-2.5 px-4">
        <Logo size={34} />
        <div className="flex items-baseline">
          <span className="text-[22px] font-semibold tracking-[-0.02em] text-leaf">agro</span>
          <span className="text-[22px] font-semibold tracking-[-0.02em] text-white">xarita</span>
        </div>
      </div>

      <div className="scrollbar-dark min-h-0 flex-1 space-y-2 overflow-y-auto px-3 py-2">
        {BOLIMLAR.map(({ id, nom }) => {
          const ochiq = faolBolim === id
          return (
            <section key={id} className="rounded-card border border-line bg-surface">
              <button
                onClick={() => toggleBolim(id)}
                aria-expanded={ochiq}
                className="flex h-11 w-full items-center justify-between px-3.5 text-[13.5px] font-semibold text-ink"
              >
                {nom}
                <ChevronDown
                  className={cn('size-4 text-muted transition-transform', ochiq && 'rotate-180')}
                />
              </button>
              {ochiq && (
                <div className="border-t border-line px-3.5 py-4 text-[12.5px] text-muted">
                  Ma'lumot yo'q
                </div>
              )}
            </section>
          )
        })}
      </div>

      <div className="shrink-0 border-t border-line px-4 py-3 text-[11px] text-faint">
        © Qishloq xo'jaligi vazirligi
      </div>
    </aside>
  )
}
