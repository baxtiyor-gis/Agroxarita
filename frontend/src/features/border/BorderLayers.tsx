import { useEffect } from 'react'
import * as maplibregl from 'maplibre-gl'
import type { ExpressionSpecification, Map, MapLayerMouseEvent, VectorTileSource } from 'maplibre-gl'
import { useUi } from '@/store/useUi'
import type { Tanlov } from './useTanlov'

const SRC = { viloyat: 'viloyat-src', tuman: 'tuman-src', massiv: 'massiv-src', kontur: 'kontur-src' }
const L = {
  konturFill: 'kontur-fill',
  kontur: 'kontur-line',
  massivLine: 'massiv-line',
  tumanHalo: 'tuman-halo',
  tuman: 'tuman-line',
  viloyat: 'viloyat-line',
}

const tileUrl = (qatlam: string, tuman?: number) =>
  `${location.origin}/tiles/${qatlam}/{z}/{x}/{y}.pbf${tuman != null ? `?tuman=${tuman}` : ''}`

/** Dizayn tokenini (CSS o'zgaruvchi) o'qiydi — rang qiymati qo'lda yozilmaydi */
const token = (nom: string) =>
  getComputedStyle(document.documentElement).getPropertyValue(`--color-${nom}`).trim()

/** QX yerlari (tur = sugoriladigan) — qizil, qolgan yerlar — ko'k; sputnikda ochiqroq */
const qxRang = (sputnik: boolean) => (sputnik ? token('outline') : token('clay'))
const qolganRang = (sputnik: boolean) => (sputnik ? token('sky') : token('water'))

const konturRang = (sputnik: boolean): ExpressionSpecification => [
  'match',
  ['get', 'tur'],
  'sugoriladigan',
  qxRang(sputnik),
  qolganRang(sputnik),
]

function qoshish(map: Map) {
  if (map.getSource(SRC.viloyat)) return // StrictMode'da ikki marta qo'shilmasin
  const navy = token('navy')

  map.addSource(SRC.viloyat, { type: 'vector', tiles: [tileUrl('viloyat')], minzoom: 0, maxzoom: 14 })
  map.addSource(SRC.tuman, { type: 'vector', tiles: [tileUrl('tuman')], minzoom: 5, maxzoom: 14 })
  // tuman kodi 0 — hech narsa topilmaydi; qatlamlar yashirin bo'lgani uchun so'ralmaydi
  map.addSource(SRC.massiv, {
    type: 'vector',
    tiles: [tileUrl('massiv', 0)],
    minzoom: 6,
    maxzoom: 16,
  })
  map.addSource(SRC.kontur, {
    type: 'vector',
    tiles: [tileUrl('kontur', 0)],
    minzoom: 9,
    maxzoom: 18,
  })

  // kontur to'ldirishi: ichki rang yo'q — shaffof qatlam faqat bosish (popup) uchun
  map.addLayer({
    id: L.konturFill,
    type: 'fill',
    source: SRC.kontur,
    'source-layer': 'kontur',
    layout: { visibility: 'none' },
    paint: { 'fill-color': '#000000', 'fill-opacity': 0 },
  })
  // Tartib (pastdan): kontur → massiv → tuman hoshiyasi → tuman → viloyat
  // kontur: ingichka, z bo'yicha biroz qalinlashadi
  map.addLayer({
    id: L.kontur,
    type: 'line',
    source: SRC.kontur,
    'source-layer': 'kontur',
    layout: { visibility: 'none', 'line-join': 'round' },
    paint: {
      'line-color': konturRang(false),
      'line-width': ['interpolate', ['linear'], ['zoom'], 9, 0.5, 12, 0.8, 16, 1.2],
    },
  })
  // massiv: konturlar ustida, uzuq chiziq (punktir) — kontur chegarasi bilan adashmasin
  map.addLayer({
    id: L.massivLine,
    type: 'line',
    source: SRC.massiv,
    'source-layer': 'massiv',
    layout: { visibility: 'none', 'line-join': 'round' },
    paint: {
      'line-color': navy,
      'line-width': ['interpolate', ['linear'], ['zoom'], 8, 1.5, 14, 2.5],
      'line-dasharray': [3, 2],
    },
  })
  // tanlangan tuman ostidagi to'q hoshiya — sariq chiziq har qanday fonda ko'rinsin
  map.addLayer({
    id: L.tumanHalo,
    type: 'line',
    source: SRC.tuman,
    'source-layer': 'tuman',
    layout: { visibility: 'none', 'line-join': 'round' },
    paint: { 'line-color': token('ink'), 'line-width': 7, 'line-opacity': 0.55 },
  })
  map.addLayer({
    id: L.tuman,
    type: 'line',
    source: SRC.tuman,
    'source-layer': 'tuman',
    layout: { visibility: 'none', 'line-join': 'round' },
    paint: { 'line-color': navy, 'line-width': 1, 'line-opacity': 0.8 },
  })
  map.addLayer({
    id: L.viloyat,
    type: 'line',
    source: SRC.viloyat,
    'source-layer': 'viloyat',
    layout: { 'line-join': 'round' },
    paint: { 'line-color': navy, 'line-width': 1.6, 'line-opacity': 1 },
  })
}

