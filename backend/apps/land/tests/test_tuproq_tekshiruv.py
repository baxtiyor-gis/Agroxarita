"""kontur_tuproq: aniqlanmagan konturlar tuproq bilan >= chegara qoplansa -> sugoriladigan."""
import pytest

from apps.land.bog_lash import kontur_tuproq_hisobla
from apps.land.models import Kontur
from apps.soil.models import Tuproq
from conftest import kontur_yarat, kvadrat


def _tuproq(globalid, geom):
    return Tuproq.objects.create(globalid=globalid, geom=geom, geom_mvt=geom.transform(3857, clone=True))


@pytest.mark.django_db
def test_qoplanish_boyicha_sugoriladigan(tuman):
    # tuproq poligoni: x 69.100..69.106
    _tuproq("t1", kvadrat(69.100, 40.100, 69.106, 40.110))
    toliq = kontur_yarat(tuman, 1, kvadrat(69.101, 40.101, 69.103, 40.103), tur=Kontur.ANIQLANMAGAN)  # 100%
    yarim_kam = kontur_yarat(tuman, 2, kvadrat(69.105, 40.101, 69.109, 40.103), tur=Kontur.ANIQLANMAGAN)  # 25%
    tashqarida = kontur_yarat(tuman, 3, kvadrat(69.120, 40.101, 69.122, 40.103), tur=Kontur.ANIQLANMAGAN)
    sug = kontur_yarat(tuman, 4, kvadrat(69.101, 40.105, 69.103, 40.107), tur=Kontur.SUGORILADIGAN)

    natija = kontur_tuproq_hisobla(tuman.kod, 0.5)

    assert natija["yangilandi"] == 1
    turlar = dict(Kontur.objects.filter(pk__in=[toliq.pk, yarim_kam.pk, tashqarida.pk, sug.pk]).values_list("pk", "tur"))
    assert turlar[toliq.pk] == Kontur.SUGORILADIGAN
    assert turlar[yarim_kam.pk] == Kontur.ANIQLANMAGAN
    assert turlar[tashqarida.pk] == Kontur.ANIQLANMAGAN
    assert turlar[sug.pk] == Kontur.SUGORILADIGAN  # sug'oriladigan tegilmaydi

    # past chegara bilan 25% ham o'tadi; qayta ishga tushirish idempotent
    assert kontur_tuproq_hisobla(tuman.kod, 0.2)["yangilandi"] == 1
    assert kontur_tuproq_hisobla(tuman.kod, 0.2)["yangilandi"] == 0
