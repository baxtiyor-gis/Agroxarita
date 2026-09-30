import math

import numpy as np
import pytest
from osgeo import gdal, ogr, osr

from apps.relief.dem_tile import hillshade, klasslar, maska_qil, tile_bbox, tile_png, tuman_minmax

gdal.UseExceptions()


def _xy(z, lon, lat):
    n = 2**z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


@pytest.fixture
def dem_papka(tmp_path, settings):
    """data/dem/dem.vrt o'rnida: 68.9..69.6 x 39.9..41.1, 0.001 gradus; h = 100 + 1000*(lon-69) (sharqqa ko'tariladi)."""
    settings.DATA_DIR = tmp_path
    papka = tmp_path / "dem"
    papka.mkdir()
    w, h = 700, 1200
    ds = gdal.GetDriverByName("GTiff").Create(str(papka / "dem.tif"), w, h, 1, gdal.GDT_Float32)
    ds.SetGeoTransform((68.9, 0.001, 0, 41.1, 0, -0.001))
    srs = osr.SpatialReference()
    srs.ImportFromEPSG(4326)
    ds.SetProjection(srs.ExportToWkt())
    lon = 68.9 + 0.001 * (np.arange(w) + 0.5)
    ds.GetRasterBand(1).WriteArray(np.tile(100 + 1000 * (lon - 69), (h, 1)).astype(np.float32))
    ds = None
    gdal.Translate(str(papka / "dem.vrt"), str(papka / "dem.tif"), format="VRT")
    return papka


def _geom(z, x, y, kesim=None):
    """Tile bboxi (yoki kesim=(fx0, fy0, fx1, fy1) ulushi) ogr poligoni."""
    a = tile_bbox(z, x, y)
    if kesim:
        w, h = a[2] - a[0], a[3] - a[1]
        a = (a[0] + kesim[0] * w, a[1] + kesim[1] * h, a[0] + kesim[2] * w, a[1] + kesim[3] * h)
    return ogr.CreateGeometryFromWkt(f"POLYGON(({a[0]} {a[1]},{a[2]} {a[1]},{a[2]} {a[3]},{a[0]} {a[3]},{a[0]} {a[1]}))")


def test_tile_bbox_z0_va_klasslar():
    assert tile_bbox(0, 0, 0)[0] == pytest.approx(-20037508.34, abs=1)
    assert tile_bbox(1, 1, 1) == pytest.approx((0, -20037508.34, 20037508.34, 0), abs=1)
    k = klasslar(100, 600)
    assert len(k) == 5 and k[0]["min"] == 100 and k[-1]["max"] == 600 and k[0]["rang"] == "#4b8c5a"
    assert all(a["max"] == b["min"] for a, b in zip(k, k[1:]))


def test_hillshade_tekis_va_qiyalik():
    tekis = hillshade(np.full((5, 5), 100.0), 10)
    assert tekis == pytest.approx(math.sin(math.radians(45)))
    # sharqqa ko'tarilgan yon bag'ir g'arbga qaraydi; yorug'lik shimoli-g'arbdan -> tekisdan yorug'roq
    yonbagir = np.tile(np.arange(5) * 10.0, (5, 1))
    assert hillshade(yonbagir, 10).mean() > tekis.mean()
    assert hillshade(yonbagir[:, ::-1], 10).mean() < tekis.mean()


def test_maska_va_minmax(dem_papka):
    from osgeo import ogr as _o

    tuman = _geom(10, *_xy(10, 69.25, 40.5))
    assert maska_qil(tuman, tile_bbox(10, *_xy(10, 69.25, 40.5)), 8, 8).min() == 1
    g = _o.CreateGeometryFromWkt("POLYGON((0 0,1 0,1 1,0 0))")
    assert maska_qil(g, (1e6, 1e6, 1.1e6, 1.1e6), 4, 4).sum() == 0


