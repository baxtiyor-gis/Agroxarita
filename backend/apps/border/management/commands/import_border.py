"""Viloyat, tuman va massiv chegaralarini manbadan (shp / GIS.gdb) bazaga yuklash.

    python manage.py import_border [--viloyat] [--tuman] [--massiv] [--tozala] [--quruq]

Flag berilmasa - hammasi. `--quruq` - o'qiydi, normallashtiradi, hisobot beradi, bazaga yozmaydi.
"""
import re
from pathlib import Path

from django.conf import settings
from django.contrib.gis.geos import GEOSGeometry, MultiPolygon
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from osgeo import ogr

from apps.border.models import Massiv, Tuman, Viloyat

ogr.UseExceptions()

SODDALASH_METR = 250  # geom_mvt_s uchun (EPSG:3857 birligida)
NAMUNA_SONI = 10
KESISHUV_ESHIGI = 0.001  # massiv maydonining 0.1% dan kichik kesishuv hisobga olinmaydi
KATTA_ULUSH = 0.05  # ikkinchi tumanga tushgan ulush hisobotda 'katta' hisoblanadi


# --------------------------------------------------------------------------- normallashtirish

# manbada aralash uchraydigan apostrof belgilari
_APOSTROFLAR = "‘’'`ʻʼ´′"
_APOSTROF_RE = re.compile(f"[{re.escape(_APOSTROFLAR)}]")
O_G_APOSTROF = "‘"  # o' / g' (oz, gz)
BOSHQA_APOSTROF = "’"  # tutuq belgisi (ma'no, ...)

_TIP_XARITA = {
    "t": "tuman",  # lotin T
    "т": "tuman",  # kirill т
    "ш": "shahar",  # kirill Ш
    "s": "shahar",
    "sh": "shahar",
}


def apostrof(matn):
    """`o`/`g` dan keyin ‘ (U+2018), boshqa joyda ’ (U+2019)."""

    def almashtir(m):
        oldingi = m.string[m.start() - 1] if m.start() > 0 else ""
        return O_G_APOSTROF if oldingi in "oOgG" else BOSHQA_APOSTROF

    return _APOSTROF_RE.sub(almashtir, matn)


def nom_tozala(matn):
    """Nomni tozalash: apostrof birxillashtiriladi, ortiqcha bo'shliqlar olib tashlanadi."""
    if matn is None:
        return ""
    return " ".join(apostrof(str(matn)).split())


def tip_aniqla(qiymat):
    """`T`/`Т` -> 'tuman', `Ш` -> 'shahar'. Tanib bo'lmasa None."""
    if qiymat is None:
        return None
    return _TIP_XARITA.get(str(qiymat).strip().casefold())


def kod_ajrat(cad_raqami):
    """'12:01' -> 1201. Noto'g'ri format bo'lsa ValueError."""
    m = re.fullmatch(r"\s*(\d{1,2})\s*:\s*(\d{2})\s*", str(cad_raqami or ""))
    if not m:
        raise ValueError(f"cad_raqami formati noto'g'ri: {cad_raqami!r}")
    return int(m.group(1)) * 100 + int(m.group(2))


# --------------------------------------------------------------------------- geometriya

def _poligonlar(g):
    """Geometriyadan faqat poligon qismlarni ajratadi (GeometryCollection ichidagilar ham)."""
    if g.empty:
        return []
    if g.geom_type == "Polygon":
        return [g]
    if g.geom_type in ("MultiPolygon", "GeometryCollection"):
        chiqish = []
        for qism in g:
            chiqish.extend(_poligonlar(qism))
        return chiqish
    return []


def multipoligon(g):
    """(MultiPolygon | None, tuzatildimi). Invalid bo'lsa make_valid, faqat poligon qismlar."""
    tuzatildi = not g.valid
    if tuzatildi:
        g = g.make_valid()
    qismlar = [p for p in _poligonlar(g) if p.area > 0]
    if not qismlar:
        return None, tuzatildi
    return MultiPolygon(*qismlar, srid=g.srid), tuzatildi


