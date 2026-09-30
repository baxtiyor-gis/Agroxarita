"""ERA5-Land ni CDS dan yillik NetCDF qilib data/era5/ ga yuklaydi (bor fayl o'tkaziladi)."""
import datetime as dt
import os
import time

from django.conf import settings
from django.core.management import call_command
from django.core.management.base import BaseCommand, CommandError

from apps.climate.hisob import (
    fayl_oxirgi_sana, fayllar_yil, kunlik_fayllar_yoz, soatlik_tayyor, tp_birlashtir, tp_tayyor,
)
from apps.climate.era5 import (
    BOSHLASH, DATASET_SOATLIK, GURUHLAR, TUGASH, fayl_nomi, guruh_yillari, oxirgi_sana, oy_mavjud_kunlar, soatlik_nomi,
    soatlik_sorov, sorov, tp_oy_nomi, tp_oy_sorov, yil_oylari,
)


class Command(BaseCommand):
    help = "ERA5-Land ni yuklash: --yil Y yoki --boshlash/--tugash (default 2016-2025); --guruh t_min|t_max|tp"

    def add_arguments(self, parser):
        parser.add_argument("--yil", type=int)
        parser.add_argument("--boshlash", type=int, default=BOSHLASH)
        parser.add_argument("--tugash", type=int, default=TUGASH)
        parser.add_argument("--guruh", choices=list(GURUHLAR), action="append")
        parser.add_argument("--soatlik", action="store_true", help="t2m soatlik (oyma-oy) -> mahalliy kunlik t_min/t_max/t_ort")
        parser.add_argument("--joriy", action="store_true", help="joriy yil (--soatlik --yil <bugungi yil>): mavjud sanagacha, t2m + tp")
        parser.add_argument("--bugun", help="sinov uchun 'bugun' sanasi (YYYY-MM-DD); mavjud sana = bugun - 7 kun")
        parser.add_argument("--import", dest="import_", action="store_true", help="yil fayllari tayyor bo'lsa import_iqlim")

    def handle(
        self, *args, yil=None, boshlash=BOSHLASH, tugash=TUGASH, guruh=None, import_=False, soatlik=False, joriy=False,
        bugun=None, **opts,
    ):
        import cdsapi

        if not settings.CDS_API_KEY:
            raise CommandError("CDS_API_KEY sozlanmagan (.env)")
        client = cdsapi.Client(url=settings.CDS_API_URL, key=settings.CDS_API_KEY, quiet=True, progress=False)
        papka = settings.ERA5_DIR
        papka.mkdir(parents=True, exist_ok=True)
        bugun = dt.date.fromisoformat(bugun) if bugun else dt.date.today()
        if joriy:
            soatlik, yil = True, yil or bugun.year
        if yil:
            boshlash = tugash = yil
        if soatlik:
            return self.handle_soatlik(client, papka, boshlash, tugash, import_, oxirgi_sana(bugun))
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

    def handle_soatlik(self, client, papka, boshlash, tugash, import_, oxirgi=None):
        (papka / "soatlik").mkdir(parents=True, exist_ok=True)
        oxirgi = oxirgi or oxirgi_sana()
        for y in range(boshlash, tugash + 1):
            if oxirgi < dt.date(y, 1, 1):
                self.log(f"{y}: ERA5-Land da hali ma'lumot yo'q (mavjud sana {oxirgi}), o'tkazildi")
                continue
            if oxirgi <= dt.date(y, 12, 31):
                self.handle_qisman(client, papka, y, import_, oxirgi)
                continue
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

    def handle_qisman(self, client, papka, y, import_, oxirgi):
        """Joriy (to'liq bo'lmagan) yil: mavjud oylar/kunlar; qayta ishga tushirilsa faqat yangi qismi yuklanadi."""
        self.log(f"{y}: qisman rejim, mavjud sana {oxirgi}")
        for yy, mm in yil_oylari(y, oxirgi):
            self.yukla_oy(client, papka, yy, mm, oy_mavjud_kunlar(yy, mm, oxirgi))
        for mm in range(1, oxirgi.month + 1):
            self.yukla_tp_oy(client, papka, y, mm, oy_mavjud_kunlar(y, mm, oxirgi))
        if not (soatlik_tayyor(papka, y, oxirgi) and tp_tayyor(papka, y, oxirgi)):
            return
        # fayllar oxirgi sanagacha bo'lmasa (yangi kunlar chiqqan) - qayta yoziladi
        if fayl_oxirgi_sana(papka / fayl_nomi("t_min", y)) != oxirgi or fayl_oxirgi_sana(papka / fayl_nomi("t_max", y)) != oxirgi:
            kunlik_fayllar_yoz(papka, y, oxirgi)
            self.log(f"{y}: kunlik t_min/t_max/t_ort {oxirgi} gacha yozildi")
        if fayl_oxirgi_sana(papka / fayl_nomi("tp", y)) != oxirgi:
            tp_birlashtir(papka, y, oxirgi)
            self.log(f"{y}: tp {oxirgi} gacha birlashtirildi")
        if import_:
            if fayllar_yil(papka, y, qisman=True):
                call_command("import_iqlim", yil=y, qisman=True, stdout=self.stdout)
                self.log(f"{y}: import_iqlim (qisman, {oxirgi} gacha) tugadi")
            else:
                self.log(f"{y}: fayllar yetishmaydi, import o'tkazildi")
        self.log("tugadi")

    def log(self, matn):
        self.stdout.write(f"[{time.strftime('%Y-%m-%d %H:%M:%S')}] {matn}")
        self.stdout.flush()

    def yukla_oy(self, client, papka, y, m, kunlar=None):
        """t2m soatlik oy fayli; kunlar - to'liq bo'lmagan oy uchun mavjud kunlar (nom: ..._k23.nc)."""
        self.yukla_fayl(
            client, papka / soatlik_nomi(y, m, kunlar), DATASET_SOATLIK, soatlik_sorov(y, m, kunlar), f"t2m {y}-{m:02d}",
            eskilar=f"t2m_{y}_{m:02d}_k*.nc",
        )

    def yukla_tp_oy(self, client, papka, y, m, kunlar=None):
        self.yukla_fayl(
            client, papka / tp_oy_nomi(y, m, kunlar), DATASET_SOATLIK, tp_oy_sorov(y, m, kunlar), f"tp {y}-{m:02d}",
            eskilar=f"tp_{y}_{m:02d}_k*.nc",
        )

    def yukla_fayl(self, client, maqsad, dataset, sorov_, nom, eskilar=None):
        if maqsad.exists():
            return
        qulf = maqsad.with_suffix(".lock")
        # boshqa jarayon shu faylni yuklayotgan bo'lsa (yil chegarasidagi dekabr) - kutamiz
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
                    client.retrieve(dataset, sorov_, str(tmp))
                    if tmp.exists() and tmp.stat().st_size > 1000:
                        break
                    raise RuntimeError("bo'sh fayl")
                except Exception as e:  # noqa: BLE001 - kalit xabarga tushmasin
                    matn = str(e)
                    self.stderr.write(f"CDS xatosi ({nom}, urinish {urinish}): {type(e).__name__}: {matn[:300]}".replace(chr(10), " "))
                    self.stderr.flush()
                    if any(x in matn for x in ("401", "Unauthorized", "Authentication")):
                        raise CommandError("CDS autentifikatsiya xatosi")
                    # mavjud bo'lmagan sana/ma'lumot - cheksiz qayta so'ramaymiz (keyingi ishga tushirishda qayta uriniladi)
                    if any(x in matn.lower() for x in ("not available", "none of the data", "no data", "invalid date")):
                        raise CommandError(f"{nom}: ma'lumot hali mavjud emas")
                    time.sleep(120)
            else:
                raise CommandError(f"{nom} yuklanmadi")
            tmp.replace(maqsad)
            if eskilar:  # oldingi qisqaroq (qisman) versiyalar
                for eski in maqsad.parent.glob(eskilar):
                    if eski != maqsad:
                        eski.unlink(missing_ok=True)
            self.log(f"{nom}: {maqsad.stat().st_size / 1024:.0f} KB, {time.time() - t0:.0f} s")
        finally:
            qulf.unlink(missing_ok=True)
