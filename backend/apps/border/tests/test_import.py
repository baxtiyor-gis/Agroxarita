"""import_border: normallashtirish (sof Python), quruq rejim (bazasiz) va bazaga yuklash testlari.

Manba fayllari test ichida GDAL bilan tmp_path da yaratiladi (haqiqiy data/ ga bog'liq emas).
"""
from io import StringIO

import pytest
from django.contrib.gis.geos import GEOSGeometry
from django.core.management import call_command
from osgeo import ogr, osr

from apps.border.management.commands.import_border import kod_ajrat, nom_tozala, tip_aniqla
from apps.border.models import Massiv, Tuman, Viloyat
from conftest import kvadrat

ogr.UseExceptions()


# --------------------------------------------------------------------------- normallashtirish

@pytest.mark.parametrize(
    "kirish, kutilgan",
    [
        ("Farg'ona", "Farg‘ona"),
        ("Farg`ona", "Farg‘ona"),
        ("Farg’ona", "Farg‘ona"),
        ("O'zbekiston", "O‘zbekiston"),
        ("G'ofur G'ulom", "G‘ofur G‘ulom"),
        ("Ma'mur", "Ma’mur"),
        ("Sha'bo", "Sha’bo"),  # h dan keyin - tutuq
        ("Qo‘shko‘pir", "Qo‘shko‘pir"),
        ("  Yakkabog'   tumani ", "Yakkabog‘ tumani"),
        ("Toshkent sh", "Toshkent sh"),
        (None, ""),
        ("", ""),
    ],
)
def test_nom(kirish, kutilgan):
    assert nom_tozala(kirish) == kutilgan


@pytest.mark.parametrize(
    "kirish, kutilgan",
    [("T", "tuman"), ("Т", "tuman"), ("Ш", "shahar"), ("ш", "shahar"), (" T ", "tuman"),
     ("X", None), ("", None), (None, None)],
)
def test_tip(kirish, kutilgan):
    assert tip_aniqla(kirish) == kutilgan


def test_tip_lotin_va_kirill_t_farqli_belgilar():
    assert "T" != "Т"
    assert tip_aniqla("T") == tip_aniqla("Т") == "tuman"


@pytest.mark.parametrize("kirish, kutilgan", [("12:01", 1201), ("09:15", 915), ("1:05", 105), (" 22:12 ", 2212)])
def test_kod(kirish, kutilgan):
    assert kod_ajrat(kirish) == kutilgan


@pytest.mark.parametrize("noto_g_ri", ["1201", "12-01", "", None, "12:1", "ab:cd"])
def test_kod_xato(noto_g_ri):
    with pytest.raises(ValueError):
        kod_ajrat(noto_g_ri)


# --------------------------------------------------------------------------- manba yaratish

def _wkt_3857(geom_4326):
    return geom_4326.transform(3857, clone=True).wkt


def _srs_3857():
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(3857)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    return srs


def _maydon(qatlam, nom, tur):
    d = ogr.FieldDefn(nom, tur)
    if tur == ogr.OFTString:
        d.SetWidth(100)
    qatlam.CreateField(d)


def _shp(yol, geom_tur, maydonlar, qatorlar):
    """qatorlar: [(atributlar dict, WKT)]"""
    yol.parent.mkdir(parents=True, exist_ok=True)
    ds = ogr.GetDriverByName("ESRI Shapefile").CreateDataSource(str(yol))
    q = ds.CreateLayer(yol.stem, _srs_3857(), geom_tur, options=["ENCODING=UTF-8"])
    for nom, tur in maydonlar.items():
        _maydon(q, nom, tur)
    for atr, wkt in qatorlar:
        f = ogr.Feature(q.GetLayerDefn())
        for k, v in atr.items():
            f[k] = v
        f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        q.CreateFeature(f)
    ds = None


def _gdb(yol, qatorlar):
    ds = ogr.GetDriverByName("OpenFileGDB").CreateDataSource(str(yol))
    q = ds.CreateLayer("massiv", _srs_3857(), ogr.wkbMultiPolygon)
    for nom, tur in {"name_lot": ogr.OFTString, "globalid": ogr.OFTString, "massiv_id": ogr.OFTInteger}.items():
        _maydon(q, nom, tur)
    for atr, wkt in qatorlar:
        f = ogr.Feature(q.GetLayerDefn())
        for k, v in atr.items():
            f[k] = v
        f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        q.CreateFeature(f)
    ds = None


