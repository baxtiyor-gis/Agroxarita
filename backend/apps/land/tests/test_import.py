"""import_kontur: kichik GPKG manba (tmp_path), haqiqiy GIS.gdb ga bog'liq emas."""
import math
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from osgeo import ogr, osr

from apps.land.models import Kontur

ogr.UseExceptions()
R = 6378137.0


def merkator(lon, lat):
    return R * math.radians(lon), R * math.log(math.tan(math.pi / 4 + math.radians(lat) / 2))


def poligon_wkt(lon0, lat0, lon1, lat1, z=True):
    n = [merkator(*p) for p in [(lon0, lat0), (lon1, lat0), (lon1, lat1), (lon0, lat1), (lon0, lat0)]]
    return "MULTIPOLYGON Z (((" + ", ".join(f"{x} {y} 10" for x, y in n) + ")))"


def kapalak_wkt(lon0, lat0, lon1, lat1):
    """O'zini kesadigan (invalid) 'kapalak' poligon."""
    a, b, c, d = merkator(lon0, lat0), merkator(lon1, lat0), merkator(lon1, lat1), merkator(lon0, lat1)
    n = [a, c, b, d, a]
    return "MULTIPOLYGON Z (((" + ", ".join(f"{x} {y} 10" for x, y in n) + ")))"


_MATN = ("mfy", "massiv", "yagona_kontur", "eski_kontur", "satr", "izox")
_TUR = {"distrikt_id": ogr.OFTInteger}
MAYDONLAR = (
    [(f.column, ogr.OFTString) for f in Kontur._meta.concrete_fields if f.column in _MATN]
    + [(f.column, ogr.OFTReal) for f in Kontur._meta.concrete_fields
       if f.get_internal_type() in ("FloatField", "IntegerField") and f.column not in ("id",)]
    + [("distrikt_id", ogr.OFTInteger)]
)


@pytest.fixture
def manba(tmp_path):
    """GPKG `contour` (EPSG:3857): 6 qator (fid 1..6)."""
    yol = tmp_path / "GIS.gpkg"
    ds = ogr.GetDriverByName("GPKG").CreateDataSource(str(yol))
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(3857)
    qatlam = ds.CreateLayer("contour", srs, ogr.wkbMultiPolygonZM, ["FID=OBJECTID"])
    for nom, tur in MAYDONLAR:
        qatlam.CreateField(ogr.FieldDefn(nom, tur))
    qatlam.StartTransaction()
    qatorlar = [
        # (dist, raqam, maydon, mfy, massiv, yagona, geometriya)
        (1201, 5.0, 1.5, "  Ko'hna   mfy ", "Oqʼyer", "A1", poligon_wkt(69.1, 40.1, 69.2, 40.2)),
        (1201, 5.0, 2.0, "", "M2", "   ", kapalak_wkt(69.2, 40.2, 69.3, 40.3)),  # takror + invalid
        (1202, 7.0, 3.0, "G`alaba", None, "A3", poligon_wkt(69.6, 40.1, 69.7, 40.2)),
        (9999, 1.0, 4.0, "x", "y", "A4", poligon_wkt(69.1, 40.5, 69.2, 40.6)),  # bog'lanmagan
        (1201, 6.0, 5.0, "z", "w", "A5", None),  # geometriya yo'q
        (1201, None, 6.0, "q", "r", "A6", poligon_wkt(69.3, 40.3, 69.4, 40.4)),  # raqam NULL
    ]
    for dist, raqam, maydon, mfy, massiv, yagona, wkt in qatorlar:
        f = ogr.Feature(qatlam.GetLayerDefn())
        f["distrikt_id"] = dist
        if raqam is not None:
            f["kontur_raqami"] = raqam
        f["umumiy_maydoni"], f["mfy"], f["yagona_kontur"] = maydon, mfy, yagona
        if massiv is not None:
            f["massiv"] = massiv
        if wkt:
            f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        qatlam.CreateFeature(f)
    qatlam.CommitTransaction()
    ds = None
    return yol


def ishga_tushir(manba, *args):
    chiqish = StringIO()
    call_command("import_kontur", "--gdb", str(manba), *args, stdout=chiqish)
    return chiqish.getvalue()


