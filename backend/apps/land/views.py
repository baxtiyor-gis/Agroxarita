from django.core.exceptions import ObjectDoesNotExist
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from apps.soil.normalizatsiya import kirill_lotin

from .models import Kontur
from .yer_turlari import USTUNLAR, YER_TURLARI

# Eng katta kesishuvli tuproq + barcha kesishgan poligonlar bo'yicha qoplanish — bitta so'rov.
TUPROQ_SQL = """
WITH k AS (SELECT geom, ST_Area(geom) AS maydon FROM land_kontur WHERE id = %s),
kesish AS (
    SELECT t.id, ST_Area(ST_Intersection(t.geom, k.geom)) AS s
    FROM soil_tuproq t, k
    WHERE t.geom && k.geom AND ST_Intersects(t.geom, k.geom)
),
eng AS (SELECT id FROM kesish ORDER BY s DESC LIMIT 1)
SELECT t.bonitet, t.yer_osti_suvi,
       me.nom, sh.nom, yu.nom, tosh.nom, kl.nom,
       (SELECT LEAST(1.0, COALESCE(SUM(s), 0) / NULLIF((SELECT maydon FROM k), 0)) FROM kesish)
FROM eng
JOIN soil_tuproq t ON t.id = eng.id
LEFT JOIN soil_tuproqlugat me ON me.id = t.mexanika_id
LEFT JOIN soil_tuproqlugat sh ON sh.id = t.shorlanish_id
LEFT JOIN soil_tuproqlugat yu ON yu.id = t.yuvilish_id
LEFT JOIN soil_tuproqlugat tosh ON tosh.id = t.toshlanish_id
LEFT JOIN soil_tuproqlugat kl ON kl.id = t.klass_id
"""

# Eng so'nggi yil (kesishgan poligonlar ichida), shu yilda eng katta kesishuv + shu yil poligonlari bo'yicha qoplanish.
AGROKIMYO_SQL = """
WITH k AS (SELECT geom, ST_Area(geom) AS maydon FROM land_kontur WHERE id = %s),
kesish AS (
    SELECT a.id, a.yil, ST_Area(ST_Intersection(a.geom, k.geom)) AS s
    FROM soil_agrokimyo a, k
    WHERE a.korsatkich = %s AND a.geom && k.geom AND ST_Intersects(a.geom, k.geom)
),
oxirgi AS (SELECT max(yil) AS yil FROM kesish),
shu_yil AS (SELECT kesish.* FROM kesish, oxirgi WHERE kesish.yil IS NOT DISTINCT FROM oxirgi.yil),
eng AS (SELECT id FROM shu_yil ORDER BY s DESC, id LIMIT 1)
SELECT a.daraja, a.daraja_nom, a.gradatsiya, a.yil,
       (SELECT LEAST(1.0, COALESCE(SUM(s), 0) / NULLIF((SELECT maydon FROM k), 0)) FROM shu_yil)
FROM eng JOIN soil_agrokimyo a ON a.id = eng.id
"""


def agrokimyo_malumoti(kontur_id, korsatkich):
    with connection.cursor() as cursor:
        cursor.execute(AGROKIMYO_SQL, [kontur_id, korsatkich])
        qator = cursor.fetchone()
    if qator is None:
        return None
    daraja, daraja_nom, gradatsiya, yil, qoplanish = qator
    return {
        "daraja": daraja,
        "daraja_nom": daraja_nom or None,
        "gradatsiya": gradatsiya or None,
        "yil": yil,
        "qoplanish": round(float(qoplanish or 0), 2),
    }


def relyef_malumoti(kontur):
    try:
        r = kontur.relyef  # select_related("relyef") — qo'shimcha so'rovsiz
    except ObjectDoesNotExist:
        return None
    if r.balandlik_ortacha is None:
        return None
    return {
        "balandlik": {"min": r.balandlik_min, "ortacha": r.balandlik_ortacha, "max": r.balandlik_max},
        "qiyalik": {"ortacha": r.qiyalik_ortacha, "sinf": r.qiyalik_sinfi, "sinf_nom": r.get_qiyalik_sinfi_display()},
        "yonalish": {"kod": r.yonalish, "nom": r.get_yonalish_display(), "gradus": r.yonalish_gradus},
    }


def tuproq_malumoti(kontur_id):
    with connection.cursor() as cursor:
        cursor.execute(TUPROQ_SQL, [kontur_id])
        qator = cursor.fetchone()
    if qator is None:
        return None
    bonitet, yer_osti_suvi, mexanika, shorlanish, yuvilish, toshlanish, klass, qoplanish = qator
    return {
        "bonitet": bonitet,
        "mexanika": mexanika,
        "shorlanish": shorlanish,
        "yuvilish": yuvilish,
        "toshlanish": toshlanish,
        "klass": klass,
        "yer_osti_suvi": yer_osti_suvi or None,
        "qoplanish": round(float(qoplanish or 0), 2),
    }


@api_view(["GET"])
def kontur_batafsil(request, id):
    try:
        kontur = (
            Kontur.objects.select_related("tuman__viloyat", "tuman_geo__viloyat", "relyef")
            .only(
                "kontur_raqami", "yagona_kontur", "umumiy_maydoni", "tur", "mfy", "massiv", "geom",
                "tuman__kod", "tuman__nom", "tuman__viloyat__region_id", "tuman__viloyat__nom",
                "tuman_geo__kod", "tuman_geo__nom", "tuman_geo__viloyat__region_id", "tuman_geo__viloyat__nom",
                "relyef__balandlik_min", "relyef__balandlik_ortacha", "relyef__balandlik_max", "relyef__qiyalik_ortacha",
                "relyef__qiyalik_sinfi", "relyef__yonalish", "relyef__yonalish_gradus",
                *USTUNLAR,
            )
            .get(pk=id)
        )
    except Kontur.DoesNotExist:
        raise NotFound(f"id={id} kontur topilmadi.") from None

    tuman = kontur.tuman_geo or kontur.tuman
    yer_turlari = []
    for ustun, nom, jami in YER_TURLARI:
        qiymat = getattr(kontur, ustun)
        if qiymat is not None and qiymat > 0:
            yer_turlari.append({"kod": ustun, "nom": nom, "maydon": round(qiymat, 2), "jami": jami})
    yer_turlari.sort(key=lambda t: -t["maydon"])

    return Response(
        {
            "id": kontur.pk,
            "kontur_raqami": kontur.kontur_raqami,
            "yagona_kontur": kontur.yagona_kontur,
            "maydon": round(kontur.umumiy_maydoni, 2) if kontur.umumiy_maydoni is not None else None,
            "tur": kontur.tur,
            "tuman": {"kod": tuman.kod, "nom": tuman.nom},
            "viloyat": {"region_id": tuman.viloyat.region_id, "nom": tuman.viloyat.nom},
            "massiv": kirill_lotin(kontur.massiv),
            "mfy": kirill_lotin(kontur.mfy),
            "yer_turlari": yer_turlari,
            "tuproq": tuproq_malumoti(kontur.pk),
            "agrokimyo": {
                "kaliy": agrokimyo_malumoti(kontur.pk, "kaliy"),
                "fosfor": agrokimyo_malumoti(kontur.pk, "fosfor"),
                "gumus": agrokimyo_malumoti(kontur.pk, "gumus"),
            },
            "relyef": relyef_malumoti(kontur),
            "bbox": list(kontur.geom.extent),
        }
    )
