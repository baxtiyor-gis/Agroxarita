from django.db import connection
from django.db.utils import Error as DBError
from rest_framework.decorators import api_view
from rest_framework.exceptions import NotFound, ParseError
from rest_framework.response import Response

from .models import Tuman, Viloyat
from .serializers import (
    TumanRoyxatSerializer,
    TumanSerializer,
    ViloyatRoyxatSerializer,
    ViloyatSerializer,
)


def butun_son(qiymat, nom):
    """Query parametrini butun songa aylantiradi; bo'lmasa 400."""
    try:
        return int(str(qiymat).strip())
    except (TypeError, ValueError):
        raise ParseError(f"'{nom}' parametri butun son bo'lishi kerak.") from None


@api_view(["GET"])
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute("SELECT PostGIS_Lib_Version()")
            postgis = cursor.fetchone()[0]
    except DBError as xato:
        return Response({"status": "xato", "detail": str(xato).splitlines()[0]}, status=503)
    return Response({"status": "ok", "postgis": postgis})


@api_view(["GET"])
def viloyat_royxat(request):
    qs = Viloyat.objects.only("region_id", "nom", "bbox").order_by("nom")
    return Response(ViloyatRoyxatSerializer(qs, many=True).data)


@api_view(["GET"])
def viloyat_batafsil(request, region_id):
    try:
        viloyat = Viloyat.objects.only("region_id", "nom", "soato", "bbox").get(region_id=region_id)
    except Viloyat.DoesNotExist:
        raise NotFound(f"region_id={region_id} viloyat topilmadi.") from None
    return Response(ViloyatSerializer(viloyat).data)


@api_view(["GET"])
def tuman_royxat(request):
    qs = (
        Tuman.objects.select_related("viloyat")
        .only("kod", "nom", "tip", "bbox", "viloyat__region_id")
        .order_by("nom")
    )
    param = request.query_params.get("viloyat")
    if param not in (None, ""):
        region_id = butun_son(param, "viloyat")
        if not Viloyat.objects.filter(region_id=region_id).exists():
            raise NotFound(f"region_id={region_id} viloyat topilmadi.")
        qs = qs.filter(viloyat__region_id=region_id)
    return Response(TumanRoyxatSerializer(qs, many=True).data)


@api_view(["GET"])
def tuman_batafsil(request, kod):
    try:
        tuman = (
            Tuman.objects.select_related("viloyat")
            .only("kod", "nom", "tip", "soato", "bbox", "viloyat__region_id")
            .get(kod=kod)
        )
    except Tuman.DoesNotExist:
        raise NotFound(f"kod={kod} tuman topilmadi.") from None
    return Response(TumanSerializer(tuman).data)
