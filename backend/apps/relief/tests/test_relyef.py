import numpy as np
import pytest
from osgeo import gdal, ogr, osr

from apps.relief.dem import LCC_PROJ4, qiyalik_sinfi, yonalish_kodi, zonal
from apps.relief.management.commands.hisobla_relyef import Rasterlar, kontur_hisobla, tuman_hisobla
from apps.relief.models import KonturRelyef
from conftest import kontur_yarat, kvadrat

gdal.UseExceptions()


def test_sinf_va_yonalish():
    assert [qiyalik_sinfi(x) for x in (0.5, 1, 2.9, 3, 6.9, 7, 30, None)] == [
        "tekis", "yengil", "yengil", "orta", "orta", "tik", "tik", None]
    assert [yonalish_kodi(x) for x in (0, 359, 44, 90, 180, 270, 315)] == ["Sh", "Sh", "ShSh", "Sq", "J", "G", "ShG"]


def test_zonal_doiraviy_ortacha_va_nodata():
    dem = np.array([[100, 110], [120, -9999]], np.float32)
    sl = np.array([[2, 4], [6, -9999]], np.float32)
    asp = np.array([[350, 10], [-9999, -9999]], np.float32)
    n = zonal(np.ones((2, 2), bool), dem, sl, asp)
    assert (n["balandlik_min"], n["balandlik_ortacha"], n["balandlik_max"]) == (100, 110, 120)
    assert n["qiyalik_ortacha"] == 4 and n["qiyalik_sinfi"] == "orta"
    assert n["yonalish"] == "Sh" and n["yonalish_gradus"] in (0.0, 360.0)
    assert zonal(np.zeros((2, 2), bool), dem, sl, asp) is None


@pytest.fixture
def rasterlar(tmp_path):
    """100x100 piksel, 30 m, DEM = 0.1 * x (metr) — sharqqa ko'tariladi: qiyalik atan(0.1)=5.71 gradus, yo'nalish g'arb."""
    srs = osr.SpatialReference()
    srs.ImportFromProj4(LCC_PROJ4)
    ds = gdal.GetDriverByName("GTiff").Create(str(tmp_path / "dem_lcc.tif"), 100, 100, 1, gdal.GDT_Float32)
    ds.SetGeoTransform((1000, 30, 0, 4000, 0, -30))
    ds.SetProjection(srs.ExportToWkt())
    x = 1000 + 30 * (np.arange(100) + 0.5)
    ds.GetRasterBand(1).WriteArray(np.tile(0.1 * x, (100, 1)).astype(np.float32))
    ds.GetRasterBand(1).SetNoDataValue(-9999)
    ds = None
    gdal.DEMProcessing(str(tmp_path / "slope.tif"), str(tmp_path / "dem_lcc.tif"), "slope", computeEdges=True)
    gdal.DEMProcessing(str(tmp_path / "aspect.tif"), str(tmp_path / "dem_lcc.tif"), "aspect", computeEdges=True)
    return Rasterlar(tmp_path)


def _poligon(x0, y0, x1, y1):
    return ogr.CreateGeometryFromWkt(f"POLYGON(({x0} {y0},{x1} {y0},{x1} {y1},{x0} {y1},{x0} {y0}))")


def test_kontur_hisobla_tekis_qiyalik(rasterlar):
    n = kontur_hisobla(_poligon(1300, 3300, 1900, 3700), rasterlar)
    assert n["qiyalik_ortacha"] == pytest.approx(5.71, abs=0.05)
    assert n["qiyalik_sinfi"] == "orta"
    assert n["yonalish"] == "G" and n["yonalish_gradus"] == pytest.approx(270, abs=1)
    assert 130 < n["balandlik_min"] < n["balandlik_ortacha"] < n["balandlik_max"] < 190


def test_kichik_kontur_markaziy_piksel_va_oyna_kesh(rasterlar):
    kichik = _poligon(1500.5, 3500.5, 1501.5, 3501.5)  # piksel markazini qamramaydi
    n = kontur_hisobla(kichik, rasterlar)
    assert n is not None and n["balandlik_ortacha"] == pytest.approx(0.1 * 1515, abs=3)
    oyna = (0, 0, 100, 100)
    massivlar = rasterlar.oqi(*oyna)
    assert kontur_hisobla(kichik, rasterlar, massivlar, oyna) == n


def test_raster_tashqarisi(rasterlar):
    assert kontur_hisobla(_poligon(50000, 50000, 50100, 50100), rasterlar) is None


@pytest.mark.django_db
def test_tuman_hisobla_va_qayta(tuman, rasterlar):
    """Kontur geometriyasi bazada 4326; LCC dagi (1300..1900, 3300..3700) ga to'g'ri kelgan joyni topamiz."""
    # lon_0=65, lat_0=41 -> LCC (0,0); raster x 1000..4000, y 1000..4000. Nuqta: x~2000 m, y~2000 m sharqi/shimoli.
    k = kontur_yarat(tuman, 20, kvadrat(65.0250, 41.0190, 65.0260, 41.0200), tur="sugoriladigan")
    k.tuman_geo = tuman
    k.save(update_fields=["tuman_geo"])
    kontur_yarat(tuman, 21, kvadrat(65.03, 41.02, 65.031, 41.021), tur="aniqlanmagan")
    n, bosh, _ = tuman_hisobla(tuman.kod, rasterlar)
    assert (n, bosh) == (1, 0)
    r = KonturRelyef.objects.get(kontur=k)
    assert r.qiyalik_sinfi == "orta" and r.yonalish == "G" and r.balandlik_ortacha > 0
    assert tuman_hisobla(tuman.kod, rasterlar)[0] == 0  # hisoblangan o'tkaziladi
    assert tuman_hisobla(tuman.kod, rasterlar, qayta=True)[0] == 1
    assert KonturRelyef.objects.count() == 1


@pytest.mark.django_db
def test_api_relyef(client, tuman):
    k = kontur_yarat(tuman, 30, kvadrat(69.1, 40.1, 69.2, 40.2), tur="sugoriladigan")
    assert client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()["relyef"] is None
    KonturRelyef.objects.create(kontur=k)  # qiymatsiz (DEM tashqarisi) -> null
    assert client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()["relyef"] is None
    KonturRelyef.objects.filter(kontur=k).update(
        balandlik_min=800.0, balandlik_ortacha=810.5, balandlik_max=820.0, qiyalik_ortacha=2.4,
        qiyalik_sinfi="yengil", yonalish="JG", yonalish_gradus=225.0,
    )
    d = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()["relyef"]
    assert d == {
        "balandlik": {"min": 800.0, "ortacha": 810.5, "max": 820.0},
        "qiyalik": {"ortacha": 2.4, "sinf": "yengil", "sinf_nom": "Yengil (1-3°)"},
        "yonalish": {"kod": "JG", "nom": "Janubi-g'arb", "gradus": 225.0},
    }
