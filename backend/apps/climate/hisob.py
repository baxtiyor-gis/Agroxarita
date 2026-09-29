"""NetCDF o'qish va agrometeorologik hisoblar (bazasiz funksiyalar)."""
import datetime as dt
import math

import numpy as np

from .era5 import GURUHLAR, fayl_nomi


def _o(ds, nom):
    """Masked -> float64 array (NaN)."""
    a = ds.variables[nom][:]
    if np.ma.isMaskedArray(a):
        a = a.astype("float64").filled(np.nan)
    return np.asarray(a, dtype="float64")


def _sanalar(ds):
    import netCDF4

    nom = "valid_time" if "valid_time" in ds.variables else "time"
    v = ds.variables[nom]
    kunlar = netCDF4.num2date(v[:], v.units, only_use_cftime_datetimes=False, only_use_python_datetimes=True)
    return [d.date() for d in kunlar]


def eng_yaqin_indeks(massiv, qiymatlar):
    """Har qiymat uchun massivdagi eng yaqin indeks (teng masofada - pastki)."""
    return np.abs(massiv[None, :] - np.asarray(qiymatlar)[:, None]).argmin(axis=1)


def oqi_guruh(yol, ozgaruvchilar, kataklar):
    """(sanalar, {nom: array[vaqt, katak]}); kataklar = [(lon, lat), ...]."""
    import netCDF4

    with netCDF4.Dataset(yol) as ds:
        lat = _o(ds, "latitude" if "latitude" in ds.variables else "lat")
        lon = _o(ds, "longitude" if "longitude" in ds.variables else "lon")
        sanalar = _sanalar(ds)
        ilat = eng_yaqin_indeks(lat, [k[1] for k in kataklar])
        ilon = eng_yaqin_indeks(lon, [k[0] for k in kataklar])
        chiqish = {}
        for nom in ozgaruvchilar:
            a = _o(ds, nom)
            while a.ndim > 3:  # expver o'lchami bo'lsa
                a = np.nanmax(a, axis=1)
            chiqish[nom] = a[:, ilat, ilon]
    return sanalar, chiqish


def nisbiy_namlik(t, td):
    """Magnus formulasi, °C -> %."""

    def es(x):
        return np.exp(17.625 * x / (243.04 + x))

    return np.clip(100.0 * es(td) / es(t), 0, 100)


def ra_mm(lat_grad, kun_yil):
    """Atmosfera tashqi radiatsiyasi Ra, mm/kun (FAO-56)."""
    fi = np.radians(lat_grad)
    dr = 1 + 0.033 * np.cos(2 * math.pi * kun_yil / 365)
    delta = 0.409 * np.sin(2 * math.pi * kun_yil / 365 - 1.39)
    ws = np.arccos(np.clip(-np.tan(fi) * np.tan(delta), -1, 1))
    ra = 24 * 60 / math.pi * 0.0820 * dr * (ws * np.sin(fi) * np.sin(delta) + np.cos(fi) * np.cos(delta) * np.sin(ws))
    return ra * 0.408


def hargreaves(t_min, t_max, t_ort, lat_grad, kun_yil):
    """ET0 (mm/kun), Hargreaves-Samani."""
    return np.maximum(0.0023 * (t_ort + 17.8) * np.sqrt(np.maximum(t_max - t_min, 0)) * ra_mm(lat_grad, kun_yil), 0)


def oy_kunlik(yolar, kataklar):
    """Bir oy uchun kunlik ko'rsatkichlar: (sanalar, {maydon: array[vaqt, katak]}).

    Birliklar: K->°C, m->mm, J/m2->MJ/m2. yolar: {guruh: fayl yo'li}.
    """
    sanalar, a = oqi_guruh(yolar["t_min"], ["t2m"], kataklar)
    _, b = oqi_guruh(yolar["t_max"], ["t2m"], kataklar)
    _, c = oqi_guruh(yolar["ort"], ["t2m", "d2m", "u10", "v10"], kataklar)
    _, d = oqi_guruh(yolar["yigindi"], ["tp", "ssrd"], kataklar)
    t_min, t_max, t_ort = a["t2m"] - 273.15, b["t2m"] - 273.15, c["t2m"] - 273.15
    kun_yil = np.array([x.timetuple().tm_yday for x in sanalar])[:, None]
    lat = np.array([k[1] for k in kataklar])[None, :]
    return sanalar, {
        "t_min": t_min,
        "t_max": t_max,
        "t_ort": t_ort,
        "yogin": np.maximum(d["tp"] * 1000.0, 0),
        "radiatsiya": d["ssrd"] / 1e6,
        "shamol": np.hypot(c["u10"], c["v10"]),
        "namlik": nisbiy_namlik(t_ort, c["d2m"] - 273.15),
        "et0": hargreaves(t_min, t_max, t_ort, lat, kun_yil),
    }


def fayllar_oy(papka, yil, oy):
    """Oyning barcha guruh fayllari bor bo'lsa {guruh: yo'l}, aks holda None."""
    yolar = {g: papka / fayl_nomi(g, yil, oy) for g in GURUHLAR}
    return yolar if all(p.exists() for p in yolar.values()) else None


def yillik_hisob(sanalar, t_min, t_ort, yogin, et0):
    """Bitta katak, bitta yil: (fah, sovuqsiz, oxirgi_bahor, birinchi_kuz, yogin, et0, t_ort)."""

    def yig(a):
        return None if np.all(np.isnan(a)) else float(np.nansum(a))

    yil = sanalar[0].year
    iyul = dt.date(yil, 7, 1)
    sov = t_min < 0
    bahor = [s for s, f in zip(sanalar, sov) if f and s < iyul]
    kuz = [s for s, f in zip(sanalar, sov) if f and s >= iyul]
    ob = max(bahor) if bahor else None
    bk = min(kuz) if kuz else None
    boshi = ob if ob else dt.date(yil, 1, 1) - dt.timedelta(days=1)
    oxiri = bk if bk else dt.date(yil, 12, 31) + dt.timedelta(days=1)
    fah = float(np.nansum(np.where(t_ort > 10, t_ort, 0)))
    ort = None if np.all(np.isnan(t_ort)) else float(np.nanmean(t_ort))
    return fah, (oxiri - boshi).days - 1, ob, bk, yig(yogin), yig(et0), ort
