# Agroxarita V2 — reja

Holat: 2026-09-29, `V2` branch. V1 kodi `old/` da (faqat o'qish uchun).

## Maqsad

Agroxaritani butun O'zbekiston bo'yicha tayyorlash: ma'lumotlar PostGIS bazasida,
backend (Django) va frontend (React) alohida, UI — V1 dagi kabi.

V1 da tuman ma'lumoti brauzerga to'liq JSON sifatida yuklanardi. Respublikada ~948 ming kontur
bor — shuning uchun geometriya **vektor tile (MVT)** bilan, atribut va statistika **REST API**
bilan beriladi.

## Ma'lumot manbalari (`data/`, git'da yo'q)

| Fayl | Qatlam | Soni | CRS | Mazmuni |
|---|---|---|---|---|
| `regions/regions.shp` | viloyatlar | 14 | 3857 | `name`, `name_lot`, `region_id`, `mhobt` |
| `districts/districts.shp` | tumanlar | 206 | 3857 | `name`, `name_lot`, `viloyat`, `region_id`, `mhobt`, `cad_raqami`, `tip` |
| `GIS.gdb` → `massiv` | massivlar | 0 (hozircha bo'sh) | 3857 | `name`, `name_lot`, `tuman`, `viloyat`, `district_i`, `massiv_id`, `region_id` |
| `GIS.gdb` → `contour` | konturlar | 948 141 | 3857 | yer turi maydonlari, viloyat/tuman/massiv/MFY nomlari, `region_id`, `distrikt_id` |
| `GIS.gdb` → `Soil` | tuproq | 75 480 | 4326 | mexanik tarkib, sho'rlanish, yuvilish, toshlanish, bonitet, yer osti suvi |

Bazada hamma narsa EPSG:4326 ga o'tkaziladi.

## Stack

| Qism | Texnologiya |
|---|---|
| Backend | Python 3.12, Django 5, GeoDjango, DRF, djangorestframework-gis |
| Baza | PostgreSQL 17 + PostGIS 3 (lokal servis) |
| Kesh | Redis 7 — keyinroq (tile/statistika keshi) |
| Frontend | React 19, Vite, TypeScript, Tailwind 4, MapLibre, Zustand, TanStack Query |
| Muhit | Ishlab chiqish — lokal (Windows venv + PostgreSQL); Docker — deploy bosqichida |

## Repo tuzilishi

```
agro-xarita/
├── CLAUDE.md
├── .claude/agents/          subagentlar
├── docs/                    PLAN.md, api.md
├── .env.example
├── backend/
│   ├── CLAUDE.md
│   ├── Dockerfile           GDAL o'rnatilgan Python image
│   ├── requirements.txt
│   ├── manage.py
│   ├── config/              settings (env orqali), urls
│   └── apps/
│       ├── border/          Viloyat, Tuman, Massiv
│       ├── kontur/          Kontur
│       ├── tuproq/          TuproqPoligon
│       └── tiles/           MVT endpointlar
├── frontend/
│   ├── CLAUDE.md
│   ├── Dockerfile
│   ├── package.json
│   └── src/                 V1 UI asosida
└── old/                     V1
```

## Bosqichlar

### 0–1. Backend asosi va hudud — batafsil: [Task.md](Task.md) → Task 1

- Django skeleti, lokal PostgreSQL + PostGIS ulanishi, `/api/health/`.
- `Viloyat`, `Tuman`, `Massiv` modellari va `import_border`.
- Select forma API (viloyat, tuman) va MVT tile (viloyat, tuman, massiv), validatsiya, pytest.

### 1b. Frontend skeleti

- Vite + React + TS + Tailwind 4 + MapLibre, V1 dizayn tokenlari, `frontend/CLAUDE.md`.
- Viloyat → tuman tanlovi, xaritada chegara tile'lari, tanlanganda zoom.
### 2. Kontur

- `Kontur` modeli `contour` qatlami asosida; `distrikt_id` → `Tuman` bog'lanishi tekshiriladi.
- Import staging jadval orqali (ogr2ogr → `INSERT ... SELECT`), `ST_MakeValid`, `ST_Force2D`.
- Kontur MVT tile (zoom bo'yicha soddalashtirish), kontur tafsiloti API, popup.

### 3. Massiv

- `GIS.gdb` → `massiv`: `Massiv` modeli (tuman FK `district_i` orqali, `massiv_id`), import,
  tuman ichidagi massivlar API, xaritada qatlam.

### 4. Tuproq

- `TuproqPoligon` (`Soil`), domen kodlari → nomlar lug'ati.
- Konturga dominant tuproq qiymatlarini fazoviy bog'lash (bonitet, mexanik tarkib, sho'rlanish).

### 5. Statistika va sidebar

- Tuman/viloyat bo'yicha agregatlar (materialized view + Redis kesh).
- V1 sidebar bo'limlari: Hudud, Yer, Tuproq — maydon, ulush, "xaritada ko'rsatish".

### 6. Performans va deploy

- Respublika zoomida tile tezligi, indekslar, kesh; `reviewer` tekshiruvi.
- Docker Compose (db, redis, backend, frontend), production Dockerfile'lar, nginx, GitLab CI.

## Ish tartibi

- Har bosqich: reja → agentlarga parallel vazifa → `reviewer` → commit.
- `old/` dagi mantiq kerak bo'lsa — `old-explorer` (haiku) qisqa xulosa beradi.
- API kontrakti `docs/api.md` da; frontend va backend unga qarab parallel ishlaydi.

## Ochiq savollar

1. Autentifikatsiya: ochiq xarita yoki login/rollar?
2. Deploy: hozirgi server va GitLab CI qoladimi?
3. Agrokimyo (gumus, fosfor, kaliy), ekin xaritalari, iqlim — respublika bo'yicha qachon keladi?
