"""Iqlim: katak_yarat, sun'iy NetCDF -> import_iqlim (idempotent), hisob funksiyalari."""
import datetime as dt

import netCDF4
import numpy as np
import pytest
from django.core.management import call_command

from apps.climate import hisob
from apps.climate.era5 import GURUHLAR, fayl_nomi, sorov
from apps.climate.models import IqlimKatak, IqlimKunlik, IqlimOylik, IqlimYillik
from conftest import kontur_yarat, kvadrat

pytestmark = pytest.mark.django_db

LATS = np.array([40.3, 40.2, 40.1, 40.0])
LONS = np.array([69.0, 69.1, 69.2, 69.3])


def nc_yoz(yol, ozgaruvchilar, yil=2024, oy=1, kunlar=31):
    with netCDF4.Dataset(yol, "w") as ds:
        ds.createDimension("valid_time", kunlar)
        ds.createDimension("latitude", len(LATS))
        ds.createDimension("longitude", len(LONS))
        t = ds.createVariable("valid_time", "i8", ("valid_time",))
        t.units = f"days since {yil}-{oy:02d}-01 00:00:00"
        t[:] = np.arange(kunlar)
        ds.createVariable("latitude", "f8", ("latitude",))[:] = LATS
        ds.createVariable("longitude", "f8", ("longitude",))[:] = LONS
        for nom, qiymat in ozgaruvchilar.items():
            v = ds.createVariable(nom, "f4", ("valid_time", "latitude", "longitude"))
            v[:] = np.full((kunlar, len(LATS), len(LONS)), qiymat)


def yil_fayllari(papka, yil=2024, t_min=270.0):
    kunlar = 366 if yil % 4 == 0 else 365
    nc_yoz(papka / fayl_nomi("t_min", yil), {"t2m": t_min}, yil, 1, kunlar)
    nc_yoz(papka / fayl_nomi("t_max", yil), {"t2m": 305.0}, yil, 1, kunlar)
    nc_yoz(papka / fayl_nomi("tp", yil), {"tp": 0.002}, yil, 1, kunlar)
    nc_yoz(papka / fayl_nomi("tp", yil + 1), {"tp": 0.002}, yil + 1, 1, 1)  # keyingi yil 1-yanvari


@pytest.fixture
def kataklar_bor(tuman):
    # bitta katak (69.1..69.2, 40.1..40.2) - ikkita sug'oriladigan kontur, bittasi aniqlanmagan
    kontur_yarat(tuman, 1, kvadrat(69.11, 40.11, 69.12, 40.12), tur="sugoriladigan", umumiy_maydoni=10.0)
    kontur_yarat(tuman, 2, kvadrat(69.13, 40.13, 69.14, 40.14), tur="sugoriladigan", umumiy_maydoni=5.0)
    kontur_yarat(tuman, 3, kvadrat(69.31, 40.31, 69.32, 40.32), tur="aniqlanmagan", umumiy_maydoni=99.0)


def test_katak_yarat(kataklar_bor, tuman):
    call_command("katak_yarat")
    call_command("katak_yarat")  # idempotent
    assert IqlimKatak.objects.count() == 1
    k = IqlimKatak.objects.get()
    assert (k.kod, k.ix, k.iy) == ("691_401", 691, 401)
    assert k.sugorilad_maydon == 15.0
    assert k.tuman == tuman
    assert (k.markaz_lon, k.markaz_lat) == (69.15, 40.15)
    assert k.geom_mvt.srid == 3857


def test_import_iqlim_idempotent(kataklar_bor, tmp_path):
    call_command("katak_yarat")
    yil_fayllari(tmp_path, 2024)
    for _ in range(2):
        call_command("import_iqlim", papka=str(tmp_path), yil=2024)
    assert IqlimKunlik.objects.count() == 366
    kun = IqlimKunlik.objects.get(sana=dt.date(2024, 1, 5))
    assert kun.t_min == pytest.approx(270.0 - 273.15, abs=1e-3)
    assert kun.t_ort == pytest.approx((270.0 + 305.0) / 2 - 273.15, abs=1e-3)
    assert kun.yogin == pytest.approx(2.0, abs=1e-4)
    assert kun.radiatsiya is None and kun.shamol is None and kun.namlik is None
    assert kun.et0 > 0
    assert IqlimKunlik.objects.get(sana=dt.date(2024, 12, 31)).yogin == pytest.approx(2.0, abs=1e-4)
    assert IqlimOylik.objects.count() == 12
    oy = IqlimOylik.objects.get(oy=1)
    assert (oy.yil, oy.kunlar) == (2024, 31)
    assert oy.yogin == pytest.approx(62.0, abs=1e-3)
    yil = IqlimYillik.objects.get()
    assert yil.fah == pytest.approx(366 * 14.35, abs=1e-1)
    assert yil.yogin == pytest.approx(732.0, abs=1e-2)
    assert yil.oxirgi_bahorgi_sovuq == dt.date(2024, 6, 30)  # butun yil sovuq (sintetik)
    assert yil.birinchi_kuzgi_sovuq == dt.date(2024, 7, 1)


def test_import_yil_toliq_emas_otkaziladi(kataklar_bor, tmp_path):
    call_command("katak_yarat")
    yil_fayllari(tmp_path, 2024)
    (tmp_path / fayl_nomi("tp", 2024)).unlink()
    call_command("import_iqlim", papka=str(tmp_path))
    assert IqlimKunlik.objects.count() == 0


def test_yillik_hisob_sovuqsiz():
    sanalar = [dt.date(2023, 1, 1) + dt.timedelta(days=i) for i in range(365)]
    t_min = np.full(365, 5.0)
    t_min[[10, 80]] = -2.0  # bahor sovuqlari
    t_min[[300]] = -1.0  # kuz
    t_ort = np.full(365, 15.0)
    fah, sov, ob, bk, yogin, et0, ort = hisob.yillik_hisob(sanalar, t_min, t_ort, np.ones(365), np.full(365, 2.0))
    assert ob == sanalar[80] and bk == sanalar[300]
    assert sov == 300 - 80 - 1
    assert fah == 15.0 * 365 and yogin == 365.0 and et0 == 730.0


def test_hargreaves_va_namlik():
    et = hisob.hargreaves(np.array(15.0), np.array(35.0), np.array(25.0), 40.0, np.array(190))
    assert 5 < float(et) < 12  # yozda O'zbekistonda ~7-9 mm/kun
    assert float(hisob.nisbiy_namlik(np.array(20.0), np.array(20.0))) == pytest.approx(100.0)


def test_sorov_shakli():
    s = sorov("tp", 2024)
    assert s["time"] == ["00:00"] and s["area"] == [45.6, 55.9, 37.1, 73.2] and len(s["month"]) == 12
    assert sorov("tp", 2026)["day"] == ["01"]
    assert sorov("t_min", 2024)["daily_statistic"] == "daily_minimum"
    assert set(GURUHLAR) == {"t_min", "t_max", "tp"}
