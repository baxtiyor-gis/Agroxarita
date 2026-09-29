import pytest
from django.db import IntegrityError, transaction

from apps.border.models import Tuman, Viloyat
from conftest import geometriya_maydonlari, kvadrat


def test_fixture_geometriyalari(tuman):
    assert tuman.geom.srid == 4326
    assert tuman.geom_mvt.srid == 3857
    assert tuman.geom_mvt_s.srid == 3857
    assert tuman.bbox == [69.0, 40.0, 69.5, 41.0]


def test_fk_boglanishi(viloyat, tuman, massiv):
    assert tuman.viloyat == viloyat
    assert massiv.tuman == tuman
    assert list(viloyat.tumanlar.all()) == [tuman]
    assert list(tuman.massivlar.all()) == [massiv]


def test_tuman_kod_unique(viloyat, tuman):
    with pytest.raises(IntegrityError), transaction.atomic():
        Tuman.objects.create(
            viloyat=viloyat, kod=tuman.kod, soato="boshqa", nom="Dublikat",
            **geometriya_maydonlari(kvadrat(69, 40, 69.1, 40.1)),
        )


def test_viloyat_region_id_unique(viloyat):
    with pytest.raises(IntegrityError), transaction.atomic():
        Viloyat.objects.create(
            region_id=viloyat.region_id, soato="x", nom="Dublikat",
            **geometriya_maydonlari(kvadrat(0, 0, 1, 1)),
        )


def test_tip_choices():
    assert {v for v, _ in Tuman.Tip.choices} == {"tuman", "shahar"}


def test_geometriya_gist_indeksi(db):
    from django.db import connection

    with connection.cursor() as c:
        c.execute(
            "SELECT indexdef FROM pg_indexes WHERE tablename IN "
            "('border_viloyat','border_tuman','border_massiv') AND indexdef ILIKE '%gist%'"
        )
        qatorlar = [r[0] for r in c.fetchall()]
    for ustun in ("geom", "geom_mvt", "geom_mvt_s"):
        assert sum(f"({ustun})" in q for q in qatorlar) == 3
