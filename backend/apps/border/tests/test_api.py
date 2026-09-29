import pytest
from django.urls import resolve


def test_url_resolve():
    assert resolve("/api/viloyatlar/").route == "api/viloyatlar/"
    assert resolve("/api/viloyatlar/12/").kwargs == {"region_id": 12}
    assert resolve("/api/tumanlar/").route == "api/tumanlar/"
    assert resolve("/api/tumanlar/1201/").kwargs == {"kod": 1201}


def test_tuman_viloyat_param_son_emas_400(client):
    javob = client.get("/api/tumanlar/?viloyat=abc")
    assert javob.status_code == 400
    assert "butun son" in str(javob.json())


@pytest.mark.django_db
def test_viloyat_royxat(client, viloyat):
    from apps.border.models import Viloyat
    from conftest import geometriya_maydonlari, kvadrat

    Viloyat.objects.create(region_id=3, soato="1703", nom="Andijon", **geometriya_maydonlari(kvadrat(60, 40, 61, 41)))
    javob = client.get("/api/viloyatlar/")
    assert javob.status_code == 200
    data = javob.json()
    assert [v["nom"] for v in data] == ["Andijon", "Sinov viloyati"]  # nom bo'yicha
    assert set(data[1]) == {"region_id", "nom", "bbox"}
    assert data[1]["region_id"] == 12
    assert data[1]["bbox"] == [69.0, 40.0, 70.0, 41.0]


@pytest.mark.django_db
def test_viloyat_batafsil(client, viloyat):
    javob = client.get("/api/viloyatlar/12/")
    assert javob.status_code == 200
    assert javob.json() == {"region_id": 12, "nom": "Sinov viloyati", "soato": "1712", "bbox": [69.0, 40.0, 70.0, 41.0]}
    assert "geom" not in javob.json()


@pytest.mark.django_db
def test_viloyat_topilmadi_404(client, viloyat):
    javob = client.get("/api/viloyatlar/99/")
    assert javob.status_code == 404
    assert "detail" in javob.json()


@pytest.mark.django_db
def test_tuman_royxat_hammasi_va_tartib(client, tuman, shahar):
    javob = client.get("/api/tumanlar/")
    assert javob.status_code == 200
    data = javob.json()
    assert [t["kod"] for t in data] == [1201, 1202]  # "Birinchi tuman" < "Sinov shahri"
    assert set(data[0]) == {"kod", "nom", "tip", "region_id", "bbox"}
    assert data[0]["region_id"] == 12
    assert data[0]["tip"] == "tuman" and data[1]["tip"] == "shahar"
    assert data[0]["bbox"] == [69.0, 40.0, 69.5, 41.0]


@pytest.mark.django_db
def test_tuman_royxat_filtr(client, tuman, shahar):
    from apps.border.models import Tuman, Viloyat
    from conftest import geometriya_maydonlari, kvadrat

    boshqa = Viloyat.objects.create(region_id=3, soato="1703", nom="Andijon", **geometriya_maydonlari(kvadrat(60, 40, 61, 41)))
    Tuman.objects.create(viloyat=boshqa, kod=301, soato="1703301", nom="Boshqa", **geometriya_maydonlari(kvadrat(60, 40, 61, 41)))

    assert [t["kod"] for t in client.get("/api/tumanlar/?viloyat=12").json()] == [1201, 1202]
    assert [t["kod"] for t in client.get("/api/tumanlar/?viloyat=3").json()] == [301]
    assert client.get("/api/tumanlar/").json().__len__() == 3


@pytest.mark.django_db
def test_tuman_royxat_mavjud_bolmagan_viloyat_404(client, tuman):
    assert client.get("/api/tumanlar/?viloyat=99").status_code == 404


@pytest.mark.django_db
def test_tuman_batafsil(client, tuman):
    javob = client.get("/api/tumanlar/1201/")
    assert javob.status_code == 200
    assert javob.json() == {
        "kod": 1201, "nom": "Birinchi tuman", "tip": "tuman", "soato": "1712201",
        "region_id": 12, "bbox": [69.0, 40.0, 69.5, 41.0],
    }


@pytest.mark.django_db
def test_tuman_topilmadi_404(client, tuman):
    assert client.get("/api/tumanlar/9999/").status_code == 404


@pytest.mark.django_db
def test_royxat_n_plus_1_yoq(client, tuman, shahar, django_assert_num_queries):
    with django_assert_num_queries(1):
        client.get("/api/tumanlar/")
