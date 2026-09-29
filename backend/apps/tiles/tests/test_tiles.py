import pytest
from django.urls import resolve

from apps.tiles.views import kesh_sarlavhasi

MVT = "application/vnd.mapbox-vector-tile"


# --- bazasiz testlar (validatsiya DB so'rovidan oldin) ---

def test_url_resolve():
    assert resolve("/tiles/viloyat/5/10/12.pbf").func.__name__ == "tile"


@pytest.mark.parametrize("yol", [
    "/tiles/viloyat/23/0/0.pbf",      # z > 22
    "/tiles/viloyat/-1/0/0.pbf",      # z < 0
    "/tiles/viloyat/3/8/0.pbf",       # x >= 2^z
    "/tiles/viloyat/3/0/8.pbf",       # y >= 2^z
    "/tiles/viloyat/3/-1/0.pbf",      # x < 0
    "/tiles/viloyat/0/1/0.pbf",       # z=0 da faqat 0/0
])
def test_notogri_zxy_400(client, yol):
    javob = client.get(yol)
    assert javob.status_code == 400
    assert "detail" in javob.json()


def test_nomalum_qatlam_404(client):
    javob = client.get("/tiles/yer/5/0/0.pbf")
    assert javob.status_code == 404
    assert "yer" in javob.json()["detail"]


def test_notogri_qatlam_zxy_dan_oldin_404(client):
    assert client.get("/tiles/yer/99/0/0.pbf").status_code == 404


@pytest.mark.parametrize("yol", [
    "/tiles/tuman/4/0/0.pbf",      # tuman 5-14
    "/tiles/tuman/15/0/0.pbf",
    "/tiles/viloyat/15/0/0.pbf",   # viloyat 0-14
    "/tiles/massiv/8/0/0.pbf",     # massiv 9-16
    "/tiles/massiv/17/0/0.pbf",
])
def test_zoom_oraligidan_tashqari_204(client, yol):
    javob = client.get(yol)
    assert javob.status_code == 204
    assert javob.content == b""


@pytest.mark.parametrize("yol", [
    "/tiles/tuman/6/0/0.pbf?viloyat=abc",
    "/tiles/massiv/10/0/0.pbf?tuman=1.5",
])
def test_filtr_butun_son_emas_400(client, yol):
    javob = client.get(yol)
    assert javob.status_code == 400
    assert "butun son" in javob.json()["detail"]


def test_tile_sql_parametrli():
    from apps.tiles.views import tile_sql

    sql, tol, filtr = tile_sql("tuman", 6, {"viloyat": 12})
    assert "geom_mvt_s" in sql and "v.region_id = %s" in sql
    assert len(tol) == 1 and filtr == [12]
    assert sql.count("%s") == 3 + 1 + len(tol) + len(filtr)  # z,x,y + qatlam + tol + filtr
    sql9, tol9, _ = tile_sql("massiv", 13, {})
    assert "geom_mvt_s" not in sql9 and tol9 == []


# --- bazaga bog'liq testlar ---

def _tile_koordinata(z, lon, lat):
    import math

    n = 2**z
    x = int((lon + 180) / 360 * n)
    y = int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)
    return x, y


@pytest.mark.django_db
def test_viloyat_tile(client, viloyat):
    for z in (2, 8, 9, 12):  # z<9 -> geom_mvt_s, z>=9 -> geom_mvt
        x, y = _tile_koordinata(z, 69.5, 40.5)
        javob = client.get(f"/tiles/viloyat/{z}/{x}/{y}.pbf")
        assert javob.status_code == 200, z
        assert javob["Content-Type"] == MVT
        assert javob["Cache-Control"] == kesh_sarlavhasi()
        assert b"viloyat" in javob.content and b"region_id" in javob.content and b"nom" in javob.content


@pytest.mark.django_db
def test_tuman_tile_atributlar_va_filtr(client, tuman, shahar):
    x, y = _tile_koordinata(8, 69.25, 40.5)
    javob = client.get(f"/tiles/tuman/8/{x}/{y}.pbf")
    assert javob.status_code == 200
    for kalit in (b"tuman", b"kod", b"nom", b"tip", b"region_id"):
        assert kalit in javob.content
    assert client.get(f"/tiles/tuman/8/{x}/{y}.pbf?viloyat=12").status_code == 200
    # boshqa viloyat -> bo'sh -> 204
    assert client.get(f"/tiles/tuman/8/{x}/{y}.pbf?viloyat=99").status_code == 204


