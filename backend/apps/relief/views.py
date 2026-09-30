from django.core.cache import cache
from django.db import connection
from osgeo import ogr
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from .dem import dem_papka
from .dem_tile import kesh_kalit_minmax, klasslar, minmax_keshli


def dem_vrt():
    """data/dem/dem.vrt yo'li; fayl yo'q bo'lsa None."""
    yol = dem_papka() / "dem.vrt"
    return yol if yol.exists() else None


def tuman_geom_3857(kod):
    """Tuman to'liq geometriyasi (3857, ogr); tuman yo'q bo'lsa None."""
    with connection.cursor() as c:
        c.execute("SELECT ST_AsBinary(geom_mvt) FROM border_tuman WHERE kod = %s", [kod])
        qator = c.fetchone()
    return ogr.CreateGeometryFromWkb(bytes(qator[0])) if qator else None


def tuman_minmax_kod(kod):
    """(min, max) yoki None (DEM yo'q / piksel yo'q). Tuman yo'q bo'lsa NotFound."""
    vrt = dem_vrt()
    if vrt is None:
        return None
    if cache.get(kesh_kalit_minmax(kod)) is None:
        geom = tuman_geom_3857(kod)
        if geom is None:
            raise NotFound(f"kod={kod} tuman topilmadi.")
        return minmax_keshli(vrt, kod, lambda: geom)
    return cache.get(kesh_kalit_minmax(kod))


@api_view(["GET"])
def tuman_relyef(request, kod):
    """Tuman balandlik diapazoni va DEM tile rang klasslari (legenda)."""
    if dem_vrt() is None:
        return Response({"detail": "DEM (data/dem/dem.vrt) mavjud emas."}, status=503)
    mm = tuman_minmax_kod(kod)
    if mm is None:
        raise NotFound(f"kod={kod} tuman uchun DEM ma'lumoti yo'q.")
    return Response({"min": mm[0], "max": mm[1], "klasslar": klasslar(*mm)})
