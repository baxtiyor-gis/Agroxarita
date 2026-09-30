import pytest
from django.db import IntegrityError, transaction

from apps.soil.models import Tuproq, TuproqClass
from conftest import geometriya_maydonlari, kvadrat


def tuproq_yarat(globalid, **kw):
    g = geometriya_maydonlari(kvadrat(69.1, 40.1, 69.11, 40.11))
    return Tuproq.objects.create(globalid=globalid, geom=g["geom"], geom_mvt=g["geom_mvt"], **kw)


@pytest.mark.django_db
def test_tuproq_yaratish_va_lugat(tuman):
    lugat = TuproqClass.objects.create(tur="mexanika", kod=1, nom="O‘rta qumoqli")
    t = tuproq_yarat("{A}", tuman=tuman, mexanika=lugat, bonitet=55.5, yer_osti_suvi="1–2")
    t.refresh_from_db()
    assert t.mexanika.nom == "O‘rta qumoqli"
    assert t.tuman == tuman
    assert t.manba == {}
    assert tuman.tuproqlar.count() == 1


@pytest.mark.django_db
def test_globalid_unique():
    tuproq_yarat("{A}")
    with pytest.raises(IntegrityError), transaction.atomic():
        tuproq_yarat("{A}")


@pytest.mark.django_db
def test_lugat_tur_kod_unique():
    TuproqClass.objects.create(tur="mexanika", kod=1, nom="a")
    TuproqClass.objects.create(tur="shorlanish", kod=1, nom="b")  # boshqa tur — mumkin
    with pytest.raises(IntegrityError), transaction.atomic():
        TuproqClass.objects.create(tur="mexanika", kod=1, nom="c")


@pytest.mark.django_db
def test_tuman_ochirilsa_null(tuman):
    t = tuproq_yarat("{A}", tuman=tuman)
    tuman.delete()
    t.refresh_from_db()
    assert t.tuman is None
