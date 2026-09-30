import { useEffect, useRef, useState } from 'react'
import * as maplibregl from 'maplibre-gl'
import { BorderLayers } from '@/features/border/BorderLayers'
import { KonturPanel } from '@/features/kontur/KonturPanel'
import { useKontur } from '@/features/kontur/api'
import { useTanlov } from '@/features/border/useTanlov'
import { useUi } from '@/store/useUi'
import { Legenda } from './Legenda'
import { MapControls } from './MapControls'
import { MAX_BOUNDS, MAX_ZOOM, MIN_ZOOM, UZ_BOUNDS, asosiyStyle } from './config'

const KONTUR_MIN_ZOOM = 9

export function MapView() {
  const konteyner = useRef<HTMLDivElement>(null)
  const xarita = useRef<maplibregl.Map | null>(null)
  const [tayyor, setTayyor] = useState<maplibregl.Map | null>(null)
  const tanlov = useTanlov()
  const bbox = (tanlov.tumanObj ?? tanlov.viloyatObj)?.bbox
  const bboxKey = bbox?.join(',') ?? ''
  const oldingi = useRef<string | undefined>(undefined)
  const [zoom, setZoom] = useState(0)
  const asosiy = useUi((s) => s.asosiy)
  const konturQ = useKontur(tanlov.kontur)
  const konturBbox = konturQ.data?.bbox
  const kontur = useUi((s) => s.qatlamlar.qx || s.qatlamlar.qolgan)

  useEffect(() => {
    if (!konteyner.current) return
    const map = new maplibregl.Map({
      container: konteyner.current,
      style: asosiyStyle(useUi.getState().asosiy),
      bounds: UZ_BOUNDS,
      fitBoundsOptions: { padding: 20 },
      minZoom: MIN_ZOOM,
      maxZoom: MAX_ZOOM,
      maxBounds: MAX_BOUNDS,
    })
    map.addControl(new maplibregl.ScaleControl({ unit: 'metric' }), 'bottom-left')
    xarita.current = map
    map.once('load', () => {
      setZoom(map.getZoom())
      setTayyor(map)
    })
    map.on('zoom', () => setZoom(map.getZoom()))
    return () => {
      setTayyor(null)
      map.remove()
      xarita.current = null
    }
  }, [])

  // Asosiy xarita: style qayta yuklanmaydi, raster qatlamlar visibility bilan almashadi
  useEffect(() => {
    if (!tayyor) return
    for (const id of ['osm', 'sputnik'] as const)
      tayyor.setLayoutProperty(id, 'visibility', id === asosiy ? 'visible' : 'none')
  }, [tayyor, asosiy])

  // Kamera: tanlovda bbox'ga, tozalansa boshlang'ich ko'rinishga
  useEffect(() => {
    if (!tayyor) return
    if (oldingi.current === undefined && bboxKey === '') {
      oldingi.current = ''
      return
    }
    if (oldingi.current === bboxKey) return
    oldingi.current = bboxKey
    if (bbox && tanlov.kontur != null) return // kontur URL orqali ochilgan — kamera kontur bbox'iga
    if (bbox) tayyor.fitBounds(bbox, { padding: 48, duration: 800 })
    else if (!tanlov.viloyat && !tanlov.tuman)
      tayyor.fitBounds(UZ_BOUNDS, { padding: 20, duration: 800 })
    // bbox bboxKey orqali kuzatiladi
  }, [tayyor, bboxKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kontur URL orqali ochilsa (yoki ko'rinishdan tashqarida bo'lsa) — kontur bbox'iga yaqinlashadi;
  // xaritada bosilgan (ko'rinib turgan) kontur uchun kamera qimirlamaydi
  useEffect(() => {
    if (!tayyor || !konturBbox) return
    const [x0, y0, x1, y1] = konturBbox
    const markaz: [number, number] = [(x0 + x1) / 2, (y0 + y1) / 2]
    if (tayyor.getZoom() >= 13 && tayyor.getBounds().contains(markaz)) return
    tayyor.fitBounds(konturBbox, {
      padding: { left: 440, top: 80, right: 80, bottom: 80 },
      maxZoom: 17,
      duration: 800,
    })
  }, [tayyor, konturBbox])

  return (
    <>
      <div className="absolute inset-0">
        <div ref={konteyner} className="size-full" />
      </div>
      {tayyor && tanlov.tuman != null && kontur && zoom < KONTUR_MIN_ZOOM && (
        <div className="float-panel absolute top-3 left-1/2 z-20 -translate-x-1/2 rounded-card px-4 py-2 text-[13px] font-medium text-body">
          Konturlarni ko'rish uchun yaqinlashtiring
        </div>
      )}
      {tayyor && <BorderLayers map={tayyor} tanlov={tanlov} />}
      <Legenda tuman={tanlov.tuman} />
      <KonturPanel />
      <MapControls
        onZoomIn={() => xarita.current?.zoomIn()}
        onZoomOut={() => xarita.current?.zoomOut()}
        onHome={() => xarita.current?.fitBounds(UZ_BOUNDS, { padding: 20 })}
      />
    </>
  )
}
