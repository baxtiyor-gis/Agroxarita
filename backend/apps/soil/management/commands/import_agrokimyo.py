"""Agrokimyo poligonlarini GIS.gdb dan bazaga yuklash (kaliy; keyin fosfor/gumus ham).

    python manage.py import_agrokimyo --qatlam Kaliy --korsatkich kaliy [--quruq] [--data-dir PAPKA] [--gdb YOL]

Oqim: VectorTranslate -> staging `soil_agrokimyo_staging` (UNLOGGED) -> bitta tranzaksiyada shu `korsatkich`
qatorlarini DELETE + INSERT ... SELECT -> tuman bog'lash (district_cad, keyin eng katta kesishuv) -> ANALYZE.
Idempotent: faqat shu korsatkich almashtiriladi. `--quruq` bazaga yozmaydi.
"""
import re
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from osgeo import gdal, ogr

from apps.soil.models import Agrokimyo

gdal.UseExceptions()
ogr.UseExceptions()

STAGING = "soil_agrokimyo_staging"
NAMUNA_SONI = 1000
USTUNLAR = ["year", "district", "region", "area", "region_cad", "district_cad", "darajasi", "gradatsiyasi",
            "viloyat", "tuman"]
# normallashtirilgan matn (kichik harf, apostrofsiz) -> (kod, nom)
DARAJALAR = {
    "juda kam": (1, "Juda kam"),
    "kam": (2, "Kam"),
    "ortacha": (3, "O'rtacha"),
    "kop": (4, "Ko'p"),
    "juda kop": (5, "Juda ko'p"),
}


def daraja_parse(matn):
    """Apostrof variantlari bilan daraja matni -> (kod, nom); noma'lum yoki bo'sh -> (None, None)."""
    if matn is None:
        return (None, None)
    t = re.sub(r"[^a-z ]", "", " ".join(str(matn).lower().split()))
    return DARAJALAR.get(t, (None, None))


def _pg_ulanish():
    d = connection.settings_dict
    qismlar = {"host": d.get("HOST") or "localhost", "port": d.get("PORT") or "5432",
               "dbname": d["NAME"], "user": d["USER"], "password": d["PASSWORD"]}
    return "PG:" + " ".join(f"{k}={v}" for k, v in qismlar.items() if v)


def _t(ustun):
    return f"NULLIF(btrim(s.{ustun}), '')"


