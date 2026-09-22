import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, ScaleControl } from 'maplibre-gl'
import type {
  ExpressionSpecification,
  Map as MlMap,
  MapSourceDataEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { useApp, type Qatlam } from '@/store/useApp'
import { attrs, crops, kontur } from '@/lib/data'
import { SHKALA, FOYD_RANG, YOQ_RANG, KONTUR_CHEGARA } from '@/lib/ranglar'
import { baholash } from '@/lib/tavsiya'

const MARKAZ: [number, number] = [67.355, 39.73]

/** Atribut qiymatlarini xarita xususiyatlariga ko'chirish — id bo'yicha */
function qiymatlar(qatlam: Qatlam, ekinId: string | null): Map<number, number> {
  const p = attrs()
  const c = p.col
  const m = new Map<number, number>()

  if (qatlam === 'yoq') return m

  if (qatlam === 'tavsiya') {
    const crop = crops().find((x) => x.id === ekinId)
    if (!crop) return m
    for (let i = 0; i < p.n; i++) m.set(c.id[i], baholash(crop, kontur(i)).ball)
    return m
  }
  const src: Record<string, number[]> = {
    bonitet: c.bonitet,
    gumus: c.gumus,
    fosfor: c.fosfor,
    kaliy: c.kaliy,
    shor: c.shor,
    balandlik: c.balandlik,
    qiyalik: c.qiyalik,
    foyd: c.foyd,
  }
  const arr = src[qatlam]
  for (let i = 0; i < p.n; i++) m.set(c.id[i], arr[i])
  return m
}

/**
 * Klasslangan ranglash — `step` ifodasi bilan. Gradient emas: xaritadagi
 * har bir rang legendadagi aniq bir katakka mos keladi.
 */
function rangIfoda(qatlam: Qatlam): ExpressionSpecification {
  const v: ExpressionSpecification = ['feature-state', 'v'] as never

  // Tematik ranglashsiz — ko'rinishni `fill-opacity` boshqaradi (0.01)
  if (qatlam === 'yoq') return '#ffffff' as unknown as ExpressionSpecification

  if (qatlam === 'foyd') {
    const cases: unknown[] = ['match', v]
    for (const [k, rang] of Object.entries(FOYD_RANG)) cases.push(Number(k), rang)
    cases.push(YOQ_RANG)
    return cases as unknown as ExpressionSpecification
  }

  const ks = SHKALA[qatlam].klasslar
  // step: birinchi rang, keyin har bir chegara uchun [chegara, rang]
  const step: unknown[] = ['step', v, ks[0].rang]
  for (let i = 1; i < ks.length; i++) step.push(ks[i].min, ks[i].rang)

  return [
    'case',
    ['==', ['feature-state', 'v'], null],
    YOQ_RANG,
    ['<', v, 0],
    YOQ_RANG,
    step,
  ] as unknown as ExpressionSpecification
}

export interface XaritaAPI {
  zoom: (d: number) => void
  home: () => void
}

export function Xarita({ apiRef }: { apiRef?: React.RefObject<XaritaAPI | null> }) {
  const box = useRef<HTMLDivElement>(null)
  const map = useRef<MlMap | null>(null)
  const yuklandi = useRef(false)
  const hoverId = useRef<number | null>(null)
  const [stylTayyor, setStylTayyor] = useState(false)

  const {
    qatlam,
    tavsiyaEkin,
    hillshade,
    asos,
    konturKorinsin,
    tanlangan,
    setTanlangan,
    natija,
    tayyor,
    klassFiltr,
  } = useApp()

  // Tashqi boshqaruv uchun API
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      zoom: (d) => map.current?.easeTo({ zoom: (map.current.getZoom() ?? 10) + d, duration: 250 }),
      home: () => map.current?.easeTo({ center: MARKAZ, zoom: 10.4, duration: 600 }),
    }
  }, [apiRef])

  // ---------------------------------------------------------- xaritani qurish
  useEffect(() => {
    if (!box.current || map.current) return

    const m = new MapLibreMap({
      container: box.current,
      center: MARKAZ,
      zoom: 10.4,
      minZoom: 8,
      maxZoom: 17,
      attributionControl: { compact: true },
      style: {
        version: 8,
        // `glyphs` ataylab yo'q: xaritada matn (symbol) qatlami ishlatilmaydi,
        // yuklanmaydigan shrift manzili esa `load` hodisasini to'sib qo'yadi
        // va barcha ko'rinish effektlari ishlamay qoladi.
        sources: {
          dem: {
            type: 'raster-dem',
            tiles: ['https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png'],
            encoding: 'terrarium',
            tileSize: 256,
            maxzoom: 13,
            attribution: 'Relyef: Mapzen / SRTM',
          },
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap',
          },
          sputnik: {
            type: 'raster',
            tiles: [
              'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
            ],
            tileSize: 256,
            maxzoom: 19,
            attribution: 'Esri, Maxar, Earthstar Geographics',
          },
          konturlar: {
            type: 'geojson',
            data: `${import.meta.env.BASE_URL}data/geom.geojson`,
            promoteId: 'id',
          },
        },
        layers: [
          { id: 'fon', type: 'background', paint: { 'background-color': '#f4f5f3' } },
          {
            id: 'osm',
            type: 'raster',
            source: 'osm',
            layout: { visibility: 'none' },
            paint: { 'raster-opacity': 0.42, 'raster-saturation': -0.55 },
          },
          {
            id: 'sputnik',
            type: 'raster',
            source: 'sputnik',
            paint: { 'raster-opacity': 1 },
          },
          {
            id: 'hillshade',
            type: 'hillshade',
            source: 'dem',
            paint: {
              'hillshade-exaggeration': 0.45,
              'hillshade-shadow-color': '#4a5a4e',
              'hillshade-highlight-color': '#fdfefb',
              'hillshade-accent-color': '#95a292',
            },
          },
          // Boshlang'ich holat = store'dagi sukut (qatlam 'yoq'): ichi shaffof,
          // chegarasi qizil. Aks holda sahifa yuklanganda rang sakraydi.
          {
            id: 'kontur-fill',
            type: 'fill',
            source: 'konturlar',
            paint: {
              // Sezilmas shaffoflik: `0` bo'lsa MapLibre bu qatlamni bosish
              // hisobiga olmaydi va kontur tanlanmaydi.
              'fill-color': '#ffffff',
              'fill-opacity': 0.01,
            },
          },
          {
            id: 'kontur-line',
            type: 'line',
            source: 'konturlar',
            paint: {
              'line-color': KONTUR_CHEGARA,
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.4, 14, 0.8, 16, 1.2],
              'line-opacity': [
                'case',
                ['boolean', ['feature-state', 'yashirin'], false],
                0.08,
                0.72,
              ],
            },
          },
          {
            id: 'kontur-hover',
            type: 'line',
            source: 'konturlar',
            paint: {
              'line-color': '#ffffff',
              'line-width': 2.2,
              'line-opacity': ['case', ['boolean', ['feature-state', 'hover'], false], 1, 0],
            },
          },
          {
            id: 'kontur-tanlangan',
            type: 'line',
            source: 'konturlar',
            filter: ['==', ['id'], -1],
            paint: { 'line-color': '#ffffff', 'line-width': 3 },
          },
        ],
      },
    })

    // Zoom tugmalari o'ng tepadagi o'z panelimizda — bu yerda faqat masshtab
    m.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

    // Xarita xatolari jimgina yutilib ketmasin — manba yoki plitka
    // yuklanmasa, sababi konsolda ko'rinishi kerak
    m.on('error', (e) => {
      console.error('[xarita]', e.error?.message ?? e)
    })

    m.on('load', () => {
      yuklandi.current = true
      m.setTerrain({ source: 'dem', exaggeration: 0 })
      // Uslub tayyor — ko'rinish effektlari qayta ishga tushsin
      setStylTayyor(true)
    })

    // Hover
    const hoverTozala = () => {
      if (hoverId.current !== null) {
        m.setFeatureState({ source: 'konturlar', id: hoverId.current }, { hover: false })
        hoverId.current = null
      }
      m.getCanvas().style.cursor = ''
    }

    m.on('mousemove', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['kontur-fill'] })[0]
      if (!f || f.id === undefined) {
        hoverTozala()
        return
      }
      if (hoverId.current !== f.id) {
        hoverTozala()
        hoverId.current = f.id as number
        m.setFeatureState({ source: 'konturlar', id: f.id }, { hover: true })
      }
      m.getCanvas().style.cursor = 'pointer'
    })
    m.on('mouseout', hoverTozala)
    // Bosishni umumiy hodisada ushlaymiz va faqat `kontur-fill` ni
    // qidiramiz: chiziq qatlamlari (line/hover/tanlangan) to'ldirish ustida
    // turadi va qatlamga bog'langan tinglovchini to'sib qo'yadi.
    m.on('click', (e) => {
      const f = m.queryRenderedFeatures(e.point, { layers: ['kontur-fill'] })[0]
      if (!f) return
      const idx = attrs().col.id.indexOf(Number(f.id))
      if (idx >= 0) useApp.getState().setTanlangan(idx)
    })

    map.current = m
    return () => {
      m.remove()
      map.current = null
      yuklandi.current = false
      // StrictMode ikki marta mount qiladi: birinchi xarita o'chib, ikkinchisi
      // qayta qurilganda `load` kutilishi kerak. Bu belgini tozalamasak,
      // ko'rinish effektlari eski `true` holatga tayanib o'tkazib yuboriladi
      // va konturlar hech qachon chizilmaydi.
      setStylTayyor(false)
    }
  }, [])

  // ------------------------------------------------- qatlam va ranglar
  useEffect(() => {
    const m = map.current
    if (!m || !tayyor) return
    const qoll = () => {
      m.setPaintProperty('kontur-fill', 'fill-color', rangIfoda(qatlam))
      const vals = qiymatlar(qatlam, tavsiyaEkin)
      for (const [id, v] of vals) {
        m.setFeatureState({ source: 'konturlar', id }, { v })
      }
    }
    if (m.isStyleLoaded() && m.getSource('konturlar')) {
      if (m.isSourceLoaded('konturlar')) qoll()
      else
        m.once('sourcedata', (e: MapSourceDataEvent) => {
          if (e.sourceId === 'konturlar') qoll()
        })
    } else {
      m.once('idle', qoll)
    }
  }, [qatlam, tavsiyaEkin, tayyor])

  // ------------------------------------------------------------ hillshade
  useEffect(() => {
    const m = map.current
    if (!m || !yuklandi.current) return
    if (m.getLayer('hillshade')) {
      m.setLayoutProperty('hillshade', 'visibility', hillshade ? 'visible' : 'none')
    }
  }, [hillshade, stylTayyor])

  // ----------------------------------------------------------- asos qatlam
  useEffect(() => {
    const m = map.current
    if (!m) return
    const qoll = () => {
      if (!m.getLayer('osm') || !m.getLayer('sputnik')) return
      const sput = asos === 'sputnik'
      m.setLayoutProperty('osm', 'visibility', sput ? 'none' : 'visible')
      m.setLayoutProperty('sputnik', 'visibility', sput ? 'visible' : 'none')
      m.setPaintProperty('kontur-tanlangan', 'line-color', '#ffffff')
      m.setPaintProperty('kontur-hover', 'line-color', sput ? '#ffffff' : '#16201a')
    }
    if (yuklandi.current) qoll()
    else m.once('load', qoll)
  }, [asos])

  // -------------------------------- kontur ko'rinishi: to'ldirish va chegara
  useEffect(() => {
    const m = map.current
    if (!m || !yuklandi.current || !m.getLayer('kontur-fill')) return

    const tematik = qatlam !== 'yoq'
    // Tematik ranglash yo'q — ichi amalda shaffof, faqat chegara ko'rinadi.
    // Ammo `0` emas: MapLibre to'liq shaffof to'ldirishni bosish hisobiga
    // olmaydi va kontur tanlanmaydi. 0.01 ko'zga ko'rinmaydi.
    // Tematik rejimda ranglar to'liq — shaffoflik xoroplet o'qilishini buzadi.
    const toliq = !tematik ? 0.01 : 1
    const ustida = !tematik ? 0.01 : 1

    m.setPaintProperty('kontur-fill', 'fill-opacity', [
      'case',
      ['boolean', ['feature-state', 'yashirin'], false],
      tematik ? 0.07 : 0.01,
      ['boolean', ['feature-state', 'hover'], false],
      ustida,
      toliq,
    ])

    // Chegara: tematiksiz rejimda qizil va qalinroq — konturlar asosiy obyekt
    const sput = asos === 'sputnik'
    m.setPaintProperty(
      'kontur-line',
      'line-color',
      !tematik ? KONTUR_CHEGARA : sput ? 'rgba(255,255,255,0.85)' : '#2b3a30',
    )
    m.setPaintProperty('kontur-line', 'line-width', [
      'interpolate',
      ['linear'],
      ['zoom'],
      11,
      !tematik ? 0.4 : 0.2,
      14,
      !tematik ? 0.8 : 0.5,
      16,
      !tematik ? 1.2 : 0.9,
    ])
    m.setPaintProperty('kontur-line', 'line-opacity', [
      'case',
      ['boolean', ['feature-state', 'yashirin'], false],
      0.08,
      !tematik ? 0.72 : 0.55,
    ])
  }, [qatlam, asos, stylTayyor])

  // ------------------------------------------------ kontur qatlami ko'rinishi
  useEffect(() => {
    const m = map.current
    if (!m || !yuklandi.current) return
    const v = konturKorinsin ? 'visible' : 'none'
    for (const l of ['kontur-fill', 'kontur-line', 'kontur-hover', 'kontur-tanlangan']) {
      if (m.getLayer(l)) m.setLayoutProperty(l, 'visibility', v)
    }
  }, [konturKorinsin, stylTayyor])

  // ------------------------------------------------- filtr natijasini ko'rsatish
  useEffect(() => {
    const m = map.current
    if (!m || !tayyor || !m.getSource('konturlar')) return
    const p = attrs()
    const hammasi = natija.size === 0 || natija.size === p.n
    const vals = klassFiltr === null ? null : qiymatlar(qatlam, tavsiyaEkin)
    const ks = SHKALA[qatlam].klasslar

    for (let i = 0; i < p.n; i++) {
      const id = p.col.id[i]
      let yashirin = hammasi ? false : !natija.has(i)

      // Legendadan klass tanlansa — faqat o'sha klass ko'rinadi
      if (!yashirin && vals) {
        const v = vals.get(id) ?? -1
        if (klassFiltr === -2) {
          yashirin = v >= 0
        } else {
          const k = ks[klassFiltr!]
          yashirin = !(v >= 0 && v >= k.min && v < k.max)
        }
      }
      m.setFeatureState({ source: 'konturlar', id }, { yashirin })
    }
  }, [natija, tayyor, klassFiltr, qatlam, tavsiyaEkin])

  // ------------------------------------------------------ tanlangan kontur
  useEffect(() => {
    const m = map.current
    if (!m || !m.getLayer('kontur-tanlangan')) return
    if (tanlangan === null) {
      m.setFilter('kontur-tanlangan', ['==', ['id'], -1])
      return
    }
    const id = attrs().col.id[tanlangan]
    m.setFilter('kontur-tanlangan', ['==', ['id'], id])
  }, [tanlangan, setTanlangan])

  return <div ref={box} className="size-full" />
}
