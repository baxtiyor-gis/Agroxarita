import pytest

from apps.tiles.views import kesh_sarlavhasi, kontur_sql
from conftest import kontur_yarat, kvadrat

MVT = "application/vnd.mapbox-vector-tile"


def _xy(z, lon, lat):
    import math

    n = 2**z
    return int((lon + 180) / 360 * n), int((1 - math.asinh(math.tan(math.radians(lat))) / math.pi) / 2 * n)


def _url(z, lon, lat, q="?tuman=1201"):
    x, y = _xy(z, lon, lat)
    return f"/tiles/kontur/{z}/{x}/{y}.pbf{q}"


@pytest.mark.parametrize("q", ["", "?tuman=", "?tuman=abc", "?tuman=1.5"])
def test_tuman_majburiy_va_butun_son_400(client, q):
    assert client.get(f"/tiles/kontur/12/0/0.pbf{q}").status_code == 400


@pytest.mark.django_db
def test_tuman_yoq_404(client, tuman):
    assert client.get("/tiles/kontur/12/0/0.pbf?tuman=9999").status_code == 404


@pytest.mark.django_db
@pytest.mark.parametrize("z", [8, 19])
def test_zoom_oraligidan_tashqari_204(client, kontur, z):
    javob = client.get(_url(z, 69.105, 40.105))
    assert javob.status_code == 204 and javob.content == b""


@pytest.mark.django_db
@pytest.mark.parametrize("z", [9, 12, 13, 18])
def test_zoom_oraligida_200(client, kontur, z):
    javob = client.get(_url(z, 69.105, 40.105))
    assert javob.status_code == 200, z
    assert javob["Content-Type"] == MVT
    assert javob["Cache-Control"] == kesh_sarlavhasi()
    for kalit in (b"kontur", b"kontur_raqami", b"maydon", b"tur", b"aniqlanmagan"):
        assert kalit in javob.content


@pytest.mark.django_db
def test_maydon_2_xona_va_ortiqcha_ustun_yoq(client, kontur):
    import struct

    javob = client.get(_url(14, 69.105, 40.105))
    assert javob.status_code == 200
    assert struct.pack("<d", 123.46) in javob.content  # ROUND(.., 2), double sifatida
    assert struct.pack("<d", 123.456) not in javob.content
    assert b"haydalma_yer_sug" not in javob.content and b"tuman" not in javob.content


@pytest.mark.django_db
def test_boshqa_tuman_konturi_chiqmaydi(client, kontur, kontur_shahar):
    # shahar konturi tilesi: 1201 filtri -> bo'sh; 1202 -> bor
    assert client.get(_url(14, 69.605, 40.105, "?tuman=1201")).status_code == 204
    assert client.get(_url(14, 69.605, 40.105, "?tuman=1202")).status_code == 200
    # birinchi tuman konturi tilesida ham boshqa tuman bilan bo'sh
    assert client.get(_url(14, 69.105, 40.105, "?tuman=1202")).status_code == 204


@pytest.mark.django_db
def test_filtr_tuman_geo_boyicha(client, tuman, shahar):
    # manba tuman = 1201, lekin geometrik tuman = 1202 (shahar hududida yotadi)
    kontur_yarat(tuman, 9, kvadrat(69.7, 40.5, 69.71, 40.51), kontur_raqami=3, tuman_geo=shahar)
    assert client.get(_url(14, 69.705, 40.505, "?tuman=1201")).status_code == 204
    assert client.get(_url(14, 69.705, 40.505, "?tuman=1202")).status_code == 200


@pytest.mark.django_db
def test_past_zoomda_pikseldan_kichik_kontur_tashlanadi(client, tuman):
    # ~22 m x 29 m kontur: z=10 ekran pikseli ~38 m (piksel/4) — tashlanadi, z=13 da (soddalashtirishsiz) saqlanadi
    kontur_yarat(tuman, 5, kvadrat(69.3, 40.3, 69.3002, 40.3002), kontur_raqami=1, umumiy_maydoni=0.05)
    assert client.get(_url(10, 69.3, 40.3)).status_code == 204
    assert client.get(_url(13, 69.3, 40.3)).status_code == 200
    # katta kontur z=10 da saqlanadi
    kontur_yarat(tuman, 6, kvadrat(69.31, 40.31, 69.33, 40.33), kontur_raqami=2, umumiy_maydoni=400.0)
    assert client.get(_url(10, 69.32, 40.32)).status_code == 200


def test_kontur_sql_z_bo_yicha():
    sql12, tol12 = kontur_sql(12)
    assert "ST_Simplify(" in sql12 and "maydon_mvt >=" in sql12 and len(tol12) == 1
    assert tol12[0] == pytest.approx(40075016.68 / (256 * 2**12) / 4, rel=1e-3)
    assert sql12.count("%s") == 3 + 1 + 1 + 1  # z,x,y + qatlam + tolerantlik + tuman_id
    sql13, tol13 = kontur_sql(13)
    assert "Simplify" not in sql13 and "maydon_mvt" not in sql13 and tol13 == []
    assert sql13.count("%s") == 3 + 1 + 1
    assert "COALESCE(t.tuman_geo_id, t.tuman_id) = %s" in sql13 and "t.tur" in sql13 and "geom_mvt && tile.env" in sql13
