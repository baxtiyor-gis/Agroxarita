"""Kontur iqlim API: kontur -> katak bog'lash va katak bo'yicha ko'rsatkichlar (SQL agregat + kesh)."""
import calendar
import datetime as dt

from django.core.cache import cache
from django.db import connection

from .models import IqlimKatak, IqlimOylik, IqlimYillik

KESH_VAQT = 3600
ISSIQ_CHEGARA = 35.0  # Tmax >= 35 °C
KECH_SOVUQ = (4, 10)  # oxirgi bahorgi sovuq shu sanadan keyin bo'lsa - kech

# Kontur ichki nuqtasi (ST_PointOnSurface, katak_yarat bilan bir xil qoida) -> 0.1° katak indekslari.
KATAK_SQL = """
SELECT floor(ST_X(c) * 10)::int, floor(ST_Y(c) * 10)::int
FROM (SELECT ST_PointOnSurface(geom) AS c FROM land_kontur WHERE id = %s) s
"""

KUNLIK_SQL = """
SELECT extract(year FROM sana)::int AS yil, count(*), min(t_min), count(*) FILTER (WHERE t_max >= %s),
       avg(t_ort), sum(yogin), sum(et0)
FROM climate_iqlimkunlik WHERE katak_id = %s GROUP BY 1 ORDER BY 1
"""


def kontur_katagi(kontur_id):
    """Kontur -> IqlimKatak (yoki None). Kontur yo'q bo'lsa `LookupError`."""
    with connection.cursor() as c:
        c.execute(KATAK_SQL, [kontur_id])
        qator = c.fetchone()
    if qator is None:
        raise LookupError(kontur_id)
    return IqlimKatak.objects.filter(ix=qator[0], iy=qator[1]).first()


def _r(x, n=1):
    return None if x is None else round(float(x), n)


def _ortacha(qiymatlar, n=1):
    q = [x for x in qiymatlar if x is not None]
    return round(sum(q) / len(q), n) if q else None


def katak_iqlimi(katak):
    """Katak bo'yicha to'liq javob (keshlanadi; bir katakdagi barcha konturlar uchun bir xil)."""
    kalit = f"iqlim:{katak.pk}"
    natija = cache.get(kalit)
    if natija is None:
        natija = _hisobla(katak)
        cache.set(kalit, natija, timeout=KESH_VAQT)
    return natija


def _hisobla(katak):
    with connection.cursor() as c:
        c.execute(KUNLIK_SQL, [ISSIQ_CHEGARA, katak.pk])
        kunlik = {q[0]: q for q in c.fetchall()}
    yillik_qatorlar = {y.yil: y for y in IqlimYillik.objects.filter(katak=katak)}
    oylik = list(IqlimOylik.objects.filter(katak=katak).order_by("yil", "oy"))
    yillar = sorted(set(kunlik) | set(yillik_qatorlar) | {o.yil for o in oylik})

    yillik = []
    for yil in yillar:
        k = kunlik.get(yil)
        y = yillik_qatorlar.get(yil)
        kunlar_yil = 366 if calendar.isleap(yil) else 365
        toliq = bool(y is not None and k is not None and k[1] >= kunlar_yil)
        ob, bk = (y.oxirgi_bahorgi_sovuq, y.birinchi_kuzgi_sovuq) if y else (None, None)
        yillik.append({
            "yil": yil,
            "fah": _r(y.fah) if y else None,
            "sovuqsiz": y.sovuqsiz_kunlar if y else None,
            "bahorgi_sovuq": ob.timetuple().tm_yday if ob else None,
            "kuzgi_sovuq": bk.timetuple().tm_yday if bk else None,
            "issiq_kun": k[3] if k else None,
            "min_t": _r(k[2]) if k else None,
            "yogin": _r(k[5]) if k else None,
            "et0": _r(k[6]) if k else None,
            "t_ort": _r(k[4]) if k else None,
            "toliq": toliq,
            "_ob": ob,
        })
    toliq_yillar = [y for y in yillik if y["toliq"]]

    kech = sum(1 for y in toliq_yillar if y["_ob"] and (y["_ob"].month, y["_ob"].day) > KECH_SOVUQ)
    korsatkich = {
        "fah": _ortacha(y["fah"] for y in toliq_yillar),
        "sovuqsiz": _ortacha(y["sovuqsiz"] for y in toliq_yillar),
        "bahorgi_sovuq": _ortacha(y["bahorgi_sovuq"] for y in toliq_yillar),
        "kuzgi_sovuq": _ortacha(y["kuzgi_sovuq"] for y in toliq_yillar),
        "issiq_kun": _ortacha(y["issiq_kun"] for y in toliq_yillar),
        "min_t": _ortacha(y["min_t"] for y in toliq_yillar),
        "kech_sovuq_yillar": kech if toliq_yillar else None,
    }
    for y in yillik:
        del y["_ob"]

    toliq_set = {y["yil"] for y in toliq_yillar}
    oylik_ortacha = []
    for oy in range(1, 13):
        q = [o for o in oylik if o.oy == oy and o.yil in toliq_set]
        oylik_ortacha.append({
            "oy": oy,
            "t_ort": _ortacha(o.t_ort for o in q),
            "yogin": _ortacha(o.yogin for o in q),
            "et0": _ortacha(o.et0 for o in q),
        })

    yillar_oylar = []
    for yil in yillar:
        oylar = [{"oy": o.oy, "t_ort": _r(o.t_ort), "yogin": _r(o.yogin)} for o in oylik if o.yil == yil]
        if oylar:
            yillar_oylar.append({"yil": yil, "oylar": oylar})

    yogin = _ortacha(y["yogin"] for y in toliq_yillar)
    et0 = _ortacha(y["et0"] for y in toliq_yillar)
    suv = {"yogin": yogin, "et0": et0, "tanqislik": _r(et0 - yogin) if None not in (yogin, et0) else None}

    return {
        "katak": {"id": katak.pk, "lat": katak.markaz_lat, "lon": katak.markaz_lon, "balandlik": None},
        "davr": [yillar[0], yillar[-1]] if yillar else None,
        "yillar": yillar,
        "korsatkich": korsatkich,
        "yillik": yillik,
        "oylik_ortacha": oylik_ortacha,
        "yillar_oylar": yillar_oylar,
        "suv_balansi": suv,
        "xavf": _xavf(toliq_yillar),
    }


def _xavf(toliq):
    """Eng issiq/sovuq (t_ort) va eng nam/quruq (yogin) to'liq yil."""
    def eng(kalit, katta):
        q = [y for y in toliq if y[kalit] is not None]
        if not q:
            return None
        y = (max if katta else min)(q, key=lambda y: y[kalit])
        return {"yil": y["yil"], "qiymat": y[kalit]}

    return {"eng_issiq": eng("t_ort", True), "eng_sovuq": eng("t_ort", False),
            "eng_nam": eng("yogin", True), "eng_quruq": eng("yogin", False)}
