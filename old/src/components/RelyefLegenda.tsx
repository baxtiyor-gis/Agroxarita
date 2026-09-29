import type { RelyefMeta } from '@/lib/relyef'

/**
 * Ixcham balandlik shkalasi — masshtab chizig'i yonida.
 * Rang to'xtashlari teng oraliqda: vodiy (620–1000 m) tog'lar orasida
 * siqilib qolmasin.
 */
export function RelyefLegenda({ meta }: { meta: RelyefMeta }) {
  const { min, max, stops } = meta
  const n = stops.length - 1
  const gradient = `linear-gradient(to right, ${stops
    .map(([, c], i) => `${c} ${((i / n) * 100).toFixed(1)}%`)
    .join(', ')})`
  // Chetlar — haqiqiy min/max, ichida har ikkinchi to'xtash (chetga yopishganlari yo'q)
  const belgilar = stops
    .map(([v], i) => ({ v, i }))
    .filter(({ i }) => i > 0 && i < n - 1 && i % 2 === 0)

  return (
    <div className="pointer-events-none absolute bottom-3 left-[128px] z-10 w-[250px] rounded-md bg-white/90 px-2.5 pt-1.5 pb-1 shadow-sm ring-1 ring-black/5">
      <div className="mb-1 text-[10.5px] font-semibold text-navy">Balandlik, m</div>
      <div className="h-2 rounded-sm ring-1 ring-black/10" style={{ background: gradient }} />
      <div className="nums relative mt-0.5 h-3 text-[10px] text-muted">
        <span className="absolute left-0">{min}</span>
        {belgilar.map(({ v, i }) => (
          <span key={v} className="absolute -translate-x-1/2" style={{ left: `${(i / n) * 100}%` }}>
            {v}
          </span>
        ))}
        <span className="absolute right-0">{max}</span>
      </div>
    </div>
  )
}
