"""import_agrokimyo: kichik GPKG manba (EPSG:3857, tmp_path), haqiqiy GIS.gdb ga bog'liq emas."""
from io import StringIO

import pytest
from django.core.management import call_command
from osgeo import ogr, osr

from apps.soil.management.commands.import_agrokimyo import daraja_parse
from apps.soil.models import Agrokimyo

ogr.UseExceptions()


@pytest.fixture
def manba(tmp_path):
    yol = tmp_path / "GIS.gpkg"
    ds = ogr.GetDriverByName("GPKG").CreateDataSource(str(yol))
    src = osr.SpatialReference()
    src.ImportFromEPSG(4326)
    src.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    dst = osr.SpatialReference()
    dst.ImportFromEPSG(3857)
    dst.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    q = ds.CreateLayer("Kaliy", dst, ogr.wkbMultiPolygon, ["FID=OBJECTID"])
    for nom, tur in [("year", ogr.OFTInteger), ("district", ogr.OFTInteger), ("region", ogr.OFTInteger),
                     ("area", ogr.OFTReal), ("region_cad", ogr.OFTReal), ("district_cad", ogr.OFTReal),
                     ("darajasi", ogr.OFTString), ("gradatsiyasi", ogr.OFTString),
                     ("viloyat", ogr.OFTString), ("tuman", ogr.OFTString)]:
        q.CreateField(ogr.FieldDefn(nom, tur))
    ct = osr.CoordinateTransformation(src, dst)
    qatorlar = [
        # (yil, district_cad, daraja, gradatsiya, wkt)
        (2024, 1201, "Kam", "101-200", "POLYGON ((69.1 40.1, 69.2 40.1, 69.2 40.2, 69.1 40.2, 69.1 40.1))"),
        (2025, None, "Juda ko`p", ">400", "POLYGON ((69.6 40.1, 69.7 40.1, 69.7 40.2, 69.6 40.2, 69.6 40.1))"),
        (2024, 9999, "O‘rtacha", "201-300", "POLYGON ((69.3 40.3, 69.4 40.3, 69.4 40.4, 69.3 40.4, 69.3 40.3))"),
        (2022, 1201, "Juda kam", "<100", "POLYGON ((69.1 40.5, 69.2 40.5, 69.2 40.6, 69.1 40.6, 69.1 40.5))"),
        (2022, 1201, "Nomalum", None, "POLYGON ((69.1 40.7, 69.2 40.7, 69.2 40.8, 69.1 40.8, 69.1 40.7))"),
        (2020, None, "Kam", "101-200", "POLYGON ((71.1 40.1, 71.2 40.1, 71.2 40.2, 71.1 40.2, 71.1 40.1))"),
        (2024, 1202, "Ko'p", "401-500", "POLYGON ((69.6 40.5, 69.7 40.7, 69.7 40.5, 69.6 40.7, 69.6 40.5))"),  # invalid
    ]
    for yil, cad, daraja, grad, wkt in qatorlar:
        f = ogr.Feature(q.GetLayerDefn())
        f["year"], f["area"], f["viloyat"] = yil, 100.0, " Sinov "
        if cad is not None:
            f["district_cad"] = cad
        f["darajasi"] = daraja
        if grad:
            f["gradatsiyasi"] = grad
        g = ogr.CreateGeometryFromWkt(wkt)
        g.Transform(ct)
        f.SetGeometry(ogr.ForceToMultiPolygon(g))
        q.CreateFeature(f)
    ds = None
    return yol


def ishga_tushir(manba, *args):
    chiqish = StringIO()
    call_command("import_agrokimyo", "--gdb", str(manba), "--qatlam", "Kaliy", "--korsatkich", "kaliy", *args,
                 stdout=chiqish)
    return chiqish.getvalue()


def test_daraja_parse():
    assert daraja_parse("Juda kam") == (1, "Juda kam")
    assert daraja_parse(" o‘rtacha ") == (3, "O'rtacha")
    assert daraja_parse("Ko`p") == (4, "Ko'p")
    assert daraja_parse("JUDA KO'P") == (5, "Juda ko'p")
    assert daraja_parse("xyz") == (None, None) and daraja_parse(None) == (None, None)


@pytest.mark.django_db(transaction=True)
class TestImportAgrokimyo:
    def test_yuklash(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        assert "manba 7, yuklandi 7, o'tkazildi 0" in chiqish
        a = {(x.yil, x.daraja): x for x in Agrokimyo.objects.all()}
        assert len(a) == 7
        k = a[(2024, 2)]
        assert k.korsatkich == "kaliy" and k.daraja_nom == "Kam" and k.gradatsiya == "101-200" and k.maydon == 100.0
        assert k.geom.srid == 4326 and k.geom_mvt.srid == 3857 and k.geom.geom_type == "MultiPolygon"
        assert k.geom.extent == pytest.approx((69.1, 40.1, 69.2, 40.2))
        assert k.manba["viloyat"] == "Sinov" and k.manba["district_cad"] == 1201
        assert a[(2025, 5)].daraja_nom == "Juda ko'p" and a[(2022, 1)].daraja_nom == "Juda kam"

    def test_nomalum_daraja_va_invalid(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        n = Agrokimyo.objects.get(yil=2022, daraja=None)
        assert n.daraja_nom == "" and n.gradatsiya == ""
        assert "['Nomalum']" in chiqish
        assert "tuzatildi (invalid -> ST_MakeValid): 1" in chiqish
        assert all(x.geom.valid for x in Agrokimyo.objects.all())

    def test_tuman(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        t = {(x.yil, x.daraja): x.tuman_id for x in Agrokimyo.objects.all()}
        assert t[(2024, 2)] == tuman.id  # district_cad
        assert t[(2025, 5)] == shahar.id  # geometrik
        assert t[(2024, 3)] == tuman.id  # cad mos emas -> geometrik
        assert t[(2020, 2)] is None
        assert "district_cad bo'yicha 4, geometrik 2, bog'lanmagan 1" in chiqish

    def test_idempotent_va_korsatkich_ajratilgan(self, manba, tuman, shahar):
        Agrokimyo.objects.create(korsatkich="fosfor", yil=2024, daraja=1, geom=tuman.geom, geom_mvt=tuman.geom_mvt)
        ishga_tushir(manba)
        ishga_tushir(manba)
        assert Agrokimyo.objects.filter(korsatkich="kaliy").count() == 7
        assert Agrokimyo.objects.filter(korsatkich="fosfor").count() == 1

    def test_quruq(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba, "--quruq")
        assert "manba 7" in chiqish and "'Nomalum': 1" in chiqish
        assert Agrokimyo.objects.count() == 0
