"""Umumiy fixture'lar: kichik sun'iy Viloyat/Tuman/Massiv (haqiqiy data/ ga bog'liq emas)."""
import pytest
from django.contrib.gis.geos import MultiPolygon, Polygon

from apps.border.models import Massiv, Tuman, Viloyat
from apps.land.models import Kontur


def kvadrat(x0, y0, x1, y1):
    """EPSG:4326 MultiPolygon (to'rtburchak)."""
    return MultiPolygon(Polygon.from_bbox((x0, y0, x1, y1)), srid=4326)


def geometriya_maydonlari(geom):
    """geom, geom_mvt, geom_mvt_s, bbox — import qiladigan to'ldirishga o'xshash."""
    mvt = geom.transform(3857, clone=True)
    soddalashtirilgan = mvt.simplify(250, preserve_topology=True)
    if soddalashtirilgan.geom_type == "Polygon":
        soddalashtirilgan = MultiPolygon(soddalashtirilgan, srid=3857)
    return {
        "geom": geom,
        "geom_mvt": mvt,
        "geom_mvt_s": soddalashtirilgan,
        "bbox": list(geom.extent),
    }


@pytest.fixture
def viloyat(db):
    """Viloyat region_id=12: lon 69..70, lat 40..41."""
    return Viloyat.objects.create(
        region_id=12, soato="1712", nom="Sinov viloyati", **geometriya_maydonlari(kvadrat(69, 40, 70, 41))
    )


@pytest.fixture
def tuman(viloyat):
    """Tuman kod=1201: viloyatning chap yarmi."""
    return Tuman.objects.create(
        viloyat=viloyat, kod=1201, soato="1712201", nom="Birinchi tuman", tip="tuman",
        **geometriya_maydonlari(kvadrat(69, 40, 69.5, 41)),
    )


@pytest.fixture
def shahar(viloyat):
    """Shahar kod=1202: viloyatning o'ng yarmi."""
    return Tuman.objects.create(
        viloyat=viloyat, kod=1202, soato="1712202", nom="Sinov shahri", tip="shahar",
        **geometriya_maydonlari(kvadrat(69.5, 40, 70, 41)),
    )


@pytest.fixture
def massiv(tuman):
    """Massiv massiv_id=120101: birinchi tuman ichida."""
    return Massiv.objects.create(
        tuman=tuman, globalid="{00000000-0000-0000-0000-000000120101}", massiv_id=120101, nom="Sinov massivi",
        **geometriya_maydonlari(kvadrat(69.1, 40.1, 69.2, 40.2)),
    )


def kontur_yarat(tuman, manba_fid, geom, **kw):
    """Kontur: geom (4326) dan geom_mvt (3857) ni hisoblaydi."""
    mvt = geom.transform(3857, clone=True)
    kw.setdefault("tuman_geo", tuman)  # sinovlarda geometrik tuman = manba tuman (agar aks aytilmasa)
    return Kontur.objects.create(
        tuman=tuman, manba_fid=manba_fid, geom=geom, geom_mvt=mvt, geom_mvt_s=mvt, maydon_mvt=mvt.area, **kw
    )


@pytest.fixture
def kontur(tuman):
    """Kontur manba_fid=1: birinchi tuman ichida (~1.1 km x 1.1 km)."""
    return kontur_yarat(
        tuman, 1, kvadrat(69.1, 40.1, 69.11, 40.11), kontur_raqami=7, umumiy_maydoni=123.456, haydalma_yer_sug=100.0
    )


@pytest.fixture
def kontur_shahar(shahar):
    """Boshqa tuman (shahar kod=1202) konturi."""
    return kontur_yarat(shahar, 2, kvadrat(69.6, 40.1, 69.61, 40.11), kontur_raqami=8, umumiy_maydoni=50.0)
