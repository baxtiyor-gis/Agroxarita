"""Sug'oriladigan konturlar relyefi: python manage.py hisobla_relyef [--tuman KOD ...] [--viloyat ID ...] [--qayta]

`yukla_dem` yaratgan data/dem/{dem_lcc,slope,aspect}.tif dan zonal statistika. Har tuman alohida tranzaksiya;
hisoblangan konturlar o'tkaziladi (`--qayta` bo'lmasa). Kontur geometriyasi PostGIS'da LCC ga o'tkaziladi,
tuman bo'yicha bo'laklarda (y bo'yicha saralangan) raster oynasi bir marta o'qiladi, kontur maskasi
`RasterizeLayer` bilan; mask bo'sh bo'lsa (kichik kontur) ALL_TOUCHED, u ham bo'sh bo'lsa markaziy piksel.
"""
import math
import time

import numpy as np
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from django.utils import timezone
from osgeo import gdal, ogr

from apps.relief.dem import LCC_PROJ4, dem_papka, zonal
from apps.relief.models import KonturRelyef

gdal.UseExceptions()
ogr.UseExceptions()
gdal.PushErrorHandler("CPLQuietErrorHandler")  # MEM maskada SRS yo'q — har kontur uchun ogohlantirish shovqin

BOLAK = 300  # bir oynada o'qiladigan kontur soni
MAX_OYNA = 30_000_000  # piksel; kattaroq bo'lsa kontur-kontur o'qiladi

SQL = """
SELECT k.id, ST_AsBinary(ST_Transform(k.geom, %s::text)) FROM land_kontur k
WHERE k.tuman_geo_id = (SELECT id FROM border_tuman WHERE kod = %s) AND k.tur = 'sugoriladigan' {qo_shimcha}
ORDER BY k.id
"""
QOSHIMCHA = "AND NOT EXISTS (SELECT 1 FROM relief_konturrelyef r WHERE r.kontur_id = k.id)"


class Rasterlar:
    def __init__(self, papka):
        self.ds = [gdal.Open(str(papka / f)) for f in ("dem_lcc.tif", "slope.tif", "aspect.tif")]
        gt = self.ds[0].GetGeoTransform()
        self.x0, self.y0, self.res = gt[0], gt[3], gt[1]
        self.kenglik, self.balandlik = self.ds[0].RasterXSize, self.ds[0].RasterYSize

    def oyna_piksel(self, env):
        minx, maxx, miny, maxy = env
        px0 = max(0, math.floor((minx - self.x0) / self.res))
        px1 = min(self.kenglik, math.ceil((maxx - self.x0) / self.res))
        py0 = max(0, math.floor((self.y0 - maxy) / self.res))
        py1 = min(self.balandlik, math.ceil((self.y0 - miny) / self.res))
        return px0, py0, px1 - px0, py1 - py0

    def oqi(self, px0, py0, w, h):
        return [d.GetRasterBand(1).ReadAsArray(px0, py0, w, h).astype(np.float32) for d in self.ds]


def maska_qil(geom, px0, py0, w, h, r, all_touched=False):
    mem = gdal.GetDriverByName("MEM").Create("", w, h, 1, gdal.GDT_Byte)
    mem.SetGeoTransform((r.x0 + px0 * r.res, r.res, 0, r.y0 - py0 * r.res, 0, -r.res))
    ds = ogr.GetDriverByName("Memory").CreateDataSource("")
    qat = ds.CreateLayer("k", geom_type=ogr.wkbUnknown)
    f = ogr.Feature(qat.GetLayerDefn())
    f.SetGeometry(geom)
    qat.CreateFeature(f)
    gdal.RasterizeLayer(mem, [1], qat, burn_values=[1], options=["ALL_TOUCHED=TRUE"] if all_touched else [])
    return mem.GetRasterBand(1).ReadAsArray().astype(bool)


def kontur_hisobla(geom, r, oyna_massivlar=None, oyna=None):
    """geom: LCC ogr geometriya. oyna_massivlar/oyna: oldindan o'qilgan (dem, slope, aspect) va (px0, py0, w, h)."""
    px0, py0, w, h = r.oyna_piksel(geom.GetEnvelope())
    if w <= 0 or h <= 0:
        return None
    if oyna_massivlar is None:
        dem, sl, asp = r.oqi(px0, py0, w, h)
    else:
        lx, ly = px0 - oyna[0], py0 - oyna[1]
        dem, sl, asp = (a[ly:ly + h, lx:lx + w] for a in oyna_massivlar)
    maska = maska_qil(geom, px0, py0, w, h, r)
    n = zonal(maska, dem, sl, asp) if maska.any() else None
    if n is None:
        maska = maska_qil(geom, px0, py0, w, h, r, all_touched=True)
        n = zonal(maska, dem, sl, asp) if maska.any() else None
    if n is None:  # markaziy piksel
        p = geom.PointOnSurface()
        cx = min(max(int((p.GetX() - r.x0) / r.res) - px0, 0), w - 1)
        cy = min(max(int((r.y0 - p.GetY()) / r.res) - py0, 0), h - 1)
        m = np.zeros((h, w), bool)
        m[cy, cx] = True
        n = zonal(m, dem, sl, asp)
    return n


