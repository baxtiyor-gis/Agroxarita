"""Kontur -> geometrik tuman (`tuman_geo`) va yer turi (`tur`). Buyruqlar va `import_kontur` shu kodni ishlatadi.

Ikkalasi ham SQL'da (Python siklisiz); `tuman_kod` berilsa faqat shu tuman bilan bog'liq konturlar.
"""
import time

from django.db import connection


def _tuman_id(c, kod):
    c.execute("SELECT id FROM border_tuman WHERE kod = %s", [kod])
    r = c.fetchone()
    if r is None:
        raise ValueError(f"kod={kod} tuman topilmadi")
    return r[0]


def kontur_tuman_hisobla(tuman_kod=None, yoz=lambda s: None):
    """Har kontur uchun eng katta kesishuvli tuman -> `tuman_geo_id`. Kontur kesilmaydi.

    Tez yo'l: bitta tuman ichida to'liq yotgan (ST_CoveredBy) kontur uchun Intersection yo'q. Qolganlari
    (chegarani kesuvchilar) uchun `ST_Area(ST_Intersection)` eng kattasi; hech biriga tegmasa NULL.
    `tuman_kod`: tuman_id = shu YOKI chegarasiga tegadigan YOKI hozir tuman_geo = shu konturlar.
    """
    t0 = time.perf_counter()
    with connection.cursor() as c:
        p = []
        if tuman_kod is None:
            shart = "TRUE"
        else:
            tid = _tuman_id(c, tuman_kod)
            shart = ("(k.tuman_id = %s OR k.tuman_geo_id = %s OR (k.geom && (SELECT geom FROM border_tuman WHERE id = %s) "
                     "AND ST_Intersects(k.geom, (SELECT geom FROM border_tuman WHERE id = %s))))")
            p = [tid] * 4
        c.execute("DROP TABLE IF EXISTS _kt")
        c.execute("CREATE TEMP TABLE _kt (id bigint PRIMARY KEY, geo_id bigint, kesuvchi boolean NOT NULL DEFAULT false)")
        # 1) tez yo'l: to'liq bitta tuman ichida
        c.execute(f"""
            INSERT INTO _kt (id, geo_id)
            SELECT k.id, x.id FROM land_kontur k
            LEFT JOIN LATERAL (
                SELECT t.id FROM border_tuman t WHERE t.geom && k.geom AND ST_CoveredBy(k.geom, t.geom) LIMIT 1
            ) x ON TRUE
            WHERE {shart}""", p)
        # 2) qolganlar: eng katta kesishuv
        c.execute("""
            UPDATE _kt SET geo_id = y.id, kesuvchi = TRUE
            FROM (SELECT z.id AS kid, m.id FROM _kt z
                  JOIN land_kontur k ON k.id = z.id
                  CROSS JOIN LATERAL (
                      SELECT t.id FROM border_tuman t
                      WHERE t.geom && k.geom AND ST_Intersects(t.geom, k.geom)
                      ORDER BY ST_Area(ST_Intersection(k.geom, t.geom)) DESC, t.id LIMIT 1
                  ) m
                  WHERE z.geo_id IS NULL) y
            WHERE _kt.id = y.kid""")
        c.execute("SELECT count(*), count(*) FILTER (WHERE kesuvchi), count(*) FILTER (WHERE geo_id IS NULL) FROM _kt")
        korildi, kesuvchi, tushmagan = c.fetchone()
        c.execute("""UPDATE land_kontur k SET tuman_geo_id = _kt.geo_id FROM _kt
                     WHERE k.id = _kt.id AND k.tuman_geo_id IS DISTINCT FROM _kt.geo_id""")
        yangilandi = c.rowcount
        c.execute("""
            SELECT t.kod, count(*) FROM _kt JOIN land_kontur k ON k.id = _kt.id
            JOIN border_tuman t ON t.id = k.tuman_id
            WHERE k.tuman_id IS DISTINCT FROM k.tuman_geo_id GROUP BY t.kod ORDER BY count(*) DESC""")
        farq_tuman = c.fetchall()
        c.execute("DROP TABLE _kt")
    natija = {"korildi": korildi, "yangilandi": yangilandi, "kesuvchi": kesuvchi, "tushmagan": tushmagan,
              "farq": sum(n for _, n in farq_tuman), "farq_top": farq_tuman[:10],
              "vaqt": time.perf_counter() - t0}
    yoz(f"kontur_tuman: ko'rildi {korildi}, tuman_geo o'zgardi {yangilandi}, chegarani kesuvchi {kesuvchi}, "
        f"hech tumanga tushmagan {tushmagan}, tuman != tuman_geo {natija['farq']}; {natija['vaqt']:.1f}s")
    if farq_tuman:
        yoz("  tuman != tuman_geo, manba tuman kodi bo'yicha top-10: "
            + ", ".join(f"{kod}: {n}" for kod, n in natija["farq_top"]))
    return natija


