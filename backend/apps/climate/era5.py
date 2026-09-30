"""ERA5-Land so'rovlari va fayl nomlari (yillik fayllar: data/era5/{guruh}_{yil}.nc).

t_min/t_max: `derived-era5-land-daily-statistics` (daily_minimum / daily_maximum, 2m temperature).
tp: bu dataset yig'iladigan (accumulated) o'zgaruvchilarni qo'llamaydi, shuning uchun soatlik
`reanalysis-era5-land` dan har kunning 00:00 UTC qiymati olinadi (00 UTC dagi qiymat = OLDINGI kun
yig'indisi, m). Kun D uchun yog'in = (D+1) kunning 00:00 dagi tp. 2025 uchun 2026-01-01 ham yuklanadi.
"""
DATASET_DERIVED = "derived-era5-land-daily-statistics"
DATASET_SOATLIK = "reanalysis-era5-land"
AREA = [45.6, 55.9, 37.1, 73.2]  # N, W, S, E — O'zbekiston bbox
BOSHLASH, TUGASH = 2016, 2025

GURUHLAR = {
    "t_min": (DATASET_DERIVED, "daily_minimum"),
    "t_max": (DATASET_DERIVED, "daily_maximum"),
    "tp": (DATASET_SOATLIK, None),
}


def fayl_nomi(guruh, yil):
    return f"{guruh}_{yil}.nc"


def guruh_yillari(guruh, boshlash=BOSHLASH, tugash=TUGASH):
    """tp uchun tugash+1 yilning 1-yanvari ham kerak (2025-12-31 yog'ini hisoblash uchun)."""
    yillar = list(range(boshlash, tugash + 1))
    if guruh == "tp" and tugash == TUGASH:
        yillar.append(TUGASH + 1)
    return yillar


def sorov(guruh, yil):
    dataset, stat = GURUHLAR[guruh]
    oylar = [f"{m:02d}" for m in range(1, 13)]
    kunlar = [f"{d:02d}" for d in range(1, 32)]
    if guruh == "tp":
        if yil > TUGASH:  # faqat 1-yanvar
            oylar, kunlar = ["01"], ["01"]
        return {
            "variable": ["total_precipitation"],
            "year": str(yil),
            "month": oylar,
            "day": kunlar,
            "time": ["00:00"],
            "area": AREA,
            "data_format": "netcdf",
            "download_format": "unarchived",
        }
    return {
        "variable": ["2m_temperature"],
        "year": str(yil),
        "month": oylar,
        "day": kunlar,
        "daily_statistic": stat,
        "time_zone": "utc+00:00",
        "frequency": "1_hourly",
        "area": AREA,
        "data_format": "netcdf",
        "download_format": "unarchived",
    }


# --- Soatlik rejim: t2m soatlik (reanalysis-era5-land), bir oy = bir so'rov; kunlik mahalliy (UTC+5) hisoblanadi ---
MAHALLIY_SOAT = 5  # Asia/Tashkent = UTC+5


def soatlik_nomi(yil, oy, kunlar=None):
    """kunlar - oy to'liq bo'lmasa (joriy oy) mavjud kunlar soni: t2m_2026_09_k23.nc."""
    if kunlar is None or kunlar >= oy_kunlari(yil, oy):
        return f"soatlik/t2m_{yil}_{oy:02d}.nc"
    return f"soatlik/t2m_{yil}_{oy:02d}_k{kunlar:02d}.nc"


def oy_kunlari(yil, oy):
    import calendar

    return calendar.monthrange(yil, oy)[1]


def soatlik_sorov(yil, oy, kunlar=None):
    return {
        "variable": ["2m_temperature"],
        "year": str(yil),
        "month": [f"{oy:02d}"],
        "day": [f"{d:02d}" for d in range(1, (kunlar or oy_kunlari(yil, oy)) + 1)],
        "time": [f"{h:02d}:00" for h in range(24)],
        "area": AREA,
        "data_format": "netcdf",
        "download_format": "unarchived",
    }


def yil_oylari(yil, oxirgi=None):
    """Yil kunliklari uchun kerakli soatlik oylar: oldingi yil dekabri (1-yanvar 00-04 mahalliy) + 12 oy.

    oxirgi (date) berilsa va shu yilga tegishli bo'lsa - oylar faqat shu sanagacha (joriy, to'liq bo'lmagan yil).
    """
    oxirgi_oy = oxirgi.month if oxirgi is not None and oxirgi.year == yil else 12
    return [(yil - 1, 12)] + [(yil, m) for m in range(1, oxirgi_oy + 1)]


# --- Joriy (to'liq bo'lmagan) yil: ERA5-Land ~5-7 kun kechikadi, faqat mavjud sanagacha so'raladi ---
KECHIKISH_KUN = 7


def oxirgi_sana(bugun=None):
    """ERA5-Land da to'liq (24 soat) mavjud deb hisoblanadigan oxirgi kun: bugun - KECHIKISH_KUN."""
    import datetime as dt

    return (bugun or dt.date.today()) - dt.timedelta(days=KECHIKISH_KUN)


def oy_mavjud_kunlar(yil, oy, oxirgi=None):
    """(yil, oy) uchun mavjud kunlar soni (oxirgi sanagacha kesilgan); oy oxirgi sanadan keyin bo'lsa 0."""
    n = oy_kunlari(yil, oy)
    if oxirgi is None:
        return n
    if (yil, oy) > (oxirgi.year, oxirgi.month):
        return 0
    if (yil, oy) == (oxirgi.year, oxirgi.month):
        return min(n, oxirgi.day)
    return n


def tp_oy_nomi(yil, oy, kunlar=None):
    """Joriy yil tp si oyma-oy: soatlik/tp_2026_09_k23.nc (00:00 UTC qiymatlari)."""
    if kunlar is None or kunlar >= oy_kunlari(yil, oy):
        return f"soatlik/tp_{yil}_{oy:02d}.nc"
    return f"soatlik/tp_{yil}_{oy:02d}_k{kunlar:02d}.nc"


def tp_oy_sorov(yil, oy, kunlar=None):
    return {
        "variable": ["total_precipitation"],
        "year": str(yil),
        "month": [f"{oy:02d}"],
        "day": [f"{d:02d}" for d in range(1, (kunlar or oy_kunlari(yil, oy)) + 1)],
        "time": ["00:00"],
        "area": AREA,
        "data_format": "netcdf",
        "download_format": "unarchived",
    }
