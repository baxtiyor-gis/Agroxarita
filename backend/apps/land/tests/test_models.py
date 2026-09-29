import pytest
from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from apps.land.models import Kontur
from conftest import kontur_yarat, kvadrat


@pytest.mark.django_db
def test_kontur_yaratish(kontur):
    kontur.refresh_from_db()
    assert kontur.tuman.kod == 1201
    assert kontur.haydalma_yer_sug == 100.0 and kontur.boshqa_yer is None
    assert kontur.geom.srid == 4326 and kontur.geom_mvt.srid == 3857


@pytest.mark.django_db
def test_manba_fid_unique(kontur, tuman):
    with pytest.raises(IntegrityError), transaction.atomic():
        kontur_yarat(tuman, kontur.manba_fid, kvadrat(69.2, 40.2, 69.21, 40.21))


@pytest.mark.django_db
def test_kontur_raqami_takrorlanishi_mumkin(kontur, tuman):
    kontur_yarat(tuman, 99, kvadrat(69.2, 40.2, 69.21, 40.21), kontur_raqami=kontur.kontur_raqami)
    assert Kontur.objects.filter(tuman=tuman, kontur_raqami=7).count() == 2


@pytest.mark.django_db
def test_tuman_protect(kontur, tuman):
    with pytest.raises(ProtectedError):
        tuman.delete()


@pytest.mark.django_db
def test_indekslar():
    from django.db import connection

    with connection.cursor() as c:
        c.execute("SELECT indexdef FROM pg_indexes WHERE tablename = 'land_kontur'")
        defs = " ".join(r[0] for r in c.fetchall())
    assert defs.count("USING gist") == 2
    assert "kontur_tuman_raqam_idx" in defs and "tuman_id" in defs
