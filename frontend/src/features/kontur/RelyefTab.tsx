import { relyefMock, yonalishNom } from './mock'
import { Satr, Shkala } from './ui'

/** V1 Relyef tabi: Balandlik (shkala), Qiyalik (izoh), Yo'nalish (izoh) — hammasi namuna */
export function RelyefTab({ id }: { id: number }) {
  const r = relyefMock(id)
  return (
    <div className="divide-y divide-line px-2.5">
      <Satr nom="Balandlik" qiymat={`${r.balandlik} m`} namuna>
        <div className="mt-1.5 pr-1">
          <Shkala qiymat={r.balandlik} min={r.hMin} max={r.hMax} rang="var(--color-wheat)" />
          <div className="nums mt-1 flex justify-between text-[9.5px] text-faint">
            <span>{r.hMin} m</span>
            <span>{r.hMax} m</span>
          </div>
        </div>
      </Satr>
      <Satr
        nom="Qiyalik"
        qiymat={`${r.qiyalik.toFixed(1).replace('.', ',')}° · ${r.qiyalik < 3 ? 'Tekis' : r.qiyalik < 8 ? 'Yengil nishab' : 'Tik'}`}
        namuna
      >
        <div className="mt-1 text-[11px] text-muted">
          {r.qiyalik < 3
            ? 'Mexanizatsiyaga qulay'
            : r.qiyalik < 8
              ? 'Texnika ishlashi mumkin'
              : 'Eroziya xavfi, terrasalash kerak'}
        </div>
      </Satr>
      <Satr nom="Yo'nalish" qiymat={yonalishNom(r.yonalish)} namuna>
        <div className="mt-1 text-[11px] text-muted">
          {[3, 4, 5].includes(Math.round(r.yonalish / 45) % 8)
            ? 'Quyoshli yon — issiqsevar ekinlarga qulay'
            : 'Salqin yon'}
        </div>
      </Satr>
    </div>
  )
}
