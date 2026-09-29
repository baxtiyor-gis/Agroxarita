import type { HTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** Xarita ustidagi suzuvchi panel (.float-panel) */
export function Panel({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('float-panel overflow-hidden rounded-card', className)} {...props} />
}
