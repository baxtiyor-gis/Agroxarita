"""Konturlarni GIS.gdb `contour` qatlamidan bazaga yuklash.

    python manage.py import_kontur [--tuman KOD] [--quruq] [--data-dir PAPKA] [--gdb YOL]

Oqim: GDAL VectorTranslate -> staging jadval `land_kontur_staging` (UNLOGGED) -> bitta tranzaksiyada
TRUNCATE/DELETE + `INSERT ... SELECT` -> ANALYZE -> staging o'chiriladi. `--quruq` bazaga yozmaydi.
"""
import time
from collections import Counter
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from osgeo import gdal, ogr

from apps.land.bog_lash import kontur_tuman_hisobla, kontur_tur_hisobla
from apps.land.models import Kontur

gdal.UseExceptions()
ogr.UseExceptions()

STAGING = "land_kontur_staging"
QATLAM = "contour"
NAMUNA_SONI = 1000
MATN_MAYDONLARI = ("yagona_kontur", "eski_kontur", "satr", "izox")
APOSTROFLI_MAYDONLAR = ("mfy", "massiv")
# normalizatsiya.py dagi _APOSTROFLAR bilan bir xil (SQL literal uchun ' ikkilangan)
_APOSTROF_SINF = "[‘’''`ʻʼ´′]"
_MAXSUS = {"id", "manba_fid", "tuman", "tuman_geo", "tur", "kontur_raqami", "geom", "geom_mvt", "geom_mvt_s", "maydon_mvt"}


def matn_sql(ustun, apostrof=False):
    """SQL: bo'shliqlar kesiladi/birlashtiriladi, bo'sh -> NULL; apostrof normalizatsiya.apostrof kabi.

    o/g dan keyin -> U+2018, qolgan hammasi -> U+2019 (oraliq belgi chr(1)).
    """
    ifoda = f"s.{ustun}"
    if apostrof:
        ifoda = (
            f"replace(regexp_replace(regexp_replace({ifoda}, '(?<=[oOgG]){_APOSTROF_SINF}', chr(1), 'g'), "
            f"'{_APOSTROF_SINF}', E'\\u2019', 'g'), chr(1), E'\\u2018')"
        )
    return f"NULLIF(btrim(regexp_replace({ifoda}, '\\s+', ' ', 'g')), '')"


def _ustunlar():
    return [f.column for f in Kontur._meta.concrete_fields if f.name not in _MAXSUS]


def _pg_ulanish():
    d = connection.settings_dict
    qismlar = {"host": d.get("HOST") or "localhost", "port": d.get("PORT") or "5432",
               "dbname": d["NAME"], "user": d["USER"], "password": d["PASSWORD"]}
    return "PG:" + " ".join(f"{k}={v}" for k, v in qismlar.items() if v)


