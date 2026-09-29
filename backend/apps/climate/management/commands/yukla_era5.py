"""ERA5-Land ni CDS dan yillik NetCDF qilib data/era5/ ga yuklaydi (bor fayl o'tkaziladi)."""
import time

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.climate.hisob import fayllar_yil
from apps.climate.era5 import BOSHLASH, GURUHLAR, TUGASH, fayl_nomi, guruh_yillari, sorov


class Command(BaseCommand):
    help = "ERA5-Land ni yuklash: --yil Y yoki --boshlash/--tugash (default 2016-2025); --guruh t_min|t_max|tp"

    def add_arguments(self, parser):
        parser.add_argument("--yil", type=int)
        parser.add_argument("--boshlash", type=int, default=BOSHLASH)
        parser.add_argument("--tugash", type=int, default=TUGASH)
        parser.add_argument("--guruh", choices=list(GURUHLAR), action="append")
        parser.add_argument("--import", dest="import_", action="store_true", help="yil fayllari tayyor bo'lsa import_iqlim")

    def handle(self, *args, yil=None, boshlash=BOSHLASH, tugash=TUGASH, guruh=None, import_=False, **opts):
        import cdsapi

        if not settings.CDS_API_KEY:
            raise CommandError("CDS_API_KEY sozlanmagan (.env)")
        client = cdsapi.Client(url=settings.CDS_API_URL, key=settings.CDS_API_KEY, quiet=True, progress=False)
        papka = settings.ERA5_DIR
        papka.mkdir(parents=True, exist_ok=True)
        if yil:
            boshlash = tugash = yil
        # yil bo'yicha yuklanadi; yil uchun t_min, t_max, tp (va keyingi yil tp si, 31-dekabr uchun) tayyor bo'lsa import
        imp = set()

        def urin_import(yillar):
            for yy in yillar:
                if import_ and yy not in imp and fayllar_yil(papka, yy):
                    call_command("import_iqlim", yil=yy, stdout=self.stdout)
                    self.stdout.flush()
                    imp.add(yy)

        for y in range(boshlash, tugash + 1):
            for g in guruh or GURUHLAR:
                for yy in guruh_yillari(g, y, y):
                    self.yukla(client, papka, g, yy)
            urin_import([y - 1, y])
        # boshqa ishchi keyingi yil tp sini yuklashini kutib, oxirgi yillarni qayta urinib ko'radi
        for _ in range(60):
            urin_import(range(boshlash, tugash + 1))
            if not import_ or all(yy in imp for yy in range(boshlash, tugash + 1)):
                break
            time.sleep(120)

    def yukla(self, client, papka, g, y):
        maqsad = papka / fayl_nomi(g, y)
        if maqsad.exists():
            return
        tmp = maqsad.with_suffix(".part")
        t0 = time.time()
        dataset = GURUHLAR[g][0]
        for urinish in range(1, 101):
            try:
                client.retrieve(dataset, sorov(g, y), str(tmp))
                break
            except Exception as e:  # noqa: BLE001 - kalit xabarga tushmasin
                matn = str(e)
                xabar = f"CDS xatosi ({g} {y}, urinish {urinish}): {type(e).__name__}: {matn[:300]}".replace("\n", " ")
                self.stderr.write(xabar)
                # navbat to'la (parallel limit) yoki vaqtinchalik xato - kutib qayta uriniladi
                vaqtincha = any(x in matn for x in ("queued", "502", "503", "504", "Timeout", "Connection"))
                if not vaqtincha or urinish == 100:
                    raise CommandError(xabar)
                time.sleep(60)
        tmp.replace(maqsad)
        self.stdout.write(f"{maqsad.name}: {maqsad.stat().st_size / 1024:.0f} KB, {time.time() - t0:.0f} s")
        self.stdout.flush()
