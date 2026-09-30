"""Kontur tematik ko'rsatkichlari: python manage.py hisobla_korsatkich [--tuman KOD ...] [--viloyat ID ...] [--qayta]

Har kontur uchun `KonturKorsatkich`: bonitet va sho'rlanish — eng katta kesishuvli tuproq poligonidan, gumus/fosfor/kaliy —
eng so'nggi yil ichida eng katta kesishuvli poligondan (`land.views` dagi mantiq bilan bir xil). Qoplanish (kesishuv
maydoni / kontur maydoni) < 0.1 bo'lsa qiymat null. Hammasi SQL'da, tuman bo'yicha, har tuman alohida tranzaksiya.
Sho'rlanish klassi (TuproqClass kodi -> 1..5): 1-5 o'zi; 6 Kam -> 2; 7 Sho'rlanmagan yoki kam -> 1;
8 Ba'zan kam sho'rlangan -> 2; 9 Ba'zan kuchsiz -> 2.
"""
import time

from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction

MIN_QOPLANISH = 0.1

# {agro}: kaliy/fosfor/gumus uchun bir xil CTE (qat'iy ro'yxatdan)
AGRO_CTE = """
{n}_kesish AS (
    SELECT k.id AS kid, a.daraja, a.yil, ST_Area(ST_Intersection(a.geom, k.geom)) AS s
    FROM kontur k JOIN {jadval} a ON a.geom && k.geom AND ST_Intersects(a.geom, k.geom)
),
{n}_son AS (
    SELECT *, max(yil) OVER (PARTITION BY kid) AS oxirgi FROM {n}_kesish
),
{n} AS (
    SELECT kid,
           (array_agg(daraja ORDER BY s DESC, daraja))[1] AS daraja,
           SUM(s) AS jami
    FROM {n}_son WHERE yil IS NOT DISTINCT FROM oxirgi GROUP BY kid
)"""

SQL = """
WITH kontur AS (
    SELECT id, geom, ST_Area(geom) AS maydon FROM land_kontur
    WHERE COALESCE(tuman_geo_id, tuman_id) = %(tuman_id)s {qo_shimcha}
),
t_kesish AS (
    SELECT k.id AS kid, t.bonitet, sh.kod AS sh_kod, ST_Area(ST_Intersection(t.geom, k.geom)) AS s
    FROM kontur k
    JOIN soil_tuproq t ON t.geom && k.geom AND ST_Intersects(t.geom, k.geom)
    LEFT JOIN soil_tuproqclass sh ON sh.id = t.shorlanish_id
),
tuproq AS (
    SELECT kid,
           (array_agg(bonitet ORDER BY s DESC, bonitet))[1] AS bonitet,
           (array_agg(sh_kod ORDER BY s DESC, sh_kod))[1] AS sh_kod,
           SUM(s) AS jami
    FROM t_kesish GROUP BY kid
),
{agro}
INSERT INTO land_konturkorsatkich (kontur_id, bonitet, shorlanish, gumus, fosfor, kaliy)
SELECT k.id,
       CASE WHEN t.jami / NULLIF(k.maydon, 0) >= %(min)s THEN t.bonitet END,
       CASE WHEN t.jami / NULLIF(k.maydon, 0) >= %(min)s THEN
           CASE t.sh_kod WHEN 1 THEN 1 WHEN 2 THEN 2 WHEN 3 THEN 3 WHEN 4 THEN 4 WHEN 5 THEN 5
                         WHEN 6 THEN 2 WHEN 7 THEN 1 WHEN 8 THEN 2 WHEN 9 THEN 2 END
       END,
       CASE WHEN g.jami / NULLIF(k.maydon, 0) >= %(min)s THEN g.daraja END,
       CASE WHEN f.jami / NULLIF(k.maydon, 0) >= %(min)s THEN f.daraja END,
       CASE WHEN q.jami / NULLIF(k.maydon, 0) >= %(min)s THEN q.daraja END
FROM kontur k
LEFT JOIN tuproq t ON t.kid = k.id
LEFT JOIN gumus g ON g.kid = k.id
LEFT JOIN fosfor f ON f.kid = k.id
LEFT JOIN kaliy q ON q.kid = k.id
ON CONFLICT (kontur_id) DO UPDATE SET bonitet = EXCLUDED.bonitet, shorlanish = EXCLUDED.shorlanish,
    gumus = EXCLUDED.gumus, fosfor = EXCLUDED.fosfor, kaliy = EXCLUDED.kaliy
"""
QOSHIMCHA = "AND NOT EXISTS (SELECT 1 FROM land_konturkorsatkich r WHERE r.kontur_id = land_kontur.id)"


def sql_yasa(qayta):
    agro = ",\n".join(
        AGRO_CTE.format(n=n, jadval=j) for n, j in (("gumus", "soil_gumus"), ("fosfor", "soil_fosfor"), ("kaliy", "soil_kaliy"))
    )
    return SQL.format(agro=agro, qo_shimcha="" if qayta else QOSHIMCHA)


def tuman_hisobla(tuman_id, qayta=False):
    """Bitta tuman: (kontur soni, soniya). Har tuman alohida tranzaksiya."""
    t0 = time.perf_counter()
    with transaction.atomic(), connection.cursor() as c:
        c.execute(sql_yasa(qayta), {"tuman_id": tuman_id, "min": MIN_QOPLANISH})
        n = c.rowcount
    return n, time.perf_counter() - t0


class Command(BaseCommand):
    help = "Kontur tematik ko'rsatkichlari (bonitet, sho'rlanish, gumus, fosfor, kaliy) — SQL, tuman bo'yicha."

    def add_arguments(self, parser):
        parser.add_argument("--tuman", type=int, nargs="*", default=None, help="tuman kod(lar)i")
        parser.add_argument("--viloyat", type=int, nargs="*", default=None, help="viloyat region_id(lar)i")
        parser.add_argument("--qayta", action="store_true", help="hisoblanganlarni ham qayta hisobla")

    def handle(self, *a, **o):
        with connection.cursor() as c:
            if o["tuman"]:
                c.execute("SELECT id, kod FROM border_tuman WHERE kod = ANY(%s) ORDER BY kod", [o["tuman"]])
            elif o["viloyat"]:
                c.execute(
                    "SELECT t.id, t.kod FROM border_tuman t JOIN border_viloyat v ON v.id = t.viloyat_id "
                    "WHERE v.region_id = ANY(%s) ORDER BY t.kod", [o["viloyat"]],
                )
            else:
                c.execute("SELECT id, kod FROM border_tuman ORDER BY kod")
            tumanlar = c.fetchall()
        if o["tuman"] and len(tumanlar) != len(set(o["tuman"])):
            raise CommandError(f"tuman topilmadi: {sorted(set(o['tuman']) - {k for _, k in tumanlar})}")
        jami = 0
        for tid, kod in tumanlar:
            n, sek = tuman_hisobla(tid, o["qayta"])
            jami += n
            if n:
                self.stdout.write(f"tuman {kod}: {n} kontur, {sek:.1f}s ({n / max(sek, 1e-9):.0f}/s)")
                self.stdout.flush()
        self.stdout.write(f"tugadi: {len(tumanlar)} tuman, {jami} kontur")
