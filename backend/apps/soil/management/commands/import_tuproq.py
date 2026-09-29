"""Tuproq poligonlarini GIS.gdb `Soil` qatlamidan bazaga yuklash.

    python manage.py import_tuproq [--quruq] [--data-dir PAPKA] [--gdb YOL]

Oqim: domenlar -> TuproqLugat; VectorTranslate -> staging `soil_tuproq_staging` (UNLOGGED) -> bitta
tranzaksiyada TRUNCATE soil_tuproq + INSERT ... SELECT -> geometrik tuman bog'lash -> ANALYZE -> staging DROP.
Idempotent: har ishga tushirishda soil_tuproq to'liq almashtiriladi. `--quruq` bazaga yozmaydi.
"""
import time
from pathlib import Path

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import connection, transaction
from osgeo import gdal, ogr

from apps.soil.normalizatsiya import kirill_lotin, yer_osti_suvi_parse
from apps.soil.models import TuproqLugat

gdal.UseExceptions()
ogr.UseExceptions()

STAGING = "soil_tuproq_staging"
QATLAM = "Soil"
NAMUNA_SONI = 1000
# model maydoni -> (tur, manba ustuni)
DOMENLAR = {
    "mexanika": "mexanikasi_id",
    "shorlanish": "shorlanishi_id",
    "yuvilish": "yuvilishi_id",
    "toshlanish": "toshlanishi_id",
    "klass": "klass_id",
}


def _pg_ulanish():
    d = connection.settings_dict
    qismlar = {"host": d.get("HOST") or "localhost", "port": d.get("PORT") or "5432",
               "dbname": d["NAME"], "user": d["USER"], "password": d["PASSWORD"]}
    return "PG:" + " ".join(f"{k}={v}" for k, v in qismlar.items() if v)


def _t(ustun):
    """Matn: kesish, bo'sh -> NULL."""
    return f"NULLIF(btrim(s.{ustun}), '')"


def domenlarni_oqi(ds):
    """{tur: {kod(int): kirill nom}} - domen nomi qatlam maydonidan olinadi."""
    qatlam = ds.GetLayerByName(QATLAM)
    if qatlam is None:
        raise CommandError(f"'{QATLAM}' qatlami yo'q")
    defn = qatlam.GetLayerDefn()
    natija = {}
    for tur, ustun in DOMENLAR.items():
        i = defn.GetFieldIndex(ustun)
        if i < 0:
            raise CommandError(f"'{ustun}' maydoni yo'q")
        nom = defn.GetFieldDefn(i).GetDomainName()
        if not nom:
            natija[tur] = {}
            continue
        dom = ds.GetFieldDomain(nom)
        natija[tur] = {int(k): v for k, v in dom.GetEnumeration().items()}
    return natija


