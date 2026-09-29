"""Vektor tile'lar: ST_AsMVT + ST_AsMVTGeom. Qatlam nomi — oq ro'yxatdan, qiymatlar — parametrlar bilan."""
from django.conf import settings
from django.db import connection
from django.http import HttpResponse, JsonResponse
from django.views.decorators.http import require_GET

from apps.border.models import Massiv, Tuman, Viloyat
from apps.land.models import Kontur

MVT_TURI = "application/vnd.mapbox-vector-tile"
EXTENT = 4096
BUFFER = 64
QUYI_ZOOM_CHEGARA = 9  # z < 9 -> geom_mvt_s, z >= 9 -> geom_mvt
SODDALASH_MAX_ZOOM = 12  # shundan yuqorida qo'shimcha soddalashtirish yo'q
EKVATOR_M = 40075016.6856

# qatlam -> zoom oralig'i, FROM/JOIN, atributlar, filtr parametri -> WHERE sharti
# (barchasi kod ichida; foydalanuvchi kiritgan qiymat faqat %s parametr sifatida)
QATLAMLAR = {
    "viloyat": {
        "zoom": (0, 14),
        "jadval": f"{Viloyat._meta.db_table} t",
        "atributlar": "t.region_id, t.nom",
        "filtrlar": {},
    },
    "tuman": {
        "zoom": (5, 14),
        "jadval": f"{Tuman._meta.db_table} t JOIN {Viloyat._meta.db_table} v ON v.id = t.viloyat_id",
        "atributlar": "t.kod, t.nom, t.tip, v.region_id",
        "filtrlar": {"viloyat": "v.region_id = %s"},
    },
    "massiv": {
        "zoom": (9, 16),
        "filtr_zoom_min": 6,  # ?tuman= berilganda z >= 6 dan (z < 9 da geom_mvt_s)
        "jadval": f"{Massiv._meta.db_table} t JOIN {Tuman._meta.db_table} d ON d.id = t.tuman_id",
        "atributlar": "t.massiv_id, t.nom, d.kod",
        "filtrlar": {"tuman": "d.kod = %s"},
    },
    # maska: tile to'rtburchagi minus tuman (alohida SQL — maska_sql); ?tuman majburiy
    "maska": {"zoom": (0, 16), "filtrlar": {"tuman": None}, "majburiy": ("tuman",)},
    # konturlar: alohida SQL (kontur_sql); ?tuman majburiy
    "kontur": {"zoom": (9, 18), "filtrlar": {"tuman": None}, "majburiy": ("tuman",)},
}

KONTUR_SODDALASH_MAX_ZOOM = 12  # z < 13 — soddalashtirish va mayda konturlarni tashlash


def _xato(xabar, status):
    return JsonResponse({"detail": xabar}, status=status)


def tile_sql(qatlam, z, filtrlar):
    """(sql, params). Params tartibi: z, x, y (o'zingiz qo'shasiz), qatlam, [tolerantlik], filtrlar."""
    sozlama = QATLAMLAR[qatlam]
    ustun = "t.geom_mvt_s" if z < QUYI_ZOOM_CHEGARA else "t.geom_mvt"
    if z <= SODDALASH_MAX_ZOOM:
        geom_ifoda = f"ST_SimplifyPreserveTopology({ustun}, %s)"
        tolerantlik = [EKVATOR_M / (256 * 2**z) / 4]  # ~1/4 piksel (metr)
    else:
        geom_ifoda = ustun
        tolerantlik = []
    shartlar = [f"{ustun} && tile.env"]
    filtr_params = []
    for nom, qiymat in filtrlar.items():
        shartlar.append(sozlama["filtrlar"][nom])
        filtr_params.append(qiymat)
    sql = f"""
        WITH tile AS (SELECT ST_TileEnvelope(%s, %s, %s) AS env)
        SELECT ST_AsMVT(q, %s, {EXTENT}, 'geom')
        FROM (
            SELECT {sozlama['atributlar']},
                   ST_AsMVTGeom({geom_ifoda}, tile.env, {EXTENT}, {BUFFER}, true) AS geom
            FROM {sozlama['jadval']}, tile
            WHERE {' AND '.join(shartlar)}
        ) q
        WHERE q.geom IS NOT NULL
    """
    return sql, tolerantlik, filtr_params


def _maska_geom_sql(z):
    """Maska geometriyasi (3857): buffer'ga kengaytirilgan tile minus tuman — seam bo'lmasligi uchun.
    Params: z, x, y, z, x, y, tuman kodi. Tile to'liq tuman ichida (ST_Covers) -> NULL."""
    ustun = "d.geom_mvt_s" if z < QUYI_ZOOM_CHEGARA else "d.geom_mvt"
    return f"""
        WITH tile AS (
            SELECT ST_TileEnvelope(%s, %s, %s) AS env,
                   ST_TileEnvelope(%s, %s, %s, margin => {BUFFER}.0 / {EXTENT}) AS benv
        )
        SELECT tile.env,
               CASE WHEN NOT ({ustun} && tile.benv AND ST_Intersects({ustun}, tile.benv)) THEN tile.benv
                    WHEN ST_Covers({ustun}, tile.env) THEN NULL
                    ELSE ST_Difference(tile.benv, {ustun}) END AS geom
        FROM {Tuman._meta.db_table} d, tile
        WHERE d.kod = %s
    """