def geometriya_maydonlari(g):
    """Manba geometriyasi (har qanday SRID, 2D) -> ({geom, geom_mvt, geom_mvt_s, bbox} | None, tuzatildimi)."""
    mp, tuzatildi = multipoligon(g)
    if mp is None:
        return None, tuzatildi
    geom = mp if mp.srid == 4326 else mp.transform(4326, clone=True)
    mvt = mp if mp.srid == 3857 else mp.transform(3857, clone=True)
    if not geom.valid:  # transformatsiyadan keyin kamdan-kam
        geom, _ = multipoligon(geom)
        tuzatildi = True
    if not mvt.valid:
        mvt, _ = multipoligon(mvt)
        tuzatildi = True
    if geom is None or mvt is None:
        return None, tuzatildi
    soddalashgan, _ = multipoligon(mvt.simplify(SODDALASH_METR, preserve_topology=True))
    if soddalashgan is None:  # juda kichik obyekt soddalashtirishda yo'qolsa
        soddalashgan = mvt
    return {
        "geom": geom,
        "geom_mvt": mvt,
        "geom_mvt_s": soddalashgan,
        "bbox": [round(v, 7) for v in geom.extent],
    }, tuzatildi


# --------------------------------------------------------------------------- manba o'qish

def _epsg(qatlam):
    srs = qatlam.GetSpatialRef()
    kod = srs.GetAuthorityCode(None) if srs else None
    return int(kod) if kod else None


def _ochish(yol):
    if not Path(yol).exists():
        raise CommandError(f"Manba topilmadi: {yol}")
    return ogr.Open(str(yol))


def _yozuvlar(qatlam, ogohlantir):
    """Qatlam obyektlari: (fid, maydonlar dict, GEOS geometriya | None)."""
    srid = _epsg(qatlam)
    if srid is None:
        ogohlantir(f"{qatlam.GetName()}: CRS aniqlanmadi, EPSG:3857 deb olindi")
        srid = 3857
    nomlar = [d.name for d in qatlam.schema]
    for f in qatlam:
        maydonlar = {n: f[n] for n in nomlar}
        og = f.GetGeometryRef()
        if og is None or og.IsEmpty():
            yield f.GetFID(), maydonlar, None
            continue
        og = og.Clone()
        og.FlattenTo2D()
        yield f.GetFID(), maydonlar, GEOSGeometry(memoryview(bytes(og.ExportToWkb())), srid=srid)


class Hisobot:
    def __init__(self, nom):
        self.nom = nom
        self.manba = 0
        self.tayyor = 0
        self.yaratildi = 0
        self.yangilandi = 0
        self.tuzatildi = 0
        self.otkazildi = []  # (kalit, sabab)
        self.otkazilgan_kalitlar = set()  # manbada bor, lekin yuklanmagan (--tozala o'chirmasin)
        self.ochirildi = 0
        self.manbada_yoq = 0
        self.ogohlantirish = []
        self.kesishmaydi = 0
        self.kop_tumanli = []  # (kalit, nom, [(tuman kod, ulush)])

    def qator(self, quruq):
        holat = f"yuklanadi {self.tayyor}" if quruq else f"yuklandi {self.yaratildi}, yangilandi {self.yangilandi}"
        s = (
            f"{self.nom}: manba {self.manba}, {holat}, o'tkazildi {len(self.otkazildi)}, "
            f"geometriyasi tuzatildi {self.tuzatildi}"
        )
        if not quruq:
            s += f", manbada yo'q {self.manbada_yoq}, o'chirildi {self.ochirildi}"
        return s


