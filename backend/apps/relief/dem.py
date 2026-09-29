"""Relyef: DEM fayllari, qiyalik sinfi, yo'nalish, zonal statistika (sof funksiyalar — bazasiz testlanadi).

Qiyalik usuli: DEM geografik (EPSG:4326, 1" ~ 30.9 m shimol-janub, ~23 m sharq-g'arb) bo'lgani uchun
`scale=111120` qiyalikni sharq-g'arbda ~24% kam beradi (cos(lat)). Shuning uchun DEM metrik LCC
proyeksiyasiga warp qilinadi (30 m), so'ng `DEMProcessing` `scale=1` bilan. LCC (std. parallel 38/44)
O'zbekiston bo'ylab masshtab xatosi ~1% dan kam.
"""
import math
from pathlib import Path

import numpy as np
from django.conf import settings

# O'zbekiston uchun konform konus (metr). Konturlar ham shu proyeksiyaga PostGIS'da o'tkaziladi.
LCC_PROJ4 = "+proj=lcc +lat_1=38 +lat_2=44 +lat_0=41 +lon_0=65 +x_0=0 +y_0=0 +datum=WGS84 +units=m +no_defs"
PIKSEL = 30.0

DEM_URL = (
    "https://copernicus-dem-30m.s3.amazonaws.com/Copernicus_DSM_COG_10_N{lat:02d}_00_E{lon:03d}_00_DEM/"
    "Copernicus_DSM_COG_10_N{lat:02d}_00_E{lon:03d}_00_DEM.tif"
)


def dem_papka():
    return Path(settings.DATA_DIR) / "dem"


def tile_nomi(lon, lat):
    return f"Copernicus_DSM_COG_10_N{lat:02d}_00_E{lon:03d}_00_DEM.tif"


def qiyalik_sinfi(gradus):
    if gradus is None:
        return None
    if gradus < 1:
        return "tekis"
    if gradus < 3:
        return "yengil"
    if gradus < 7:
        return "orta"
    return "tik"


def yonalish_kodi(azimut):
    """Azimut (0=shimol, soat yo'nalishida) -> 8 tomon kodi."""
    kodlar = ["Sh", "ShSh", "Sq", "JSq", "J", "JG", "G", "ShG"]
    return kodlar[int(((azimut % 360) + 22.5) // 45) % 8]


def zonal(maska, dem, qiyalik, aspekt, dem_nodata=None, nodata=-9999.0):
    """Maska (bool) ichidagi piksellar statistikasi. Yaroqli piksel yo'q bo'lsa None.

    Qaytadi: dict(balandlik_min/ortacha/max, qiyalik_ortacha, qiyalik_sinfi, yonalish, yonalish_gradus).
    Aspect nodata (tekis joy) piksellari yo'nalishga qo'shilmaydi; hech biri qolmasa yonalish None.
    """
    yaroq = maska & np.isfinite(dem) & (dem != nodata)
    if dem_nodata is not None:
        yaroq &= dem != dem_nodata
    if not yaroq.any():
        return None
    h = dem[yaroq]
    natija = {
        "balandlik_min": round(float(h.min()), 1),
        "balandlik_ortacha": round(float(h.mean()), 1),
        "balandlik_max": round(float(h.max()), 1),
        "qiyalik_ortacha": None, "qiyalik_sinfi": None, "yonalish": None, "yonalish_gradus": None,
    }
    q = qiyalik[yaroq]
    q = q[np.isfinite(q) & (q != nodata)]
    if q.size:
        o = float(q.mean())
        natija["qiyalik_ortacha"] = round(o, 2)
        natija["qiyalik_sinfi"] = qiyalik_sinfi(o)
    a = aspekt[yaroq]
    a = a[np.isfinite(a) & (a != nodata) & (a >= 0)]
    if a.size:
        r = np.deg2rad(a.astype(np.float64))
        s, c = np.sin(r).sum(), np.cos(r).sum()
        if math.hypot(s, c) > 1e-9:
            az = math.degrees(math.atan2(s, c)) % 360
            natija["yonalish_gradus"] = round(az, 1)
            natija["yonalish"] = yonalish_kodi(az)
    return natija
