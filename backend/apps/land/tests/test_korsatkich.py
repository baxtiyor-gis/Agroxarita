import pytest

from apps.land.management.commands.hisobla_korsatkich import sql_yasa, tuman_hisobla
from apps.land.models import KonturKorsatkich
from apps.relief.models import KonturRelyef
from apps.soil.models import Gumus, Kaliy, Tuproq, TuproqClass
from conftest import geometriya_maydonlari, kontur_yarat, kvadrat

pytestmark = pytest.mark.django_db

KONTUR = (69.10, 40.10, 69.11, 40.11)


def _geom(bbox):
    m = geometriya_maydonlari(kvadrat(*bbox))
    return {"geom": m["geom"], "geom_mvt": m["geom_mvt"]}


def _tuproq(gid, bbox, bonitet, sh_kod):
    sh, _ = TuproqClass.objects.get_or_create(tur="shorlanish", kod=sh_kod, defaults={"nom": f"sh{sh_kod}"})
    return Tuproq.objects.create(globalid=gid, bonitet=bonitet, shorlanish=sh, **_geom(bbox))


def _agro(model, bbox, daraja, yil):
    return model.objects.create(daraja=daraja, yil=yil, **_geom(bbox))


def test_eng_katta_kesishuv_va_shorlanish_mapping(tuman, kontur):
    # kontur x: 69.10..69.11; chap 30% (kichik) va o'ng 70% (katta) tuproq
    _tuproq("a", (69.10, 40.09, 69.103, 40.12), 50.0, 1)
    _tuproq("b", (69.103, 40.09, 69.12, 40.12), 72.0, 9)  # 9 -> 2
    tuman_hisobla(tuman.id)
    k = KonturKorsatkich.objects.get(kontur=kontur)
    assert k.bonitet == 72.0 and k.shorlanish == 2
    assert (k.gumus, k.fosfor, k.kaliy) == (None, None, None)


@pytest.mark.parametrize("kod,kutilgan", [(1, 1), (2, 2), (3, 3), (4, 4), (5, 5), (6, 2), (7, 1), (8, 2), (9, 2)])
def test_shorlanish_klass_mapping(tuman, kontur, kod, kutilgan):
    _tuproq("a", (69.0, 40.0, 69.4, 40.4), 60.0, kod)
    tuman_hisobla(tuman.id)
    assert KonturKorsatkich.objects.get(kontur=kontur).shorlanish == kutilgan


def test_qoplanish_past_bolsa_null(tuman, kontur):
    _tuproq("a", (69.10, 40.10, 69.1005, 40.11), 60.0, 1)  # 5% (< 0.1)
    _agro(Kaliy, (69.10, 40.10, 69.11, 40.11), 4, 2023)
    tuman_hisobla(tuman.id)
    k = KonturKorsatkich.objects.get(kontur=kontur)
    assert k.bonitet is None and k.shorlanish is None and k.kaliy == 4


def test_agrokimyo_eng_songgi_yil(tuman, kontur):
    _agro(Gumus, (69.0, 40.0, 69.4, 40.4), 2, 2019)  # eski yil, to'liq qoplaydi
    _agro(Gumus, (69.10, 40.10, 69.11, 40.11), 5, 2023)  # yangi yil
    tuman_hisobla(tuman.id)
    assert KonturKorsatkich.objects.get(kontur=kontur).gumus == 5


def test_qayta_va_otkazib_yuborish(tuman, kontur):
    n, _ = tuman_hisobla(tuman.id)
    assert n == 1
    assert tuman_hisobla(tuman.id)[0] == 0  # hisoblangan — o'tkazildi
    _tuproq("a", (69.0, 40.0, 69.4, 40.4), 61.0, 3)
    assert tuman_hisobla(tuman.id, qayta=True)[0] == 1
    assert KonturKorsatkich.objects.get(kontur=kontur).bonitet == 61.0


def test_boshqa_tuman_konturi_tegmaydi(tuman, shahar, kontur, kontur_shahar):
    tuman_hisobla(tuman.id)
    assert KonturKorsatkich.objects.filter(kontur=kontur_shahar).count() == 0


def test_sql_qat_iy_jadvallar():
    sql = sql_yasa(True)
    assert "soil_gumus" in sql and "soil_fosfor" in sql and "soil_kaliy" in sql and "land_konturkorsatkich" in sql


def test_kontur_tile_korsatkich_va_relyef_atributlari(client, tuman, kontur):
    _tuproq("a", (69.0, 40.0, 69.4, 40.4), 61.0, 3)
    tuman_hisobla(tuman.id)
    KonturRelyef.objects.create(kontur=kontur, balandlik_ortacha=815.5, qiyalik_ortacha=2.5)
    javob = client.get("/tiles/kontur/14/11337/6196.pbf?tuman=1201")
    assert javob.status_code == 200
    for nom in (b"bonitet", b"shorlanish", b"gumus", b"fosfor", b"kaliy", b"balandlik", b"qiyalik"):
        assert nom in javob.content
