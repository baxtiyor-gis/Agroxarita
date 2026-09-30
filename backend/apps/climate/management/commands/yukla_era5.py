"""ERA5-Land ni CDS dan yillik NetCDF qilib data/era5/ ga yuklaydi (bor fayl o'tkaziladi)."""
import os
import time

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.climate.hisob import fayllar_yil, kunlik_fayllar_yoz, soatlik_tayyor
from apps.climate.era5 import (
    BOSHLASH, DATASET_SOATLIK, GURUHLAR, TUGASH, fayl_nomi, guruh_yillari, soatlik_nomi, soatlik_sorov, sorov, yil_oylari,
)


class Command(BaseCommand):
    help = "ERA5-Land ni yuklash: --yil Y yoki --boshlash/--tugash (default 2016-2025); --guruh t_min|t_max|tp"

    def add_arguments(self, parser):
        parser.add_argument("--yil", type=int)
        parser.add_argument("--boshlash", type=int, default=BOSHLASH)
        parser.add_argument("--tugash", type=int, default=TUGASH)
        parser.add_argument("--guruh", choices=list(GURUHLAR), action="append")
        parser.add_argument("--soatlik", action="store_true", help="t2m soatlik (oyma-oy) -> mahalliy kunlik t_min/t_max/t_ort")
        parser.add_argument("--import", dest="import_", action="store_true", help="yil fayllari tayyor bo'lsa import_iqlim")

    def handle(self, *args, yil=None, boshlash=BOSHLASH, tugash=TUGASH, guruh=None, import_=False, soatlik=False, **opts):
        import cdsapi

        if not settings.CDS_API_KEY:
            raise CommandError("CDS_API_KEY sozlanmagan (.env)")
        client = cdsapi.Client(url=settings.CDS_API_URL, key=settings.CDS_API_KEY, quiet=True, progress=False)
        papka = settings.ERA5_DIR
        papka.mkdir(parents=True, exist_ok=True)
        if yil:
            boshlash = tugash = yil
        if soatlik:
            return self.handle_soatlik(client, papka, boshlash, tugash, import_)
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

    def handle_soatlik(self, client, papka, boshlash, tugash, import_):
        (papka / "soatlik").mkdir(parents=True, exist_ok=True)
        for y in range(boshlash, tugash + 1):
            for yy, mm in yil_oylari(y):
                self.yukla_oy(client, papka, yy, mm)
            if not soatlik_tayyor(papka, y):
                continue
            if not (papka / fayl_nomi("t_min", y)).exists():
                kunlik_fayllar_yoz(papka, y)
                self.log(f"{y}: kunlik t_min/t_max/t_ort yozildi")
            if import_:
                if fayllar_yil(papka, y):
                    call_command("import_iqlim", yil=y, stdout=self.stdout)
                    self.log(f"{y}: import_iqlim tugadi")
                else:
                    self.log(f"{y}: tp fayllari yetishmaydi, import o'tkazildi")
        self.log("tugadi")

    def log(self, matn):
        self.stdout.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {matn}")
        self.stdout.flush()

    def yukla_oy(self, client, papka, y, m):
        maqsad = papka / soatlik_nomi(y, m)
        if maqsad.exists():
            return
        qulf = maqsad.with_suffix(".lock")
        # boshqa jarayon shu oyni yuklayotgan bo'lsa (yil chegarasidagi dekabr) - kutamiz
        while True:
            try:
                os.close(os.open(qulf, os.O_CREAT | os.O_EXCL | os.O_WRONLY))
                break
            except FileExistsError:
                if maqsad.exists():
                    return
                if time.time() - qulf.stat().st_mtime > 6 * 3600:
                    qulf.unlink(missing_ok=True)
                time.sleep(30)
        try:
            if maqsad.exists():
                return
            tmp = maqsad.with_suffix(".part")
            t0 = time.time()
            for urinish in range(1, 1001):
                try:
                    client.retrieve(DATASET_SOATLIK, soatlik_sorov(y, m), str(tmp))
                    if tmp.exists() and tmp.stat().st_size > 1000:
                        break
                    raise RuntimeError("bo'sh fayl")
                except Exception as e:  # noqa: BLE001 - kalit xabarga tushmasin
                    matn = str(e)
                    self.stderr.write(f"CDS xatosi (t2m {y}-{m:02d}, urinish {urinish}): {type(e).__name__}: {matn[:300]}".replace(chr(10), " "))
                    self.stderr.flush()
                    if any(x in matn for x in ("401", "Unauthorized", "Authentication")):
                        raise CommandError("CDS autentifikatsiya xatosi")
                    time.sleep(120)
            else:
                raise CommandError(f"t2m {y}-{m:02d} yuklanmadi")
            tmp.replace(maqsad)
            self.log(f"t2m {y}-{m:02d}: {maqsad.stat().st_size / 1024:.0f} KB, {time.time() - t0:.0f} s")
        finally:
            qulf.unlink(missing_ok=True)
