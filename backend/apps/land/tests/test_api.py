import pytest
from django.db import connection
from django.test.utils import CaptureQueriesContext

from apps.soil.models import Agrokimyo, Tuproq, TuproqLugat
from conftest import kontur_yarat, kvadrat


def _tuproq(globalid, geom, **kw):
    return Tuproq.objects.create(globalid=globalid, geom=geom, geom_mvt=geom.transform(3857, clone=True), **kw)


@pytest.mark.django_db
def test_kontur_tuzilma_va_yer_turlari(client, tuman):
    k = kontur_yarat(
        tuman, 10, kvadrat(69.1, 40.1, 69.2, 40.2), kontur_raqami=5, yagona_kontur="12:01:00005",
        umumiy_maydoni=18.614, massiv="M1", mfy="MFY1", tur="sugoriladigan",
        haydalma_lalmi=3.0, haydalma_yer_sug=10.5, jami_qx_yeri=13.5, boglar_sug=0.0, issiqxona=None,
    )
    with CaptureQueriesContext(connection) as sorovlar:
        r = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost")
    assert r.status_code == 200
    assert len(sorovlar) <= 5
    d = r.json()
    assert d["id"] == k.pk and d["kontur_raqami"] == 5 and d["yagona_kontur"] == "12:01:00005"
    assert d["maydon"] == 18.61 and d["tur"] == "sugoriladigan"
    assert d["tuman"] == {"kod": 1201, "nom": "Birinchi tuman"}
    assert d["viloyat"] == {"region_id": 12, "nom": "Sinov viloyati"}
    assert d["massiv"] == "M1" and d["mfy"] == "MFY1"
    assert d["bbox"] == pytest.approx([69.1, 40.1, 69.2, 40.2])
    assert [t["kod"] for t in d["yer_turlari"]] == ["jami_qx_yeri", "haydalma_yer_sug", "haydalma_lalmi"]
    assert d["yer_turlari"][0] == {"kod": "jami_qx_yeri", "nom": "Jami QX yeri", "maydon": 13.5, "jami": True}
    assert d["yer_turlari"][2]["nom"] == "Haydalma (lalmi)" and d["yer_turlari"][2]["jami"] is False
    assert d["tuproq"] is None


@pytest.mark.django_db
def test_kontur_tuproq_eng_katta_kesishuv(client, tuman):
    mex = TuproqLugat.objects.create(tur="mexanika", kod=1, nom="O'rta qumoqli")
    kl = TuproqLugat.objects.create(tur="klass", kod=5, nom="V")
    kichik = TuproqLugat.objects.create(tur="mexanika", kod=2, nom="Qumli")
    # kontur x 69.10..69.20; tuproq A: 69.10..69.16 (60%), B: 69.16..69.18 (20%)
    _tuproq("a", kvadrat(69.10, 40.1, 69.16, 40.2), mexanika=mex, klass=kl, bonitet=52, yer_osti_suvi="1-2")
    _tuproq("b", kvadrat(69.16, 40.1, 69.18, 40.2), mexanika=kichik, bonitet=10)
    k = kontur_yarat(tuman, 11, kvadrat(69.10, 40.1, 69.20, 40.2), umumiy_maydoni=1.0)
    with CaptureQueriesContext(connection) as sorovlar:
        d = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()
    assert len(sorovlar) <= 5
    t = d["tuproq"]
    assert t["bonitet"] == 52 and t["mexanika"] == "O'rta qumoqli" and t["klass"] == "V"
    assert t["yer_osti_suvi"] == "1-2" and t["shorlanish"] is None
    assert t["qoplanish"] == 0.8
    assert d["yer_turlari"] == []


@pytest.mark.django_db
def test_kontur_tuman_geo_va_404(client, tuman, shahar):
    k = kontur_yarat(tuman, 12, kvadrat(69.6, 40.1, 69.61, 40.11), tuman_geo=shahar)
    d = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()
    assert d["tuman"]["kod"] == 1202
    r = client.get("/api/konturlar/99999999/", HTTP_HOST="localhost")
    assert r.status_code == 404 and "detail" in r.json()


