from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound
from rest_framework.response import Response

from .api import katak_iqlimi, kontur_katagi


@api_view(["GET"])
def kontur_iqlim(request, id):
    try:
        katak = kontur_katagi(id)
    except LookupError:
        raise NotFound(f"id={id} kontur topilmadi.") from None
    if katak is None:
        raise NotFound(f"id={id} kontur uchun iqlim katagi yo'q.")
    return Response(katak_iqlimi(katak))
