import { useMemo } from 'react'
import { useApp } from '@/store/useApp'
import { attrs, crops, ustun } from '@/lib/data'
import { SHKALA, klassOl, YOQ_RANG } from '@/lib/ranglar'
import { baholash } from '@/lib/tavsiya'
import { kontur } from '@/lib/data'

/**
 * Klasslangan legenda — har bir katak aniq diapazon va konturlar soni bilan.
 * Katakka bosilsa xaritada faqat o'sha klass qoladi.
 */
export function Legenda() {
  const { qatlam, tavsiyaEkin, tayyor, klassFiltr, setKlassFiltr } = useApp()
  const sh = SHKALA[qatlam]

  // Har bir klassda nechta kontur borligini sanaymiz
  const sanoq = useMemo(() => {
    if (!tayyor) return null
    const p = attrs()
    const n = sh.klasslar.map(() => 0)
    let yoq = 0

    const qiymat = (i: number): number => {
      if (qatlam === 'tavsiya') {
        const crop = crops().find((x) => x.id === tavsiyaEkin)
        return crop ? baholash(crop, kontur(i)).ball : -1
      }
      return ustun(qatlam)?.[i] ?? -1
    }

    for (let i = 0; i < p.n; i++) {
      const v = qiymat(i)
      if (v < 0) {
        yoq++
        continue
      }
      const idx = sh.klasslar.findIndex((k) => v >= k.min && v < k.max)
      if (idx >= 0) n[idx]++
      else n[n.length - 1]++
    }
    return { n, yoq }
  }, [qatlam, tavsiyaEkin, tayyor, sh])

  // Tematik ranglash yo'q — legenda ham kerak emas
  if (qatlam === 'yoq') return null
  if (qatlam === 'tavsiya' && !tavsiyaEkin) return null

  const ekin = crops().find((c) => c.id === tavsiyaEkin)

  return (
    <div className="pointer-events-auto absolute right-3 bottom-8 z-10 flex max-h-[calc(100%-340px)] min-h-[160px] w-[290px] flex-col overflow-hidden rounded-card float-panel">
      <div className="border-b border-line px-3.5 py-2.5">
        <div className="text-[13.5px] font-semibold text-navy">
          {qatlam === 'tavsiya' && ekin ? `${ekin.nom} mosligi` : sh.nom}
        </div>
        <div className="mt-0.5 text-[11px] text-muted">
          {qatlam === 'tavsiya' ? 'moslik bali, 0–100' : sh.izoh} · bosib filtrlash
        </div>
      </div>

      <div className="scrollbar-thin min-h-0 flex-auto overflow-y-auto px-1.5 py-1.5">
        {sh.klasslar.map((k, i) => {
          const soni = sanoq?.n[i] ?? 0
          const tanlangan = klassFiltr === i
          const sonsiz = soni === 0
          return (
            <button
              key={i}
              onClick={() => setKlassFiltr(tanlangan ? null : i)}
              disabled={sonsiz}
              className={[
                'flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left transition-colors',
                sonsiz ? 'opacity-35' : 'hover:bg-sunken',
                tanlangan ? 'bg-leaf-soft font-medium ring-1 ring-leaf-line' : '',
              ].join(' ')}
            >
              <span
                className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10"
                style={{ background: k.rang }}
              />
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{k.nom}</span>
              {k.oraliq && (
                <span className="nums shrink-0 text-[10.5px] text-faint">{k.oraliq}</span>
              )}
              <span className="nums w-10 shrink-0 text-right text-[11px] text-muted">
                {soni.toLocaleString('ru')}
              </span>
            </button>
          )
        })}

        {!!sanoq?.yoq && (
          <button
            onClick={() => setKlassFiltr(klassFiltr === -2 ? null : -2)}
            className={[
              'mt-1 flex w-full items-center gap-2.5 rounded-md border-t border-line px-2 py-[5px] text-left transition-colors hover:bg-sunken',
              klassFiltr === -2 ? 'bg-leaf-soft' : '',
            ].join(' ')}
          >
            <span
              className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10"
              style={
                qatlam === 'ekin'
                  ? { background: 'transparent', boxShadow: 'inset 0 0 0 1.5px var(--color-outline)' }
                  : { background: YOQ_RANG }
              }
            />
            <span className="flex-1 text-[12px] text-muted">Ma'lumot yo'q</span>
            <span className="nums w-10 shrink-0 text-right text-[11px] text-muted">
              {sanoq.yoq.toLocaleString('ru')}
            </span>
          </button>
        )}
      </div>

      {klassFiltr !== null && (
        <button
          onClick={() => setKlassFiltr(null)}
          className="w-full border-t border-line py-2 text-[12px] font-medium text-leaf-dark hover:bg-sunken"
        >
          Filtrni bekor qilish
        </button>
      )}
    </div>
  )
}

/** Kartochkada ishlatish uchun — qiymatning klass nomi */
export function klassNomi(qatlam: Parameters<typeof klassOl>[0], v: number) {
  return klassOl(qatlam, v)?.nom ?? null
}