function ochirish(map: Map) {
  if (!map.getStyle()) return
  Object.values(L).forEach((id) => map.getLayer(id) && map.removeLayer(id))
  Object.values(SRC).forEach((id) => map.getSource(id) && map.removeSource(id))
}

type Qatlamlar = ReturnType<typeof useUi.getState>['qatlamlar']

/** Tanlov o'zgarganda tile URL'lar (qayta yuklash faqat tuman o'zgarganda) */
function tilesYangilash(map: Map, tuman: number | null) {
  if (tuman == null) return
  ;(map.getSource(SRC.massiv) as VectorTileSource).setTiles([tileUrl('massiv', tuman)])
  ;(map.getSource(SRC.kontur) as VectorTileSource).setTiles([tileUrl('kontur', tuman)])
}

function yangilash(
  map: Map,
  { viloyat, tuman }: Pick<Tanlov, 'viloyat' | 'tuman'>,
  qat: Qatlamlar,
  sputnik: boolean,
) {
  const vis = (id: string, korinadi: boolean) =>
    map.setLayoutProperty(id, 'visibility', korinadi ? 'visible' : 'none')
  // sputnikda to'q ko'k chegara ko'rinmaydi — oq; tanlangan tuman — sariq (kontur qizil/ko'k bilan adashmasin)
  const chegara = sputnik ? token('surface') : token('navy')
  const tanlanganRang = token('sun')

  // viloyat: tanlanganda tanlangani qalin (qolganlari xiralashtirilmaydi); tuman tanlanganda yashirin
  vis(L.viloyat, tuman == null && qat.viloyat)
  const tanlangan: ExpressionSpecification = ['==', ['get', 'region_id'], viloyat ?? -1]
  map.setPaintProperty(L.viloyat, 'line-color', chegara)
  map.setPaintProperty(L.viloyat, 'line-width', viloyat == null ? 1.6 : ['case', tanlangan, 3.2, 1.6])

  // tuman: viloyat tanlanganda — uning tumanlari; tuman tanlanganda — faqat shu (qizil, qalin)
  vis(L.tuman, viloyat != null && qat.tuman)
  vis(L.tumanHalo, tuman != null && qat.tuman)
  if (tuman != null) {
    map.setFilter(L.tuman, ['==', ['get', 'kod'], tuman])
    map.setFilter(L.tumanHalo, ['==', ['get', 'kod'], tuman])
    map.setPaintProperty(L.tuman, 'line-color', tanlanganRang)
    map.setPaintProperty(L.tuman, 'line-width', 3.5)
    map.setPaintProperty(L.tuman, 'line-opacity', 1)
  } else {
    map.setFilter(L.tuman, viloyat != null ? ['==', ['get', 'region_id'], viloyat] : null)
    map.setPaintProperty(L.tuman, 'line-color', chegara)
    map.setPaintProperty(L.tuman, 'line-width', 1)
    map.setPaintProperty(L.tuman, 'line-opacity', 0.8)
  }

  // massiv va kontur: faqat tuman tanlanganda (qatlam yoqilgan bo'lsa)
  map.setPaintProperty(L.massivLine, 'line-color', chegara)
  vis(L.massivLine, tuman != null && qat.massiv)
  map.setPaintProperty(L.kontur, 'line-color', konturRang(sputnik))  // kontur: QX yerlari va qolgan yerlar alohida yoqiladi (filtr tur bo'yicha)
  const qx: ExpressionSpecification = ['==', ['get', 'tur'], 'sugoriladigan']
  const qolgan: ExpressionSpecification = ['!', qx]
  const konturFiltr = qat.qx && qat.qolgan ? null : qat.qx ? qx : qolgan
  map.setFilter(L.kontur, konturFiltr)
  map.setFilter(L.konturFill, konturFiltr)
  vis(L.kontur, tuman != null && (qat.qx || qat.qolgan))
  vis(L.konturFill, tuman != null && (qat.qx || qat.qolgan))
}

