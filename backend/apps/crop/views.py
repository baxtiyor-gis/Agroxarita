from django.core.cache import cache
from django.db import connection
from rest_framework.decorators import api_view
from rest_framework.response import Response

from apps.crop.yillar import EKINLAR_KESH, ekin_yillari

SQL = """
SELECT e.kod, e.nom, x.yil, SUM(x.maydon)
FROM crop_ekinclass e
JOIN crop_konturekin x ON x.ekin_id = e.id
GROUP BY e.kod, e.nom, x.yil
"""


@api_view(["GET"])
def ekinlar_royxati(request):
    """Ekinlar: `yillar` (kamayish) va har ekin uchun yil bo'yicha jami maydon (ga).

    Tartib: eng yangi yil maydoni kamayish, keyin oldingi yillar, keyin kod. SQL agregat, keshlanadi.
    """
    natija = cache.get(EKINLAR_KESH)
    if natija is None:
        yillar = sorted(ekin_yillari(), reverse=True)
        ekinlar = {}
        with connection.cursor() as c:
            c.execute(SQL)
            for kod, nom, yil, maydon in c.fetchall():
                e = ekinlar.setdefault(kod, {"kod": kod, "nom": nom, "maydonlar": {str(y): 0.0 for y in yillar}})
                e["maydonlar"][str(yil)] = round(maydon, 2)
        royxat = sorted(ekinlar.values(),
                        key=lambda e: ([-e["maydonlar"][str(y)] for y in yillar], e["kod"]))
        natija = {"yillar": yillar, "ekinlar": royxat}
        cache.set(EKINLAR_KESH, natija, timeout=1800)
    return Response(natija)
