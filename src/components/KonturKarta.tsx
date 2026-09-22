import { useMemo, useState } from 'react'
import {
  X,
  Check,
  AlertTriangle,
  Ban,
  ChevronDown,
  Mountain,
  Layers,
  Sprout,
  Info,
  Droplets,
} from 'lucide-react'
import { useApp } from '@/store/useApp'
import {
  crops,
  kontur,
  FOYD_NOM,
  DARAJA_NOM,
  MEX_NOM,
  SHOR_NOM,
  SIFAT_NOM,
  yonalishNom,
} from '@/lib/data'
import { tavsiyalar, ballRang, ballNom, mavsum, MAVSUM_NOM, type Mavsum } from '@/lib/tavsiya'

/** Kartochkada ko'rsatish tartibi — asosiy ekish mavsumlari */
const MAVSUMLAR: [Mavsum, string][] = [
  ['kuzgi', MAVSUM_NOM.kuzgi],
  ['bahorgi', MAVSUM_NOM.bahorgi],
]
import type { Sabab, Tavsiya } from '@/lib/types'
import { cn, ga } from '@/lib/utils'
import { Shkala, Darajalar } from './Shkala'

type Tab = 'tavsiya' | 'tuproq' | 'relyef' | 'malumot'

const TABLAR: { id: Tab; nom: string; icon: typeof Sprout }[] = [
  { id: 'tavsiya', nom: 'Tavsiya', icon: Sprout },
  { id: 'tuproq', nom: 'Tuproq', icon: Layers },
  { id: 'relyef', nom: 'Relyef', icon: Mountain },
  { id: 'malumot', nom: "Ma'lumot", icon: Info },
]

function SababIkon({ turi }: { turi: Sabab['turi'] }) {
  if (turi === 'ok') return <Check className="mt-[2px] size-3 shrink-0 text-leaf" strokeWidth={2.5} />
  if (turi === 'ogoh')
    return <AlertTriangle className="mt-[2px] size-3 shrink-0 text-wheat" strokeWidth={2.2} />
  return <Ban className="mt-[2px] size-3 shrink-0 text-clay" strokeWidth={2.2} />
}

