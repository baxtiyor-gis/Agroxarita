import { useState } from 'react'
import { Info, MapPin } from 'lucide-react'
import { InfoOyna } from '@/components/InfoOyna'
import { Button } from '@/components/ui/Button'
import { Select } from '@/components/ui/Select'
import { useTanlov } from '@/features/border/useTanlov'

export function Header() {
  const { viloyat, tuman, viloyatlar, tumanlar, setViloyat, setTuman } = useTanlov()
  const xato = 'border-clay text-clay'
  const [info, setInfo] = useState(false)
  return (
    <header className="z-30 flex h-[68px] shrink-0 items-center gap-3 border-b border-line bg-surface px-6">
      <InfoOyna ochiq={info} onYop={() => setInfo(false)} />
      <span className="shrink-0 text-[20px] font-semibold tracking-[-0.02em]">
        <span className="text-leaf">agro</span>
        <span className="text-navy">xarita</span>
      </span>
      <span className="h-7 w-px shrink-0 bg-line" />
      <div className="min-w-0 truncate text-[14px] font-medium text-body">
        O'zbekiston qishloq xo'jaligi yerlarining raqamli xaritasi
      </div>

      <Button className="ml-auto shrink-0 whitespace-nowrap" onClick={() => setInfo(true)}>
        <Info className="size-4 text-leaf" />
        Loyiha haqida
      </Button>
      <Select
        aria-label="Viloyat"
        value={viloyat ?? ''}
        placeholder={
          viloyatlar.isPending
            ? 'Yuklanmoqda…'
            : viloyatlar.isError
              ? "Yuklab bo'lmadi"
              : 'Barcha viloyatlar'
        }
        title={viloyatlar.isError ? viloyatlar.error.message : undefined}
        disabled={viloyatlar.isPending || viloyatlar.isError}
        className={viloyatlar.isError ? xato : undefined}
        icon={<MapPin className="size-4" />}
        onChange={(e) => setViloyat(e.target.value ? Number(e.target.value) : null)}
      >
        {viloyatlar.data?.map((v) => (
          <option key={v.region_id} value={v.region_id}>
            {v.nom}
          </option>
        ))}
      </Select>
      <Select
        aria-label="Tuman"
        value={tuman ?? ''}
        placeholder={
          viloyat == null
            ? 'Tuman'
            : tumanlar.isPending
              ? 'Yuklanmoqda…'
              : tumanlar.isError
                ? "Yuklab bo'lmadi"
                : 'Barcha tumanlar'
        }
        title={tumanlar.isError ? tumanlar.error.message : undefined}
        disabled={viloyat == null || tumanlar.isPending || tumanlar.isError}
        className={tumanlar.isError ? xato : undefined}
        icon={<MapPin className="size-4" />}
        onChange={(e) => setTuman(e.target.value ? Number(e.target.value) : null)}
      >
        {tumanlar.data?.map((t) => (
          <option key={t.kod} value={t.kod}>
            {t.nom}
          </option>
        ))}
      </Select>
    </header>
  )
}