BOWTIE = "POLYGON((70 40, 70.5 41, 70.5 40, 70 41, 70 40))"  # o'zini kesadi -> invalid


def manba_yarat(papka, tumanlar=None, massivlar=None):
    """regions/, districts/, GIS.gdb yaratadi. Standart to'plam:

    viloyat 12 (mhobt 1712, nom apostrofli), 13; tuman 12:01 (lotin/kirill `T`), 12:02 (`Ш`),
    12:03 (invalid bowtie), 99:01 (viloyat yo'q). massiv (kaliti yo'q, fid): A1 (1201), A2 (1202), A3,
    A4 (hech qaysi tumanda emas), A5 (1201 25% / 1202 75%).
    """
    _shp(
        papka / "regions" / "regions.shp", ogr.wkbPolygon,
        {"name": ogr.OFTString, "name_lot": ogr.OFTString, "region_id": ogr.OFTInteger64, "mhobt": ogr.OFTInteger64},
        [
            ({"name": "Сирдарё", "name_lot": "Sirdaryo  Viloyati", "region_id": 12, "mhobt": 1712},
             _wkt_3857(kvadrat(69, 40, 71, 41))),
            ({"name": "Жиззах", "name_lot": "Qo'shrabot", "region_id": 13, "mhobt": 1708},
             _wkt_3857(kvadrat(72, 40, 73, 41))),
        ],
    )
    if tumanlar is None:
        tumanlar = [
            ({"name_lot": "Boyovut  tumani", "cad_raqami": "12:01", "region_id": 12, "tip": "Т", "mhobt": 1712201},
             _wkt_3857(kvadrat(69, 40, 69.5, 41))),
            ({"name_lot": "Sirdaryo `shahri", "cad_raqami": "12:02", "region_id": 12, "tip": "Ш", "mhobt": 1712202},
             _wkt_3857(kvadrat(69.5, 40, 70, 41))),
            ({"name_lot": "Bowtie tumani", "cad_raqami": "12:03", "region_id": 12, "tip": "T", "mhobt": 1712203},
             _wkt_3857(GEOSGeometry(BOWTIE, srid=4326))),
            ({"name_lot": "Yetim tumani", "cad_raqami": "99:01", "region_id": 99, "tip": "T", "mhobt": 9999001},
             _wkt_3857(kvadrat(10, 10, 11, 11))),
        ]
    _shp(
        papka / "districts" / "districts.shp", ogr.wkbPolygon,
        {"name_lot": ogr.OFTString, "cad_raqami": ogr.OFTString, "region_id": ogr.OFTInteger64,
         "tip": ogr.OFTString, "mhobt": ogr.OFTInteger64},
        tumanlar,
    )
    if massivlar is None:
        massivlar = [
            ({"name_lot": "O'rta massiv", "globalid": "{A1}", "massiv_id": 1}, _wkt_3857(kvadrat(69.1, 40.1, 69.2, 40.2))),
            ({"name_lot": "Takror id", "globalid": "{A2}", "massiv_id": 1}, _wkt_3857(kvadrat(69.6, 40.1, 69.7, 40.2))),
            ({"name_lot": "Nol id", "globalid": "{A3}", "massiv_id": 0}, _wkt_3857(kvadrat(69.3, 40.5, 69.4, 40.6))),
            ({"name_lot": "Tashqarida", "globalid": "{A4}", "massiv_id": 4}, _wkt_3857(kvadrat(80, 50, 80.1, 50.1))),
            # 1201 (69..69.5) bilan 25%, 1202 (69.5..70) bilan 75% kesishadi
            ({"name_lot": "Ikki tumanli", "globalid": "{A5}", "massiv_id": 5}, _wkt_3857(kvadrat(69.4, 40.7, 69.8, 40.8))),
        ]
    _gdb(papka / "GIS.gdb", massivlar)
    return papka


