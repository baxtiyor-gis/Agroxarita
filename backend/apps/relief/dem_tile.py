"""DEM raster tile: tuman ichida balandlik rang shkalasi + yengil hillshade, tashqarisi shaffof (RGBA PNG).

`data/dem/dem.vrt` (EPSG:4326, ~30 m) tile bbox (EPSG:3857) ga xotirada warp qilinadi; tuman chegarasi bo'yicha
clip — tuman geometriyasi (3857) 2x super-sampling bilan rasterlanadi (chetlari yumshoq alfa). Tuman min/max
balandligi butun metrga yaxlitlanadi (past -> floor, yuqori -> ceil) va keshlanadi; rang klasslari min-max bo'yicha
5 teng oraliq (V1 BALANDLIK ranglari). Sof funksiyalar — bazasiz testlanadi (VRT/geometriya parametr sifatida).
"""
import math

import numpy as np
from django.core.cache import cache
from osgeo import gdal, ogr, osr

gdal.UseExceptions()
ogr.UseExceptions()

TILE = 256
EKVATOR_M = 40075016.6856
ORIGIN = EKVATOR_M / 2
NODATA = -9999.0
SS = 2  # maska super-sampling (chetlarni yumshatish)
RANGLAR = ["#4b8c5a", "#9cbd6c", "#e2cc84", "#c99a63", "#9a6a4c"]  # old/src/lib/ranglar.ts BALANDLIK
MAX_MINMAX_PX = 1500


def _rgb(hex_):
    return tuple(int(hex_[i:i + 2], 16) for i in (1, 3, 5))


def tile_bbox(z, x, y):
    """(minx, miny, maxx, maxy) EPSG:3857."""
    n = 2**z
    kv = EKVATOR_M / n
    return (-ORIGIN + x * kv, ORIGIN - (y + 1) * kv, -ORIGIN + (x + 1) * kv, ORIGIN - y * kv)


def klasslar(mn, mx):
    """5 teng oraliq: [{min, max, rang}] (metr)."""
    qadam = (mx - mn) / len(RANGLAR)
    return [
        {"min": round(mn + i * qadam, 1), "max": round(mn + (i + 1) * qadam, 1), "rang": r}
        for i, r in enumerate(RANGLAR)
    ]


def _srs_3857():
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(3857)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs


def maska_qil(geom, bbox, w, h):
    """geom (ogr, 3857) -> float32 [0..1] maska (w x h) bbox ustida."""
    minx, miny, maxx, maxy = bbox
    mem = gdal.GetDriverByName("MEM").Create("", w, h, 1, gdal.GDT_Byte)
    mem.SetGeoTransform((minx, (maxx - minx) / w, 0, maxy, 0, -(maxy - miny) / h))
    ds = ogr.GetDriverByName("Memory").CreateDataSource("")
    qat = ds.CreateLayer("m", srs=_srs_3857(), geom_type=ogr.wkbUnknown)
    f = ogr.Feature(qat.GetLayerDefn())
    f.SetGeometry(geom)
    qat.CreateFeature(f)
    gdal.RasterizeLayer(mem, [1], qat, burn_values=[1])
    return mem.GetRasterBand(1).ReadAsArray().astype(np.float32)


def dem_oqi(vrt, bbox, w, h, algoritm="bilinear"):
    """VRT dan bbox (3857) ni w x h ga warp: float32 massiv, nodata -> NaN."""
    ds = gdal.Warp(
        "", str(vrt), format="MEM", outputBounds=bbox, width=w, height=h, dstSRS="EPSG:3857",
        resampleAlg=algoritm, dstNodata=NODATA, outputType=gdal.GDT_Float32,
    )
    a = ds.GetRasterBand(1).ReadAsArray().astype(np.float32)
    a[a == NODATA] = np.nan
    return a


def tuman_minmax(vrt, geom):
    """Tuman ichidagi (min, max) balandlik, butun metr (floor/ceil); DEM piksel topilmasa None."""
    minx, maxx, miny, maxy = geom.GetEnvelope()
    piksel = max(40.0, max(maxx - minx, maxy - miny) / MAX_MINMAX_PX)
    w, h = max(1, math.ceil((maxx - minx) / piksel)), max(1, math.ceil((maxy - miny) / piksel))
    bbox = (minx, miny, minx + w * piksel, miny + h * piksel)
    dem = dem_oqi(vrt, bbox, w, h)
    maska = maska_qil(geom, bbox, w, h) > 0
    q = dem[maska & np.isfinite(dem)]
    if q.size == 0:
        return None
    mn, mx = math.floor(float(q.min())), math.ceil(float(q.max()))
    return (mn, mx if mx > mn else mn + 1)


