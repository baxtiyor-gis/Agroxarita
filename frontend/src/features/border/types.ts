/** [minLon, minLat, maxLon, maxLat] — EPSG:4326 */
export type Bbox = [number, number, number, number]

export interface Viloyat {
  region_id: number
  nom: string
  bbox: Bbox
}

export interface Tuman {
  kod: number
  nom: string
  tip: 'tuman' | 'shahar'
  region_id: number
  bbox: Bbox
}

export interface TumanBatafsil extends Tuman {
  soato: string
}