def test_tile_png_shaffoflik_va_rang(dem_papka, tmp_path):
    z = 11
    x, y = _xy(z, 69.25, 40.5)
    png = tile_png(dem_papka / "dem.vrt", z, x, y, _geom(z, x, y, (0, 0, 0.5, 1)), 100, 600)  # chap yarmi
    assert png[:8] == b"\x89PNG\r\n\x1a\n"
    (tmp_path / "t.png").write_bytes(png)
    ds = gdal.Open(str(tmp_path / "t.png"))
    assert (ds.RasterXSize, ds.RasterYSize, ds.RasterCount) == (256, 256, 4)
    alfa = ds.GetRasterBand(4).ReadAsArray()
    assert alfa[:, :120].min() == 255 and alfa[:, 136:].max() == 0
    assert tile_png(dem_papka / "dem.vrt", z, x, y, ogr.CreateGeometryFromWkt("POLYGON EMPTY"), 100, 600) is None


def test_tuman_minmax_sintetik(dem_papka):
    z = 8
    a = tile_bbox(z, *_xy(z, 69.25, 40.5))
    g = ogr.CreateGeometryFromWkt(f"POLYGON(({a[0]} {a[1]},{a[2]} {a[1]},{a[2]} {a[3]},{a[0]} {a[3]},{a[0]} {a[1]}))")
    mn, mx = tuman_minmax(dem_papka / "dem.vrt", g)
    assert isinstance(mn, int) and mn < mx
    assert 100 - 400 < mn < 600 and 100 < mx < 1100


@pytest.mark.django_db
def test_dem_tile_endpoint(client, tuman, dem_papka):
    z = 11
    x, y = _xy(z, 69.25, 40.5)  # tuman (69..69.5) ichida
    url = f"/tiles/dem/{z}/{x}/{y}.png?tuman=1201"
    javob = client.get(url)
    assert javob.status_code == 200 and javob["Content-Type"] == "image/png"
    assert javob.content[:4] == b"\x89PNG" and "max-age" in javob["Cache-Control"] or javob["Cache-Control"] == "no-cache"
    assert client.get(url).content == javob.content  # keshdan
    # tuman bilan kesishmaydigan tile -> 204
    xt, yt = _xy(z, 69.8, 40.5)
    assert client.get(f"/tiles/dem/{z}/{xt}/{yt}.png?tuman=1201").status_code == 204


@pytest.mark.django_db
def test_dem_tile_xatolar(client, tuman, dem_papka):
    assert client.get("/tiles/dem/11/1/1.png").status_code == 400
    assert client.get("/tiles/dem/11/1/1.png?tuman=abc").status_code == 400
    assert client.get("/tiles/dem/11/99999/1.png?tuman=1201").status_code == 400
    assert client.get("/tiles/dem/11/1/1.png?tuman=9999").status_code == 404
    assert client.get("/tiles/dem/7/1/1.png?tuman=1201").status_code == 204
    assert client.get("/tiles/dem/17/1/1.png?tuman=1201").status_code == 204


@pytest.mark.django_db
def test_dem_yoq_503(client, tuman, settings, tmp_path):
    settings.DATA_DIR = tmp_path
    assert client.get("/tiles/dem/11/1300/700.png?tuman=1201").status_code == 503
    assert client.get("/api/tumanlar/1201/relyef/").status_code == 503


@pytest.mark.django_db
def test_tuman_relyef_legenda(client, tuman, dem_papka):
    javob = client.get("/api/tumanlar/1201/relyef/")
    assert javob.status_code == 200
    d = javob.json()
    assert d["min"] < d["max"] and len(d["klasslar"]) == 5
    assert d["klasslar"][0]["min"] == pytest.approx(d["min"], abs=0.1)
    assert d["klasslar"][-1]["max"] == pytest.approx(d["max"], abs=0.1)
    assert 95 <= d["min"] <= 150 and 550 <= d["max"] <= 605  # 69.0 -> 100 m, 69.5 -> 600 m
    assert client.get("/api/tumanlar/9999/relyef/").status_code == 404
