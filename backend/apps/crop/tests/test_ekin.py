"""Ekin: import_ekin (kichik GPKG manba), kontur API `ekinlar` va tile atributlari."""
import math
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError
from django.db import connection
from osgeo import ogr, osr

from apps.crop.models import EkinClass, KonturEkin
from conftest import kontur_yarat, kvadrat

ogr.UseExceptions()

DOMEN = {101010000: "Paxta", 102010000: "Gʻalla", 5: "Arpa (ozuqa uchun)"}


def _poligon(x0, y0, x1, y1):
    return f"POLYGON(({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))"


@pytest.fixture
def manba(tmp_path):
    """Crop_2026 GPKG: A konturi (69.1..69.11) ichida paxta (katta) + g'alla (kichik); B konturi (69.2..69.21):
    paxta to'liq, 25% ustma-ust poligon (bog'lanmaydi), lug'atda yo'q kod 999; uzoqdagi poligon."""
    yol = tmp_path / "GIS.gpkg"
    ds = ogr.GetDriverByName("GPKG").CreateDataSource(str(yol))
    ds.AddFieldDomain(ogr.CreateCodedFieldDomain("dom_crop", "", ogr.OFTInteger, ogr.OFSTNone, DOMEN))
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    srs.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
    q = ds.CreateLayer("Crop_2026", srs, ogr.wkbMultiPolygon, ["FID=OBJECTID"])
    fd = ogr.FieldDefn("crop_name", ogr.OFTInteger)
    fd.SetDomainName("dom_crop")
    q.CreateField(fd)
    q.CreateField(ogr.FieldDefn("crop_area", ogr.OFTReal))
    q.CreateField(ogr.FieldDefn("kontur_raqami", ogr.OFTInteger))
    q.CreateField(ogr.FieldDefn("district", ogr.OFTInteger))
    q.StartTransaction()
    for kod, wkt in [
        (101010000, _poligon(69.1, 40.1, 69.105, 40.11)),
        (102010000, _poligon(69.105, 40.1, 69.11, 40.1025)),
        (101010000, _poligon(69.2, 40.1, 69.21, 40.11)),
        (102010000, _poligon(69.2095, 40.1, 69.2115, 40.11)),  # 25% ichkarida -> bog'lanmaydi
        (999, _poligon(69.2, 40.1, 69.201, 40.101)),
        (101010000, _poligon(69.4, 40.5, 69.41, 40.51)),  # hech qaysi konturga tegmaydi
    ]:
        f = ogr.Feature(q.GetLayerDefn())
        f["crop_name"], f["crop_area"] = kod, 1.0
        f.SetGeometry(ogr.CreateGeometryFromWkt(wkt))
        q.CreateFeature(f)
    q.CommitTransaction()
    ds = None
    return yol


@pytest.fixture
def konturlar(tuman):
    a = kontur_yarat(tuman, 1, kvadrat(69.1, 40.1, 69.11, 40.11), kontur_raqami=1, umumiy_maydoni=95.0)
    b = kontur_yarat(tuman, 2, kvadrat(69.2, 40.1, 69.21, 40.11), kontur_raqami=2, umumiy_maydoni=95.0)
    return a, b


def ishga_tushir(manba, *args):
    chiqish = StringIO()
    call_command("import_ekin", "--gdb", str(manba), "--yil", "2026", *args, stdout=chiqish)
    return chiqish.getvalue()


