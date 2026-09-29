import type { ReactNode, SelectHTMLAttributes } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/cn'

interface Props extends SelectHTMLAttributes<HTMLSelectElement> {
  icon?: ReactNode
  placeholder: string
}

export function Select({ icon, placeholder, className, children, ...props }: Props) {
  return (
    <div className="relative">
      {icon && (
        <span className="pointer-events-none absolute top-1/2 left-3 -translate-y-1/2 text-leaf">
          {icon}
        </span>
      )}
      <select
        aria-label={placeholder}
        className={cn(
          'h-10 min-w-40 appearance-none rounded-card border border-line bg-surface pr-9 text-[13px] font-medium text-ink transition-colors hover:border-line-strong focus:border-leaf focus:ring-2 focus:ring-leaf-soft focus:outline-none disabled:cursor-not-allowed disabled:bg-sunken disabled:text-muted disabled:hover:border-line',
          icon ? 'pl-9' : 'pl-3',
          className,
        )}
        {...props}
      >
        <option value="">{placeholder}</option>
        {children}
      </select>
      <ChevronDown className="pointer-events-none absolute top-1/2 right-3 size-4 -translate-y-1/2 text-muted" />
    </div>
  )
}