@pytest.mark.django_db
def test_massiv_tile(client, massiv):
    x, y = _tile_koordinata(12, 69.15, 40.15)
    javob = client.get(f"/tiles/massiv/12/{x}/{y}.pbf")
    assert javob.status_code == 200
    for kalit in (b"massiv", b"massiv_id", b"kod"):
        assert kalit in javob.content
    assert client.get(f"/tiles/massiv/12/{x}/{y}.pbf?tuman=1201").status_code == 200
    assert client.get(f"/tiles/massiv/12/{x}/{y}.pbf?tuman=9999").status_code == 204


@pytest.mark.django_db
def test_massiv_tile_tuman_filtri_z6_dan(client, massiv):
    for z in (6, 7, 8):
        x, y = _tile_koordinata(z, 69.15, 40.15)
        javob = client.get(f"/tiles/massiv/{z}/{x}/{y}.pbf?tuman=1201")
        assert javob.status_code == 200, z
        assert b"massiv_id" in javob.content
        # filtrsiz z=8 — oraliqdan tashqarida
    x, y = _tile_koordinata(8, 69.15, 40.15)
    assert client.get(f"/tiles/massiv/8/{x}/{y}.pbf").status_code == 204
    x5, y5 = _tile_koordinata(5, 69.15, 40.15)
    assert client.get(f"/tiles/massiv/5/{x5}/{y5}.pbf?tuman=1201").status_code == 204


@pytest.mark.parametrize("yol", [
    "/tiles/maska/8/0/0.pbf",              # ?tuman yo'q
    "/tiles/maska/8/0/0.pbf?tuman=",
    "/tiles/maska/8/0/0.pbf?tuman=abc",
])
def test_maska_tuman_majburiy_400(client, yol):
    assert client.get(yol).status_code == 400


@pytest.mark.django_db
def test_maska_tuman_yoq_404(client, tuman):
    assert client.get("/tiles/maska/8/0/0.pbf?tuman=9999").status_code == 404


@pytest.mark.django_db
def test_maska_tile(client, tuman):
    # tuman: lon 69..69.5, lat 40..41
    for z in (6, 8, 12):  # z<9 -> geom_mvt_s
        # tuman tashqarisi -> butun to'rtburchak
        x, y = _tile_koordinata(z, 69.9, 40.5) if z == 12 else _tile_koordinata(z, 75, 30)
        tashqari = client.get(f"/tiles/maska/{z}/{x}/{y}.pbf?tuman=1201")
        assert tashqari.status_code == 200, z
        assert tashqari["Content-Type"] == MVT
        assert tashqari["Cache-Control"] == kesh_sarlavhasi()
        assert b"maska" in tashqari.content
    # chegara kesib o'tgan tile
    x, y = _tile_koordinata(12, 69.5, 40.5)
    kesib = client.get(f"/tiles/maska/12/{x}/{y}.pbf?tuman=1201")
    assert kesib.status_code == 200 and b"maska" in kesib.content
    # tile to'liq tuman ichida -> 204
    x, y = _tile_koordinata(12, 69.25, 40.5)
    assert client.get(f"/tiles/maska/12/{x}/{y}.pbf?tuman=1201").status_code == 204
    # zoom oralig'idan tashqarida
    assert client.get("/tiles/maska/17/0/0.pbf?tuman=1201").status_code == 204


@pytest.mark.django_db
def test_maska_geometriyasi_buffer_zonasiga_chiqadi(tuman):
    from django.db import connection

    from apps.tiles.views import _maska_geom_sql

    x, y = _tile_koordinata(12, 69.9, 40.5)  # tuman tashqarisida
    with connection.cursor() as cursor:
        cursor.execute(
            f"SELECT ST_XMin(env), ST_XMax(env), ST_XMin(geom), ST_XMax(geom), ST_YMin(env), ST_YMax(env),"
            f" ST_YMin(geom), ST_YMax(geom) FROM ({_maska_geom_sql(12)}) m",
            [12, x, y, 12, x, y, 1201],
        )
        exmin, exmax, gxmin, gxmax, eymin, eymax, gymin, gymax = cursor.fetchone()
    kenglik = exmax - exmin
    assert gxmin == pytest.approx(exmin - kenglik * 64 / 4096)
    assert gxmax == pytest.approx(exmax + kenglik * 64 / 4096)
    assert gymin < eymin and gymax > eymax


@pytest.mark.django_db
def test_obyektsiz_joyda_204(client, viloyat):
    # Yer sharining narigi tomoni (Tinch okeani)
    x, y = _tile_koordinata(8, -150, 0)
    assert client.get(f"/tiles/viloyat/8/{x}/{y}.pbf").status_code == 204
