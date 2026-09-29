export const YOQ = "Ma'lumot yo'q"

/** Bosh harf bilan (qiymatlar qoidasi) */
export const bosh = (s: string | null | undefined) =>
  s ? s.charAt(0).toUpperCase() + s.slice(1) : null

export const ga = (v: number) =>
  v.toLocaleString('uz-UZ', { minimumFractionDigits: 0, maximumFractionDigits: 2 })

export const TUR_NOMI: Record<string, string> = {
  sugoriladigan: "Qishloq xo'jaligi yeri",
  aniqlanmagan: 'Qolgan yer',
}
