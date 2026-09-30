import { useState } from 'react'
import { Layers } from 'lucide-react'
import { useSearchParams } from 'react-router'
import { useUi, type QatlamId } from '@/store/useUi'
import type { AsosiyXarita } from './config'
import { SHKALA, TEMATIK_GURUHLAR, gradient, rasterTematikmi } from './tematik'

const ASOSIY: { id: AsosiyXarita; nom: string }[] = [
  { id: 'sputnik', nom: 'Sputnik' },
  { id: 'osm', nom: 'OSM' },
]
const QATLAMLAR: { id: QatlamId; nom: string }[] = [
  { id: 'viloyat', nom: 'Viloyat' },
  { id: 'tuman', nom: 'Tuman' },
  { id: 'massiv', nom: 'Massiv' },
  { id: 'qx', nom: "Qishloq xo'jaligi yerlari" },
  { id: 'qolgan', nom: 'Qolgan yerlar' },
]

const v = (nom: string) => `var(--color-${nom})`

/** Shartli belgi — xaritadagi uslub bilan bir xil (BorderLayers ranglari) */
function Belgi({ id, sputnik }: { id: QatlamId; sputnik: boolean }) {
  const chegara = v('navy')
  const chiziq = (style: React.CSSProperties) => (
    <span className="block w-full" style={{ height: 0, ...style }} />
  )
  const ichki = {
    viloyat: chiziq({ borderTop: `2px solid ${chegara}` }),
    tuman: chiziq({ borderTop: `3px solid ${v('sun')}`, boxShadow: `0 0 0 1px rgb(17 24 39 / 0.55)` }),
    // massiv: xaritadagidek — sputnikda oq punktir (oq panelda ko'rinsin: to'q chiziq ustida), OSMda navy
    massiv: (
      <svg width="24" height="8" viewBox="0 0 24 8" className="block">
        {sputnik && <line x1="0" y1="4" x2="24" y2="4" stroke="rgb(17 24 39 / 0.75)" strokeWidth="4.4" />}
        <line
          x1="1"
          y1="4"
          x2="23"
          y2="4"
          stroke={sputnik ? v('surface') : chegara}
          strokeWidth="2.2"
          strokeDasharray="5 3"
        />
      </svg>
    ),
    qx: (
      <span
        className="block h-3 w-5 rounded-[2px]"
        style={{ border: `1.5px solid ${sputnik ? v('outline') : v('clay')}` }}
      />
    ),
    qolgan: (
      <span
        className="block h-3 w-5 rounded-[2px]"
        style={{ border: `1.5px solid ${sputnik ? v('sky') : v('water')}` }}
      />
    ),
  }[id]
  return (
    <span aria-hidden className="flex h-4 w-7 shrink-0 items-center justify-center px-0.5">
      {ichki}
    </span>
  )
}

/** Qatlamlar tugmasi (MapControls ustuni ichida) va uning paneli */
export function LayersControl() {
  const [ochiq, setOchiq] = useState(false)
  const asosiy = useUi((s) => s.asosiy)
  const qatlamlar = useUi((s) => s.qatlamlar)
  const setAsosiy = useUi((s) => s.setAsosiy)
  const toggleQatlam = useUi((s) => s.toggleQatlam)
  const tematik = useUi((s) => s.tematik)
  const setTematik = useUi((s) => s.setTematik)
  const tumanParam = useSearchParams()[0].get('tuman')
  const tuman = tumanParam != null && /^\d+$/.test(tumanParam) ? Number(tumanParam) : null

  return (
    // relative yo'q: panel butun boshqaruv ustuniga nisbatan — tepadan boshlanadi
    <div>
      <button
        onClick={() => setOchiq((o) => !o)}
        aria-label="Qatlamlar"
        aria-expanded={ochiq}
        title="Qatlamlar"
        className="flex size-10 items-center justify-center text-body transition-colors hover:bg-sunken hover:text-navy"
      >
        <Layers className="size-4" />
      </button>
      {ochiq && (
        <div className="float-panel absolute top-0 right-[52px] scrollbar-thin max-h-[calc(100vh-96px)] w-72 overflow-y-auto rounded-card p-3 text-[13px] text-body">
          <div className="eyebrow mb-1.5">Asosiy xarita</div>
          {ASOSIY.map(({ id, nom }) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="radio"
                name="asosiy-xarita"
                checked={asosiy === id}
                onChange={() => setAsosiy(id)}
              />
              {nom}
            </label>
          ))}
          <div className="eyebrow mt-3 mb-1.5">Qatlamlar</div>
          {QATLAMLAR.map(({ id, nom }) => (
            <label key={id} className="flex cursor-pointer items-center gap-2 py-1">
              <input type="checkbox" checked={qatlamlar[id]} onChange={() => toggleQatlam(id)} />
              <Belgi id={id} sputnik={asosiy === 'sputnik'} />
              {nom}
            </label>
          ))}
          <div className="eyebrow mt-3 mb-1.5">Xaritani ranglash</div>
          <div role="radiogroup" aria-label="Tematik qatlam">
            <label className="flex cursor-pointer items-center gap-2 py-1">
              <input
                type="radio"
                name="tematik"
                checked={tematik === null}
                onChange={() => setTematik(null)}
              />
              Faqat kontur chegaralari
            </label>
            {TEMATIK_GURUHLAR.map((g) => (
              <div key={g.nom}>
                <div className="eyebrow mt-2 mb-0.5">{g.nom}</div>
                {g.idlar.map((id) => {
                  const sh = SHKALA[id]
                  const yoq = rasterTematikmi(id) && tuman == null
                  return (
                    <label
                      key={id}
                      className={`flex items-center gap-2 py-1 ${yoq ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'}`}
                      title={yoq ? 'Tuman tanlang' : undefined}
                    >
                      <input
                        type="radio"
                        name="tematik"
                        checked={tematik === id}
                        disabled={yoq}
                        onChange={() => setTematik(id)}
                      />
                      <span className="min-w-0 flex-1 truncate">{sh.nom}</span>
                      {yoq ? (
                        <span className="text-[10.5px] text-faint">Tuman tanlang</span>
                      ) : (
                        <span
                          aria-hidden
                          className="h-2.5 w-14 shrink-0 rounded-full ring-1 ring-black/10"
                          style={{ background: gradient(sh.klasslar) }}
                        />
                      )}
                    </label>
                  )
                })}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