def hillshade(dem, dx, azimut=315.0, balandlik=45.0, kuchaytirish=1.5):
    """dem (h+2 x w+2, NaN yo'q) -> yorug'lik [0..1+] (h x w). Tekis joy = sin(balandlik)."""
    gx = (dem[1:-1, 2:] - dem[1:-1, :-2]) / (2 * dx) * kuchaytirish  # sharqqa
    gy = (dem[:-2, 1:-1] - dem[2:, 1:-1]) / (2 * dx) * kuchaytirish  # shimolga (satr o'sishi = janubga)
    az, al = math.radians(azimut), math.radians(balandlik)
    return (np.sin(al) - np.cos(al) * (gx * math.sin(az) + gy * math.cos(az))) / np.sqrt(1 + gx**2 + gy**2)


def png_bayt(rgba):
    """(h, w, 4) uint8 -> PNG bayt."""
    h, w, _ = rgba.shape
    mem = gdal.GetDriverByName("MEM").Create("", w, h, 4, gdal.GDT_Byte)
    for i in range(4):
        mem.GetRasterBand(i + 1).WriteArray(rgba[:, :, i])
    yol = f"/vsimem/dem_{id(rgba)}.png"
    gdal.GetDriverByName("PNG").CreateCopy(yol, mem)
    f = gdal.VSIFOpenL(yol, "rb")
    gdal.VSIFSeekL(f, 0, 2)
    n = gdal.VSIFTellL(f)
    gdal.VSIFSeekL(f, 0, 0)
    data = gdal.VSIFReadL(1, n, f)
    gdal.VSIFCloseL(f)
    gdal.Unlink(yol)
    return bytes(data)


def tile_png(vrt, z, x, y, geom, mn, mx):
    """geom — tuman (yoki uning tile bilan kesishmasi) ogr geometriyasi, 3857. Bo'sh bo'lsa None."""
    bbox = tile_bbox(z, x, y)
    alfa = maska_qil(geom, bbox, TILE * SS, TILE * SS)
    alfa = alfa.reshape(TILE, SS, TILE, SS).mean(axis=(1, 3))
    if not alfa.any():
        return None
    piksel = (bbox[2] - bbox[0]) / TILE
    p = piksel
    kengaytirilgan = (bbox[0] - p, bbox[1] - p, bbox[2] + p, bbox[3] + p)
    algoritm = "bilinear" if piksel * 0.75 < 60 else "average"
    dem = dem_oqi(vrt, kengaytirilgan, TILE + 2, TILE + 2, algoritm)
    dem = np.where(np.isfinite(dem), dem, mn)
    # rang: 5 klass (teng oraliq), legenda bilan bir xil
    idx = np.clip(np.floor((dem[1:-1, 1:-1] - mn) / (mx - mn) * len(RANGLAR)).astype(int), 0, len(RANGLAR) - 1)
    palitra = np.array([_rgb(r) for r in RANGLAR], dtype=np.float32)
    rgb = palitra[idx]
    lat = math.degrees(math.atan(math.sinh(math.pi * (1 - 2 * (y + 0.5) / 2**z))))
    yorug = hillshade(dem, piksel * math.cos(math.radians(lat)))
    kopaytma = np.clip(0.6 + 0.4 * yorug / math.sin(math.radians(45.0)), 0.55, 1.25)
    rgb = np.clip(rgb * kopaytma[:, :, None], 0, 255)
    rgba = np.dstack([rgb, alfa * 255.0]).round().astype(np.uint8)
    return png_bayt(rgba)


def kesh_kalit_minmax(kod):
    return f"dem:minmax:{kod}"


def minmax_keshli(vrt, kod, geom_olish):
    """Keshdan yoki hisoblab. `geom_olish()` — to'liq tuman ogr geometriyasi (3857); faqat kesh bo'sh bo'lsa chaqiriladi."""
    kalit = kesh_kalit_minmax(kod)
    qiymat = cache.get(kalit)
    if qiymat is None:
        qiymat = tuman_minmax(vrt, geom_olish())
        if qiymat is not None:
            cache.set(kalit, qiymat, timeout=None)
    return qiymat
