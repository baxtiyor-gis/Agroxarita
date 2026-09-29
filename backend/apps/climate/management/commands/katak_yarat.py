"""Sug'oriladigan konturlar tushgan 0.1° kataklarni yaratadi/yangilaydi (idempotent)."""
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.climate.models import IqlimKatak

SQL = """
WITH k AS (
    SELECT floor(ST_X(c) * 10)::int AS ix, floor(ST_Y(c) * 10)::int AS iy,
           COALESCE(tuman_geo_id, tuman_id) AS tuman_id,
           COALESCE(umumiy_maydoni, 0) AS ga
    FROM (SELECT ST_PointOnSurface(geom) AS c, tuman_geo_id, tuman_id, umumiy_maydoni
          FROM land_kontur WHERE tur = 'sugoriladigan') s
), t AS (
    SELECT ix, iy, tuman_id, sum(ga) AS ga FROM k GROUP BY ix, iy, tuman_id
)
SELECT ix, iy, sum(ga) AS jami, (array_agg(tuman_id ORDER BY ga DESC))[1] AS tuman_id
FROM t GROUP BY ix, iy ORDER BY ix, iy
"""


class Command(BaseCommand):
    help = "Iqlim kataklarini yaratish (sug'oriladigan konturlar bo'yicha)"

    def handle(self, *args, **opts):
        from django.contrib.gis.geos import Polygon

        with connection.cursor() as cur:
            cur.execute(SQL)
            qatorlar = cur.fetchall()
        mavjud = {(k.ix, k.iy): k for k in IqlimKatak.objects.all()}
        yangi, yangilash = [], []
        for ix, iy, jami, tuman_id in qatorlar:
            lon0, lat0 = ix / 10, iy / 10
            k = mavjud.get((ix, iy))
            if k is None:
                geom = Polygon.from_bbox((lon0, lat0, lon0 + 0.1, lat0 + 0.1))
                geom.srid = 4326
                yangi.append(
                    IqlimKatak(
                        kod=f"{ix}_{iy}", ix=ix, iy=iy, markaz_lon=round(lon0 + 0.05, 4), markaz_lat=round(lat0 + 0.05, 4),
                        geom=geom, geom_mvt=geom.transform(3857, clone=True),
                        sugorilad_maydon=jami, tuman_id=tuman_id,
                    )
                )
            else:
                k.sugorilad_maydon, k.tuman_id = jami, tuman_id
                yangilash.append(k)
        with transaction.atomic():
            IqlimKatak.objects.bulk_create(yangi, batch_size=1000)
            IqlimKatak.objects.bulk_update(yangilash, ["sugorilad_maydon", "tuman"], batch_size=1000)
        self.stdout.write(f"kataklar: {len(qatorlar)} (yangi {len(yangi)}, yangilandi {len(yangilash)})")
