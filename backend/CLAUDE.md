# Backend (Django 5.2 + GeoDjango + DRF)

Windows, Python 3.11, lokal PostgreSQL 17 + PostGIS 3. Barcha buyruqlar `backend/` ichida (PowerShell).

## O'rnatish
```
python -m venv .venv
.\.venv\Scripts\python -m pip install -U pip
# GDAL — PyPI'da Windows wheel yo'q, alohida (requirements.txt da EMAS):
.\.venv\Scripts\python -m pip install https://github.com/cgohlke/geospatial-wheels/releases/download/v2025.3.30/gdal-3.10.2-cp311-cp311-win_amd64.whl
.\.venv\Scripts\python -m pip install -r requirements.txt
copy .env.example .env        # qiymatlarni to'ldir
```
- `.env` da: `GDAL_LIBRARY_PATH=...\.venv\Lib\site-packages\osgeo\gdal.dll`,
  `GEOS_LIBRARY_PATH=...\.venv\Lib\site-packages\osgeo\geos_c.dll` (to'liq yo'l). OSGeo4W ishlatilmaydi.
- `settings.py` `.env` ni tizim env ustidan yozadi (`overwrite=True`) va `GDAL_DATA`/`PROJ_*` ni wheel
  ichidagi `osgeo/data` ga yo'naltiradi (tizimda OSGeo4W/PostgreSQL qiymatlari bor).
- Bazada `CREATE EXTENSION postgis;` kerak; testlar uchun foydalanuvchida `CREATEDB` va `template1` da postgis (yoki superuser).

## Buyruqlar
```
.\.venv\Scripts\python manage.py migrate
.\.venv\Scripts\python manage.py runserver
.\.venv\Scripts\python manage.py check
.\.venv\Scripts\python manage.py makemigrations --check
.\.venv\Scripts\python -m pytest            # pytest.ini: --reuse-db; sxema o'zgarsa --create-db
```
Health: `GET /api/health/` -> `{"status":"ok","postgis":"3.x"}` (baza yo'q bo'lsa 503).

## Qoidalar
- Faqat `backend/` ichida yoz. Nomlar o'zbekcha lotinda (`Viloyat`, `Tuman`, `Massiv`, `nom`, `kod`).
- Geometriya EPSG:4326 (`geom`); tile uchun `geom_mvt`/`geom_mvt_s` (3857) import vaqtida to'ldiriladi. Hammasiga GiST indeks.
- Ro'yxat endpointlarida N+1 yo'q (`select_related`/`prefetch_related`); statistika (maydon, ulush) bazada.
- Tile: `ST_AsMVT` + `ST_AsMVTGeom`, SQL faqat parametrlar bilan, kerakli ustunlargina.
- DRF: faqat JSON, pagination yo'q. Har yangi endpointga test; `docs/api.md` yangilanadi.
- Umumiy test fixture'lari: `conftest.py` (`viloyat`, `tuman`, `shahar`, `massiv`; `kvadrat`, `geometriya_maydonlari`).
- Migratsiyani o'zing yarat va `makemigrations --check` bilan tekshir. Commit — asosiy sessiya.
