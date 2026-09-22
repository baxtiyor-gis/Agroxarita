import { useMemo } from 'react'
import { useApp } from '@/store/useApp'
import { attrs, crops } from '@/lib/data'
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
    const c = p.col
    const n = sh.klasslar.map(() => 0)
    let yoq = 0

    const qiymat = (i: number): number => {
      if (qatlam === 'tavsiya') {
        const crop = crops().find((x) => x.id === tavsiyaEkin)
        return crop ? baholash(crop, kontur(i)).ball : -1
      }
      const src: Record<string, number[]> = {
        bonitet: c.bonitet,
        gumus: c.gumus,
        fosfor: c.fosfor,
        kaliy: c.kaliy,
        shor: c.shor,
        balandlik: c.balandlik,
        qiyalik: c.qiyalik,
        foyd: c.foyd,
      }
      return src[qatlam]?.[i] ?? -1
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
    <div className="pointer-events-auto absolute right-3 bottom-3 z-10 w-[210px] overflow-hidden rounded-card float-panel">
      <div className="border-b border-line px-2.5 py-1.5">
        <div className="text-[11.5px] font-medium text-ink">
          {qatlam === 'tavsiya' && ekin ? `${ekin.nom} mosligi` : sh.nom}
        </div>
        {qatlam !== 'tavsiya' && <div className="text-[10px] text-faint">{sh.izoh}</div>}
      </div>

      <div className="py-1">
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
                'flex w-full items-center gap-2 px-2.5 py-[4px] text-left transition-colors',
                sonsiz ? 'opacity-35' : 'hover:bg-paper',
                tanlangan ? 'bg-leaf-soft font-medium' : '',
              ].join(' ')}
            >
              <span
                className="size-3 shrink-0 rounded-[3px] ring-1 ring-black/10"
                style={{ background: k.rang }}
              />
              <span className="min-w-0 flex-1 truncate text-[11px] text-body">{k.nom}</span>
              {k.oraliq && (
                <span className="nums shrink-0 text-[9.5px] text-faint">{k.oraliq}</span>
              )}
              <span className="nums w-8 shrink-0 text-right text-[10px] text-muted">
                {soni.toLocaleString('ru')}
              </span>
            </button>
          )
        })}

        {!!sanoq?.yoq && (
          <button
            onClick={() => setKlassFiltr(klassFiltr === -2 ? null : -2)}
            className={[
              'flex w-full items-center gap-2 border-t border-line px-2.5 py-[3px] text-left transition-colors hover:bg-paper',
              klassFiltr === -2 ? 'bg-leaf-soft' : '',
            ].join(' ')}
          >
            <span
              className="size-3 shrink-0 rounded-[3px] ring-1 ring-black/10"
              style={{ background: YOQ_RANG }}
            />
            <span className="flex-1 text-[11px] text-muted">ma'lumot yo'q</span>
            <span className="nums w-8 shrink-0 text-right text-[10px] text-muted">
              {sanoq.yoq.toLocaleString('ru')}
            </span>
          </button>
        )}
      </div>

      {klassFiltr !== null && (
        <button
          onClick={() => setKlassFiltr(null)}
          className="w-full border-t border-line py-1 text-[10.5px] text-muted hover:bg-paper hover:text-ink"
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
