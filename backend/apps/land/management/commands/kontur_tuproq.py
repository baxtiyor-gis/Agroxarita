"""Qolgan yerlarni tuproq bilan tekshirish: python manage.py kontur_tuproq [--tuman KOD] [--chegara 0.5]."""
from django.core.management.base import BaseCommand, CommandError

from apps.land.bog_lash import kontur_tuproq_hisobla


class Command(BaseCommand):
    help = "aniqlanmagan konturlar: tuproq bilan qoplanish >= chegara bo'lsa -> qx_tuproq (kontur_tur dan keyin)."

    def add_arguments(self, parser):
        parser.add_argument("--tuman", type=int, default=None, help="faqat shu tuman (tuman_geo) konturlari")
        parser.add_argument("--chegara", type=float, default=0.5, help="qoplanish ulushi (0..1), default 0.5")

    def handle(self, *args, **o):
        try:
            kontur_tuproq_hisobla(o["tuman"], o["chegara"], self.stdout.write)
        except ValueError as e:
            raise CommandError(str(e))