def ishga_tushir(papka, *args):
    chiqish = StringIO()
    call_command("import_border", *args, f"--data-dir={papka}", stdout=chiqish)
    return chiqish.getvalue()


@pytest.fixture
def manba(tmp_path):
    return manba_yarat(tmp_path)


# --------------------------------------------------------------------------- quruq rejim (bazasiz)

def test_quruq_hisobot(manba):
    chiqish = ishga_tushir(manba, "--quruq")
    assert "viloyat: manba 2, yuklanadi 2, o'tkazildi 0" in chiqish
    # 99:01 uchun viloyat yo'q -> o'tkazildi; invalid bowtie tuzatildi
    assert "tuman: manba 4, yuklanadi 3, o'tkazildi 1, geometriyasi tuzatildi 1" in chiqish
    assert "viloyat topilmadi: region_id=99" in chiqish
    # faqat tumansiz A4 o'tkazildi
    assert "massiv: manba 5, yuklanadi 4, o'tkazildi 1" in chiqish
    assert "(a) hech bir tuman bilan kesishmaydi (o'tkazildi): 1" in chiqish
    assert "ikkinchi tuman ulushi >5%: 1" in chiqish
    assert "fid=5 | Ikki tumanli | tuman 1202 75.0%, tuman 1201 25.0%" in chiqish


def test_quruq_nomlar_normallashgan(manba):
    chiqish = ishga_tushir(manba, "--quruq")
    assert "Sirdaryo Viloyati" in chiqish
    assert "Qo‘shrabot" in chiqish  # o dan keyin apostrof -> ‘
    assert "shahar" in chiqish


def test_quruq_bosh_massiv_xato_bermaydi(tmp_path):
    manba_yarat(tmp_path, massivlar=[])
    chiqish = ishga_tushir(tmp_path, "--quruq")
    assert "massiv qatlami bo'sh" in chiqish


def test_quruq_massiv_tumansiz_xato(manba):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        ishga_tushir(manba, "--quruq", "--massiv")


def test_manba_yoq_xato(tmp_path):
    from django.core.management.base import CommandError

    with pytest.raises(CommandError):
        ishga_tushir(tmp_path, "--quruq", "--viloyat")


def test_geometriya_maydonlari_invalid_tuzatiladi():
    from apps.border.management.commands.import_border import geometriya_maydonlari

    invalid = GEOSGeometry(BOWTIE, srid=4326).transform(3857, clone=True)
    assert not invalid.valid
    m, tuzatildi = geometriya_maydonlari(invalid)
    assert tuzatildi
    assert m["geom"].valid and m["geom"].geom_type == "MultiPolygon" and m["geom"].srid == 4326
    assert m["geom_mvt"].srid == 3857 and m["geom_mvt_s"].srid == 3857
    assert m["geom_mvt_s"].geom_type == "MultiPolygon"
    assert m["bbox"] == pytest.approx([70, 40, 70.5, 41])


def test_geometriya_maydonlari_polygon_multipolygon_ga():
    from apps.border.management.commands.import_border import geometriya_maydonlari

    m, tuzatildi = geometriya_maydonlari(GEOSGeometry("POLYGON((0 0, 0 1, 1 1, 1 0, 0 0))", srid=4326))
    assert not tuzatildi
    assert m["geom"].geom_type == "MultiPolygon"
    assert m["bbox"] == [0.0, 0.0, 1.0, 1.0]


def test_geometriya_maydonlari_2d_ga_keltiriladi_va_poligonsiz_none():
    from apps.border.management.commands.import_border import geometriya_maydonlari

    m, _ = geometriya_maydonlari(GEOSGeometry("LINESTRING(0 0, 1 1)", srid=4326))
    assert m is None


# --------------------------------------------------------------------------- bazaga yuklash (PostGIS kerak)

