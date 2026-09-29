"""ERA5-Land kunlik statistikani CDS dan oylik NetCDF qilib data/era5/ ga yuklaydi (bor fayl o'tkaziladi)."""
import time

from django.conf import settings
from django.core.management.base import BaseCommand, CommandError

from apps.climate.era5 import DATASET, GURUHLAR, fayl_nomi, sorov


class Command(BaseCommand):
    help = "ERA5-Land ni yuklash: --yil Y --oy M (ikkalasi ixtiyoriy; default 2016-2025 hammasi)"

    def add_arguments(self, parser):
        parser.add_argument("--yil", type=int)
        parser.add_argument("--oy", type=int)
        parser.add_argument("--boshlash", type=int, default=2016)
        parser.add_argument("--tugash", type=int, default=2025)

    def handle(self, *args, yil=None, oy=None, boshlash=2016, tugash=2025, **opts):
        import cdsapi

        if not settings.CDS_API_KEY:
            raise CommandError("CDS_API_KEY sozlanmagan (.env)")
        client = cdsapi.Client(url=settings.CDS_API_URL, key=settings.CDS_API_KEY, quiet=True, progress=False)
        papka = settings.ERA5_DIR
        papka.mkdir(parents=True, exist_ok=True)
        yillar = [yil] if yil else range(boshlash, tugash + 1)
        oylar = [oy] if oy else range(1, 13)
        for y in yillar:
            for m in oylar:
                for guruh in GURUHLAR:
                    maqsad = papka / fayl_nomi(guruh, y, m)
                    if maqsad.exists():
                        continue
                    t0 = time.time()
                    tmp = maqsad.with_suffix(".part")
                    try:
                        client.retrieve(DATASET, sorov(guruh, y, m), str(tmp))
                    except Exception as e:  # noqa: BLE001 — kalit xabarga tushmasin
                        raise CommandError(f"CDS xatosi ({guruh} {y}-{m:02d}): {type(e).__name__}: {str(e)[:300]}")
                    tmp.replace(maqsad)
                    self.stdout.write(f"{maqsad.name}: {maqsad.stat().st_size / 1024:.0f} KB, {time.time() - t0:.0f} s")
