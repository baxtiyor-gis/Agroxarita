import { useEffect, useRef, useState } from 'react'
import { Map as MapLibreMap, ScaleControl } from 'maplibre-gl'
import type {
  ExpressionSpecification,
  Map as MlMap,
  MapSourceDataEvent,
} from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useApp, type Qatlam } from '@/store/useApp'
import { attrs, crops, extent, geom, kontur, ustun } from '@/lib/data'
import { SHKALA, YOQ_RANG, KONTUR_CHEGARA, ekinQatlami } from '@/lib/ranglar'
import { baholash } from '@/lib/tavsiya'
import { useRelyef } from '@/lib/relyef'
import { RelyefLegenda } from '@/components/RelyefLegenda'

/** Extentga moslashda chetdan bo'sh joy, px */
const CHET = 20
/** Boshlang'ich ko'rinish extentdan shuncha zoom yaqinroq — hudud chetlari
 *  asosan tog' va yaylov, asosiy dalalar markazda */
const YAQIN = 0.55

/** Boshlang'ich kamera: konturlar extenti + biroz yaqinlashtirish */
function boshKamera(m: MlMap) {
  const c = m.cameraForBounds(extent(), { padding: CHET })!
  return { center: c.center, zoom: (c.zoom ?? 10) + YAQIN }
}

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
  const arr = ustun(qatlam)
  if (!arr) return m
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
    asos,
    konturKorinsin,
    tanlangan,
    setTanlangan,
    natija,
    tayyor,
    klassFiltr,
  } = useApp()

  // Relyef (DEM) va gorizontallar — o'z modulida
  const relyef = useRelyef(map, stylTayyor)

  // Tashqi boshqaruv uchun API
  useEffect(() => {
    if (!apiRef) return
    apiRef.current = {
      zoom: (d) => map.current?.easeTo({ zoom: (map.current.getZoom() ?? 10) + d, duration: 250 }),
      home: () => {
        const m = map.current
        if (m) m.easeTo({ ...boshKamera(m), duration: 600 })
      },
    }
  }, [apiRef])

  // ---------------------------------------------------------- xaritani qurish
  // Ma'lumot (geometriya bilan) yuklanmaguncha xarita qurilmaydi: birinchi
  // kadrdanoq to'g'ri extent, sputnik va konturlar bo'lsin
  useEffect(() => {
    if (!box.current || map.current || !tayyor) return

    const m = new MapLibreMap({
      container: box.current,
      bounds: extent(),
      fitBoundsOptions: { padding: CHET },
      minZoom: 8,
      maxZoom: 17,
      attributionControl: { compact: true },
      style: {
        version: 8,
        // `glyphs` ataylab yo'q: xaritada matn (symbol) qatlami ishlatilmaydi,
        // yuklanmaydigan shrift manzili esa `load` hodisasini to'sib qo'yadi
        // va barcha ko'rinish effektlari ishlamay qoladi.
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            maxzoom: 19,
            attribution: '© OpenStreetMap',
          },
          sputnik: {
            type: 'raster',
            // Google sun'iy yo'ldosh plitkalari (kalitsiz). 4 ta subdomen —
            // brauzer bir xostga parallel so'rovlarni cheklaydi
            tiles: [0, 1, 2, 3].map(
              (i) => `https://mt${i}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}`,
            ),
            tileSize: 256,
            maxzoom: 20,
            attribution: '© Google',
          },
          konturlar: {
            type: 'geojson',
            data: geom(),
            promoteId: 'id',
          },
        },
        layers: [
          { id: 'fon', type: 'background', paint: { 'background-color': '#f5f6f8' } },
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
              'line-width': ['interpolate', ['linear'], ['zoom'], 11, 0.7, 14, 1.2, 16, 1.8],
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

    m.jumpTo(boshKamera(m))

    // Zoom tugmalari o'ng tepadagi o'z panelimizda — bu yerda faqat masshtab
    m.addControl(new ScaleControl({ maxWidth: 100, unit: 'metric' }), 'bottom-left')

    // Xarita xatolari jimgina yutilib ketmasin — manba yoki plitka
    // yuklanmasa, sababi konsolda ko'rinishi kerak
    m.on('error', (e) => {
      console.error('[xarita]', e.error?.message ?? e)
    })

    m.on('load', () => {
      yuklandi.current = true
      // Uslub tayyor — ko'rinish effektlari qayta ishga tushsin
      setStylTayyor(true)
      // Birinchi `idle` — ko'rinadigan plitkalar va konturlar chizib bo'lindi
      m.once('idle', () => useApp.getState().setXaritaTayyor(true))
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
      useApp.getState().setXaritaTayyor(false)
    }
  }, [tayyor])

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
  }, [asos, stylTayyor])

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
      // Ekin qatlami siyrak (konturlarning ~38 %) — ma'lumotsizlari bo'yalmaydi,
      // aks holda kulrang fon ekinli konturlarni ko'mib yuboradi
      ...((ekinQatlami(qatlam)
        ? [['<', ['coalesce', ['feature-state', 'v'], -1], 0], 0.01]
        : []) as ExpressionSpecification[]),
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
      !tematik ? 0.7 : 0.2,
      14,
      !tematik ? 1.2 : 0.5,
      16,
      !tematik ? 1.8 : 0.9,
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
  }, [natija, tayyor, klassFiltr, qatlam, tavsiyaEkin, stylTayyor])

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
  }, [tanlangan, setTanlangan, stylTayyor])

  return (
    <div className="relative size-full">
      <div ref={box} className="size-full" />
      {relyef && <RelyefLegenda meta={relyef} />}
      <XaritaLoader />
    </div>
  )
}

/** Xarita to'liq chizilguncha uni yopib turadi, keyin sekin yo'qoladi */
function XaritaLoader() {
  const xaritaTayyor = useApp((s) => s.xaritaTayyor)
  return (
    <div
      className={cn(
        'absolute inset-0 z-40 flex flex-col items-center justify-center gap-2.5 bg-paper transition-opacity duration-300',
        xaritaTayyor && 'pointer-events-none opacity-0',
      )}
      aria-hidden={xaritaTayyor}
    >
      <Loader2 className="size-6 animate-spin text-leaf" />
      <span className="text-[12px] text-muted">Xarita yuklanmoqda</span>
    </div>
  )
}
