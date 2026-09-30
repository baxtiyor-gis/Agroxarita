# Ishlab chiqish muhiti

## Bitta buyruq bilan ishga tushirish

```powershell
npm run dev
```

Backend va frontend bitta terminalda birga ishga tushadi (loglar `[api]` va `[web]` prefiksi bilan).
Bittasi to'xtasa, ikkinchisi ham to'xtaydi. To'xtatish — `Ctrl+C`.

| Xizmat | Manzil |
|---|---|
| Frontend | http://localhost:5173/map |
| Backend API | http://127.0.0.1:8000/api/health/ |
| Tile'lar | http://127.0.0.1:8000/tiles/{viloyat,tuman,massiv}/{z}/{x}/{y}.pbf |

## Boshqa buyruqlar (repo ildizidan)

| Buyruq | Nima qiladi |
|---|---|
| `npm run dev:api` | Faqat backend (Django, port 8000) |
| `npm run dev:web` | Faqat frontend (Vite, port 5173) |
| `npm test` | Backend testlari (pytest) |
| `npm run check` | Frontend lint + build |
| `npm run setup` | npm paketlarini o'rnatish (ildiz + frontend) |

## Birinchi marta sozlash

Talablar: Windows, Python 3.11, Node.js, PostgreSQL 17 + PostGIS.

1. **npm paketlari:**
   ```powershell
   npm run setup
   ```
2. **Backend venv va GDAL** — batafsil [backend/CLAUDE.md](backend/CLAUDE.md):
   ```powershell
   cd backend
   python -m venv .venv
   .venv\Scripts\python.exe -m pip install <GDAL-3.10.x-cp311-cp311-win_amd64.whl>
   .venv\Scripts\python.exe -m pip install -r requirements.txt
   ```
3. **`.env`:** `backend/.env.example` → `backend/.env`, parol va GDAL yo'llarini to'ldiring.
   Baza foydalanuvchisi — `agro-xarita` (chiziqcha bilan).
4. **Migratsiya va import:**
   ```powershell
   cd backend
   .venv\Scripts\python.exe manage.py migrate
   .venv\Scripts\python.exe manage.py import_border    # viloyat, tuman, massiv (~1 daq)
   .venv\Scripts\python.exe manage.py import_kontur    # 948 ming kontur + tuman_geo + tur (~12 daq)
   .venv\Scripts\python.exe manage.py import_tuproq    # 75 ming tuproq poligoni + lug'atlar
   .venv\Scripts\python.exe manage.py import_ekin --yil 2026   # import_kontur dan keyin; --yil 2025 ham (~3 va ~1 daq)
   ```
   Qayta hisoblash (import qilmasdan), shu tartibda: `kontur_tuman [--tuman KOD]` → `kontur_tur [--tuman KOD]` →
   `kontur_tuproq [--tuman KOD] [--chegara 0.5]` (qolgan yerlar tuproq bilan ≥50% qoplansa → `sugoriladigan`;
   `kontur_tur` uni qayta `aniqlanmagan` qiladi, shuning uchun doim undan keyin). Respublika bo'yicha qo'llangan.
   **Ekin:** `import_ekin --yil YYYY [--viloyat ID ...] [--qayta]` — `import_kontur` konturlarni tozalaganda ekinlar ham o'chadi, qayta ishga tushiring.
   **Relyef:** `yukla_dem` (Copernicus DEM → `data/dem/`), `hisobla_relyef` — `import_kontur` dan keyin qayta ishga tushiriladi.
   **Agrokimyo:** `import_agrokimyo --qatlam Kaliy --korsatkich kaliy`. **Iqlim:** `katak_yarat` → `yukla_era5` → `import_iqlim` (CDS kaliti `.env` da).
   Joriy (to'liq bo'lmagan) yil: `yukla_era5 --joriy --import` (= `--soatlik --yil <bugungi yil>`; mavjud sana = bugun−7 kun, qayta ishga tushirilsa faqat yangi qismi; IqlimKunlik — mavjud kunlar, IqlimOylik — faqat to'liq oylar, IqlimYillik yozilmaydi).
5. **Tile keshi:** `.env` da `TILE_CACHE_MAX_AGE=0` (dev — kesh yo'q); productionda `3600`.

## Testlar haqida

- Testlar alohida `test_agroxarita` bazasida ishlaydi (PostGIS oldindan yoqilgan).
- `pytest.ini` da `--reuse-db` bor. **`--create-db` ishlatmang** — `agro-xarita` superuser emas,
  yangi bazada PostGIS'ni yoqa olmaydi. Test bazasi buzilsa, `postgres` bilan qayta yarating:
  ```sql
  DROP DATABASE test_agroxarita;
  CREATE DATABASE test_agroxarita OWNER "agro-xarita";
  \c test_agroxarita
  CREATE EXTENSION postgis;
  ```
