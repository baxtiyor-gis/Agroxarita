"""Ekinlarni GIS.gdb `Crop_<yil>` qatlamidan konturlarga bog'lash.

    python manage.py import_ekin --yil 2026 [--viloyat 11 12 ...] [--qayta] [--data-dir PAPKA]
                                 [--gdb YOL] [--qatlam NOM]

Manba (gdb, qatlam) — `apps.crop.yillar.MANBALAR` (yil bo'yicha) yoki `--gdb`/`--qatlam`; ikkalasi ham yo'q bo'lsa
`data/GIS.gdb` va `Crop_<yil>`. Nisbiy `--gdb` yo'li data papkasiga nisbatan olinadi.

Oqim: domen -> EkinClass (upsert); VectorTranslate (faqat crop_name, crop_area, kontur_raqami, district,
geometriya; EPSG:4326) -> staging `ekin_staging` (UNLOGGED, MakeValid, GIST) -> bloklar bo'yicha fazoviy
bog'lash: har ekin poligoni uchun eng katta kesishuvli kontur, kesishuv/poligon >= 0.5 bo'lsa bog'lanadi ->
(kontur, ekin) bo'yicha jamlab KonturEkin. Idempotent: yil bo'yicha o'chirib qayta yoziladi (mavjud bo'lsa
`--qayta` kerak). `--viloyat` (region_id) — faqat shu viloyatlarga tegadigan poligonlar va shu viloyat konturlari.
"""
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from osgeo import gdal, ogr

from apps.border.management.commands.import_border import nom_tozala
from apps.crop.models import EkinClass
from apps.crop.yillar import manba, tozala
from apps.soil.normalizatsiya import kirill_lotin

gdal.UseExceptions()
ogr.UseExceptions()

STAGING = "ekin_staging"
BOGLASH = "ekin_boglash"
BLOK = 20000  # staging manba_fid // BLOK — bitta bog'lash bloki
MIN_ULUSH = 0.5
USTUNLAR = ["crop_name", "crop_area", "kontur_raqami", "district"]


def _pg_ulanish():
    d = connection.settings_dict
    qismlar = {"host": d.get("HOST") or "localhost", "port": d.get("PORT") or "5432",
               "dbname": d["NAME"], "user": d["USER"], "password": d["PASSWORD"]}
    return "PG:" + " ".join(f"{k}={v}" for k, v in qismlar.items() if v)


def kirillmi(matn):
    return any("Ѐ" <= h <= "ӿ" for h in matn)


def domenni_oqi(ds, qatlam_nomi):
    """{kod(int): nom} — qatlamdagi crop_name maydonining domeni (domen nomi maydondan olinadi; yo'q -> {})."""
    qatlam = ds.GetLayerByName(qatlam_nomi)
    if qatlam is None:
        raise CommandError(f"'{qatlam_nomi}' qatlami yo'q")
    defn = qatlam.GetLayerDefn()
    i = defn.GetFieldIndex("crop_name")
    if i < 0:
        raise CommandError("'crop_name' maydoni yo'q")
    nom = defn.GetFieldDefn(i).GetDomainName()
    if not nom:
        return {}
    return {int(k): v for k, v in ds.GetFieldDomain(nom).GetEnumeration().items()}