class Command(BaseCommand):
    help = "Tuproqni DATA_DIR/GIS.gdb `Soil` qatlamidan yuklaydi (staging + bitta INSERT ... SELECT)."

    def add_arguments(self, parser):
        parser.add_argument("--quruq", action="store_true", help="bazaga yozmasdan manba statistikasi")
        parser.add_argument("--data-dir", default=None, help="manbalar papkasi (default: DATA_DIR)")
        parser.add_argument("--gdb", default=None, help="manba yo'li (default: <data-dir>/GIS.gdb); testlar uchun")

    def handle(self, *args, **o):
        gdb = Path(o["gdb"]) if o["gdb"] else Path(o["data_dir"] or settings.DATA_DIR) / "GIS.gdb"
        if not gdb.exists():
            raise CommandError(f"Manba topilmadi: {gdb}")
        self.gdb, self.vaqt, self.w = gdb, [], self.stdout.write
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
            self.lugat_yukla()
            self._bosqich("lugat", t0)
            t0 = time.perf_counter()
            self.staging_yoz()
            self._bosqich("staging", t0)
            t0 = time.perf_counter()
            self.tekshir_staging()
            self._bosqich("staging_statistika", t0)
            with transaction.atomic(), connection.cursor() as c:
                t0 = time.perf_counter()
                self.yer_osti_suvi_jadval(c)
                self._bosqich("yer_osti_suvi", t0)
                t0 = time.perf_counter()
                c.execute("TRUNCATE soil_tuproq")
                c.execute(self.insert_sql())
                self.yuklandi = c.rowcount
                self._bosqich("insert", t0)
                t0 = time.perf_counter()
                self.tuman_boglash(c)
                self._bosqich("tuman", t0)
            t0 = time.perf_counter()
            with connection.cursor() as c:
                c.execute("ANALYZE soil_tuproq")
            self._bosqich("analyze", t0)
            self.maydon_birligi()
            self.hisobot()
        finally:
            with connection.cursor() as c:
                c.execute(f"DROP TABLE IF EXISTS {STAGING}")

    def lugat_yukla(self):
        ds = ogr.Open(str(self.gdb))
        self.domen = domenlarni_oqi(ds)
        ds = None
        self.lugat_soni = 0
        with transaction.atomic():
            for tur, kodlar in self.domen.items():
                for kod, nom in kodlar.items():
                    TuproqLugat.objects.update_or_create(tur=tur, kod=kod, defaults={"nom": kirill_lotin(nom)})
                    self.lugat_soni += 1

    def staging_yoz(self):
        gdal.VectorTranslate(
            _pg_ulanish(), str(self.gdb), format="PostgreSQL", layers=[QATLAM], layerName=STAGING,
            accessMode="overwrite", geometryType="PROMOTE_TO_MULTI", preserveFID=True,
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
                       count(*) - count(DISTINCT globalid)
                FROM {STAGING}""")
            self.manba, self.bosh, self.invalid, self.uch_o, self.takror = c.fetchone()
            self.lugatsiz = {}
            for tur, ustun in DOMENLAR.items():
                c.execute(f"""
                    SELECT s.{ustun}, count(*) FROM {STAGING} s
                    WHERE s.{ustun} IS NOT NULL AND NOT EXISTS
                      (SELECT 1 FROM soil_tuproqlugat l WHERE l.tur = %s AND l.kod = s.{ustun})
                    GROUP BY 1 ORDER BY 2 DESC""", [tur])
                self.lugatsiz[tur] = c.fetchall()
        if self.manba == 0:
            raise CommandError("Manbada qator yo'q")
        if self.takror:
            raise CommandError(f"globalid takrorlanadi ({self.takror} qator) - unique buziladi")

    def yer_osti_suvi_jadval(self, c):
        """Noyob qiymatlar -> Python parse -> temp jadval _ys (bitta INSERTda ishlatiladi)."""
        c.execute(f"SELECT DISTINCT yer_osti_suvi_id FROM {STAGING} WHERE yer_osti_suvi_id IS NOT NULL")
        qiymatlar = [r[0] for r in c.fetchall()]
        c.execute("DROP TABLE IF EXISTS _ys")
        c.execute("CREATE TEMP TABLE _ys (src text PRIMARY KEY, norm text, mn float8, mx float8)")
        qatorlar, self.parse_yoq = [], []
        for q in qiymatlar:
            norm, mn, mx = yer_osti_suvi_parse(q)
            qatorlar.append((q, norm if norm is not None else "", mn, mx))
            if norm is not None and mn is None and mx is None:
                self.parse_yoq.append(q)
        c.executemany("INSERT INTO _ys VALUES (%s, %s, %s, %s)", qatorlar)
        self.noyob_ys = len(qiymatlar)

    def insert_sql(self):
        lugat = "".join(
            f" LEFT JOIN soil_tuproqlugat l_{tur} ON l_{tur}.tur = '{tur}' AND l_{tur}.kod = s.{ustun}"
            for tur, ustun in DOMENLAR.items()
        )
        return f"""
            INSERT INTO soil_tuproq (globalid, tuman_id, mexanika_id, shorlanish_id, yuvilish_id, toshlanish_id,
                                     klass_id, bonitet, maydon, yer_osti_suvi, yer_osti_suvi_min, yer_osti_suvi_max,
                                     massiv_nomi, manba, geom, geom_mvt)
            SELECT s.globalid, bt.id, l_mexanika.id, l_shorlanish.id, l_yuvilish.id, l_toshlanish.id, l_klass.id,
                   s.ball_bonitet, s.maydoni, left(coalesce(y.norm, ''), 64), y.mn, y.mx,
                   coalesce({_t("massiv")}, ''),
                   jsonb_build_object(
                       'viloya', {_t("viloya")}, 'tuman', {_t("tuman")}, 'massiv', {_t("massiv")},
                       'mexanikasi', {_t("mexanikasi")}, 'shorlanishi', {_t("shorlanishi")},
                       'yuvilishi', {_t("yuvilishi")}, 'toshlanishi', {_t("toshlanishi")},
                       'klasss', {_t("klasss")}, 'bonitet_bali', {_t("bonitet_bali")},
                       'yer_osti_suvi_id', {_t("yer_osti_suvi_id")},
                       'region_id', round(s.region_id)::int, 'cad_raqami', round(s.cad_raqami)::int),
                   g.geom, ST_Transform(g.geom, 3857)
            FROM {STAGING} s
            CROSS JOIN LATERAL (
                SELECT ST_SetSRID(ST_Multi(ST_CollectionExtract(
                           ST_MakeValid(ST_Force2D(s.geom_src)), 3)), 4326) AS geom
            ) g
            LEFT JOIN _ys y ON y.src = s.yer_osti_suvi_id
            LEFT JOIN border_tuman bt ON bt.kod = round(s.cad_raqami)::int
            {lugat}
            WHERE s.geom_src IS NOT NULL AND NOT ST_IsEmpty(g.geom)
            ORDER BY s.manba_fid"""

    def tuman_boglash(self, c):
        c.execute("SELECT count(*) FROM soil_tuproq WHERE tuman_id IS NOT NULL")
        self.cad_boyicha = c.fetchone()[0]
        # cad bo'yicha bog'langanlardan markazi tuman chegarasidan tashqarida
        c.execute("""
            SELECT count(*), (array_agg(k.globalid ORDER BY k.id))[1:5]
            FROM soil_tuproq k JOIN border_tuman t ON t.id = k.tuman_id
            WHERE NOT ST_Intersects(ST_PointOnSurface(k.geom), t.geom)""")
        self.tashqarida, self.tashqarida_namuna = c.fetchone()
        # qolganlar: eng katta kesishuv
        c.execute("""
            UPDATE soil_tuproq k SET tuman_id = m.id
            FROM (SELECT z.id AS kid, x.id FROM soil_tuproq z
                  CROSS JOIN LATERAL (
                      SELECT t.id FROM border_tuman t
                      WHERE t.geom && z.geom AND ST_Intersects(t.geom, z.geom)
                      ORDER BY ST_Area(ST_Intersection(z.geom, t.geom)) DESC, t.id LIMIT 1
                  ) x
                  WHERE z.tuman_id IS NULL) m
            WHERE k.id = m.kid""")
        self.geometrik = c.rowcount
        c.execute("SELECT count(*) FROM soil_tuproq WHERE tuman_id IS NULL")
        self.boglanmagan = c.fetchone()[0]

    def maydon_birligi(self):
        """maydon / (ST_Area(geography)/10000) - tasodifiy 1000 poligon."""
        t0 = time.perf_counter()
        with connection.cursor() as c:
            c.execute(f"""
                SELECT count(*), percentile_cont(0.5) WITHIN GROUP (ORDER BY nisbat),
                       percentile_cont(0.1) WITHIN GROUP (ORDER BY nisbat),
                       percentile_cont(0.9) WITHIN GROUP (ORDER BY nisbat)
                FROM (SELECT maydon / (ST_Area(geom::geography) / 10000.0) AS nisbat
                      FROM (SELECT maydon, geom FROM soil_tuproq
                            WHERE maydon > 0 ORDER BY random() LIMIT {NAMUNA_SONI}) q) n
                WHERE nisbat IS NOT NULL""")
            self.nisbat = c.fetchone()
        self._bosqich("maydon_tekshiruvi", t0)

    def hisobot(self):
        w = self.w
        with connection.cursor() as c:
            c.execute("SELECT count(*), coalesce(sum(maydon), 0) FROM soil_tuproq")
            jami, maydon = c.fetchone()
            taqsimot = {}
            for tur in DOMENLAR:
                c.execute("""
                    SELECT coalesce(l.nom, '(NULL)'), count(*) FROM soil_tuproq k
                    LEFT JOIN soil_tuproqlugat l ON l.id = k.%s_id
                    GROUP BY 1 ORDER BY 2 DESC LIMIT 5""" % tur)
                taqsimot[tur] = c.fetchall()
        w("\n=== HISOBOT ===")
        w(f"tuproq: manba {self.manba}, yuklandi {self.yuklandi}, o'tkazildi {self.manba - self.yuklandi} "
          f"(bo'sh/NULL geometriya {self.bosh}); lug'at yozuvlari {self.lugat_soni}")
        w(f"  geometriyasi tuzatildi (invalid -> ST_MakeValid): {self.invalid}; 3D/M -> 2D: {self.uch_o}")
        w(f"  bazada: {jami} qator, maydon yig'indisi {maydon:,.0f}")
        w(f"  tuman: cad bo'yicha {self.cad_boyicha}, geometrik {self.geometrik}, bog'lanmagan {self.boglanmagan}")
        w(f"  cad bo'yicha bog'langan, lekin markazi tuman tashqarisida: {self.tashqarida}"
          + (f" (namuna: {', '.join(self.tashqarida_namuna)})" if self.tashqarida_namuna else ""))
        for tur, qatorlar in self.lugatsiz.items():
            if qatorlar:
                w(f"  lug'atda yo'q {tur} kodlari (NULL qilindi): " + ", ".join(f"{k}: {n}" for k, n in qatorlar))
        w("  lug'at bo'yicha taqsimot (top-5):")
        for tur, qatorlar in taqsimot.items():
            w(f"    {tur}: " + "; ".join(f"{nom} = {n}" for nom, n in qatorlar))
        w(f"  yer_osti_suvi: noyob {self.noyob_ys}, parse qilinmagan {len(self.parse_yoq)}")
        if self.parse_yoq:
            with connection.cursor() as c:
                c.execute(f"SELECT yer_osti_suvi_id, count(*) FROM {STAGING} WHERE yer_osti_suvi_id = ANY(%s) "
                          "GROUP BY 1 ORDER BY 2 DESC", [self.parse_yoq])
                w("    " + "; ".join(f"{k!r}: {n}" for k, n in c.fetchall()))
        n, med, p10, p90 = self.nisbat
        if n:
            w(f"  maydon birligi: maydon / (ST_Area(geography)/10000): n={n}, "
              f"mediana {med:.4f}, p10 {p10:.4f}, p90 {p90:.4f} (1.0 = gektar)")
        self._vaqtlar()

    # ------------------------------------------------------------------ quruq
    def quruq_hisobot(self):
        t0 = time.perf_counter()
        ds = ogr.Open(str(self.gdb))
        qatlam = ds.GetLayerByName(QATLAM)
        if qatlam is None:
            raise CommandError(f"{self.gdb} da '{QATLAM}' qatlami yo'q")
        domen = domenlarni_oqi(ds)
        srs = qatlam.GetSpatialRef()
        epsg = srs.GetAuthorityCode(None) if srs else None
        kerak = ("globalid", "yer_osti_suvi_id", "cad_raqami", "ball_bonitet", "maydoni") + tuple(DOMENLAR.values())
        qatlam.SetIgnoredFields(["OGR_GEOMETRY"] + [d.name for d in qatlam.schema if d.name not in kerak])
        jami = cad_bosh = 0
        ids, ys = set(), {}
        maydon = 0.0
        yoq = {t: {} for t in DOMENLAR}
        for f in qatlam:
            jami += 1
            ids.add(f["globalid"])
            cad_bosh += f["cad_raqami"] is None
            maydon += f["maydoni"] or 0
            ys[f["yer_osti_suvi_id"]] = ys.get(f["yer_osti_suvi_id"], 0) + 1
            for tur, ustun in DOMENLAR.items():
                v = f[ustun]
                if v is not None and v not in domen[tur]:
                    yoq[tur][v] = yoq[tur].get(v, 0) + 1
        parse_yoq = {q: n for q, n in ys.items() if q is not None
                     and (lambda r: r[0] is not None and r[1] is None and r[2] is None)(yer_osti_suvi_parse(q))}
        self._bosqich("manbani o'qish", t0)
        w = self.w
        w("\n=== HISOBOT (quruq) ===")
        w(f"tuproq: manba {jami}, noyob globalid {len(ids)}, CRS EPSG:{epsg}, maydoni yig'indisi {maydon:,.0f}")
        w(f"  cad_raqami NULL: {cad_bosh}; noyob yer_osti_suvi_id: {len(ys)}, parse qilinmagan: {len(parse_yoq)}")
        for q, n in sorted(parse_yoq.items(), key=lambda x: -x[1]):
            w(f"    {q!r}: {n}")
        for tur in DOMENLAR:
            w(f"  domen {tur}: {len(domen[tur])} kod; lug'atda yo'q: {yoq[tur] or 'yo`q'}")
        self._vaqtlar()