class Command(BaseCommand):
    help = "Konturlarni DATA_DIR/GIS.gdb `contour` qatlamidan yuklaydi (staging + bitta INSERT ... SELECT)."

    def add_arguments(self, parser):
        parser.add_argument("--tuman", type=int, default=None, help="faqat shu tuman kodi (distrikt_id)")
        parser.add_argument("--quruq", action="store_true", help="bazaga yozmasdan manba statistikasi")
        parser.add_argument("--data-dir", default=None, help="manbalar papkasi (default: DATA_DIR)")
        parser.add_argument("--gdb", default=None, help="manba yo'li (default: <data-dir>/GIS.gdb); testlar uchun")

    def handle(self, *args, **o):
        gdb = Path(o["gdb"]) if o["gdb"] else Path(o["data_dir"] or settings.DATA_DIR) / "GIS.gdb"
        if not gdb.exists():
            raise CommandError(f"Manba topilmadi: {gdb}")
        self.tuman, self.vaqt, self.gdb, self.w = o["tuman"], [], gdb, self.stdout.write
        if o["quruq"]:
            self.w("QURUQ REJIM: bazaga yozilmaydi")
            self.quruq_hisobot()
        else:
            self.yuklash()

    # ------------------------------------------------------------------ yordamchi
    def _bosqich(self, nom, t0):
        self.vaqt.append((nom, time.perf_counter() - t0))

    def _vaqtlar(self):
        self.w("bosqichlar: " + ", ".join(f"{n} {t:.1f}s" for n, t in self.vaqt)
               + f"; jami {sum(t for _, t in self.vaqt):.1f}s")

    # ------------------------------------------------------------------ haqiqiy import
    def yuklash(self):
        try:
            t0 = time.perf_counter()
            self.staging_yoz()
            self._bosqich("staging", t0)
            t0 = time.perf_counter()
            self.tekshir_staging()
            self._bosqich("staging_statistika", t0)
            with transaction.atomic(), connection.cursor() as c:
                t0 = time.perf_counter()
                if self.tuman is None:
                    c.execute("TRUNCATE land_kontur")
                    ochirildi = None
                else:
                    c.execute("DELETE FROM land_kontur WHERE tuman_id IN (SELECT id FROM border_tuman WHERE kod = %s)",
                              [self.tuman])
                    ochirildi = c.rowcount
                self._bosqich("tozalash", t0)
                t0 = time.perf_counter()
                c.execute(self.insert_sql())
                self.yuklandi = c.rowcount
                self._bosqich("insert", t0)
            t0 = time.perf_counter()
            with connection.cursor() as c:
                c.execute("ANALYZE land_kontur")
            self._bosqich("analyze", t0)
            t0 = time.perf_counter()
            try:
                kontur_tuman_hisobla(self.tuman, self.w)
                self._bosqich("kontur_tuman", t0)
                t0 = time.perf_counter()
                kontur_tur_hisobla(self.tuman, self.w)
            except ValueError as e:  # --tuman kodi bazada yo'q: bog'lash/tur o'tkazib yuboriladi
                self.w(f"kontur_tuman/kontur_tur o'tkazildi: {e}")
            self._bosqich("kontur_tur", t0)
            self.maydon_birligi()
            self.hisobot(ochirildi)
        finally:
            with connection.cursor() as c:
                c.execute(f"DROP TABLE IF EXISTS {STAGING}")

    def staging_yoz(self):
        where = f"distrikt_id = {int(self.tuman)}" if self.tuman is not None else None
        gdal.VectorTranslate(
            _pg_ulanish(), str(self.gdb), format="PostgreSQL", layers=[QATLAM], layerName=STAGING,
            accessMode="overwrite", where=where, geometryType="PROMOTE_TO_MULTI", preserveFID=True,
            layerCreationOptions=["GEOMETRY_NAME=geom_src", "FID=manba_fid", "UNLOGGED=YES", "LAUNDER=NO",
                                  "SPATIAL_INDEX=NONE", "GEOM_TYPE=geometry"],
        )

    def tekshir_staging(self):
        with connection.cursor() as c:
            c.execute(f"""
                SELECT count(*),
                       count(*) FILTER (WHERE geom_src IS NULL OR ST_IsEmpty(geom_src)),
                       count(*) FILTER (WHERE geom_src IS NOT NULL AND NOT ST_IsEmpty(geom_src)
                                        AND NOT ST_IsValid(ST_Force2D(geom_src))),
                       count(*) FILTER (WHERE geom_src IS NOT NULL AND ST_CoordDim(geom_src) > 2),
                       count(*) FILTER (WHERE NOT EXISTS (SELECT 1 FROM border_tuman t WHERE t.kod = s.distrikt_id))
                FROM {STAGING} s""")
            self.manba, self.bosh, self.invalid, self.uch_o, self.boglanmagan = c.fetchone()
            c.execute(f"""
                SELECT count(*), coalesce(sum(n), 0) FROM (
                  SELECT count(*) n FROM {STAGING} WHERE kontur_raqami IS NOT NULL
                  GROUP BY distrikt_id, kontur_raqami HAVING count(*) > 1) x""")
            self.takror_guruh, self.takror_qator = c.fetchone()
        if self.manba == 0:
            raise CommandError("Manbada tanlangan qator yo'q" + (f" (tuman {self.tuman})" if self.tuman else ""))

    def insert_sql(self):
        ustunlar = _ustunlar()
        tanlash = [
            matn_sql(u) if u in MATN_MAYDONLARI else matn_sql(u, apostrof=True) if u in APOSTROFLI_MAYDONLAR
            else f"s.{u}"
            for u in ustunlar
        ]
        return f"""
            INSERT INTO land_kontur (manba_fid, tuman_id, kontur_raqami, {", ".join(ustunlar)}, tur, geom, geom_mvt, geom_mvt_s, maydon_mvt)
            SELECT s.manba_fid, t.id, round(s.kontur_raqami)::integer, {", ".join(tanlash)}, 'aniqlanmagan',
                   ST_Transform(g.mvt, 4326), g.mvt,
                   ST_Multi(ST_CollectionExtract(ST_SimplifyPreserveTopology(g.mvt, 19.1), 3)), ST_Area(g.mvt)
            FROM {STAGING} s
            JOIN border_tuman t ON t.kod = s.distrikt_id
            CROSS JOIN LATERAL (
                SELECT ST_SetSRID(ST_Multi(ST_CollectionExtract(
                           ST_MakeValid(ST_Force2D(s.geom_src)), 3)), 3857) AS mvt
            ) g
            WHERE s.geom_src IS NOT NULL AND NOT ST_IsEmpty(g.mvt)
            ORDER BY s.manba_fid"""

    def maydon_birligi(self):
        """umumiy_maydoni / (ST_Area(geography)/10000) - tasodifiy 1000 kontur."""
        t0 = time.perf_counter()
        with connection.cursor() as c:
            c.execute(f"""
                SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY nisbat),
                       percentile_cont(0.1) WITHIN GROUP (ORDER BY nisbat),
                       percentile_cont(0.9) WITHIN GROUP (ORDER BY nisbat)
                FROM (SELECT umumiy_maydoni / (ST_Area(geom::geography) / 10000.0) AS nisbat
                      FROM (SELECT umumiy_maydoni, geom FROM land_kontur
                            WHERE umumiy_maydoni > 0 ORDER BY random() LIMIT {NAMUNA_SONI}) q) n
                WHERE nisbat IS NOT NULL""")
            self.nisbat = c.fetchone()
        self._bosqich("maydon_tekshiruvi", t0)

    def hisobot(self, ochirildi):
        w = self.w
        with connection.cursor() as c:
            if self.tuman is None:
                c.execute("SELECT count(*), coalesce(sum(umumiy_maydoni), 0) FROM land_kontur")
            else:
                c.execute("SELECT count(*), coalesce(sum(umumiy_maydoni), 0) FROM land_kontur k "
                          "JOIN border_tuman t ON t.id = k.tuman_id WHERE t.kod = %s", [self.tuman])
            jami, maydon = c.fetchone()
        w("\n=== HISOBOT ===")
        w(f"kontur: manba {self.manba}, yuklandi {self.yuklandi}, o'tkazildi {self.manba - self.yuklandi}"
          + (f", oldingi o'chirildi {ochirildi}" if ochirildi is not None else ", to'liq almashtirildi"))
        w(f"  bog'lanmagan (tuman yo'q): {self.boglanmagan}; bo'sh/NULL geometriya: {self.bosh}")
        w(f"  geometriyasi tuzatildi (invalid -> ST_MakeValid): {self.invalid}; 3D/M -> 2D: {self.uch_o}")
        w(f"  takror (tuman, kontur_raqami): {self.takror_guruh} guruh / {self.takror_qator} qator")
        w(f"  bazada{' (shu tuman)' if self.tuman is not None else ''}: {jami} qator, "
          f"umumiy_maydoni yig'indisi {maydon:,.0f} ga")
        n, med, p10, p90 = self.nisbat
        if n:
            w(f"  maydon birligi: umumiy_maydoni / (ST_Area(geography)/10000): n={n}, "
              f"mediana {med:.4f}, p10 {p10:.4f}, p90 {p90:.4f} (1.0 = gektar)")
        self._vaqtlar()

    # ------------------------------------------------------------------ quruq
    def quruq_hisobot(self):
        t0 = time.perf_counter()
        ds = ogr.Open(str(self.gdb))
        qatlam = ds.GetLayerByName(QATLAM)
        if qatlam is None:
            raise CommandError(f"{self.gdb} da '{QATLAM}' qatlami yo'q")
        filtr = f"distrikt_id = {int(self.tuman)}" if self.tuman is not None else None
        qatlam.SetAttributeFilter(filtr)
        srs = qatlam.GetSpatialRef()
        epsg = srs.GetAuthorityCode(None) if srs else None
        kerak = ("kontur_raqami", "distrikt_id", "umumiy_maydoni")
        qatlam.SetIgnoredFields(["OGR_GEOMETRY"] + [d.name for d in qatlam.schema if d.name not in kerak])
        with connection.cursor() as c:
            c.execute("SELECT kod FROM border_tuman")
            tumanlar = {r[0] for r in c.fetchall()}
        jami = boglanmagan = bosh_raqam = 0
        maydon = 0.0
        takror = Counter()
        for f in qatlam:
            jami += 1
            d = f["distrikt_id"]
            if d not in tumanlar:
                boglanmagan += 1
            kr = f["kontur_raqami"]
            if kr is None:
                bosh_raqam += 1
            else:
                takror[(d, round(kr))] += 1
            maydon += f["umumiy_maydoni"] or 0
        guruh = [k for k, v in takror.items() if v > 1]
        qator = sum(takror[k] for k in guruh)
        self._bosqich("manbani o'qish", t0)

        t0 = time.perf_counter()  # geometriya namunasi (birinchi 1000 ta)
        qatlam.SetIgnoredFields([])
        qatlam.SetAttributeFilter(filtr)
        bosh = invalid = uch_o = korildi = 0
        for f in qatlam:  # tez: birinchi NAMUNA_SONI ta obyekt
            if korildi >= NAMUNA_SONI:
                break
            g = f.GetGeometryRef()
            korildi += 1
            if g is None or g.IsEmpty():
                bosh += 1
                continue
            g = g.Clone()
            if g.Is3D() or g.IsMeasured():
                uch_o += 1
            g.FlattenTo2D()
            if not g.IsValid():
                invalid += 1
        self._bosqich("geometriya namunasi", t0)
        w = self.w
        w("\n=== HISOBOT (quruq) ===")
        w(f"kontur: manba {jami}" + (f" (tuman {self.tuman})" if self.tuman is not None else "")
          + f", CRS EPSG:{epsg}, umumiy_maydoni yig'indisi {maydon:,.0f}")
        w(f"  bog'lanmagan (Tuman.kod yo'q): {boglanmagan}; kontur_raqami NULL: {bosh_raqam}")
        w(f"  takror (tuman, kontur_raqami): {len(guruh)} guruh / {qator} qator")
        w(f"  geometriya namunasi ({korildi} ta): bo'sh {bosh}, invalid {invalid}, 3D/M {uch_o}")
        self._vaqtlar()