@pytest.mark.django_db(transaction=True)
class TestImportKontur:
    def test_yuklash(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        # 6 manba: 1 bog'lanmagan, 1 geometriyasiz -> 4 yuklanadi
        assert Kontur.objects.count() == 4
        assert "manba 6, yuklandi 4, o'tkazildi 2" in chiqish
        assert "bog'lanmagan (tuman yo'q): 1" in chiqish
        assert "takror (tuman, kontur_raqami): 1 guruh / 2 qator" in chiqish
        k = Kontur.objects.get(manba_fid=1)
        assert k.tuman_id == tuman.id
        assert k.kontur_raqami == 5
        assert k.umumiy_maydoni == 1.5
        assert k.geom.srid == 4326 and k.geom_mvt.srid == 3857
        assert k.geom.geom_type == "MultiPolygon"
        assert abs(k.geom.centroid.x - 69.15) < 1e-6
        assert not Kontur.objects.filter(manba_fid__in=[4, 5]).exists()

    def test_matn_normallashtirish(self, manba, tuman, shahar):
        ishga_tushir(manba)
        k1, k2, k3 = (Kontur.objects.get(manba_fid=i) for i in (1, 2, 3))
        assert k1.mfy == "Ko‘hna mfy"  # bo'shliqlar, o'dan keyingi apostrof
        assert k1.massiv == "Oq’yer"  # q dan keyin -> U+2019 (tutuq)
        assert k2.mfy is None and k2.yagona_kontur is None  # bo'sh satr -> NULL
        assert k3.mfy == "G‘alaba" and k3.massiv is None

    def test_uch_olchamdan_ikki_olchamga(self, manba, tuman, shahar):
        ishga_tushir(manba)
        for k in Kontur.objects.all():
            assert not k.geom.hasz and not k.geom_mvt.hasz
            assert not k.geom_mvt.empty

    def test_invalid_tuzatiladi(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        k = Kontur.objects.get(manba_fid=2)
        assert k.geom.valid and k.geom_mvt.valid
        assert k.geom.geom_type == "MultiPolygon" and k.geom.area > 0
        assert "tuzatildi (invalid -> ST_MakeValid): 1" in chiqish

    def test_idempotent(self, manba, tuman, shahar):
        ishga_tushir(manba)
        birinchi = sorted(Kontur.objects.values_list("manba_fid", "tuman_id", "kontur_raqami"))
        ishga_tushir(manba)
        assert Kontur.objects.count() == 4
        assert sorted(Kontur.objects.values_list("manba_fid", "tuman_id", "kontur_raqami")) == birinchi

    def test_tuman_bilan(self, manba, tuman, shahar):
        ishga_tushir(manba)
        Kontur.objects.filter(tuman=tuman).update(izox="eski")
        Kontur.objects.filter(tuman=shahar).update(izox="eski")
        chiqish = ishga_tushir(manba, "--tuman", "1202")
        assert Kontur.objects.count() == 4  # jami o'zgarmadi
        assert Kontur.objects.filter(tuman=tuman, izox="eski").count() == 3  # tegilmadi
        assert Kontur.objects.filter(tuman=shahar, izox="eski").count() == 0  # qayta yozildi
        assert "manba 1, yuklandi 1" in chiqish

    def test_tuman_bog_lanmagan(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba, "--tuman", "9999")
        assert Kontur.objects.count() == 0
        assert "yuklandi 0, o'tkazildi 1" in chiqish and "bog'lanmagan (tuman yo'q): 1" in chiqish

    def test_quruq_yozmaydi(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba, "--quruq")
        assert Kontur.objects.count() == 0
        assert "manba 6" in chiqish and "bog'lanmagan (Tuman.kod yo'q): 1" in chiqish

    def test_staging_o_chiriladi(self, manba, tuman, shahar):
        from django.db import connection
        ishga_tushir(manba)
        with connection.cursor() as c:
            c.execute("SELECT to_regclass('land_kontur_staging')")
            assert c.fetchone()[0] is None

    def test_manba_yoq(self, tmp_path):
        with pytest.raises(CommandError):
            call_command("import_kontur", "--gdb", str(tmp_path / "yoq.gdb"))
