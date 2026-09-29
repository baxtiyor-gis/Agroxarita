"""import_tuproq: kichik GPKG manba (tmp_path, domenlari bilan), haqiqiy GIS.gdb ga bog'liq emas."""
from io import StringIO

import pytest
from django.core.management import call_command
from osgeo import ogr, osr

from apps.soil.models import Tuproq, TuproqLugat

ogr.UseExceptions()


def poligon_wkt(x0, y0, x1, y1):
    n = [(x0, y0), (x1, y0), (x1, y1), (x0, y1), (x0, y0)]
    return "MULTIPOLYGON Z (((" + ", ".join(f"{x} {y} 10" for x, y in n) + ")))"


def kapalak_wkt(x0, y0, x1, y1):
    n = [(x0, y0), (x1, y1), (x1, y0), (x0, y1), (x0, y0)]
    return "MULTIPOLYGON Z (((" + ", ".join(f"{x} {y} 10" for x, y in n) + ")))"


DOMEN_USTUNLAR = ["mexanikasi_id", "shorlanishi_id", "yuvilishi_id", "toshlanishi_id", "klass_id"]
DOMEN_QIYMAT = {1: "Қумоқ", 2: "Ўрта қумоқ"}
STR_USTUNLAR = ["yer_osti_suvi_id", "globalid", "viloya", "tuman", "massiv", "mexanikasi", "shorlanishi",
                "yuvilishi", "toshlanishi", "klasss", "bonitet_bali"]
REAL_USTUNLAR = ["ball_bonitet", "maydoni", "region_id", "cad_raqami"]


@pytest.fixture
def manba(tmp_path):
    yol = tmp_path / "GIS.gpkg"
    ds = ogr.GetDriverByName("GPKG").CreateDataSource(str(yol))
    for u in DOMEN_USTUNLAR:
        ds.AddFieldDomain(ogr.CreateCodedFieldDomain(f"dom_{u}", "", ogr.OFTInteger, ogr.OFSTNone, DOMEN_QIYMAT))
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    q = ds.CreateLayer("Soil", srs, ogr.wkbMultiPolygonZM, ["FID=OBJECTID"])
    for u in DOMEN_USTUNLAR:
        fd = ogr.FieldDefn(u, ogr.OFTInteger)
        fd.SetDomainName(f"dom_{u}")
        q.CreateField(fd)
    for u in STR_USTUNLAR:
        q.CreateField(ogr.FieldDefn(u, ogr.OFTString))
    for u in REAL_USTUNLAR:
        q.CreateField(ogr.FieldDefn(u, ogr.OFTReal))
    q.StartTransaction()
    qatorlar = [
        # (gid, cad, mex, yer_osti_suvi, massiv, wkt)
        ("A", 1201, 1, "1 - 2", "  Oq   massiv ", poligon_wkt(69.1, 40.1, 69.2, 40.2)),
        ("B", None, 99, ">10", None, kapalak_wkt(69.6, 40.1, 69.7, 40.2)),  # geometrik (shahar), kod yo'q, invalid
        ("C", 9999, 2, " ", "M", poligon_wkt(69.3, 40.3, 69.6, 40.4)),  # cad mos emas -> ko'proq tuman1 ga
        ("D", 1202, 1, None, "M", poligon_wkt(69.1, 40.5, 69.2, 40.6)),  # cad bo'yicha, markazi tashqarida
        ("E", 1201, 1, "abc", "M", None),  # geometriya yo'q
        ("F", None, None, "1,5 - 2", "M", poligon_wkt(71.1, 40.1, 71.2, 40.2)),  # hech qayerga tushmaydi
    ]
    for gid, cad, mex, ys, massiv, wkt in qatorlar:
        f = ogr.Feature(q.GetLayerDefn())
        f["globalid"], f["maydoni"], f["ball_bonitet"], f["viloya"] = gid, 1.5, 55.0, " Sinov "
        if cad is not None:
            f["cad_raqami"] = cad
        if mex is not None:
            f["mexanikasi_id"] = mex
        if ys is not None:
            f["yer_osti_suvi_id"] = ys
        if massiv is not None:
            f["massiv"] = massiv
        if wkt:
            f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        q.CreateFeature(f)
    q.CommitTransaction()
    ds = None
    return yol


