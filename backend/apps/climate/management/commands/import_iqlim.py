"""data/era5/ NetCDF -> IqlimKunlik (katak markazidagi eng yaqin nuqta), keyin IqlimOylik/IqlimYillik. Idempotent."""
import datetime as dt
from collections import defaultdict
from pathlib import Path

import numpy as np
from django.conf import settings
from django.core.management.base import BaseCommand
from django.db import connection, transaction

from apps.climate import hisob
from apps.climate.models import IqlimKatak, IqlimKunlik, IqlimYillik

MAYDONLAR = ["t_min", "t_max", "t_ort", "yogin", "et0", "radiatsiya", "shamol", "namlik"]

OYLIK_SQL = """
INSERT INTO climate_iqlimoylik (katak_id, yil, oy, t_min, t_max, t_ort, yogin, et0, radiatsiya, shamol, namlik, kunlar)
SELECT katak_id, EXTRACT(year FROM sana)::int, EXTRACT(month FROM sana)::int,
       avg(t_min), avg(t_max), avg(t_ort), sum(yogin), sum(et0), avg(radiatsiya), avg(shamol), avg(namlik), count(*)
FROM climate_iqlimkunlik WHERE sana >= %s AND sana < %s GROUP BY 1, 2, 3
ON CONFLICT (katak_id, yil, oy) DO UPDATE SET t_min = EXCLUDED.t_min, t_max = EXCLUDED.t_max,
  t_ort = EXCLUDED.t_ort, yogin = EXCLUDED.yogin, et0 = EXCLUDED.et0, radiatsiya = EXCLUDED.radiatsiya,
  shamol = EXCLUDED.shamol, namlik = EXCLUDED.namlik, kunlar = EXCLUDED.kunlar
"""


def _float(x):
    return None if x is None or np.isnan(x) else float(x)


class Command(BaseCommand):
    help = "ERA5 NetCDF -> IqlimKunlik/Oylik/Yillik (to'liq fayl to'plami bor oylar qayta yoziladi)"

    def add_arguments(self, parser):
        parser.add_argument("--yil", type=int)
        parser.add_argument("--oy", type=int)
        parser.add_argument("--papka", default=None)

    def handle(self, *args, yil=None, oy=None, papka=None, **opts):
        papka = Path(papka) if papka else settings.ERA5_DIR
        kataklar = list(IqlimKatak.objects.order_by("id"))
        nuqtalar = [(k.markaz_lon, k.markaz_lat) for k in kataklar]
        yillar = [yil] if yil else range(2016, 2026)
        oylar = [oy] if oy else range(1, 13)
        tegilgan, jami = set(), 0
        for y in yillar:
            for m in oylar:
                yolar = hisob.fayllar_oy(papka, y, m)
                if not yolar:
                    continue
                sanalar, q = hisob.oy_kunlik(yolar, nuqtalar)
                jami += self.saqla_oy(kataklar, sanalar, q, y, m)
                tegilgan.add(y)
                self.stdout.write(f"{y}-{m:02d}: {len(sanalar)} kun")
        for y in sorted(tegilgan):
            self.yillik(y)
        self.stdout.write(f"kunlik qatorlar: {jami}; yillar: {sorted(tegilgan)}")

    @transaction.atomic
    def saqla_oy(self, kataklar, sanalar, q, y, m):
        boshi = dt.date(y, m, 1)
        oxiri = dt.date(y + (m == 12), m % 12 + 1, 1)
        IqlimKunlik.objects.filter(sana__gte=boshi, sana__lt=oxiri).delete()
        qatorlar = [
            IqlimKunlik(katak_id=k.id, sana=sana, **{f: _float(q[f][ti, ki]) for f in MAYDONLAR})
            for ti, sana in enumerate(sanalar)
            for ki, k in enumerate(kataklar)
        ]
        IqlimKunlik.objects.bulk_create(qatorlar, batch_size=5000)
        with connection.cursor() as cur:
            cur.execute(OYLIK_SQL, [boshi, oxiri])
        return len(qatorlar)

    @transaction.atomic
    def yillik(self, y):
        qiymat = defaultdict(list)
        qs = (
            IqlimKunlik.objects.filter(sana__gte=dt.date(y, 1, 1), sana__lte=dt.date(y, 12, 31))
            .order_by("katak_id", "sana")
            .values_list("katak_id", "sana", "t_min", "t_ort", "yogin", "et0")
        )
        for katak_id, *qolgan in qs.iterator(chunk_size=20000):
            qiymat[katak_id].append(qolgan)
        IqlimYillik.objects.filter(yil=y).delete()
        nan = float("nan")
        obj = []
        for katak_id, r in qiymat.items():
            def ustun(i):
                return np.array([nan if x[i] is None else x[i] for x in r], dtype="float64")

            fah, sov, ob, bk, yogin, et0, t_ort = hisob.yillik_hisob(
                [x[0] for x in r], ustun(1), ustun(2), ustun(3), ustun(4)
            )
            obj.append(
                IqlimYillik(
                    katak_id=katak_id, yil=y, fah=fah, sovuqsiz_kunlar=sov, oxirgi_bahorgi_sovuq=ob,
                    birinchi_kuzgi_sovuq=bk, yogin=yogin, et0=et0, t_ort=t_ort,
                )
            )
        IqlimYillik.objects.bulk_create(obj, batch_size=2000)
