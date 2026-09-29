from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

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
            Kontur.objects.select_related("tuman__viloyat", "tuman_geo__viloyat")
            .only(
                "kontur_raqami", "yagona_kontur", "umumiy_maydoni", "tur", "mfy", "massiv", "geom",
                "tuman__kod", "tuman__nom", "tuman__viloyat__region_id", "tuman__viloyat__nom",
                "tuman_geo__kod", "tuman_geo__nom", "tuman_geo__viloyat__region_id", "tuman_geo__viloyat__nom",
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
            "massiv": kontur.massiv,
            "mfy": kontur.mfy,
            "yer_turlari": yer_turlari,
            "tuproq": tuproq_malumoti(kontur.pk),
            "bbox": list(kontur.geom.extent),
        }
    )
