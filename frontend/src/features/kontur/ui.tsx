import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'
import { YOQ } from './format'

/** V1 `Satr`: 100px belgi + qiymat (13px); ostida ixtiyoriy izoh/shkala */
export function Satr({
  nom,
  qiymat,
  children,
}: {
  nom: string
  qiymat?: string | null
  children?: ReactNode
}) {
  const matn = qiymat === undefined ? undefined : (qiymat ?? YOQ)
  return (
    <div className="flex items-start gap-3 py-2.5">
      <span className="w-[150px] shrink-0 pt-[1px] text-[12px] text-muted">{nom}</span>
      <div className="min-w-0 flex-1">
        {matn && (
          <div
            className={cn(
              'nums flex items-center gap-1.5 text-[13px] leading-tight font-medium',
              qiymat ? 'text-ink' : 'text-faint',
            )}
          >
            {matn}
          </div>
        )}
        {children}
      </div>
    </div>
  )
}

/** V1 `Shkala`: qiymatni oraliqda ko'rsatuvchi chiziqcha */
export function Shkala({
  qiymat,
  min,
  max,
  rang = 'var(--color-leaf)',
}: {
  qiymat: number
  min: number
  max: number
  rang?: string
}) {
  const t = Math.max(0, Math.min(1, (qiymat - min) / (max - min)))
  return (
    <div className="relative h-[4px] w-full rounded-full bg-sunken">
      <div
        className="absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
        style={{ left: `${t * 100}%`, background: rang }}
      />
    </div>
  )
}

/** V1 `Darajalar`: diskret daraja (0 dan), juda kam → juda ko'p; `soni` — bo'laklar (gumus — 6) */
export function Darajalar({ daraja, soni = 5 }: { daraja: number; soni?: number }) {
  return (
    <div className="flex gap-[3px]">
      {Array.from({ length: soni }, (_, i) => i).map((i) => {
        const faol = daraja >= 0 && i <= daraja
        const yomon = daraja <= 1
        return (
          <div
            key={i}
            className="h-[5px] w-4 rounded-[1px]"
            style={{
              background: faol
                ? yomon
                  ? 'var(--color-wheat)'
                  : 'var(--color-leaf)'
                : 'var(--color-sunken)',
            }}
          />
        )
      })}
    </div>
  )
}
