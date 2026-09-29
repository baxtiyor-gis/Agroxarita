"""Konturlarni geometrik tumanga bog'lash: python manage.py kontur_tuman [--tuman KOD]."""
from django.core.management.base import BaseCommand, CommandError

from apps.land.bog_lash import kontur_tuman_hisobla


class Command(BaseCommand):
    help = "Har konturga eng katta kesishuvli tumanni (tuman_geo) yozadi; kontur kesilmaydi."

    def add_arguments(self, parser):
        parser.add_argument("--tuman", type=int, default=None,
                            help="faqat shu tuman kodi bilan bog'liq konturlar (default: hammasi)")

    def handle(self, *args, **o):
        try:
            kontur_tuman_hisobla(o["tuman"], self.stdout.write)
        except ValueError as e:
            raise CommandError(str(e))