const TUR_NOMI: Record<string, string> = {
  sugoriladigan: "Qishloq xo'jaligi yeri",
  aniqlanmagan: 'Qolgan yer',
}

const qator = (nom: string, qiymat: string) =>
  `<div class="flex justify-between gap-4"><span class="text-muted">${nom}</span><span class="font-medium text-ink">${qiymat}</span></div>`

/** Kontur bosilganda popup: id, kontur raqami, maydon, tur. Tozalash funksiyasini qaytaradi. */
function konturPopup(map: Map) {
  const popup = new maplibregl.Popup({ closeButton: true, maxWidth: '240px' })
  const bosish = (e: MapLayerMouseEvent) => {
    const f = e.features?.[0]
    if (!f) return
    const p = f.properties as { id: number; kontur_raqami?: number; maydon?: number; tur?: string }
    const maydon = p.maydon != null ? `${p.maydon.toLocaleString('uz-UZ')} ga` : '—'
    popup
      .setLngLat(e.lngLat)
      .setHTML(
        `<div class="space-y-1 text-[12.5px]">` +
          qator('ID', String(p.id)) +
          qator('Kontur raqami', p.kontur_raqami != null ? String(p.kontur_raqami) : '—') +
          qator('Maydon', maydon) +
          qator('Tur', TUR_NOMI[p.tur ?? ''] ?? '—') +
          `</div>`,
      )
      .addTo(map)
  }
  const ustida = () => (map.getCanvas().style.cursor = 'pointer')
  const tashqarida = () => (map.getCanvas().style.cursor = '')
  map.on('click', L.konturFill, bosish)
  map.on('mouseenter', L.konturFill, ustida)
  map.on('mouseleave', L.konturFill, tashqarida)
  return () => {
    map.off('click', L.konturFill, bosish)
    map.off('mouseenter', L.konturFill, ustida)
    map.off('mouseleave', L.konturFill, tashqarida)
    popup.remove()
  }
}

export function BorderLayers({ map, tanlov }: { map: Map; tanlov: Tanlov }) {
  useEffect(() => {
    qoshish(map)
    return () => ochirish(map)
  }, [map])

  const { viloyat, tuman } = tanlov
  const qatlamlar = useUi((s) => s.qatlamlar)
  const asosiy = useUi((s) => s.asosiy)

  useEffect(() => {
    tilesYangilash(map, tuman)
  }, [map, tuman])

  useEffect(() => konturPopup(map), [map])

  useEffect(() => {
    yangilash(map, { viloyat, tuman }, qatlamlar, asosiy === 'sputnik')
  }, [map, viloyat, tuman, qatlamlar, asosiy])

  return null
}
