import { cn } from '@/lib/utils'

/** Qiymatni oraliqda ko'rsatuvchi chiziqcha — raqamni ma'noga aylantiradi */
export function Shkala({
  qiymat,
  min,
  max,
  rang = 'var(--color-leaf)',
  className,
}: {
  qiymat: number
  min: number
  max: number
  rang?: string
  className?: string
}) {
  const t = Math.max(0, Math.min(1, (qiymat - min) / (max - min)))
  return (
    <div className={cn('relative h-[4px] w-full rounded-full bg-sunken', className)}>
      <div
        className="absolute top-1/2 size-[7px] -translate-x-1/2 -translate-y-1/2 rounded-full ring-2 ring-surface"
        style={{ left: `${t * 100}%`, background: rang }}
      />
    </div>
  )
}

/** Diskret daraja: juda kam → juda ko'p */
export function Darajalar({ daraja, teskari = false }: { daraja: number; teskari?: boolean }) {
  return (
    <div className="flex gap-[3px]">
      {[0, 1, 2, 3, 4].map((i) => {
        const faol = daraja >= 0 && i <= daraja
        const yomon = teskari ? daraja >= 3 : daraja <= 1
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