def kontur_tur_hisobla(tuman_kod=None, yoz=lambda s: None):
    """`tur`: sug'oriladigan (jami_qx_sug_yeri > 0 yoki haydalma_yer_sug > 0), aks holda aniqlanmagan.
    `tuman_kod` — `tuman_geo` bo'yicha (tuman_geo NULL bo'lganlar hisobga olinmaydi)."""
    t0 = time.perf_counter()
    qoida = ("CASE WHEN COALESCE(k.jami_qx_sug_yeri, 0) > 0 OR COALESCE(k.haydalma_yer_sug, 0) > 0 "
             "THEN 'sugoriladigan' ELSE 'aniqlanmagan' END")
    with connection.cursor() as c:
        if tuman_kod is None:
            shart, p = "TRUE", []
        else:
            shart, p = "k.tuman_geo_id = %s", [_tuman_id(c, tuman_kod)]
        c.execute(f"UPDATE land_kontur k SET tur = {qoida} WHERE {shart} AND k.tur IS DISTINCT FROM {qoida}", p)
        yangilandi = c.rowcount
        c.execute(f"""SELECT k.tur, count(*), COALESCE(sum(k.umumiy_maydoni), 0) FROM land_kontur k
                      WHERE {shart} GROUP BY k.tur ORDER BY k.tur""", p)
        turlar = c.fetchall()
    vaqt = time.perf_counter() - t0
    yoz(f"kontur_tur: tur o'zgardi {yangilandi}; {vaqt:.1f}s")
    for tur, n, ga in turlar:
        yoz(f"  {tur}: {n} kontur, {ga:,.1f} ga")
    return {"yangilandi": yangilandi, "turlar": turlar, "vaqt": vaqt}


def kontur_tuproq_hisobla(tuman_kod=None, chegara=0.5, yoz=lambda s: None):
    """`aniqlanmagan` konturlar: tuproq poligonlari bilan qoplanish ulushi >= `chegara` bo'lsa -> `qx_tuproq`.
    `kontur_tur_hisobla` dan KEYIN ishga tushiriladi (u `qx_tuproq` ni qayta `aniqlanmagan` qiladi).
    `tuman_kod` — `tuman_geo` bo'yicha."""
    t0 = time.perf_counter()
    with connection.cursor() as c:
        if tuman_kod is None:
            shart, p = "TRUE", []
        else:
            shart, p = "k.tuman_geo_id = %s", [_tuman_id(c, tuman_kod)]
        c.execute(
            f"""
            WITH q AS (
                SELECT k.id,
                       sum(ST_Area(ST_Intersection(k.geom, s.geom)::geography))
                         / NULLIF(ST_Area(k.geom::geography), 0) AS ulush
                FROM land_kontur k
                JOIN soil_tuproq s ON s.geom && k.geom AND ST_Intersects(s.geom, k.geom)
                WHERE {shart} AND k.tur = 'aniqlanmagan'
                GROUP BY k.id, k.geom
            )
            UPDATE land_kontur k SET tur = 'qx_tuproq' FROM q
            WHERE k.id = q.id AND q.ulush >= %s
            """,
            [*p, chegara],
        )
        yangilandi = c.rowcount
        c.execute(f"""SELECT k.tur, count(*), COALESCE(sum(k.umumiy_maydoni), 0) FROM land_kontur k
                      WHERE {shart} GROUP BY k.tur ORDER BY k.tur""", p)
        turlar = c.fetchall()
    vaqt = time.perf_counter() - t0
    yoz(f"kontur_tuproq: qx_tuproq ga o'tdi {yangilandi} (chegara {chegara:.0%}); {vaqt:.1f}s")
    for tur, n, ga in turlar:
        yoz(f"  {tur}: {n} kontur, {ga:,.1f} ga")
    return {"yangilandi": yangilandi, "turlar": turlar, "vaqt": vaqt}