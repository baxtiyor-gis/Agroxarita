"""Copernicus DEM GLO-30: sug'oriladigan konturlar tushgan 1x1 gradus tile'larni yuklash, VRT, qiyalik va yo'nalish.

python manage.py yukla_dem [--faqat-royxat] [--qayta-ishla]
data/dem/ ga yozadi (git'da yo'q). Yuklangan tile o'tkaziladi; 404 (dengiz/chet) normal.
"""
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor

from django.core.management.base import BaseCommand
from django.db import connection
from osgeo import gdal

from apps.relief.dem import DEM_URL, LCC_PROJ4, PIKSEL, dem_papka, tile_nomi

gdal.UseExceptions()
TIF = ["TILED=YES", "COMPRESS=DEFLATE", "PREDICTOR=3", "BIGTIFF=YES", "SPARSE_OK=TRUE", "NUM_THREADS=ALL_CPUS"]

TILE_SQL = """
SELECT DISTINCT gx, gy FROM land_kontur k
CROSS JOIN LATERAL generate_series(floor(ST_XMin(k.geom))::int, floor(ST_XMax(k.geom))::int) gx
CROSS JOIN LATERAL generate_series(floor(ST_YMin(k.geom))::int, floor(ST_YMax(k.geom))::int) gy
WHERE k.tur = 'sugoriladigan' ORDER BY gy, gx
"""


def tile_royxati():
    with connection.cursor() as c:
        c.execute(TILE_SQL)
        return c.fetchall()


def yukla(args):
    lon, lat, papka = args
    fayl = papka / tile_nomi(lon, lat)
    if fayl.exists():
        return lon, lat, "bor", fayl.stat().st_size
    tmp = fayl.with_suffix(".part")
    try:
        with urllib.request.urlopen(DEM_URL.format(lat=lat, lon=lon), timeout=120) as r, open(tmp, "wb") as f:
            while chunk := r.read(1 << 20):
                f.write(chunk)
    except urllib.error.HTTPError as e:
        tmp.unlink(missing_ok=True)
        return lon, lat, f"http{e.code}", 0
    tmp.rename(fayl)
    return lon, lat, "yuklandi", fayl.stat().st_size


class Command(BaseCommand):
    help = "DEM tile'lar + VRT + LCC warp + qiyalik/yo'nalish (data/dem/)."

    def add_arguments(self, parser):
        parser.add_argument("--faqat-royxat", action="store_true", help="faqat tile ro'yxati")
        parser.add_argument("--qayta-ishla", action="store_true", help="dem_lcc/slope/aspect qayta yaratilsin")

    def handle(self, *a, **o):
        papka = dem_papka()
        papka.mkdir(parents=True, exist_ok=True)
        tiles = tile_royxati()
        self.stdout.write(f"tile soni (bbox bo'yicha): {len(tiles)}")
        if o["faqat_royxat"]:
            return
        with ThreadPoolExecutor(4) as ex:
            natijalar = list(ex.map(yukla, [(lx, ly, papka) for lx, ly in tiles]))
        mavjud = [r for r in natijalar if r[2] in ("bor", "yuklandi")]
        for lon, lat, holat, hajm in natijalar:
            if holat not in ("bor", "yuklandi"):
                self.stdout.write(f"  E{lon} N{lat}: {holat}")
        hajm = sum(r[3] for r in mavjud) / 1e6
        self.stdout.write(f"tile: {len(mavjud)} mavjud, {len(natijalar) - len(mavjud)} yo'q; {hajm:.0f} MB")

        fayllar = [str(papka / tile_nomi(lx, ly)) for lx, ly, *_ in mavjud]
        vrt = papka / "dem.vrt"
        gdal.BuildVRT(str(vrt), fayllar)
        self.stdout.write(f"VRT: {vrt}")

        lcc, slope, aspect = papka / "dem_lcc.tif", papka / "slope.tif", papka / "aspect.tif"
        if o["qayta_ishla"] or not lcc.exists():
            # metrik proyeksiya: qiyalik to'g'ri hisoblansin (scale=1)
            gdal.Warp(str(lcc), str(vrt), dstSRS=LCC_PROJ4, xRes=PIKSEL, yRes=PIKSEL, resampleAlg="bilinear",
                      outputType=gdal.GDT_Float32, dstNodata=-9999, creationOptions=TIF, multithread=True)
            self.stdout.write(f"warp: {lcc}")
        for nom, yo in (("slope", slope), ("aspect", aspect)):
            if o["qayta_ishla"] or not yo.exists():
                gdal.DEMProcessing(str(yo), str(lcc), nom, computeEdges=True, creationOptions=TIF)
                self.stdout.write(f"{nom}: {yo}")
