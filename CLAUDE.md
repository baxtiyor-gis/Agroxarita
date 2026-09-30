# Agroxarita V2

O'zbekiston bo'yicha raqamli agroxarita (PF-68 farmoni, 24.04.2026). V1 — Bulung'ur va
Farg'ona pilot, statik JSON bilan (`old/`). V2 — butun respublika, ma'lumotlar PostGIS'da.
Batafsil reja: [docs/PLAN.md](docs/PLAN.md).

## Tuzilma

| Papka | Nima | Stack |
|---|---|---|
| `backend/` | API, vektor tile, import | Django 5, GeoDjango, DRF, PostgreSQL 17 + PostGIS 3 (lokal) |
| `frontend/` | Xarita UI | React 19, Vite, TypeScript, Tailwind 4, MapLibre, Zustand, TanStack Query |
| `data/` | Xom manbalar (git'da yo'q) | `regions/`, `districts/` (shp), `GIS.gdb` (`contour`, `Soil`, `massiv`) |
| `old/` | V1 loyiha — diskda yo'q, **faqat git tarixida**: `git show 767c237^:old/<yo'l>` | — |
| `docs/` | Reja, API kontrakti, qarorlar | — |

Har papkaning o'z `CLAUDE.md` si bor — o'sha papkada ishlaganda o'qiladi.

## Qoidalar

- V1 mantiqi kerak bo'lsa — `old-explorer` agentidan qisqa xulosa ol (u git tarixidan o'qiydi:
  `git ls-tree -r --name-only 767c237^ old/`, `git show 767c237^:old/src/lib/tavsiya.ts`). `old/` ni qayta tiklama.
- Nomlash o'zbekcha lotinda (V1 dagi kabi): `kontur`, `tuman`, `maydon`, `bonitet`.
  Django model/field nomlari ham shunday; texnik atamalar (serializer, view) inglizcha qoladi.
- Backend ↔ frontend kontrakti — `docs/api.md` (keyinroq OpenAPI). Kontraktni o'zgartirsang,
  ikkala tomonni ham xabardor qil (hujjatni yangila).
- API va UI da nomlar faqat lotinda (`name_lot` → `nom`).
- Xarita geometriyasi **faqat MVT** (`/tiles/...pbf`) — GeoJSON endpoint yoki source ishlatilmaydi.
- Katta geo-fayllarni (GeoJSON, GDB, tile) git'ga qo'shma.
- Koordinatalar: bazada EPSG:4326 saqlanadi; tile uchun 3857 ga `ST_Transform`.
- Commit xabarida `Co-Authored-By` qatori bo'lmasin. `git push` — faqat aniq ruxsat bilan.

## UI yo'nalishi (V1 dan saqlanadi)

- agroportal.digitagro.uz uslubi: navy sidebar, oq header, yashil aksent, Inter shrifti.
- Faqat desktop — mobil layout qilinmaydi.
- Chap sidebar = statistika (Hudud, Yer, Tuproq, Agrokimyo, Relyef bo'limlari: maydon, ulush,
  "xaritada ko'rsatish"), filtrlar emas.
- Kontur chegarasi qizil, qalinroq; yer turi 8 guruh; popup qiymatlari bosh harf bilan;
  pastda "© Qishloq xo'jaligi vazirligi". Ranglar manbasi: `old/src/lib/ranglar.ts`.

## Subagentlar (`.claude/agents/`)

Maqsad — parallel ishlash va asosiy kontekstni tejash. Asosiy sessiya rejalaydi va
natijani birlashtiradi; ish agentlarga beriladi:

| Agent | Qachon |
|---|---|
| `backend-dev` | `backend/` dagi har qanday kod: model, migratsiya, API, test |
| `frontend-dev` | `frontend/` dagi har qanday kod |
| `gis-data` | GDB tahlili, import buyruqlari, geometriya tekshiruvi, tile sozlash |
| `old-explorer` | V1 dagi mantiq/rang/formulani topib, qisqa xulosa berish (arzon, faqat o'qiydi) |
| `reviewer` | Tayyor diffni tekshirish (faqat o'qiydi) |

Tasklar **ketma-ket**: avval `backend-dev`, u tugab tekshirilgach `frontend-dev` (parallel emas).
`old-explorer` va `reviewer` kabi mustaqil ishlar parallel bo'lishi mumkin. Agentga vazifa berganda: aniq fayllar, kutilgan natija va
qaytariladigan xulosa formatini yoz — agent sessiya kontekstini ko'rmaydi.

Agentlar uchun: mavjud faylni o'zgartirishdan oldin uni **hozirgi holatida qayta o'qi** (boshqa agent
o'zgartirgan bo'lishi mumkin) va butun faylni `Write` bilan qayta yozma — `Edit` bilan faqat kerakli joyni
o'zgartir. Har task tugagach commit qilinadi, shunda yo'qolgan o'zgarish git'dan tiklanadi.

## Buyruqlar

Ishga tushirish (alohida terminallarda):
- Backend: `cd backend; .venv\Scripts\python.exe manage.py runserver 8000`; testlar — `.venv\Scripts\python.exe -m pytest -q`.
- Frontend: `cd frontend; npm run dev` (5173, `/api` va `/tiles` 8000 ga proksi); tekshiruv — `npm run lint; npm run build`.
- Production (umumiy server, docker compose, CI/CD siz — qo'lda `./deploy/deploy.sh`): [docs/DEPLOY.md](docs/DEPLOY.md).

Import tartibi (`backend/`, `.venv\Scripts\python.exe manage.py ...`):
`import_border` → `import_kontur` (oxirida `kontur_tuman` + `kontur_tur`) → `kontur_tuproq` → `import_tuproq` →
`import_agrokimyo --qatlam Kaliy --korsatkich kaliy` (fosfor, gumus ham) → `hisobla_relyef` → `hisobla_korsatkich` →
`import_ekin --yil 2026` (keyin 2025…2022; manbalar `apps/crop/yillar.py`) → iqlim: `katak_yarat` → `yukla_era5 --soatlik
--boshlash Y --tugash Y --import` (joriy yil: `yukla_era5 --joriy --import`).
`import_kontur` konturlarni qayta yozsa — ko'rsatkich, relyef va ekinlar ham qayta hisoblanadi.

Testlar: baza `test_agroxarita` (PostGIS oldindan yoqilgan), `--reuse-db`; `--create-db` ishlatilmaydi
(`agro-xarita` superuser emas). Dev'da `.env` → `TILE_CACHE_MAX_AGE=0`.

Muhit: Windows, Python 3.11, lokal PostgreSQL 17 + PostGIS.
- Backend GDAL — `backend/.venv` dagi **wheel**; GeoDjango `.env` dagi `GDAL_LIBRARY_PATH`/`GEOS_LIBRARY_PATH` orqali.
- OSGeo4W (`C:\OSGeo4W\bin`: `ogrinfo`, `ogr2ogr`) — faqat ma'lumot tahlili uchun, backend unga bog'lanmaydi.
- Baza ulanishi `backend/.env` da (git'ga kirmaydi).
