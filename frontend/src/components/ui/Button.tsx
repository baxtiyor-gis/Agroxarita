import type { ButtonHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

export function Button({ className, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={cn(
        'flex h-10 items-center gap-2 rounded-card border border-line px-3.5 text-[13px] font-medium text-ink transition-colors hover:border-line-strong hover:bg-sunken',
        className,
      )}
      {...props}
    />
  )
}
