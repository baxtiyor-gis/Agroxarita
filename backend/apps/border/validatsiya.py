"""Umumiy validatsiya yordamchilari (API uchun)."""
from rest_framework.exceptions import ParseError


def butun_son(qiymat, nom):
    """Query parametrini butun songa aylantiradi; bo'lmasa 400."""
    try:
        return int(str(qiymat).strip())
    except (TypeError, ValueError):
        raise ParseError(f"'{nom}' parametri butun son bo'lishi kerak.") from None