def _tayyorla(yozuvlar, h, kalit_fn, qolgan_fn):
    """Umumiy sikl: geometriyani tayyorlaydi, takror kalitni o'tkazadi.

    kalit_fn(maydonlar) -> kalit (None bo'lsa kalit yo'q: kalit = "fid=N", takror tekshirilmaydi),
    qolgan_fn(maydonlar) -> dict; ikkalasi ham ValueError berishi mumkin.
    Qaytaradi: [(kalit, maydonlar dict, geometriya dict)]
    """
    chiqish, korilgan = [], set()
    for fid, m, g in yozuvlar:
        h.manba += 1
        try:
            kalit = kalit_fn(m) if kalit_fn else f"fid={fid}"
            qolgan = qolgan_fn(m)
        except (ValueError, TypeError) as xato:
            h.otkazildi.append((f"fid={fid}", str(xato)))
            continue
        if kalit_fn and kalit in korilgan:
            h.otkazildi.append((kalit, "manbada takror kalit"))
            continue
        korilgan.add(kalit)
        if g is None:
            h.otkazildi.append((kalit, "geometriya yo'q"))
            h.otkazilgan_kalitlar.add(kalit)
            continue
        gm, tuzatildi = geometriya_maydonlari(g)
        if gm is None:
            h.otkazildi.append((kalit, "poligon qismi yo'q (make_valid dan keyin)"))
            h.otkazilgan_kalitlar.add(kalit)
            continue
        if tuzatildi:
            h.tuzatildi += 1
        chiqish.append((kalit, qolgan, gm))
    return chiqish