def _agro(geom, yil, daraja, korsatkich="kaliy", tuman=None):
    nomlar = {1: "Juda kam", 2: "Kam", 3: "O'rtacha", 6: "Yuqori"}
    return Agrokimyo.objects.create(
        korsatkich=korsatkich, yil=yil, daraja=daraja, daraja_nom=nomlar[daraja], gradatsiya="101-200",
        geom=geom, geom_mvt=geom.transform(3857, clone=True), tuman=tuman,
    )


@pytest.mark.django_db
def test_kontur_agrokimyo_kaliy_oxirgi_yil(client, tuman):
    # kontur x 69.10..69.20. 2022 da katta (100%), 2024 da: A 69.10..69.15 (50%), B 69.15..69.17 (20%)
    _agro(kvadrat(69.10, 40.1, 69.20, 40.2), 2022, 1)
    _agro(kvadrat(69.10, 40.1, 69.15, 40.2), 2024, 2)
    _agro(kvadrat(69.15, 40.1, 69.17, 40.2), 2024, 3)
    _agro(kvadrat(69.10, 40.1, 69.20, 40.2), 2025, 3, korsatkich="fosfor")  # fosfor: alohida ko'rsatkich
    k = kontur_yarat(tuman, 13, kvadrat(69.10, 40.1, 69.20, 40.2), umumiy_maydoni=1.0)
    with CaptureQueriesContext(connection) as sorovlar:
        d = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()
    assert len(sorovlar) <= 6
    assert d["agrokimyo"] == {
        "kaliy": {"daraja": 2, "daraja_nom": "Kam", "gradatsiya": "101-200", "yil": 2024, "qoplanish": 0.7},
        "fosfor": {"daraja": 3, "daraja_nom": "O'rtacha", "gradatsiya": "101-200", "yil": 2025, "qoplanish": 1.0},
        "gumus": None,
    }


@pytest.mark.django_db
def test_kontur_agrokimyo_gumus(client, tuman):
    _agro(kvadrat(69.10, 40.1, 69.20, 40.2), 2024, 6, korsatkich="gumus")
    k = kontur_yarat(tuman, 16, kvadrat(69.10, 40.1, 69.20, 40.2), umumiy_maydoni=1.0)
    d = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()
    assert d["agrokimyo"]["gumus"] == {
        "daraja": 6, "daraja_nom": "Yuqori", "gradatsiya": "101-200", "yil": 2024, "qoplanish": 1.0}


@pytest.mark.django_db
def test_kontur_agrokimyo_fosfor_yilsiz(client, tuman):
    # yil NULL: eng katta kesishuvli poligon, qoplanish — barcha yilsiz poligonlar bo'yicha
    _agro(kvadrat(69.10, 40.1, 69.16, 40.2), None, 1, korsatkich="fosfor")
    _agro(kvadrat(69.16, 40.1, 69.18, 40.2), None, 3, korsatkich="fosfor")
    k = kontur_yarat(tuman, 15, kvadrat(69.10, 40.1, 69.20, 40.2), umumiy_maydoni=1.0)
    d = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()
    assert d["agrokimyo"]["kaliy"] is None
    assert d["agrokimyo"]["fosfor"] == {
        "daraja": 1, "daraja_nom": "Juda kam", "gradatsiya": "101-200", "yil": None, "qoplanish": 0.8}


@pytest.mark.django_db
def test_kontur_agrokimyo_yoq_va_kirill_lotin(client, tuman):
    k = kontur_yarat(tuman, 14, kvadrat(69.1, 40.1, 69.2, 40.2), massiv="М.Улуғбек", mfy="Булунгурарик МФ")
    d = client.get(f"/api/konturlar/{k.pk}/", HTTP_HOST="localhost").json()
    assert d["agrokimyo"] == {"kaliy": None, "fosfor": None, "gumus": None}
    assert d["massiv"] == "M.Ulug‘bek" and d["mfy"] == "Bulungurarik MF"