@pytest.mark.django_db(transaction=True)
class TestImportEkin:
    def test_bog_lash_va_asosiy(self, manba, konturlar):
        a, b = konturlar
        chiqish = ishga_tushir(manba)
        assert "manba 6 poligon" in chiqish
        assert "bog'langan (>= 0.5): 4 poligon" in chiqish  # 999 ham bog'lanadi, lekin lug'atda yo'q
        assert "lug'atda yo'q kodlar (tashlandi): 999: 1" in chiqish
        assert EkinClass.objects.get(kod=102010000).nom == "G‘alla"  # ʻ -> ‘ (loyiha apostrofi)
        qatorlar = {(q.kontur_id, q.ekin.kod): q for q in KonturEkin.objects.select_related("ekin")}
        assert set(qatorlar) == {(a.pk, 101010000), (a.pk, 102010000), (b.pk, 101010000)}
        paxta_a, galla_a, paxta_b = (qatorlar[(a.pk, 101010000)], qatorlar[(a.pk, 102010000)],
                                     qatorlar[(b.pk, 101010000)])
        assert paxta_a.asosiy and not galla_a.asosiy and paxta_b.asosiy
        assert paxta_a.yil == 2026 and paxta_a.ulush == pytest.approx(1.0, abs=1e-6)
        assert paxta_a.maydon == pytest.approx(47.3, rel=0.03) and galla_a.maydon < paxta_a.maydon
        assert paxta_b.maydon <= 95.0 * 1.05
        with connection.cursor() as c:
            c.execute("SELECT to_regclass('ekin_staging'), to_regclass('ekin_boglash')")
            assert c.fetchone() == (None, None)

    def test_idempotent(self, manba, konturlar):
        ishga_tushir(manba)
        with pytest.raises(CommandError, match="--qayta"):
            ishga_tushir(manba)
        chiqish = ishga_tushir(manba, "--qayta")
        assert "o'chirildi 3, yozildi 3" in chiqish
        assert KonturEkin.objects.count() == 3

    def test_viloyat_filtri(self, manba, konturlar, viloyat):
        ishga_tushir(manba, "--viloyat", "99")
        assert KonturEkin.objects.count() == 0  # bunday viloyat yo'q
        ishga_tushir(manba, "--viloyat", str(viloyat.region_id))
        assert KonturEkin.objects.count() == 3


@pytest.fixture
def ekinlar(konturlar):
    a, _ = konturlar
    paxta = EkinClass.objects.create(kod=101010000, nom="Paxta")
    galla = EkinClass.objects.create(kod=102010000, nom="G‘alla")
    KonturEkin.objects.create(kontur=a, yil=2026, ekin=paxta, maydon=50.0, ulush=1.0, asosiy=True)
    KonturEkin.objects.create(kontur=a, yil=2026, ekin=galla, maydon=10.0, ulush=1.0)
    KonturEkin.objects.create(kontur=a, yil=2025, ekin=galla, maydon=60.0, ulush=1.0, asosiy=True)
    return a


@pytest.mark.django_db
def test_api_ekinlar(client, ekinlar, konturlar):
    r = client.get(f"/api/konturlar/{ekinlar.pk}/", HTTP_HOST="localhost")
    assert r.status_code == 200
    assert [(e["yil"], e["kod"], e["nom"], e["maydon"], e["asosiy"]) for e in r.json()["ekinlar"]] == [
        (2026, 101010000, "Paxta", 50.0, True),
        (2026, 102010000, "G‘alla", 10.0, False),
        (2025, 102010000, "G‘alla", 60.0, True),
    ]
    assert r.json()["ekinlar"][0]["nom"] == "Paxta"
    _, b = konturlar
    assert client.get(f"/api/konturlar/{b.pk}/", HTTP_HOST="localhost").json()["ekinlar"] == []


@pytest.mark.django_db
def test_tile_ekin_atributlari(client, ekinlar):
    z = 14
    n = 2**z
    x = int((69.105 + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(40.105))) / math.pi) / 2 * n)
    javob = client.get(f"/tiles/kontur/{z}/{x}/{y}.pbf?tuman=1201")
    assert javob.status_code == 200
    for kalit in (b"ekin_2026", b"ekin_2025"):
        assert kalit in javob.content


@pytest.mark.django_db
def test_api_ekinlar_royxati(client, ekinlar):
    r = client.get("/api/ekinlar/", HTTP_HOST="localhost")
    assert r.status_code == 200
    assert r.json() == [
        {"kod": 101010000, "nom": "Paxta", "maydon_2026": 50.0, "maydon_2025": 0.0},
        {"kod": 102010000, "nom": "G‘alla", "maydon_2026": 10.0, "maydon_2025": 60.0},
    ]
