import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const ga = (v: number) => v.toFixed(v < 10 ? 2 : 1).replace('.', ',')

export function gaJami(v: number) {
  return v >= 1000
    ? `${(v / 1000).toFixed(1).replace('.', ',')} ming ga`
    : `${v.toFixed(0)} ga`
}
