"""ERA5-Land so'rov guruhlari va fayl nomlari (CDS: derived-era5-land-daily-statistics)."""
import calendar

DATASET = "derived-era5-land-daily-statistics"
AREA = [45.6, 55.9, 37.1, 73.2]  # N, W, S, E — O'zbekiston bbox

# guruh kaliti -> (daily_statistic, o'zgaruvchilar)
GURUHLAR = {
    "t_min": ("daily_minimum", ["2m_temperature"]),
    "t_max": ("daily_maximum", ["2m_temperature"]),
    "ort": (
        "daily_mean",
        ["2m_temperature", "2m_dewpoint_temperature", "10m_u_component_of_wind", "10m_v_component_of_wind"],
    ),
    "yigindi": ("daily_sum", ["total_precipitation", "surface_solar_radiation_downwards"]),
}


def fayl_nomi(guruh, yil, oy):
    return f"{guruh}_{yil}_{oy:02d}.nc"


def sorov(guruh, yil, oy):
    stat, oz = GURUHLAR[guruh]
    return {
        "variable": oz,
        "year": str(yil),
        "month": f"{oy:02d}",
        "day": [f"{d:02d}" for d in range(1, calendar.monthrange(yil, oy)[1] + 1)],
        "daily_statistic": stat,
        "time_zone": "utc+00:00",
        "frequency": "1_hourly",
        "area": AREA,
        "data_format": "netcdf",
        "download_format": "unarchived",
    }