class Command(BaseCommand):
    help = "Viloyat, tuman va massiv chegaralarini DATA_DIR dagi manbadan yuklaydi."

    def add_arguments(self, parser):
        parser.add_argument("--viloyat", action="store_true")
        parser.add_argument("--tuman", action="store_true")
        parser.add_argument("--massiv", action="store_true")
        parser.add_argument("--tozala", action="store_true", help="manbada yo'q yozuvlarni o'chiradi")
        parser.add_argument("--quruq", action="store_true", help="bazaga yozmasdan hisobot beradi")
        parser.add_argument("--data-dir", default=None, help="manbalar papkasi (default: DATA_DIR)")

    def handle(self, *args, **o):
        data = Path(o["data_dir"] or settings.DATA_DIR)
        hammasi = not (o["viloyat"] or o["tuman"] or o["massiv"])
        self.quruq, self.tozala = o["quruq"], o["tozala"]
        self.hisobotlar = []
        self.namunalar = {}
        # quruq rejimda bog'lanish tekshiruvi uchun xotiradagi natijalar
        self._viloyat_kalitlari, self._tuman_geom = None, None

        if self.quruq:
            self.stdout.write("QURUQ REJIM: bazaga yozilmaydi")
        if hammasi or o["viloyat"]:
            self.viloyatlar(data / "regions" / "regions.shp")
        if hammasi or o["tuman"]:
            self.tumanlar(data / "districts" / "districts.shp", data)
        if hammasi or o["massiv"]:
            self.massivlar(data / "GIS.gdb")
        self.hisobot()

    # ------------------------------------------------------------------ viloyat
    def viloyatlar(self, yol):
        h = Hisobot("viloyat")
        self.hisobotlar.append(h)
        ds = _ochish(yol)
        yozuvlar = _tayyorla(
            _yozuvlar(ds.GetLayer(0), h.ogohlantirish.append), h,
            kalit_fn=lambda m: int(m["region_id"]),
            qolgan_fn=lambda m: {"soato": str(int(m["mhobt"])), "nom": nom_tozala(m["name_lot"])},
        )
        self._takror_soato(yozuvlar, h)
        self._viloyat_kalitlari = {k for k, _, _ in yozuvlar}
        self.namunalar["viloyat"] = [(k, q["nom"]) for k, q, _ in yozuvlar]
        self._yuklash(h, Viloyat, "region_id", yozuvlar)

    # ------------------------------------------------------------------ tuman
    def tumanlar(self, yol, data):
        h = Hisobot("tuman")
        self.hisobotlar.append(h)
        ds = _ochish(yol)
        if not self.quruq:
            viloyat_bor = set(Viloyat.objects.values_list("region_id", flat=True))
        elif self._viloyat_kalitlari is not None:
            viloyat_bor = self._viloyat_kalitlari
        else:
            viloyat_bor = {int(f["region_id"]) for f in _ochish(data / "regions" / "regions.shp").GetLayer(0)}

        def qolgan(m):
            t = tip_aniqla(m["tip"])
            if t is None:
                raise ValueError(f"tip tanib bo'lmadi: {m['tip']!r}")
            region_id = int(m["region_id"])
            if region_id not in viloyat_bor:
                raise ValueError(f"viloyat topilmadi: region_id={region_id}")
            return {
                "region_id": region_id, "tip": t, "soato": str(int(m["mhobt"])),
                "nom": nom_tozala(m["name_lot"]),
            }

        yozuvlar = _tayyorla(
            _yozuvlar(ds.GetLayer(0), h.ogohlantirish.append), h,
            kalit_fn=lambda m: kod_ajrat(m["cad_raqami"]), qolgan_fn=qolgan,
        )
        self._takror_soato(yozuvlar, h)
        self._tuman_geom = [(k, gm["geom"], gm["geom_mvt"]) for k, _, gm in yozuvlar]
        self.namunalar["tuman"] = [(k, q["nom"], q["tip"]) for k, q, _ in yozuvlar]
        self._yuklash(
            h, Tuman, "kod", yozuvlar,
            oldindan=lambda q: {"viloyat": Viloyat.objects.get(region_id=q.pop("region_id"))},
        )

    # ------------------------------------------------------------------ massiv
    def massivlar(self, yol):
        h = Hisobot("massiv")
        self.hisobotlar.append(h)
        ds = _ochish(yol)
        qatlam = ds.GetLayerByName("massiv")
        if qatlam is None:
            raise CommandError(f"{yol} da 'massiv' qatlami yo'q")
        if qatlam.GetFeatureCount() == 0:
            h.ogohlantirish.append("massiv qatlami bo'sh - hech narsa yuklanmadi")
            return

        tumanlar = self._tuman_royxati()  # [(kod, PreparedGeometry(4326), geom_mvt)]

        # massivlarning kaliti yo'q — har importda to'liq almashtiriladi
        yozuvlar = _tayyorla(
            _yozuvlar(qatlam, h.ogohlantirish.append), h,
            kalit_fn=None, qolgan_fn=lambda m: {"nom": nom_tozala(m["name_lot"])},
        )
        boglangan, kesishmaydi, kop_tumanli = [], 0, []
        for kalit, q, gm in yozuvlar:
            ulushlar = self._kesishuv(gm["geom"], gm["geom_mvt"], tumanlar)
            if not ulushlar:
                kesishmaydi += 1
                h.otkazildi.append((kalit, "hech bir tuman bilan kesishmaydi"))
                h.otkazilgan_kalitlar.add(kalit)
                continue
            q["tuman_kod"] = ulushlar[0][0]
            if len(ulushlar) > 1:
                kop_tumanli.append((kalit, q["nom"], ulushlar))
            boglangan.append((kalit, q, gm))
        h.kesishmaydi = kesishmaydi
        h.kop_tumanli = kop_tumanli
        self.namunalar["massiv"] = [(k, q["nom"], q["tuman_kod"]) for k, q, _ in boglangan]
        self._almashtir(h, boglangan)

    def _almashtir(self, h, yozuvlar):
        """Massivlarni bitta tranzaksiyada to'liq almashtiradi (o'chirib qayta yozadi)."""
        h.tayyor = len(yozuvlar)
        if self.quruq:
            return
        tumanlar = {t.kod: t for t in Tuman.objects.only("id", "kod")}
        yangi = [Massiv(tuman=tumanlar[q["tuman_kod"]], nom=q["nom"], **gm) for _, q, gm in yozuvlar]
        with transaction.atomic():
            h.ochirildi = Massiv.objects.count()
            Massiv.objects.all().delete()
            Massiv.objects.bulk_create(yangi, batch_size=500)
        h.yaratildi = len(yangi)

    def _tuman_royxati(self):
        if self.quruq:
            if self._tuman_geom is None:
                raise CommandError("--quruq --massiv uchun --tuman ham kerak (tumanlar manbadan olinadi)")
            manba = self._tuman_geom
        else:
            manba = [(t.kod, t.geom, t.geom_mvt) for t in Tuman.objects.only("kod", "geom", "geom_mvt")]
        return [(k, g.prepared, mvt) for k, g, mvt in manba]

    @staticmethod
    def _kesishuv(geom, mvt, tumanlar):
        """Massiv qaysi tumanlar bilan kesishadi: [(kod, ulush)] - ulush kamayish tartibida.

        Maydon EPSG:3857 da hisoblanadi; KESISHUV_ESHIGI dan kichik bo'laklar (chegara shovqini) hisobga olinmaydi.
        """
        umumiy = mvt.area
        natija = []
        for kod, prepared, t_mvt in tumanlar:
            if not prepared.intersects(geom):
                continue
            maydon = mvt.intersection(t_mvt).area
            if umumiy and maydon / umumiy >= KESISHUV_ESHIGI:
                natija.append((kod, maydon / umumiy))
        natija.sort(key=lambda x: -x[1])
        return natija

    # ------------------------------------------------------------------ umumiy
    @staticmethod
    def _takror_soato(yozuvlar, h):
        korilgan = set()
        for yozuv in list(yozuvlar):
            soato = yozuv[1]["soato"]
            if soato in korilgan:
                h.otkazildi.append((yozuv[0], f"takror soato: {soato}"))
                h.otkazilgan_kalitlar.add(yozuv[0])
                yozuvlar.remove(yozuv)
            korilgan.add(soato)

    def _yuklash(self, h, model, kalit_nomi, yozuvlar, oldindan=None):
        h.tayyor = len(yozuvlar)
        if self.quruq:
            return
        manba_kalitlari = {k for k, _, _ in yozuvlar} | h.otkazilgan_kalitlar
        with transaction.atomic():
            for kalit, q, gm in yozuvlar:
                q = dict(q)
                if oldindan:
                    q.update(oldindan(q))
                _, yaratildi = model.objects.update_or_create(**{kalit_nomi: kalit}, defaults={**q, **gm})
                if yaratildi:
                    h.yaratildi += 1
                else:
                    h.yangilandi += 1
            ortiqcha = model.objects.exclude(**{f"{kalit_nomi}__in": manba_kalitlari})
            h.manbada_yoq = ortiqcha.count()
            if self.tozala:
                h.ochirildi = h.manbada_yoq
                ortiqcha.delete()

    # ------------------------------------------------------------------ hisobot
    def hisobot(self):
        w = self.stdout.write
        w("\n=== HISOBOT ===")
        for h in self.hisobotlar:
            w(h.qator(self.quruq))
            for kalit, sabab in h.otkazildi[:20]:
                w(f"  o'tkazildi: {kalit} - {sabab}")
            if len(h.otkazildi) > 20:
                w(f"  ... yana {len(h.otkazildi) - 20} ta o'tkazildi")
            for og in h.ogohlantirish:
                w(self.style.WARNING(f"  ogohlantirish: {og}"))
            if h.nom == "massiv" and h.manba:
                self.kesishuv_hisoboti(h)
        if self.quruq:
            for nomi, royxat in self.namunalar.items():
                if royxat:
                    qadam = max(1, len(royxat) // NAMUNA_SONI)
                    w(f"namuna {nomi}: {royxat[::qadam][:NAMUNA_SONI]}")

    def kesishuv_hisoboti(self, h):
        w = self.stdout.write
        katta = [x for x in h.kop_tumanli if x[2][1][1] > KATTA_ULUSH]
        w("massiv -> tuman (eng katta kesishuv maydoni bo'yicha):")
        w(f"  (a) hech bir tuman bilan kesishmaydi (o'tkazildi): {h.kesishmaydi}")
        w(f"  (b) 2+ tumanni kesadi (>{KESISHUV_ESHIGI:.1%}): {len(h.kop_tumanli)}; "
          f"ikkinchi tuman ulushi >{KATTA_ULUSH:.0%}: {len(katta)}")
        for kalit, nom, ulushlar in sorted(katta, key=lambda x: -x[2][1][1])[:10]:
            qismlar = ", ".join(f"tuman {k} {u:.1%}" for k, u in ulushlar[:3])
            w(f"    {kalit} | {nom} | {qismlar}")