class Command(BaseCommand):
    help = "Ekinlarni GIS.gdb Crop_<yil> qatlamidan konturlarga fazoviy bog'laydi (KonturEkin)."

    def add_arguments(self, parser):
        parser.add_argument("--yil", type=int, required=True)
        parser.add_argument("--viloyat", type=int, nargs="+", default=None, help="region_id ro'yxati")
        parser.add_argument("--qayta", action="store_true", help="yil uchun mavjud yozuvlarni o'chirib qayta yozish")
        parser.add_argument("--data-dir", default=None)
        parser.add_argument("--gdb", default=None, help="manba GDB yo'li (default: yillar.MANBALAR yoki GIS.gdb)")
        parser.add_argument("--qatlam", default=None, help="qatlam nomi (default: yillar.MANBALAR yoki Crop_<yil>)")

    def handle(self, *args, **o):
        data = Path(o["data_dir"] or settings.DATA_DIR)
        if o["gdb"]:
            gdb, qatlam = o["gdb"], f"Crop_{o['yil']}"
        else:
            gdb, qatlam = manba(o["yil"])
        gdb = data / gdb  # mutlaq yo'l bo'lsa o'zi qoladi
        if not gdb.exists():
            raise CommandError(f"Manba topilmadi: {gdb}")
        self.gdb, self.yil, self.viloyat = gdb, o["yil"], o["viloyat"]
        self.qatlam = o["qatlam"] or qatlam
        self.vaqt, self.w = [], self.stdout.write
        self.tekshir_mavjud(o["qayta"])
        try:
            self.yuklash()
        finally:
            tozala()
            with connection.cursor() as c:
                c.execute(f"DROP TABLE IF EXISTS {STAGING}, {BOGLASH}")

    def _bosqich(self, nom, t0):
        self.vaqt.append((nom, time.perf_counter() - t0))

    def _kontur_sharti(self, alias="k"):
        """(sql, params): --viloyat bo'lsa shu viloyat konturlari."""
        if not self.viloyat:
            return "TRUE", []
        return (f"COALESCE({alias}.tuman_geo_id, {alias}.tuman_id) IN "
                "(SELECT t.id FROM border_tuman t JOIN border_viloyat v ON v.id = t.viloyat_id "
                "WHERE v.region_id = ANY(%s))", [self.viloyat])

    def tekshir_mavjud(self, qayta):
        shart, params = self._kontur_sharti("k")
        with connection.cursor() as c:
            c.execute(f"SELECT count(*) FROM crop_konturekin e JOIN land_kontur k ON k.id = e.kontur_id "
                      f"WHERE e.yil = %s AND {shart}", [self.yil, *params])
            bor = c.fetchone()[0]
        if bor and not qayta:
            raise CommandError(f"{self.yil} yil uchun {bor} yozuv bor; qayta yozish uchun --qayta bering")

    def yuklash(self):
        t0 = time.perf_counter()
        self.lugat_yukla()
        self._bosqich("lugat", t0)
        t0 = time.perf_counter()
        self.staging_yoz()
        self._bosqich("staging", t0)
        t0 = time.perf_counter()
        self.boglash()
        self._bosqich("boglash", t0)
        t0 = time.perf_counter()
        self.yoz()
        self._bosqich("yozish", t0)
        self.hisobot()

    def lugat_yukla(self):
        ds = ogr.Open(str(self.gdb))
        domen = domenni_oqi(ds, self.qatlam)
        ds = None
        # lotin domen — nom yangilanadi; kirill domen — faqat yangi kodlar (transliteratsiya), mavjud nom saqlanadi
        self.yangi_kodlar = []
        with transaction.atomic():
            for kod, nom in domen.items():
                if kirillmi(nom):
                    _, yaratildi = EkinClass.objects.get_or_create(
                        kod=kod, defaults={"nom": nom_tozala(kirill_lotin(nom))})
                else:
                    _, yaratildi = EkinClass.objects.update_or_create(kod=kod, defaults={"nom": nom_tozala(nom)})
                if yaratildi:
                    self.yangi_kodlar.append(kod)
        self.lugat_soni = len(domen)

    def staging_yoz(self):
        with connection.cursor() as c:
            c.execute(f"DROP TABLE IF EXISTS {STAGING}, {BOGLASH}")
        gdal.VectorTranslate(
            _pg_ulanish(), str(self.gdb), format="PostgreSQL", layers=[self.qatlam], layerName=STAGING,
            accessMode="overwrite", geometryType="PROMOTE_TO_MULTI", preserveFID=True, dstSRS="EPSG:4326",
            selectFields=USTUNLAR,
            layerCreationOptions=["GEOMETRY_NAME=geom_src", "FID=manba_fid", "UNLOGGED=YES", "LAUNDER=NO",
                                  "SPATIAL_INDEX=NONE", "GEOM_TYPE=geometry"],
        )
        with connection.cursor() as c:
            c.execute(f"SELECT count(*), count(*) FILTER (WHERE geom_src IS NOT NULL AND NOT ST_IsEmpty(geom_src) "
                      f"AND NOT ST_IsValid(ST_Force2D(geom_src))) FROM {STAGING}")
            self.manba, self.invalid = c.fetchone()
            if self.manba == 0:
                raise CommandError("Manbada qator yo'q")
            c.execute(f"ALTER TABLE {STAGING} ADD COLUMN geom geometry(MultiPolygon, 4326), "
                      "ADD COLUMN pmaydon float8, ADD COLUMN blok int")
            c.execute(f"""
                UPDATE {STAGING} SET geom = g.geom, blok = manba_fid / {BLOK}
                FROM (SELECT manba_fid AS fid,
                             ST_Multi(ST_CollectionExtract(ST_MakeValid(ST_Force2D(geom_src)), 3)) AS geom
                      FROM {STAGING} WHERE geom_src IS NOT NULL AND NOT ST_IsEmpty(geom_src)) g
                WHERE {STAGING}.manba_fid = g.fid""")
            c.execute(f"DELETE FROM {STAGING} WHERE geom IS NULL OR ST_IsEmpty(geom)")
            self.bosh = c.rowcount
            c.execute(f"ALTER TABLE {STAGING} DROP COLUMN geom_src")
            c.execute(f"CREATE INDEX {STAGING}_geom_idx ON {STAGING} USING gist (geom)")
            if self.viloyat:
                c.execute(f"""
                    DELETE FROM {STAGING} s WHERE NOT EXISTS
                      (SELECT 1 FROM border_viloyat v WHERE v.region_id = ANY(%s)
                       AND v.geom && s.geom AND ST_Intersects(v.geom, s.geom))""", [self.viloyat])
            c.execute(f"UPDATE {STAGING} SET pmaydon = ST_Area(geom::geography) / 10000.0")  # ga
            c.execute(f"ANALYZE {STAGING}")
            c.execute(f"SELECT count(*), coalesce(sum(pmaydon), 0) FROM {STAGING}")
            self.jami, self.jami_ga = c.fetchone()

    def boglash(self):
        shart, kparams = self._kontur_sharti("k")
        with connection.cursor() as c:
            c.execute(f"CREATE UNLOGGED TABLE {BOGLASH} (kontur_id bigint, kod int, kesishuv float8, poligon float8)")
            c.execute(f"SELECT DISTINCT blok FROM {STAGING} ORDER BY 1")
            bloklar = [r[0] for r in c.fetchall()]
            for blok in bloklar:
                c.execute(f"""
                    INSERT INTO {BOGLASH} (kontur_id, kod, kesishuv, poligon)
                    SELECT b.kid, s.crop_name, b.inter, s.pmaydon
                    FROM {STAGING} s
                    CROSS JOIN LATERAL (
                        SELECT k.id AS kid, ST_Area(ST_Intersection(k.geom, s.geom)::geography) / 10000.0 AS inter
                        FROM land_kontur k
                        WHERE k.geom && s.geom AND ST_Intersects(k.geom, s.geom) AND {shart}
                        ORDER BY inter DESC, k.id LIMIT 1
                    ) b
                    WHERE s.blok = %s AND s.crop_name IS NOT NULL AND s.pmaydon > 0
                      AND b.inter / s.pmaydon >= {MIN_ULUSH}""", [*kparams, blok])
            c.execute(f"SELECT count(*), coalesce(sum(poligon), 0), count(DISTINCT kontur_id) FROM {BOGLASH}")
            self.boglangan, self.boglangan_ga, self.boglangan_kontur = c.fetchone()
            c.execute(f"""SELECT b.kod, count(*), sum(b.poligon) FROM {BOGLASH} b
                          WHERE NOT EXISTS (SELECT 1 FROM crop_ekinclass e WHERE e.kod = b.kod)
                          GROUP BY 1 ORDER BY 2 DESC""")
            self.lugatsiz = c.fetchall()

    def yoz(self):
        shart, kparams = self._kontur_sharti("k")
        with transaction.atomic(), connection.cursor() as c:
            c.execute(f"""DELETE FROM crop_konturekin e USING land_kontur k
                          WHERE k.id = e.kontur_id AND e.yil = %s AND {shart}""", [self.yil, *kparams])
            self.ochirildi = c.rowcount
            c.execute(f"""
                INSERT INTO crop_konturekin (kontur_id, yil, ekin_id, maydon, ulush, asosiy)
                SELECT q.kontur_id, %s, q.ekin_id, q.maydon, q.ulush,
                       row_number() OVER (PARTITION BY q.kontur_id ORDER BY q.maydon DESC, q.kod) = 1
                FROM (
                    SELECT a.kontur_id, e.id AS ekin_id, a.kod,
                           LEAST(a.kesishuv, ST_Area(k.geom::geography) / 10000.0) AS maydon,
                           LEAST(1.0, a.kesishuv / NULLIF(a.poligon, 0)) AS ulush
                    FROM (SELECT kontur_id, kod, sum(kesishuv) AS kesishuv, sum(poligon) AS poligon
                          FROM {BOGLASH} GROUP BY 1, 2) a
                    JOIN crop_ekinclass e ON e.kod = a.kod
                    JOIN land_kontur k ON k.id = a.kontur_id
                ) q""", [self.yil])
            self.yozildi = c.rowcount
        with connection.cursor() as c:
            c.execute("ANALYZE crop_konturekin")

    def hisobot(self):
        w = self.w
        with connection.cursor() as c:
            c.execute("""SELECT count(DISTINCT kontur_id), coalesce(sum(maydon), 0) FROM crop_konturekin
                         WHERE yil = %s""", [self.yil])
            kontur_soni, ga = c.fetchone()
            c.execute("""SELECT e.kod, e.nom, sum(x.maydon) FROM crop_konturekin x
                         JOIN crop_ekinclass e ON e.id = x.ekin_id WHERE x.yil = %s
                         GROUP BY 1, 2 ORDER BY 3 DESC LIMIT 10""", [self.yil])
            top = c.fetchall()
        w(f"\n=== HISOBOT {self.qatlam} ===")
        w(f"manba {self.manba} poligon (bo'sh geometriya {self.bosh}, MakeValid: {self.invalid}); "
          f"ishlangan {self.jami}, {self.jami_ga:,.0f} ga; lug'at {self.lugat_soni} kod"
          f" (yangi {len(self.yangi_kodlar)})")
        w(f"bog'langan (>= {MIN_ULUSH}): {self.boglangan} poligon, {self.boglangan_ga:,.0f} ga; "
          f"bog'lanmagan: {self.jami - self.boglangan} poligon, {self.jami_ga - self.boglangan_ga:,.0f} ga")
        if self.lugatsiz:
            w("lug'atda yo'q kodlar (tashlandi): " + ", ".join(f"{k}: {n}" for k, n, _ in self.lugatsiz))
        w(f"KonturEkin: o'chirildi {self.ochirildi}, yozildi {self.yozildi}; ekinli konturlar (yil {self.yil}): "
          f"{kontur_soni}, jami {ga:,.0f} ga")
        w("top-10 ekin (ga): " + "; ".join(f"{nom} {m:,.0f}" for _, nom, m in top))
        w("bosqichlar: " + ", ".join(f"{n} {t:.1f}s" for n, t in self.vaqt)
          + f"; jami {sum(t for _, t in self.vaqt):.1f}s")