function TavsiyaQator({ t, ochiq, onToggle }: { t: Tavsiya; ochiq: boolean; onToggle: () => void }) {
  const rang = ballRang(t.ball)
  return (
    <div className={cn('rounded-card border transition-colors', ochiq ? 'border-line-strong bg-surface shadow-[0_1px_2px_rgb(22_32_26/0.05)]' : 'border-transparent hover:bg-surface')}>
      <button
        onClick={onToggle}
        className="flex w-full items-center gap-2.5 px-2.5 py-2 text-left"
      >
        <span className="nums w-3 shrink-0 text-[11px] text-faint">{t.crop.nom ? '' : ''}</span>
        <span className="flex-1 truncate text-[13px] font-medium text-ink">{t.crop.nom}</span>
        <span className="nums shrink-0 text-[13px] font-semibold tabular-nums" style={{ color: rang }}>
          {t.ball}
        </span>
        <span className="w-14 shrink-0 text-right text-[10px] text-muted">{ballNom(t.ball)}</span>
        <ChevronDown
          className={cn('size-3.5 shrink-0 text-faint transition-transform', ochiq && 'rotate-180')}
        />
      </button>
      <div className="px-2.5 pb-1.5">
        <div className="h-[4px] w-full overflow-hidden rounded-full bg-sunken">
          <div className="h-full rounded-full transition-all" style={{ width: `${t.ball}%`, background: rang }} />
        </div>
      </div>
      {ochiq && (
        <div className="space-y-1.5 border-t border-line px-2.5 py-2.5">
          {t.sabablar.map((s, i) => (
            <div key={i} className="flex gap-1.5 text-[11.5px] leading-relaxed text-body">
              <SababIkon turi={s.turi} />
              <span>{s.matn}</span>
            </div>
          ))}
          {t.crop.muddat && (
            <div className="mt-2 border-t border-line pt-2 text-[11px] leading-snug text-muted">
              <span className="text-faint">Ekish muddati: </span>
              {t.crop.muddat.split(';')[0]}
            </div>
          )}
          {t.crop.suv_matn && (
            <div className="flex gap-1 text-[11px] text-muted">
              <Droplets className="mt-[2px] size-3 shrink-0 text-water" strokeWidth={2} />
              {t.crop.suv_matn.split(',')[0]}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function Satr({ nom, qiymat, children }: { nom: string; qiymat?: string; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-[7px]">
      <span className="w-[88px] shrink-0 pt-[1px] text-[11px] text-muted">{nom}</span>
      <div className="min-w-0 flex-1">
        {qiymat && <div className="nums text-[12.5px] leading-tight text-ink">{qiymat}</div>}
        {children}
      </div>
    </div>
  )
}

export function KonturKarta() {
  const { tanlangan, setTanlangan } = useApp()
  const [tab, setTab] = useState<Tab>('tavsiya')
  const [ochiq, setOchiq] = useState<string | null>(null)

  const k = useMemo(() => (tanlangan === null ? null : kontur(tanlangan)), [tanlangan])
  const tav = useMemo(() => (k ? tavsiyalar(crops(), k) : []), [k])

  if (!k) return null

  const mos = tav.filter((t) => t.ball >= 25)
  const nomos = tav.filter((t) => t.ball < 25)
  const birinchi = mos[0]?.crop.id ?? null
  const hozirOchiq = ochiq ?? birinchi

  return (
    <div className="pointer-events-auto absolute top-3 bottom-3 left-3 z-20 flex w-[400px] flex-col overflow-hidden rounded-card float-panel">
      {/* Sarlavha */}
      <div className="shrink-0 border-b border-line bg-surface px-3.5 pt-3 pb-2.5">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="nums text-[15px] font-semibold tracking-tight text-ink">{k.kod}</div>
            <div className="mt-0.5 truncate text-[11.5px] text-muted">
              {k.massiv} massivi{k.mfy ? ` · ${k.mfy} MFY` : ''}
            </div>
          </div>
          <button
            onClick={() => setTanlangan(null)}
            className="-mt-0.5 -mr-1 rounded p-1 text-faint hover:bg-paper hover:text-ink"
          >
            <X className="size-4" />
          </button>
        </div>
        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="nums rounded-[4px] bg-sunken px-[7px] py-[2px] font-medium text-ink">{ga(k.maydon)} ga</span>
          <span className="rounded-[4px] bg-sunken px-[7px] py-[2px] text-body">{FOYD_NOM[k.foyd]}</span>
          {k.sifat < 2 && (
            <span className="rounded-[4px] bg-wheat-soft px-[7px] py-[2px] text-wheat">
              ma'lumot to'liq emas
            </span>
          )}
        </div>
      </div>

      {/* Tablar */}
      <div className="flex shrink-0 border-b border-line bg-surface px-1.5">
        {TABLAR.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={cn(
              'flex items-center gap-1.5 border-b-2 px-2.5 py-2 text-[12px] transition-colors',
              tab === t.id
                ? 'border-leaf font-medium text-ink'
                : 'border-transparent text-muted hover:border-line-strong hover:text-ink',
            )}
          >
            <t.icon className="size-3.5" strokeWidth={1.75} />
            {t.nom}
          </button>
        ))}
      </div>

      {/* Mazmun */}
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-2 py-2">
        {tab === 'tavsiya' && (
          <>
            {mos.length === 0 && (
              <div className="px-2 py-8 text-center text-[12px] text-muted">
                Bu konturga mos ekin topilmadi.
                <div className="mt-1 text-[11px] text-faint">
                  {nomos[0]?.radSabab ?? "Shart-sharoit qishloq xo'jaligiga yaroqsiz"}
                </div>
              </div>
            )}
            {/* Ko'p yillik ekinzorda tavsiya boshqa ma'noga ega — almashtirish
                emas, qatorlar orasiga qo'shimcha ekin */}
            {['bog', 'uzumzor', 'tutzor'].includes(k.foyd) && mos.length > 0 && (
              <div className="mx-2.5 mb-2.5 rounded-card border border-leaf-line bg-leaf-soft px-2.5 py-2 text-[11.5px] leading-relaxed text-leaf-dark">
                Konturda {k.foyd === 'bog' ? "bog'" : k.foyd} mavjud va u saqlanadi. Quyidagi
                ekinlar <span className="font-medium">qatorlar orasiga</span> ekish uchun tavsiya
                etiladi.
              </div>
            )}

            {/* Mavsum bo'yicha — bug'doy (kuzgi) va g'o'za (bahorgi) raqib emas,
                ular almashlab ekish tizimining turli qismlari */}
            {MAVSUMLAR.map(([msm, nom]) => {
              const list = mos.filter((t) => mavsum(t.crop) === msm).slice(0, 5)
              if (!list.length) return null
              return (
                <div key={msm} className="mb-2.5">
                  <div className="mb-1 flex items-center gap-1.5 px-2.5">
                    <span className="eyebrow">{nom}</span>
                    <span className="h-px flex-1 bg-line" />
                  </div>
                  <div className="space-y-0.5">
                    {list.map((t, i) => (
                      <div key={t.crop.id} className="flex items-start gap-1.5">
                        <span className="nums mt-2 w-3.5 shrink-0 text-right text-[11px] text-faint">
                          {i + 1}
                        </span>
                        <div className="min-w-0 flex-1">
                          <TavsiyaQator
                            t={t}
                            ochiq={hozirOchiq === t.crop.id}
                            onToggle={() => setOchiq(hozirOchiq === t.crop.id ? '' : t.crop.id)}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )
            })}

            {nomos.length > 0 && (
              <div className="mt-3 border-t border-line px-2.5 pt-2.5">
                <div className="mb-1.5 text-[11px] font-medium text-muted">
                  Mos kelmaydi ({nomos.length})
                </div>
                <div className="flex flex-wrap gap-1">
                  {nomos.slice(0, 10).map((t) => (
                    <span
                      key={t.crop.id}
                      title={t.radSabab ?? ''}
                      className="cursor-help rounded-sm bg-surface px-1.5 py-0.5 text-[11px] text-muted"
                    >
                      {t.crop.nom}
                    </span>
                  ))}
                  {nomos.length > 10 && (
                    <span className="px-1 py-0.5 text-[11px] text-faint">+{nomos.length - 10}</span>
                  )}
                </div>
                {nomos[0]?.radSabab && (
                  <div className="mt-1.5 text-[10.5px] text-faint">
                    Asosiy sabab: {nomos[0].radSabab.toLowerCase()}
                  </div>
                )}
              </div>
            )}
          </>
        )}

        {tab === 'tuproq' && (
          <div className="divide-y divide-line px-2.5">
            <Satr nom="Bonitet" qiymat={k.bonitet >= 0 ? `${k.bonitet} ball` : "o'rganilmagan"}>
              {k.bonitet < 0 && (k.foyd === 'lalmi' || k.foyd === 'yaylov') && (
                <div className="mt-1 text-[11px] text-muted">
                  {k.foyd === 'lalmi' ? 'Lalmi' : 'Yaylov'} yerlarda tuproq bonitirovkasi odatda
                  o'tkazilmagan — dala tekshiruvi kerak
                </div>
              )}
              {k.bonitet >= 0 && (
                <div className="mt-1.5 pr-1">
                  <Shkala qiymat={k.bonitet} min={35} max={85} />
                  <div className="nums mt-1 flex justify-between text-[9.5px] text-faint">
                    <span>35</span>
                    <span>85</span>
                  </div>
                </div>
              )}
            </Satr>
            <Satr
              nom="Gumus"
              qiymat={k.gumus >= 0 ? `${DARAJA_NOM[k.gumus]}${k.gumusg ? ` · ${k.gumusg} %` : ''}` : '—'}
            >
              <div className="mt-1.5">
                <Darajalar daraja={k.gumus} />
              </div>
            </Satr>
            <Satr
              nom="Fosfor"
              qiymat={
                k.fosfor >= 0 ? `${DARAJA_NOM[k.fosfor]}${k.fosforg ? ` · ${k.fosforg} mg/kg` : ''}` : '—'
              }
            >
              <div className="mt-1.5">
                <Darajalar daraja={k.fosfor} />
              </div>
            </Satr>
            <Satr
              nom="Kaliy"
              qiymat={
                k.kaliy >= 0 ? `${DARAJA_NOM[k.kaliy]}${k.kaliyg ? ` · ${k.kaliyg} mg/kg` : ''}` : '—'
              }
            >
              <div className="mt-1.5">
                <Darajalar daraja={k.kaliy} />
              </div>
            </Satr>
            <Satr nom="Mexanika" qiymat={MEX_NOM[k.mex] ?? '—'} />
            <Satr nom="Sho'rlanish" qiymat={SHOR_NOM[k.shor] ?? '—'} />
            <Satr nom="Yer osti suvi" qiymat={k.yos ? `${k.yos} m` : '—'} />
          </div>
        )}

        {tab === 'relyef' && (
          <div className="divide-y divide-line px-2.5">
            <Satr nom="Balandlik" qiymat={k.balandlik >= 0 ? `${k.balandlik} m` : '—'}>
              {k.balandlik >= 0 && (
                <div className="mt-1.5 pr-1">
                  <Shkala qiymat={k.balandlik} min={620} max={1400} rang="var(--color-wheat)" />
                  <div className="nums mt-1 flex justify-between text-[9.5px] text-faint">
                    <span>620 m</span>
                    <span>1400 m</span>
                  </div>
                </div>
              )}
            </Satr>
            <Satr
              nom="Qiyalik"
              qiymat={
                k.qiyalik >= 0
                  ? `${k.qiyalik.toFixed(1)}° · ${k.qiyalik < 3 ? 'tekis' : k.qiyalik < 8 ? 'yengil nishab' : 'tik'}`
                  : '—'
              }
            >
              {k.qiyalik >= 0 && (
                <div className="mt-1 text-[11px] text-muted">
                  {k.qiyalik < 3
                    ? 'Mexanizatsiyaga qulay'
                    : k.qiyalik < 8
                      ? 'Texnika ishlashi mumkin'
                      : 'Eroziya xavfi, terrasalash kerak'}
                </div>
              )}
            </Satr>
            <Satr nom="Yo'nalish" qiymat={yonalishNom(k.yonalish)}>
              {k.yonalish >= 0 && (
                <div className="mt-1 text-[11px] text-muted">
                  {[3, 4, 5].includes(Math.round(k.yonalish / 45) % 8)
                    ? 'Quyoshli yon — issiqsevar ekinlarga qulay'
                    : 'Salqin yon'}
                </div>
              )}
            </Satr>
          </div>
        )}

        {tab === 'malumot' && (
          <div className="divide-y divide-line px-2.5">
            <Satr nom="Bog'lanish" qiymat={SIFAT_NOM[k.sifat]} />
            <Satr nom="Kadastr kodi" qiymat={k.kod} />
            <Satr nom="Kontur raqami" qiymat={String(k.id)} />
            <Satr nom="Massiv" qiymat={k.massiv ?? '—'} />
            <Satr nom="MFY" qiymat={k.mfy ?? '—'} />
            <div className="py-3 text-[11px] leading-relaxed text-muted">
              Tuproq va agrokimyo ma'lumotlari fazoviy bog'lash orqali olingan: kontur bilan eng
              katta kesishma maydoniga ega poligon tanlangan.
              {k.sifat < 2 && (
                <span className="mt-1.5 block text-wheat">
                  Bu konturda qoplama ulushi past — tavsiyalar taxminiy.
                </span>
              )}
            </div>
          </div>
        )}
      </div>

    </div>
  )
}
