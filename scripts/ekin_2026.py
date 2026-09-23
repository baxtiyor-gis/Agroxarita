"""
2026-yil ekin xaritasini konturlarga fazoviy bog'lash.

Manba: data/New File Geodatabase.gdb, `ekin_2026` qatlami (EPSG:3857).
Natija: public/data/attrs.json ga `lug.ekin26` va `col.ekin26` qo'shiladi.

Bog'lash — intersect: har bir kontur uchun ekin poligonlari bilan kesishma
maydoni hisoblanadi (UTM 42N — Web Mercator maydonni ~1.7x shishiradi).
Kontur maydonining 5 % dan kichik kesishmalar (chegara siljishi) tashlanadi.

col.ekin26[i] = [[ekin_indeksi, ulush_foiz], ...] — ulush kamayish tartibida.
Shaxsiy maydonlar (fermer nomi, INN, kadastr) ataylab o'qilmaydi — attrs.json
ochiq statik fayl.

Ishga tushirish:  python scripts/ekin_2026.py
"""

import json
import subprocess
import warnings
from pathlib import Path

import geopandas as gpd
import pyogrio

warnings.filterwarnings("ignore")

ILDIZ = Path(__file__).resolve().parent.parent
GDB = ILDIZ / "data" / "New File Geodatabase.gdb"
QATLAM = "ekin_2026"
GEOM = ILDIZ / "public" / "data" / "geom.geojson"
ATTRS = ILDIZ / "public" / "data" / "attrs.json"
UTM = 32642
MIN_ULUSH = 0.05


def ekin_nomlari() -> dict[int, str]:
    """crop_name maydonining kodlangan domeni: kod -> ekin nomi"""
    out = subprocess.run(["ogrinfo", "-json", "-so", str(GDB), QATLAM], capture_output=True)
    meta = json.loads(out.stdout.decode("utf-8"))
    dom = next(f["domainName"] for f in meta["layers"][0]["fields"] if f["name"] == "crop_name")
    # Domenda apostroflar aralash (‘ va ʻ) — app bo'ylab oddiy ' ishlatiladi
    toza = lambda v: v.strip().translate(str.maketrans({"‘": "'", "ʻ": "'", "’": "'", "`": "'"}))
    return {int(k): toza(v) for k, v in meta["domains"][dom]["codedValues"].items()}


def main() -> None:
    nomlar = ekin_nomlari()

    ekin = pyogrio.read_dataframe(GDB, layer=QATLAM, columns=["crop_name"]).to_crs(UTM)
    ekin["geometry"] = ekin.geometry.make_valid()
    ekin["nom"] = ekin.crop_name.map(lambda c: nomlar.get(int(c), f"Kod {c}"))

    kontur = gpd.read_file(GEOM).to_crs(UTM)
    kontur["geometry"] = kontur.geometry.make_valid()
    kontur["k_maydon"] = kontur.area

    kes = gpd.overlay(
        kontur[["id", "k_maydon", "geometry"]],
        ekin[["nom", "geometry"]],
        how="intersection",
        keep_geom_type=True,
    )
    kes["a"] = kes.area
    g = kes.groupby(["id", "nom"], as_index=False).agg(a=("a", "sum"), k=("k_maydon", "first"))
    g["ulush"] = (g.a / g.k).clip(upper=1)
    g = g[g.ulush >= MIN_ULUSH]

    # Lug'at — umumiy maydon bo'yicha kamayish tartibida (legenda tartibi)
    tartib = g.groupby("nom").a.sum().sort_values(ascending=False).index.tolist()
    idx = {n: i for i, n in enumerate(tartib)}

    boy = {}
    for kid, grp in g.sort_values("ulush", ascending=False).groupby("id", sort=False):
        boy[int(kid)] = [[idx[n], round(u * 100)] for n, u in zip(grp.nom, grp.ulush)]

    attrs = json.loads(ATTRS.read_text(encoding="utf-8"))
    attrs["lug"]["ekin26"] = tartib
    attrs["col"]["ekin26"] = [boy.get(int(i), []) for i in attrs["col"]["id"]]
    ATTRS.write_text(json.dumps(attrs, ensure_ascii=False, separators=(",", ":")), encoding="utf-8")

    bor = sum(1 for v in attrs["col"]["ekin26"] if v)
    print(f"{len(tartib)} ekin, {bor} konturda ekin bor (>= {MIN_ULUSH:.0%} ulush)")
    for n in tartib:
        print(f"  {n:32} {g[g.nom == n].a.sum() / 1e4:9.1f} ga")


if __name__ == "__main__":
    main()
