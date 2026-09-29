import type { LngLatBoundsLike, StyleSpecification } from 'maplibre-gl'

/** O'zbekiston chegarasi [g'arb, janub, sharq, shimol] */
export const UZ_BOUNDS: [number, number, number, number] = [55.9, 37.1, 73.2, 45.6]

/** Harakat chegarasi — O'zbekiston atrofida zaxira bilan */
export const MAX_BOUNDS: LngLatBoundsLike = [
  [52, 34.5],
  [77, 48],
]

export const MIN_ZOOM = 4
export const MAX_ZOOM = 20

export type AsosiyXarita = 'osm' | 'sputnik'

/** Ikkala raster ham style'da turadi; almashtirish — visibility bilan (style qayta yuklanmaydi) */
export function asosiyStyle(asosiy: AsosiyXarita): StyleSpecification {
  const korinish = (id: AsosiyXarita) => ({ visibility: id === asosiy ? 'visible' : 'none' }) as const
  return {
    version: 8,
    sources: {
      osm: {
        type: 'raster',
        tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
        tileSize: 256,
        maxzoom: 19,
        attribution: '© OpenStreetMap contributors',
      },
      sputnik: {
        type: 'raster',
        tiles: ['https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}'],
        tileSize: 256,
        maxzoom: 20,
        attribution: '© Google',
      },
    },
    layers: [
      { id: 'fon', type: 'background', paint: { 'background-color': '#f5f6f8' } },
      { id: 'osm', type: 'raster', source: 'osm', layout: korinish('osm') },
      { id: 'sputnik', type: 'raster', source: 'sputnik', layout: korinish('sputnik') },
    ],
  }
}
