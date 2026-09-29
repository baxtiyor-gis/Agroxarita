"""Kontur yer turi: python manage.py kontur_tur [--tuman KOD] (tuman_geo bo'yicha)."""
from django.core.management.base import BaseCommand, CommandError

from apps.land.bog_lash import kontur_tur_hisobla


class Command(BaseCommand):
    help = "tur: sug'oriladigan (jami_qx_sug_yeri > 0 yoki haydalma_yer_sug > 0), aks holda aniqlanmagan."

    def add_arguments(self, parser):
        parser.add_argument("--tuman", type=int, default=None, help="faqat shu tuman (tuman_geo) konturlari")

    def handle(self, *args, **o):
        try:
            kontur_tur_hisobla(o["tuman"], self.stdout.write)
        except ValueError as e:
            raise CommandError(str(e))
