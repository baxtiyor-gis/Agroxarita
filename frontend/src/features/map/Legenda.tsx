import { useUi } from '@/store/useUi'
import { useRelyefLegenda } from './api'
import { SHKALA, YOQ_KLASS, YOQ_NOM, YOQ_RANG, rasterTematikmi, type Klass } from './tematik'

const son = (v: number) => Math.round(v).toLocaleString('ru')

/** Tematik ranglash legendasi — xarita ustida; klassni bosib filtrlash (qayta bosilsa bekor) */
export function Legenda({ tuman }: { tuman: number | null }) {
  const tematik = useUi((s) => s.tematik)
  const klassFiltr = useUi((s) => s.klassFiltr)
  const setKlassFiltr = useUi((s) => s.setKlassFiltr)
  const raster = rasterTematikmi(tematik)
  const relyef = useRelyefLegenda(raster ? tuman : null)

  if (tematik == null || (raster && tuman == null)) return null
  const sh = SHKALA[tematik]

  let klasslar: Klass[] = sh.klasslar
  if (raster) {
    const d = relyef.data
    klasslar = d
      ? d.klasslar.map((k, i) => ({
          min: k.min,
          max: k.max,
          rang: k.rang,
          nom: sh.klasslar[i]?.nom ?? '',
          oraliq: `${son(k.min)}–${son(k.max)} m`,
        }))
      : []
  }

  return (
    <div className="float-panel pointer-events-auto absolute right-3 bottom-8 z-10 w-[270px] overflow-hidden rounded-card">
      <div className="border-b border-line px-3.5 py-2.5">
        <div className="text-[13.5px] font-semibold text-navy">{sh.nom}</div>
        <div className="mt-0.5 text-[11px] text-muted">
          {sh.izoh}
          {!raster && ' · bosib filtrlash'}
        </div>
      </div>
      <div className="px-1.5 py-1.5">
        {raster && relyef.isPending && <div className="px-2 py-2 text-[12px] text-muted">Yuklanmoqda…</div>}
        {raster && relyef.isError && <div className="px-2 py-2 text-[12px] text-muted">Legenda mavjud emas</div>}
        {klasslar.map((k, i) => {
          const tanlangan = klassFiltr === i
          const ichki = (
            <>
              <span className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10" style={{ background: k.rang }} />
              <span className="min-w-0 flex-1 truncate text-[12px] text-ink">{k.nom}</span>
              {k.oraliq && <span className="nums shrink-0 text-[10.5px] text-faint">{k.oraliq}</span>}
            </>
          )
          return raster ? (
            <div key={i} className="flex items-center gap-2.5 px-2 py-[5px]">
              {ichki}
            </div>
          ) : (
            <button
              key={i}
              onClick={() => setKlassFiltr(tanlangan ? null : i)}
              aria-pressed={tanlangan}
              title={k.nom}
              className={`flex w-full items-center gap-2.5 rounded-md px-2 py-[5px] text-left transition-colors hover:bg-sunken ${tanlangan ? 'bg-leaf-soft font-medium ring-1 ring-leaf-line' : ''}`}
            >
              {ichki}
            </button>
          )
        })}
        {!raster && !sh.kategoriyali && (
          <button
            onClick={() => setKlassFiltr(klassFiltr === YOQ_KLASS ? null : YOQ_KLASS)}
            aria-pressed={klassFiltr === YOQ_KLASS}
            className={`mt-1 flex w-full items-center gap-2.5 rounded-md border-t border-line px-2 py-[5px] text-left transition-colors hover:bg-sunken ${klassFiltr === YOQ_KLASS ? 'bg-leaf-soft' : ''}`}
          >
            <span className="size-3.5 shrink-0 rounded-[4px] ring-1 ring-black/10" style={{ background: YOQ_RANG }} />
            <span className="flex-1 text-[12px] text-muted">{sh.yoqNom ?? YOQ_NOM}</span>
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