def tuman_hisobla(tuman_kod, r, qayta=False):
    """Bitta tuman: (hisoblangan, qiymatsiz, soniya)."""
    t0 = time.perf_counter()
    with connection.cursor() as c:
        c.execute(SQL.format(qo_shimcha="" if qayta else QOSHIMCHA), [LCC_PROJ4, tuman_kod])
        qatorlar = c.fetchall()
    if not qatorlar:
        return 0, 0, 0.0
    elementlar = []
    for kid, wkb in qatorlar:
        g = ogr.CreateGeometryFromWkb(bytes(wkb))
        elementlar.append((kid, g, r.oyna_piksel(g.GetEnvelope())))
    elementlar.sort(key=lambda e: (e[2][1], e[2][0]))
    now = timezone.now()
    obyektlar, qiymatsiz = [], 0
    for i in range(0, len(elementlar), BOLAK):
        bolak = elementlar[i:i + BOLAK]
        oynalar = [e[2] for e in bolak if e[2][2] > 0 and e[2][3] > 0]
        oyna = massivlar = None
        if oynalar:
            ux0, uy0 = min(o[0] for o in oynalar), min(o[1] for o in oynalar)
            ux1, uy1 = max(o[0] + o[2] for o in oynalar), max(o[1] + o[3] for o in oynalar)
            if (ux1 - ux0) * (uy1 - uy0) <= MAX_OYNA:
                oyna = (ux0, uy0, ux1 - ux0, uy1 - uy0)
                massivlar = r.oqi(*oyna)
        for kid, g, _ in bolak:
            n = kontur_hisobla(g, r, massivlar, oyna)
            if n is None:
                qiymatsiz += 1
                n = {}
            obyektlar.append(KonturRelyef(kontur_id=kid, hisoblangan=now, **n))
    with transaction.atomic():
        KonturRelyef.objects.bulk_create(
            obyektlar, batch_size=2000, update_conflicts=True, unique_fields=["kontur"],
            update_fields=["balandlik_min", "balandlik_ortacha", "balandlik_max", "qiyalik_ortacha",
                           "qiyalik_sinfi", "yonalish", "yonalish_gradus", "hisoblangan"],
        )
    return len(obyektlar), qiymatsiz, time.perf_counter() - t0


class Command(BaseCommand):
    help = "Sug'oriladigan konturlar uchun balandlik/qiyalik/yo'nalish (DEM zonal statistika)."

    def add_arguments(self, parser):
        parser.add_argument("--tuman", type=int, nargs="*", default=None, help="tuman kod(lar)i")
        parser.add_argument("--viloyat", type=int, nargs="*", default=None, help="viloyat region_id(lar)i")
        parser.add_argument("--qayta", action="store_true", help="hisoblanganlarni ham qayta hisobla")

    def handle(self, *a, **o):
        papka = dem_papka()
        if not (papka / "aspect.tif").exists():
            raise CommandError("data/dem/{dem_lcc,slope,aspect}.tif yo'q - avval `yukla_dem`.")
        r = Rasterlar(papka)
        with connection.cursor() as c:
            if o["tuman"]:
                c.execute("SELECT kod FROM border_tuman WHERE kod = ANY(%s) ORDER BY kod", [o["tuman"]])
            elif o["viloyat"]:
                c.execute(
                    "SELECT t.kod FROM border_tuman t JOIN border_viloyat v ON v.id = t.viloyat_id "
                    "WHERE v.region_id = ANY(%s) ORDER BY t.kod", [o["viloyat"]],
                )
            else:
                c.execute("SELECT kod FROM border_tuman ORDER BY kod")
            kodlar = [x[0] for x in c.fetchall()]
        if o["tuman"] and len(kodlar) != len(set(o["tuman"])):
            raise CommandError(f"tuman topilmadi: {sorted(set(o['tuman']) - set(kodlar))}")
        jami = 0
        for kod in kodlar:
            n, bosh, sek = tuman_hisobla(kod, r, o["qayta"])
            jami += n
            if n:
                self.stdout.write(f"tuman {kod}: {n} kontur, qiymatsiz {bosh}, {sek:.1f}s ({n / max(sek, 1e-9):.0f}/s)")
                self.stdout.flush()
        self.stdout.write(f"tugadi: {len(kodlar)} tuman, {jami} kontur")