def ishga_tushir(manba, *args):
    chiqish = StringIO()
    call_command("import_tuproq", "--gdb", str(manba), *args, stdout=chiqish)
    return chiqish.getvalue()


@pytest.mark.django_db(transaction=True)
class TestImportTuproq:
    def test_yuklash_va_lugat(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        assert "manba 6, yuklandi 5, o'tkazildi 1" in chiqish
        assert Tuproq.objects.count() == 5
        assert TuproqLugat.objects.count() == 10  # 5 tur x 2 kod
        assert TuproqLugat.objects.get(tur="mexanika", kod=1).nom == "Qumoq"
        a = Tuproq.objects.get(globalid="A")
        assert a.mexanika.kod == 1 and a.mexanika.tur == "mexanika"
        assert a.geom.srid == 4326 and a.geom_mvt.srid == 3857 and a.geom.geom_type == "MultiPolygon"
        assert not a.geom.hasz
        assert a.bonitet == 55.0 and a.maydon == 1.5
        assert a.massiv_nomi == "Oq   massiv"  # trim (ichki bo'shliq saqlanadi)
        assert a.manba["viloya"] == "Sinov" and a.manba["cad_raqami"] == 1201

    def test_lugatda_yoq_kod_null(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        assert Tuproq.objects.get(globalid="B").mexanika is None
        assert "lug'atda yo'q mexanika kodlari (NULL qilindi): 99: 1" in chiqish

    def test_invalid_tuzatiladi(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        b = Tuproq.objects.get(globalid="B")
        assert b.geom.valid and b.geom_mvt.valid and b.geom.area > 0
        assert "tuzatildi (invalid -> ST_MakeValid): 1" in chiqish

    def test_tuman_cad_va_geometrik(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        t = {g.globalid: g.tuman_id for g in Tuproq.objects.all()}
        assert t["A"] == tuman.id  # cad
        assert t["D"] == shahar.id  # cad ustun (geometriya tuman1 da)
        assert t["B"] == shahar.id  # geometrik (cad yo'q)
        assert t["C"] == tuman.id  # geometrik (cad mos emas, eng katta kesishuv)
        assert t["F"] is None
        assert "tuman: cad bo'yicha 2, geometrik 2, bog'lanmagan 1" in chiqish
        assert "markazi tuman tashqarisida: 1 (namuna: D)" in chiqish

    def test_yer_osti_suvi(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba)
        g = {x.globalid: x for x in Tuproq.objects.all()}
        assert (g["A"].yer_osti_suvi, g["A"].yer_osti_suvi_min, g["A"].yer_osti_suvi_max) == ("1–2", 1, 2)
        assert (g["B"].yer_osti_suvi, g["B"].yer_osti_suvi_min, g["B"].yer_osti_suvi_max) == (">10", 10, None)
        assert g["C"].yer_osti_suvi == "" and g["C"].yer_osti_suvi_min is None  # ' '
        assert g["D"].yer_osti_suvi == ""  # NULL
        assert g["F"].yer_osti_suvi == "1,5–2" and g["F"].yer_osti_suvi_min == 1.5
        assert "noyob 5, parse qilinmagan 1" in chiqish  # 'abc' (geometriyasiz qatorda ham hisobga olinadi)
        assert "'abc': 1" in chiqish

    def test_idempotent(self, manba, tuman, shahar):
        ishga_tushir(manba)
        birinchi = sorted(Tuproq.objects.values_list("globalid", "tuman_id", "mexanika_id", "yer_osti_suvi"))
        lugat = TuproqLugat.objects.count()
        ishga_tushir(manba)
        assert Tuproq.objects.count() == 5 and TuproqLugat.objects.count() == lugat
        assert sorted(Tuproq.objects.values_list("globalid", "tuman_id", "mexanika_id", "yer_osti_suvi")) == birinchi

    def test_quruq(self, manba, tuman, shahar):
        chiqish = ishga_tushir(manba, "--quruq")
        assert "manba 6" in chiqish
        assert Tuproq.objects.count() == 0