@pytest.mark.django_db
def test_import_hammasi(manba):
    chiqish = ishga_tushir(manba)
    assert Viloyat.objects.count() == 2
    assert Tuman.objects.count() == 3  # 99:01 o'tkazildi
    assert Massiv.objects.count() == 4

    v = Viloyat.objects.get(region_id=12)
    assert v.soato == "1712" and v.nom == "Sirdaryo Viloyati"
    assert v.geom.srid == 4326 and v.geom_mvt.srid == 3857 and v.geom_mvt_s.srid == 3857
    assert v.bbox == pytest.approx([69, 40, 71, 41])
    assert Viloyat.objects.get(region_id=13).nom == "Qo‘shrabot"

    t1, t2, t3 = (Tuman.objects.get(kod=k) for k in (1201, 1202, 1203))
    assert (t1.tip, t2.tip, t3.tip) == ("tuman", "shahar", "tuman")
    assert t1.viloyat == v
    assert t2.nom == "Sirdaryo ’shahri"
    assert t3.geom.valid and t3.geom.geom_type == "MultiPolygon"  # invalid tuzatildi
    assert not Tuman.objects.filter(kod=9901).exists()
    assert "viloyat topilmadi" in chiqish

    assert Massiv.objects.get(nom="O‘rta massiv").tuman.kod == 1201
    assert Massiv.objects.get(nom="Takror id").tuman.kod == 1202
    # 2 tumanli massiv - eng katta kesishuvli tumanga (1202, 75%)
    assert Massiv.objects.get(nom="Ikki tumanli").tuman.kod == 1202
    assert not Massiv.objects.filter(nom="Tashqarida").exists()
    assert "ikkinchi tuman ulushi >5%: 1" in chiqish


@pytest.mark.django_db
def test_import_idempotent(manba):
    ishga_tushir(manba)
    holat = (Viloyat.objects.count(), Tuman.objects.count(), Massiv.objects.count())
    ids = set(Tuman.objects.values_list("id", flat=True))
    chiqish = ishga_tushir(manba)
    assert (Viloyat.objects.count(), Tuman.objects.count(), Massiv.objects.count()) == holat
    assert set(Tuman.objects.values_list("id", flat=True)) == ids
    assert "yuklandi 0, yangilandi 2" in chiqish  # viloyat
    assert "massiv: manba 5, yuklandi 4, yangilandi 0" in chiqish  # massivlar to'liq almashtiriladi
    assert "o'chirildi 4" in chiqish


@pytest.mark.django_db
def test_import_faqat_viloyat_flagi(manba):
    ishga_tushir(manba, "--viloyat")
    assert Viloyat.objects.count() == 2
    assert Tuman.objects.count() == 0 and Massiv.objects.count() == 0


@pytest.mark.django_db
def test_import_tuman_viloyatsiz_hammasini_otkazadi(manba):
    ishga_tushir(manba, "--tuman")  # viloyatlar bazada yo'q
    assert Tuman.objects.count() == 0


@pytest.mark.django_db
def test_import_bosh_massiv_xato_bermaydi(tmp_path):
    manba_yarat(tmp_path, massivlar=[])
    chiqish = ishga_tushir(tmp_path)
    assert Massiv.objects.count() == 0 and Tuman.objects.count() == 3
    assert "massiv qatlami bo'sh" in chiqish


@pytest.mark.django_db
def test_tozala(tmp_path, manba):
    ishga_tushir(manba)
    # 12:02 manbadan olib tashlanadi
    kam = [
        ({"name_lot": "Boyovut tumani", "cad_raqami": "12:01", "region_id": 12, "tip": "T", "mhobt": 1712201},
         _wkt_3857(kvadrat(69, 40, 69.5, 41))),
    ]
    yangi = tmp_path / "yangi"
    manba_yarat(yangi, tumanlar=kam)

    chiqish = ishga_tushir(yangi, "--tuman")
    assert Tuman.objects.count() == 3  # default - o'chirmaydi, faqat hisobot
    assert "manbada yo'q 2" in chiqish

    chiqish = ishga_tushir(yangi, "--tuman", "--tozala")
    assert list(Tuman.objects.values_list("kod", flat=True)) == [1201]
    assert "o'chirildi 2" in chiqish
    # o'chirilgan tumanning massivlari (CASCADE) ham ketadi, 1201 niki qoladi
    assert set(Massiv.objects.values_list("nom", flat=True)) == {"O‘rta massiv", "Nol id"}