class Command(BaseCommand):
    help = "Agrokimyoni DATA_DIR/GIS.gdb qatlamidan yuklaydi (staging + bitta INSERT ... SELECT)."

    def add_arguments(self, parser):
        parser.add_argument("--qatlam", required=True, help="GDB qatlam nomi (masalan Kaliy)")
        parser.add_argument("--korsatkich", required=True, choices=[k for k, _ in Agrokimyo.KORSATKICH_TANLOV])
        parser.add_argument("--quruq", action="store_true", help="bazaga yozmasdan manba statistikasi")
        parser.add_argument("--data-dir", default=None)
        parser.add_argument("--gdb", default=None, help="manba yo'li (default: <data-dir>/GIS.gdb); testlar uchun")

    def handle(self, *args, **o):
        gdb = Path(o["gdb"]) if o["gdb"] else Path(o["data_dir"] or settings.DATA_DIR) / "GIS.gdb"
        if not gdb.exists():
            raise CommandError(f"Manba topilmadi: {gdb}")
        self.gdb, self.qatlam, self.kors = gdb, o["qatlam"], o["korsatkich"]
        self.vaqt, self.w = [], self.stdout.write
        ds = ogr.Open(str(gdb))
        q = ds.GetLayerByName(self.qatlam)
        if q is None:
            raise CommandError(f"{gdb} da '{self.qatlam}' qatlami yo'q")
        yoq = [u for u in USTUNLAR if q.GetLayerDefn().GetFieldIndex(u) < 0]
        if yoq:
            raise CommandError(f"'{self.qatlam}' da maydonlar yo'q: {', '.join(yoq)}")
        srs = q.GetSpatialRef()
        self.epsg = srs.GetAuthorityCode(None) if srs else None
        q = ds = None
        if o["quruq"]:
            self.w("QURUQ REJIM: bazaga yozilmaydi")
            self.quruq_hisobot()
        else:
            self.yuklash()

    def _bosqich(self, nom, t0):
        self.vaqt.append((nom, time.perf_counter() - t0))

    def _vaqtlar(self):
        self.w("bosqichlar: " + ", ".join(f"{n} {t:.1f}s" for n, t in self.vaqt)
               + f"; jami {sum(t for _, t in self.vaqt):.1f}s")

    # ------------------------------------------------------------------ haqiqiy import
    def yuklash(self):
        try:
            t0 = time.perf_counter()
            gdal.VectorTranslate(
                _pg_ulanish(), str(self.gdb), format="PostgreSQL", layers=[self.qatlam], layerName=STAGING,
                accessMode="overwrite", geometryType="PROMOTE_TO_MULTI", preserveFID=True,
                selectFields=USTUNLAR,
                layerCreationOptions=["GEOMETRY_NAME=geom_src", "FID=manba_fid", "UNLOGGED=YES", "LAUNDER=NO",
                                      "SPATIAL_INDEX=NONE", "GEOM_TYPE=geometry"],
            )
            self._bosqich("staging", t0)
            t0 = time.perf_counter()
            self.tekshir_staging()
            self._bosqich("staging_statistika", t0)
            with transaction.atomic(), connection.cursor() as c:
                t0 = time.perf_counter()
                self.daraja_jadval(c)
                c.execute("DELETE FROM soil_agrokimyo WHERE korsatkich = %s", [self.kors])
                c.execute(self.insert_sql(), [self.kors])
                self.yuklandi = c.rowcount
                self._bosqich("insert", t0)
                t0 = time.perf_counter()
                self.tuman_boglash(c)
                self._bosqich("tuman", t0)
            t0 = time.perf_counter()
            with connection.cursor() as c:
                c.execute("ANALYZE soil_agrokimyo")
            self._bosqich("analyze", t0)
            self.maydon_birligi()
            self.hisobot()
        finally:
            with connection.cursor() as c:
                c.execute(f"DROP TABLE IF EXISTS {STAGING}")

    def tekshir_staging(self):
        with connection.cursor() as c:
            c.execute(f"""
                SELECT count(*),
                       count(*) FILTER (WHERE geom_src IS NULL OR ST_IsEmpty(geom_src)),
                       count(*) FILTER (WHERE geom_src IS NOT NULL AND NOT ST_IsEmpty(geom_src)
                                        AND NOT ST_IsValid(ST_Force2D(geom_src))),
                       count(*) FILTER (WHERE geom_src IS NOT NULL AND ST_CoordDim(geom_src) > 2)
                FROM {STAGING}""")
            self.manba, self.bosh, self.invalid, self.uch_o = c.fetchone()
        if self.manba == 0:
            raise CommandError("Manbada qator yo'q")

    def daraja_jadval(self, c):
        c.execute(f"SELECT DISTINCT darajasi FROM {STAGING} WHERE darajasi IS NOT NULL")
        qiymatlar = [r[0] for r in c.fetchall()]
        c.execute("DROP TABLE IF EXISTS _daraja")
        c.execute("CREATE TEMP TABLE _daraja (src text PRIMARY KEY, kod int, nom text)")
        qatorlar, self.nomalum = [], []
        for q in qiymatlar:
            kod, nom = daraja_parse(q)
            qatorlar.append((q, kod, nom))
            if kod is None and q.strip():
                self.nomalum.append(q)
        c.executemany("INSERT INTO _daraja VALUES (%s, %s, %s)", qatorlar)

    def insert_sql(self):
        return f"""
            INSERT INTO soil_agrokimyo (korsatkich, yil, daraja, daraja_nom, gradatsiya, tuman_id, maydon,
                                        manba, geom, geom_mvt)
            SELECT %s, s.year, d.kod, coalesce(d.nom, ''), coalesce({_t("gradatsiyasi")}, ''), bt.id, s.area,
                   jsonb_build_object('viloyat', {_t("viloyat")}, 'tuman', {_t("tuman")},
                       'darajasi', {_t("darajasi")}, 'region', s.region, 'district', s.district,
                       'region_cad', round(s.region_cad)::int, 'district_cad', round(s.district_cad)::int),
                   g.geom, ST_Transform(g.geom, 3857)
            FROM {STAGING} s
            CROSS JOIN LATERAL (
                SELECT ST_Transform(ST_Multi(ST_CollectionExtract(
                           ST_MakeValid(ST_Force2D(s.geom_src)), 3)), 4326) AS geom
            ) g
            LEFT JOIN _daraja d ON d.src = s.darajasi
            LEFT JOIN border_tuman bt ON bt.kod = round(s.district_cad)::int
            WHERE s.geom_src IS NOT NULL AND NOT ST_IsEmpty(g.geom)
            ORDER BY s.manba_fid"""

    def tuman_boglash(self, c):
        c.execute("SELECT count(*) FROM soil_agrokimyo WHERE korsatkich = %s AND tuman_id IS NOT NULL", [self.kors])
        self.cad_boyicha = c.fetchone()[0]
        c.execute("""
            UPDATE soil_agrokimyo k SET tuman_id = m.id
            FROM (SELECT z.id AS kid, x.id FROM soil_agrokimyo z
                  CROSS JOIN LATERAL (
                      SELECT t.id FROM border_tuman t
                      WHERE t.geom && z.geom AND ST_Intersects(t.geom, z.geom)
                      ORDER BY ST_Area(ST_Intersection(z.geom, t.geom)) DESC, t.id LIMIT 1
                  ) x
                  WHERE z.korsatkich = %s AND z.tuman_id IS NULL) m
            WHERE k.id = m.kid""", [self.kors])
        self.geometrik = c.rowcount
        c.execute("SELECT count(*) FROM soil_agrokimyo WHERE korsatkich = %s AND tuman_id IS NULL", [self.kors])
        self.boglanmagan = c.fetchone()[0]

    def maydon_birligi(self):
        """area / (ST_Area(geography)/10000) - tasodifiy 1000 poligon."""
        t0 = time.perf_counter()
        with connection.cursor() as c:
            c.execute(f"""
                SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY nisbat),
                       percentile_cont(0.1) WITHIN GROUP (ORDER BY nisbat),
                       percentile_cont(0.9) WITHIN GROUP (ORDER BY nisbat)
                FROM (SELECT maydon / (ST_Area(geom::geography) / 10000.0) AS nisbat
                      FROM (SELECT maydon, geom FROM soil_agrokimyo
                            WHERE korsatkich = %s AND maydon > 0 ORDER BY random() LIMIT {NAMUNA_SONI}) q) n
                WHERE nisbat IS NOT NULL""", [self.kors])
            self.nisbat = c.fetchone()
        self._bosqich("maydon_tekshiruvi", t0)

    def hisobot(self):
        w = self.w
        with connection.cursor() as c:
            c.execute("SELECT count(*), coalesce(sum(maydon), 0) FROM soil_agrokimyo WHERE korsatkich = %s",
                      [self.kors])
            jami, maydon = c.fetchone()
            c.execute("""SELECT yil, coalesce(daraja::text, '?'), count(*) FROM soil_agrokimyo
                         WHERE korsatkich = %s GROUP BY 1, 2 ORDER BY 1, 2""", [self.kors])
            taqsimot = {}
            for yil, daraja, n in c.fetchall():
                taqsimot.setdefault(yil, []).append(f"{daraja}={n}")
        w("\n=== HISOBOT ===")
        w(f"{self.kors}: manba {self.manba}, yuklandi {self.yuklandi}, o'tkazildi {self.manba - self.yuklandi} "
          f"(bo'sh/NULL geometriya {self.bosh}); CRS EPSG:{self.epsg}")
        w(f"  geometriyasi tuzatildi (invalid -> ST_MakeValid): {self.invalid}; 3D/M -> 2D: {self.uch_o}")
        w(f"  bazada: {jami} qator, maydon yig'indisi {maydon:,.0f}")
        w(f"  tuman: district_cad bo'yicha {self.cad_boyicha}, geometrik {self.geometrik}, "
          f"bog'lanmagan {self.boglanmagan}")
        w("  yil x daraja: " + "; ".join(f"{y}: " + " ".join(v) for y, v in taqsimot.items()))
        w(f"  noma'lum daraja matnlari (daraja NULL): {self.nomalum or 'yoq'}")
        n, med, p10, p90 = self.nisbat
        if n:
            w(f"  maydon birligi: area / (ST_Area(geography)/10000): n={n}, "
              f"mediana {med:.4f}, p10 {p10:.4f}, p90 {p90:.4f} (1.0 = gektar)")
        self._vaqtlar()

    # ------------------------------------------------------------------ quruq
    def quruq_hisobot(self):
        t0 = time.perf_counter()
        ds = ogr.Open(str(self.gdb))
        q = ds.GetLayerByName(self.qatlam)
        q.SetIgnoredFields(["OGR_GEOMETRY"] + [d.name for d in q.schema if d.name not in USTUNLAR])
        jami = cad_bosh = 0
        yillar, matnlar = {}, {}
        for f in q:
            jami += 1
            cad_bosh += f["district_cad"] is None
            d = f["darajasi"]
            matnlar[d] = matnlar.get(d, 0) + 1
            kalit = (f["year"], daraja_parse(d)[0])
            yillar[kalit] = yillar.get(kalit, 0) + 1
        self._bosqich("manbani o'qish", t0)
        w = self.w
        w("\n=== HISOBOT (quruq) ===")
        w(f"{self.kors}: manba {jami}, CRS EPSG:{self.epsg}, district_cad NULL: {cad_bosh}")
        w("  yil/daraja: " + "; ".join(f"{y}/{k}: {n}" for (y, k), n in sorted(
            yillar.items(), key=lambda x: (x[0][0] or 0, x[0][1] or 0))))
        nomalum = {m: n for m, n in matnlar.items() if m and daraja_parse(m)[0] is None}
        w(f"  noma'lum daraja matnlari: {nomalum or 'yoq'}")
        self._vaqtlar()
