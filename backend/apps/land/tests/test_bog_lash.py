"""kontur_tuman va kontur_tur buyruqlari (tuman kod=1201: lon 69..69.5, shahar 1202: 69.5..70)."""
from io import StringIO

import pytest
from django.core.management import call_command
from django.core.management.base import CommandError

from apps.land.models import Kontur
from conftest import kontur_yarat, kvadrat

pytestmark = pytest.mark.django_db


def _yarat(tuman, fid, geom, **kw):
    kw.setdefault("tuman_geo", None)
    return kontur_yarat(tuman, fid, geom, **kw)


def _ishga(nom, *args):
    chiqish = StringIO()
    call_command(nom, *args, stdout=chiqish)
    return chiqish.getvalue()


def test_ichida_yotgan_kontur(tuman, shahar):
    k = _yarat(shahar, 1, kvadrat(69.1, 40.1, 69.11, 40.11))  # manba: shahar, aslida tuman ichida
    chiqish = _ishga("kontur_tuman")
    k.refresh_from_db()
    assert k.tuman_geo == tuman
    assert "tuman != tuman_geo 1" in chiqish and "1202: 1" in chiqish


def test_eng_katta_kesishuv_tanlanadi(tuman, shahar):
    # chegara lon=69.5: 69.48..69.53 -> 0.02 tuman, 0.03 shahar
    a = _yarat(tuman, 1, kvadrat(69.48, 40.1, 69.53, 40.11))
    # 69.47..69.51 -> 0.03 tuman, 0.01 shahar
    b = _yarat(shahar, 2, kvadrat(69.47, 40.1, 69.51, 40.11))
    chiqish = _ishga("kontur_tuman")
    a.refresh_from_db(), b.refresh_from_db()
    assert a.tuman_geo == shahar and b.tuman_geo == tuman
    assert "chegarani kesuvchi 2" in chiqish
    assert Kontur.objects.count() == 2  # kesilmaydi
    assert a.geom.equals(kvadrat(69.48, 40.1, 69.53, 40.11))


def test_hech_biriga_tushmaydi(tuman, shahar):
    k = _yarat(tuman, 1, kvadrat(75, 45, 75.1, 45.1), tuman_geo=tuman)  # eski qiymat tozalanishi kerak
    chiqish = _ishga("kontur_tuman")
    k.refresh_from_db()
    assert k.tuman_geo is None
    assert "hech tumanga tushmagan 1" in chiqish


def test_tuman_filtri_qamrovi(tuman, shahar):
    ichki = _yarat(tuman, 1, kvadrat(69.1, 40.1, 69.11, 40.11))  # 1201 ichida
    boshqa = _yarat(shahar, 2, kvadrat(69.6, 40.1, 69.61, 40.11))  # 1202 ichida, qamralmaydi
    tashqi = _yarat(tuman, 3, kvadrat(69.6, 40.5, 69.61, 40.51))  # manba 1201, chegaradan tashqarida
    _ishga("kontur_tuman", "--tuman", "1201")
    for k in (ichki, boshqa, tashqi):
        k.refresh_from_db()
    assert ichki.tuman_geo == tuman
    assert boshqa.tuman_geo is None  # qamralmagan
    assert tashqi.tuman_geo == shahar  # tuman_id=1201 bo'lgani uchun qamraldi


def test_tuman_kodi_yoq():
    with pytest.raises(CommandError):
        call_command("kontur_tuman", "--tuman", "9999", stdout=StringIO())
    with pytest.raises(CommandError):
        call_command("kontur_tur", "--tuman", "9999", stdout=StringIO())


def test_tur_qoidasi(tuman, shahar):
    sug1 = kontur_yarat(tuman, 1, kvadrat(69.1, 40.1, 69.11, 40.11), jami_qx_sug_yeri=5.0)
    sug2 = kontur_yarat(tuman, 2, kvadrat(69.2, 40.1, 69.21, 40.11), haydalma_yer_sug=1.0, jami_qx_sug_yeri=None)
    nol = kontur_yarat(tuman, 3, kvadrat(69.3, 40.1, 69.31, 40.11), jami_qx_sug_yeri=0, haydalma_yer_sug=0)
    null = kontur_yarat(tuman, 4, kvadrat(69.4, 40.1, 69.41, 40.11))  # ikkalasi NULL
    boshqa = kontur_yarat(shahar, 5, kvadrat(69.6, 40.1, 69.61, 40.11), jami_qx_sug_yeri=9.0)
    chiqish = _ishga("kontur_tur", "--tuman", "1201")
    for k in (sug1, sug2, nol, null, boshqa):
        k.refresh_from_db()
    assert (sug1.tur, sug2.tur, nol.tur, null.tur) == ("sugoriladigan", "sugoriladigan", "aniqlanmagan", "aniqlanmagan")
    assert boshqa.tur == "aniqlanmagan"  # boshqa tuman, qamralmadi
    assert "sugoriladigan: 2 kontur" in chiqish and "aniqlanmagan: 2 kontur" in chiqish
    _ishga("kontur_tur")
    boshqa.refresh_from_db()
    assert boshqa.tur == "sugoriladigan"
    # qayta ishga tushirish — o'zgarish yo'q
    assert "tur o'zgardi 0" in _ishga("kontur_tur")
