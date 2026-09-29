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
| `old/` | V1 loyiha — **faqat o'qish uchun** | — |
| `docs/` | Reja, API kontrakti, qarorlar | — |

Har papkaning o'z `CLAUDE.md` si bor — o'sha papkada ishlaganda o'qiladi.

## Qoidalar

- `old/` ni o'zgartirma. Undan mantiq kerak bo'lsa — `old-explorer` agentidan qisqa xulosa ol.
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

Batafsil: [dev.md](dev.md). Asosiylari (repo ildizidan):

- `npm run dev` — backend (8000) + frontend (5173); `npm test` — pytest; `npm run check` — lint + build.
- Import (`backend/`, `.venv\Scripts\python.exe manage.py ...`): `import_border` → `import_kontur`
  (oxirida `kontur_tuman` + `kontur_tur` ham) → `import_tuproq`.
- Test bazasi `test_agroxarita`, `--reuse-db`; `--create-db` ishlatilmaydi.

Muhit: Windows, Python 3.11, lokal PostgreSQL 17 + PostGIS.
- Backend GDAL — `backend/.venv` dagi **wheel**; GeoDjango `.env` dagi `GDAL_LIBRARY_PATH`/`GEOS_LIBRARY_PATH` orqali.
- OSGeo4W (`C:\OSGeo4W\bin`: `ogrinfo`, `ogr2ogr`) — faqat ma'lumot tahlili uchun, backend unga bog'lanmaydi.
- Baza ulanishi `backend/.env` da (git'ga kirmaydi).
