"""GET /api/konturlar/{id}/iqlim/ — sintetik ma'lumot bilan."""
import datetime as dt

import pytest
from django.contrib.gis.geos import Polygon

from apps.climate.models import IqlimKatak, IqlimKunlik, IqlimOylik, IqlimYillik
from conftest import kontur_yarat, kvadrat

pytestmark = pytest.mark.django_db


@pytest.fixture
def katak():
    g = Polygon.from_bbox((69.1, 40.1, 69.2, 40.2))
    g.srid = 4326
    return IqlimKatak.objects.create(
        kod="691_401", ix=691, iy=401, markaz_lon=69.15, markaz_lat=40.15, geom=g, geom_mvt=g.transform(3857, clone=True)
    )


def yil_yoz(katak, yil, t_ort, yogin_kun, kun_soni=None, oxirgi_bahor=dt.date(2000, 3, 20)):
    kunlar = kun_soni or (366 if yil % 4 == 0 else 365)
    bosh = dt.date(yil, 1, 1)
    IqlimKunlik.objects.bulk_create(
        IqlimKunlik(katak=katak, sana=bosh + dt.timedelta(days=i), t_min=-5.0 if i == 0 else 5.0,
                    t_max=36.0 if i < 10 else 20.0, t_ort=t_ort, yogin=yogin_kun, et0=2.0)
        for i in range(kunlar)
    )
    for oy in (1, 2):
        IqlimOylik.objects.create(katak=katak, yil=yil, oy=oy, t_ort=t_ort, yogin=yogin_kun * 30, et0=60.0, kunlar=30)
    if kun_soni is None:
        IqlimYillik.objects.create(
            katak=katak, yil=yil, fah=3000.0 + yil, sovuqsiz_kunlar=200,
            oxirgi_bahorgi_sovuq=oxirgi_bahor.replace(year=yil), birinchi_kuzgi_sovuq=dt.date(yil, 11, 1),
        )


def test_iqlim_javobi(client, tuman, katak):
    k = kontur_yarat(tuman, 1, kvadrat(69.11, 40.11, 69.12, 40.12), tur="sugoriladigan")
    yil_yoz(katak, 2023, 10.0, 1.0)  # oxirgi sovuq 20-mart
    yil_yoz(katak, 2024, 20.0, 2.0, oxirgi_bahor=dt.date(2000, 4, 20))  # kech sovuq
    yil_yoz(katak, 2026, 15.0, 1.0, kun_soni=100)  # qisman
    r = client.get(f"/api/konturlar/{k.pk}/iqlim/")
    assert r.status_code == 200
    d = r.json()
    assert d["katak"] == {"id": katak.pk, "lat": 40.15, "lon": 69.15, "balandlik": None}
    assert d["davr"] == [2023, 2026] and d["yillar"] == [2023, 2024, 2026]
    assert [y["toliq"] for y in d["yillik"]] == [True, True, False]
    kor = d["korsatkich"]
    assert kor["fah"] == pytest.approx(5023.5) and kor["sovuqsiz"] == 200
    assert kor["kech_sovuq_yillar"] == 1
    assert kor["issiq_kun"] == 10 and kor["min_t"] == -5.0
    assert kor["bahorgi_sovuq"] == pytest.approx((79 + 111) / 2, abs=1)  # 20-mart (79/80), 20-aprel (111)
    assert d["yillik"][0]["yogin"] == 365.0 and d["yillik"][2]["fah"] is None
    assert len(d["oylik_ortacha"]) == 12
    assert d["oylik_ortacha"][0] == {"oy": 1, "t_ort": 15.0, "yogin": 45.0, "et0": 60.0}  # 2026 kirmaydi
    assert d["oylik_ortacha"][5]["t_ort"] is None
    assert [x["yil"] for x in d["yillar_oylar"]] == [2023, 2024, 2026]
    assert len(d["yillar_oylar"][2]["oylar"]) == 2
    assert d["suv_balansi"]["tanqislik"] == pytest.approx(d["suv_balansi"]["et0"] - d["suv_balansi"]["yogin"], abs=0.11)
    assert d["xavf"]["eng_issiq"]["yil"] == 2024 and d["xavf"]["eng_quruq"]["yil"] == 2023


def test_iqlim_kesh_bir_katak(client, tuman, katak):
    k1 = kontur_yarat(tuman, 1, kvadrat(69.11, 40.11, 69.12, 40.12))
    k2 = kontur_yarat(tuman, 2, kvadrat(69.15, 40.15, 69.16, 40.16))
    yil_yoz(katak, 2024, 12.0, 1.0)
    a = client.get(f"/api/konturlar/{k1.pk}/iqlim/").json()
    IqlimKunlik.objects.all().delete()  # kesh: ikkinchi kontur bazaga tegmasdan bir xil javob oladi
    assert client.get(f"/api/konturlar/{k2.pk}/iqlim/").json() == a


def test_iqlim_404(client, tuman):
    assert client.get("/api/konturlar/999999/iqlim/").status_code == 404
    k = kontur_yarat(tuman, 1, kvadrat(69.11, 40.11, 69.12, 40.12))
    r = client.get(f"/api/konturlar/{k.pk}/iqlim/")  # katak yo'q
    assert r.status_code == 404
