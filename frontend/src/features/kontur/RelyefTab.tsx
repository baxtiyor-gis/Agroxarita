import type { Kontur } from './types'
import { Satr, Shkala } from './ui'

const IZOH: Record<string, string> = {
  tekis: 'Mexanizatsiyaga qulay',
  yengil: 'Texnika ishlashi mumkin',
  orta: "Eroziya xavfi o'rtacha — qator bo'ylab ishlov",
  tik: 'Eroziya xavfi, terrasalash kerak',
}

const son = (x: number, xona = 1) => x.toFixed(xona).replace('.', ',')

/** V1 Relyef tabi: Balandlik (shkala), Qiyalik (izoh), Yo'nalish (izoh) — Copernicus DEM (API) */
export function RelyefTab({ k }: { k: Kontur }) {
  const r = k.relyef
  const b = r?.balandlik
  if (!r || b?.ortacha == null) {
    return (
      <div className="px-3.5 py-6 text-center text-[12.5px] text-muted">
        Relyef ma'lumoti yo'q — balandlik faqat sug'oriladigan konturlar uchun hisoblangan.
      </div>
    )
  }
  const q = r.qiyalik
  const y = r.yonalish
  // janubiy yonbag'irlar (JSq, J, JG) — quyoshli
  const quyoshli = y.gradus != null && y.gradus >= 112.5 && y.gradus <= 247.5
  return (
    <div className="divide-y divide-line px-2.5">
      <Satr nom="Balandlik" qiymat={`${son(b.ortacha, 0)} m`}>
        {b.min != null && b.max != null && (
          <div className="mt-1.5 pr-1">
            <Shkala qiymat={b.ortacha} min={b.min} max={Math.max(b.max, b.min + 1)} rang="var(--color-wheat)" />
            <div className="nums mt-1 flex justify-between text-[9.5px] text-faint">
              <span>{son(b.min, 0)} m</span>
              <span>{son(b.max, 0)} m</span>
            </div>
          </div>
        )}
      </Satr>
      {q.ortacha != null && (
        <Satr nom="Qiyalik" qiymat={`${son(q.ortacha)}° · ${q.sinf_nom ?? '—'}`}>
          {q.sinf && <div className="mt-1 text-[11px] text-muted">{IZOH[q.sinf]}</div>}
        </Satr>
      )}
      {y.nom && (
        <Satr nom="Yo'nalish" qiymat={y.nom}>
          <div className="mt-1 text-[11px] text-muted">
            {quyoshli ? 'Quyoshli yon — issiqsevar ekinlarga qulay' : 'Salqin yon'}
          </div>
        </Satr>
      )}
    </div>
  )
}