def maska_sql(z):
    """(sql). Params: qatlam, z, x, y, z, x, y, tuman kodi."""
    return f"""
        SELECT ST_AsMVT(q, %s, {EXTENT}, 'geom')
        FROM (
            SELECT ST_AsMVTGeom(m.geom, m.env, {EXTENT}, {BUFFER}, true) AS geom
            FROM ({_maska_geom_sql(z)}) m
        ) q
        WHERE q.geom IS NOT NULL
    """


def kontur_sql(z):
    """(sql, tolerantlik). Params: z, x, y, qatlam, [tolerantlik], tuman_id. z >= 13 — soddalashtirishsiz."""
    if z <= KONTUR_SODDALASH_MAX_ZOOM:
        piksel = EKVATOR_M / (256 * 2**z)  # metr
        # oldindan soddalashtirilgan geom_mvt_s (~19 m) ustida tez ST_Simplify; NULL bo'lsa geom_mvt
        geom_ifoda = "ST_Simplify(COALESCE(t.geom_mvt_s, t.geom_mvt), %s, true)"
        tolerantlik = [piksel / 2]
        # piksel'dan kichik konturlar soddalashtirishdan OLDIN tashlanadi (maydon_mvt — oldindan hisoblangan)
        maydon_sharti = f" AND (t.maydon_mvt IS NULL OR t.maydon_mvt >= {piksel * piksel!r})"
    else:
        geom_ifoda, tolerantlik, maydon_sharti = "t.geom_mvt", [], ""
    sql = f"""
        WITH tile AS (SELECT ST_TileEnvelope(%s, %s, %s) AS env)
        SELECT ST_AsMVT(q, %s, {EXTENT}, 'geom')
        FROM (
            SELECT t.id, t.kontur_raqami, ROUND(t.umumiy_maydoni::numeric, 2)::float8 AS maydon, t.tur,
                   ST_AsMVTGeom({geom_ifoda}, tile.env, {EXTENT}, {BUFFER}, true) AS geom
            FROM {Kontur._meta.db_table} t, tile
            -- tuman_geo hali hisoblanmagan konturlar uchun vaqtincha manba tumani (distrikt_id)
            WHERE COALESCE(t.tuman_geo_id, t.tuman_id) = %s AND t.geom_mvt && tile.env{maydon_sharti}
        ) q
        WHERE q.geom IS NOT NULL
    """
    return sql, tolerantlik


@require_GET
def tile(request, qatlam, z, x, y):
    if qatlam not in QATLAMLAR:
        return _xato(f"Noma'lum qatlam: '{qatlam}'. Mavjudlari: {', '.join(QATLAMLAR)}.", 404)
    z, x, y = int(z), int(x), int(y)
    if not 0 <= z <= 22:
        return _xato("z 0 dan 22 gacha bo'lishi kerak.", 400)
    n = 2**z
    if not (0 <= x < n and 0 <= y < n):
        return _xato(f"z={z} uchun x va y 0 dan {n - 1} gacha bo'lishi kerak.", 400)

    sozlama = QATLAMLAR[qatlam]
    filtrlar = {}
    for nom in sozlama["filtrlar"]:
        xom = request.GET.get(nom)
        if xom not in (None, ""):
            try:
                filtrlar[nom] = int(xom.strip())
            except ValueError:
                return _xato(f"'{nom}' parametri butun son bo'lishi kerak.", 400)

    for nom in sozlama.get("majburiy", ()):
        if nom not in filtrlar:
            return _xato(f"'{nom}' parametri majburiy.", 400)
    tuman_id = None
    if qatlam in ("maska", "kontur"):
        tuman_id = Tuman.objects.filter(kod=filtrlar["tuman"]).values_list("id", flat=True).first()
        if tuman_id is None:
            return _xato(f"kod={filtrlar['tuman']} tuman topilmadi.", 404)

    min_z, max_z = sozlama["zoom"]
    if filtrlar and "filtr_zoom_min" in sozlama:
        min_z = sozlama["filtr_zoom_min"]
    if not min_z <= z <= max_z:
        return HttpResponse(status=204)

    if qatlam == "maska":
        sql, params = maska_sql(z), [qatlam, z, x, y, z, x, y, filtrlar["tuman"]]
    elif qatlam == "kontur":
        sql, tolerantlik = kontur_sql(z)
        params = [z, x, y, qatlam, *tolerantlik, tuman_id]
    else:
        sql, tolerantlik, filtr_params = tile_sql(qatlam, z, filtrlar)
        params = [z, x, y, qatlam, *tolerantlik, *filtr_params]
    with connection.cursor() as cursor:
        cursor.execute(sql, params)
        mvt = cursor.fetchone()[0]
    mvt = bytes(mvt) if mvt else b""
    if not mvt:
        return HttpResponse(status=204)
    javob = HttpResponse(mvt, content_type=MVT_TURI)
    javob["Cache-Control"] = kesh_sarlavhasi()
    return javob


def kesh_sarlavhasi():
    """`TILE_CACHE_MAX_AGE` (settings) bo'yicha; 0 — kesh yo'q (dev)."""
    soniya = settings.TILE_CACHE_MAX_AGE
    return f"public, max-age={soniya}" if soniya > 0 else "no-cache"
