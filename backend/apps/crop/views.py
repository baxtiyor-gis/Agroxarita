from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response

KESH_KALIT = "ekinlar_royxati_v1"
SQL = """
SELECT e.kod, e.nom,
       COALESCE(SUM(x.maydon) FILTER (WHERE x.yil = 2026), 0),
       COALESCE(SUM(x.maydon) FILTER (WHERE x.yil = 2025), 0)
FROM crop_ekinclass e
JOIN crop_konturekin x ON x.ekin_id = e.id
GROUP BY e.kod, e.nom
ORDER BY 3 DESC, 4 DESC, e.kod
"""


@api_view(["GET"])
def ekinlar_royxati(request):
    """Ekinlar: yil bo'yicha jami maydon (ga), 2026 maydoni kamayish tartibida (SQL agregat, keshlangan)."""
    natija = cache.get(KESH_KALIT)
    if natija is None:
        with connection.cursor() as c:
            c.execute(SQL)
            natija = [{"kod": k, "nom": n, "maydon_2026": round(a, 2), "maydon_2025": round(b, 2)}
                      for k, n, a, b in c.fetchall()]
        cache.set(KESH_KALIT, natija, timeout=1800)
    return Response(natija)
