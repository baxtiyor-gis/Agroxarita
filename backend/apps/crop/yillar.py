from django.core.cache import cache
from django.db import connection

# yil -> (gdb, qatlam), data papkasiga nisbatan; ro'yxatda yo'q yil -> ("GIS.gdb", "Crop_<yil>")
MANBALAR = {
    **{y: ("ASOSIY_2022_2025.gdb", f"ASOSIY_{y}") for y in (2022, 2023, 2024, 2025)},
    2026: ("asosiy_ekin30092026.gdb", "asosiy_ekin30092026"),
}
# lotin domenli yillar avval import qilinadi (nomlar lotinda qoladi), kirillilari keyin
IMPORT_TARTIBI = (2026, 2025, 2024, 2023, 2022)

EKINLAR_KESH = "ekinlar_royxati_v3"
KESH_KALIT = "ekin_yillari_v1"


def manba(yil):
    return MANBALAR.get(yil, ("GIS.gdb", f"Crop_{yil}"))
KESH_SONIYA = 300


def ekin_yillari():
    """Bazadagi ekin yillari (o'sish tartibida, int). Qisqa muddat keshlanadi; import tugagach `tozala()`."""
    yillar = cache.get(KESH_KALIT)
    if yillar is None:
        with connection.cursor() as c:
            c.execute("SELECT DISTINCT yil FROM crop_konturekin ORDER BY yil")
            yillar = [int(r[0]) for r in c.fetchall()]
        cache.set(KESH_KALIT, yillar, timeout=KESH_SONIYA)
    return yillar


def tozala():
    cache.delete(KESH_KALIT)
    cache.delete(EKINLAR_KESH)
