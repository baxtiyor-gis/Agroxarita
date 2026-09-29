# Vazifalar

## Task 1 — Backend asosi: hudud modellari, import, API va tile

**Maqsad:** Django backend skeleti lokal PostgreSQL + PostGIS ga ulanadi; viloyat, tuman va
massiv bazaga yuklanadi; frontend uchun select forma API'si va xarita uchun MVT tile'lar tayyor.

**Doiraga kirmaydi:** frontend, Docker, Redis, kontur/tuproq.

### Qarorlar

| Savol | Qaror |
|---|---|
| Muhit | Lokal PostgreSQL 17 (`postgresql-x64-17` servisi), backend — Windows venv |
| Baza | Baza va foydalanuvchini foydalanuvchi yaratadi, ulanish ma'lumotlari `.env` ga |
| GDAL | Python wheel (venv ichida), OSGeo4W emas |
| Xarita | MVT tile (PostGIS `ST_AsMVT`) |
| Nomlar | Faqat lotin (`name_lot` → `nom`) |
| Test | pytest-django |

### Ma'lumot tekshiruvi (2026-09-29)

| Tekshiruv | Natija |
|---|---|
| Viloyatlar | 14 ta, `region_id` va `mhobt` unique, `name_lot` to'liq, geometriya valid |
| Tumanlar | 206 ta, `cad_raqami` hammasi `NN:NN` formatda va unique, `mhobt` unique, `name_lot` to'liq |
| `cad_raqami` prefiksi = `region_id` | 206/206 mos — tuman → viloyat bog'lanishi ishonchli |
| Tuman geometriyasi | 186 `Polygon` + 20 `MultiPolygon` → hammasi `MultiPolygon` ga; **3 ta invalid** → `ST_MakeValid` |
| `contour.distrikt_id` ↔ `Tuman.kod` | contour'dagi 173 kodning **hammasi** tumanlarda bor; 33 tumanda kontur yo'q (asosan shaharlar) |
| `massiv` | 3241 obyekt (keyin to'ldirilgan); `district_i` — `Tuman.kod` formatida emas (ketma-ket id), `massiv_id` unique emas (0/NULL/takror) |
| Muhit | Python 3.11.9, PostgreSQL 17 — **PostGIS yo'q**; OSGeo4W GDAL 3.10.3 (faqat tahlil uchun) |

Django versiyasi: **5.2 LTS** (GDAL 3.10 va Python 3.11 bilan mos).

### 0. Oldindan kerak

**Foydalanuvchi tayyorlaydi:**

- [ ] PostgreSQL 17 ga **PostGIS** o'rnatish (Stack Builder → Spatial Extensions → PostGIS 3.x).
      Hozir `C:\Program Files\PostgreSQL\17\share\extension\postgis.control` topilmadi.
- [ ] Baza va foydalanuvchi yaratib, ulanish ma'lumotlarini beradi (host, port, db, user, parol).
      Bazada: `CREATE EXTENSION postgis;`
- [ ] Testlar uchun: foydalanuvchiga `CREATEDB` huquqi. pytest `test_<db>` bazasini yaratadi va
      unga PostGIS kerak — buning uchun **bittasi**: foydalanuvchi superuser (faqat dev), yoki
      `template1` ga `CREATE EXTENSION postgis;` (yangi bazalar uni meros oladi).

**Backend tomonda (Task 1 ichida):**

- [ ] `backend/.venv` — Python 3.11 virtual muhit.
- [ ] GDAL — **wheel orqali** (Python 3.11, `win_amd64`, GDAL 3.10.x); `requirements.txt` da emas,
      alohida o'rnatiladi, yo'li `backend/CLAUDE.md` da yoziladi.
- [ ] GeoDjango wheel ichidagi DLL'larni ishlatadi: `.env` da `GDAL_LIBRARY_PATH`
      (`.venv\Lib\site-packages\osgeo\gdal*.dll`) va `GEOS_LIBRARY_PATH` (`...\osgeo\geos_c.dll`).
      OSGeo4W bilan to'qnashmasligi uchun yo'llar aniq ko'rsatiladi; OSGeo4W faqat
      `ogrinfo`/`ogr2ogr` bilan tahlil uchun qoladi.
- [ ] Import `osgeo.ogr` (wheel) yoki Django `DataSource` orqali o'qiydi — shapefile va
      `GIS.gdb` (OpenFileGDB drayveri) ikkalasi ham.

### 1. Loyiha tuzilmasi

```
backend/
├── CLAUDE.md
├── .env.example          DB_*, SECRET_KEY, DEBUG, GDAL_LIBRARY_PATH, GEOS_LIBRARY_PATH, DATA_DIR
├── requirements.txt      django 5.2, djangorestframework, djangorestframework-gis, psycopg,
│                         psycopg[binary], django-environ, django-cors-headers, pytest, pytest-django
├── pytest.ini
├── manage.py
├── config/
│   ├── settings.py       sozlamalar .env dan; django.contrib.gis, rest_framework, corsheaders
│   └── urls.py           /api/, /tiles/
└── apps/
    ├── border/           modellar, import, API, testlar
    └── tiles/            MVT view'lar, testlar
```

- [ ] `/api/health/` — baza va PostGIS versiyasini tekshiradi → `{"status": "ok", "postgis": "3.x"}`.
- [ ] `backend/CLAUDE.md` — ishga tushirish buyruqlari, qoidalar.
- [ ] `.gitignore`: `.env`, `.venv/`, `__pycache__/`, `.pytest_cache/` — hozir `.env` ignore qilinmagan.
- [ ] CORS: faqat `.env` dagi frontend origin (dev: `http://localhost:5173`); DRF — faqat JSON renderer, pagination yo'q.

### 2. Modellar (`apps/border`)

Har modelda (geometriyalar GiST indeks bilan):

- `geom` — `MultiPolygonField(srid=4326)`: asosiy geometriya (API, keyingi fazoviy so'rovlar).
- `geom_mvt` — `MultiPolygonField(srid=3857)`: tile uchun, import vaqtida to'ldiriladi —
  har so'rovda `ST_Transform` qilinmaydi.
- `geom_mvt_s` — soddalashtirilgan 3857 (`ST_SimplifyPreserveTopology`, ~250 m): past zoom tile'lari
  uchun. Tumanlar manbasi 17 MB — respublika ko'rinishidagi tile'da to'liq geometriya sekin bo'ladi.
- `bbox` — `[minLon, minLat, maxLon, maxLat]`, import vaqtida hisoblanadi.

| Model | Maydonlar | Manba | Kalit |
|---|---|---|---|
| `Viloyat` | `region_id` (unique), `soato` (unique), `nom`, `geom` | `regions.shp`: `region_id`, `mhobt`, `name_lot` | `region_id` |
| `Tuman` | `viloyat` FK, `kod` (unique), `soato` (unique), `nom`, `tip`, `geom` | `districts.shp`: `cad_raqami` `12:01` → `kod=1201`, `mhobt`, `name_lot`, `tip` | `kod` |
| `Massiv` | `tuman` FK, `globalid` (unique), `massiv_id` (unique emas, null), `nom`, `geom` | `GIS.gdb` → `massiv`: `globalid`, `massiv_id`, `name_lot` | `globalid` |

- `Tuman.kod` = `contour.distrikt_id` bilan bir xil format (`1201`) — keyingi bog'lanishlar shu kod orqali.
- `Tuman.tip`: `tuman` / `shahar`. Manbada lotin `T`, kirill `Т` aralash, `Ш` = shahar — normallashtiriladi.

### 3. Import buyrug'i

`python manage.py import_border [--viloyat] [--tuman] [--massiv]` (flag berilmasa — hammasi).

- [ ] Manba yo'llari `DATA_DIR` dan: `regions/regions.shp`, `districts/districts.shp`, `GIS.gdb` (`massiv`).
- [ ] 3857 → 4326, `Polygon` → `MultiPolygon`, noto'g'ri geometriya → `make_valid()` va faqat
      poligon qismlar qoldiriladi (MakeValid `GeometryCollection` qaytarishi mumkin).
- [ ] Nom normallashtirish: manbada apostrof aralash (`‘` 59 ta, `'` 5, `` ` `` 3, `’` 1) —
      `o`/`g` dan keyin `‘`, boshqa joyda `’`; ortiqcha bo'shliqlar olib tashlanadi.
- [ ] Idempotent: kalit bo'yicha `update_or_create`; har qatlam bitta tranzaksiyada.
- [ ] `--tozala` flagi: manbada yo'q bo'lib qolgan yozuvlarni o'chiradi (default — o'chirmaydi,
      faqat hisobotda ko'rsatadi).
- [ ] Bog'lanmagan yozuv (tuman uchun viloyat yo'q, massiv uchun tuman yo'q) — o'tkazib yuboriladi va hisobotga yoziladi.
- [ ] `massiv` qatlami bo'sh bo'lsa — xato emas, ogohlantirish.
- [ ] Massiv → tuman: `district_i` ishlatilmaydi; massiv qaysi tuman bilan eng katta kesishish
      maydoniga ega bo'lsa, o'sha tuman. Hech bir tuman bilan kesishmasa — o'tkaziladi.
      Hisobotda: kesishmaydiganlar soni; 2+ tumanni kesuvchilar soni, ikkinchi tuman ulushi >5%
      bo'lganlar soni va 10 ta namuna.
- [ ] Oxirida hisobot: yuklangan / yangilangan / o'tkazilgan soni. Kutilgan: 14 viloyat, 206 tuman.

### 4. API (select forma uchun)

| Metod | Yo'l | Javob |
|---|---|---|
| GET | `/api/viloyatlar/` | `[{region_id, nom, bbox}]`, nom bo'yicha tartib |
| GET | `/api/viloyatlar/{region_id}/` | `{region_id, nom, soato, bbox}` |
| GET | `/api/tumanlar/?viloyat={region_id}` | `[{kod, nom, tip, region_id, bbox}]`; parametrsiz — 206 tasi hammasi |
| GET | `/api/tumanlar/{kod}/` | `{kod, nom, tip, soato, region_id, bbox}` |

- `bbox` = `[minLon, minLat, maxLon, maxLat]` — tanlanganda xaritani zoom qilish uchun.
- Geometriya API'da qaytarilmaydi (u tile orqali).

### 5. Vektor tile (xarita uchun)

| Yo'l | Qatlam | Zoom | Atributlar |
|---|---|---|---|
| `/tiles/viloyat/{z}/{x}/{y}.pbf` | `viloyat` | 0–14 | `region_id`, `nom` |
| `/tiles/tuman/{z}/{x}/{y}.pbf` | `tuman` | 5–14 | `kod`, `nom`, `tip`, `region_id` |
| `/tiles/massiv/{z}/{x}/{y}.pbf` | `massiv` | 9–16 | `massiv_id`, `nom`, `kod` (tuman) |

- `ST_AsMVTGeom` + zoom bo'yicha `ST_SimplifyPreserveTopology`; `ST_TileEnvelope` bilan filtr.
- Ixtiyoriy filtr: `?viloyat=` (tuman tile), `?tuman=` (massiv tile).
- `z < 9` da `geom_mvt_s`, `z >= 9` da `geom_mvt`.
- SQL faqat parametrlar bilan (`cursor.execute(sql, params)`); qatlam nomi — oq ro'yxatdan.
- `Content-Type: application/vnd.mapbox-vector-tile`, `Cache-Control: public, max-age=3600`.
- Bo'sh tile → `204`.

### 6. Tekshiruv (validatsiya)

- [ ] `viloyat`, `tuman` parametri butun son bo'lmasa → `400` va aniq xabar.
- [ ] Mavjud bo'lmagan `region_id` / `kod` → `404`.
- [ ] `z` 0–22 oralig'idan tashqarida yoki `x`/`y` `2^z` dan katta → `400`.
- [ ] Zoom qatlam oralig'idan tashqarida → `204`.
- [ ] Noma'lum qatlam nomi → `404`.

### 7. Testlar (pytest-django)

Test bazasi PostGIS bilan; fixture — kichik sun'iy poligonlar (haqiqiy `data/` ga bog'liq emas).

- [ ] Modellar: `kod` unique, FK bog'lanishi, `tip` va apostrof normallashtirish.
- [ ] Import: kichik test shapefile'dan yuklash (fixture test ichida GDAL bilan yaratiladi),
      qayta ishga tushirganda dublikat yo'q, bog'lanmagan yozuv o'tkaziladi, bo'sh massiv qatlami
      xato bermaydi, invalid poligon tuzatiladi, `--tozala` ishlaydi.
- [ ] API: ro'yxat, filtr, tartib, `bbox` to'g'ri, 400/404 holatlari.
- [ ] Tile: to'g'ri `Content-Type`, obyekt bor joyda bo'sh emas, bo'sh joyda `204`, noto'g'ri z/x/y → `400`.
- [ ] `/api/health/` → `200`.

### Tayyorlik mezoni

- `python manage.py check` va `makemigrations --check` — toza.
- `python manage.py import_border` → 14 viloyat, 206 tuman.
- `pytest` — hammasi o'tadi.
- Tile'lar MapLibre/QGIS'da ochiladi va chegaralar joyida.
- `docs/api.md` — yuqoridagi endpointlar bilan.

### Ijro tartibi (agentlar)

1. `backend-dev` — tuzilma, sozlamalar, modellar, migratsiya, health, umumiy `conftest.py`.
2. Parallel (fayllar kesishmaydi):
   - `gis-data` — faqat `apps/border/management/`, `apps/border/normalizatsiya.py`, `tests/test_import.py`;
   - `backend-dev` — API, tile, validatsiya, ularning testlari, `docs/api.md`.
3. Asosiy sessiya — haqiqiy `data/` dan import, sonlarni tekshirish, tile'ni QGIS'da ko'rish.
4. `reviewer` — diff tekshiruvi → commit.


---

## Task 2 — Frontend asosi: `/map` sahifasi skeleti

**Maqsad:** V1 home ko'rinishi (header, chap sidebar, xarita) yangi `frontend/` da — ma'lumotsiz,
backendsiz. Keyingi tasklar (select, chegara tile'lari, kontur) shu skeletga ulanadi.

**Doiraga kirmaydi:** backend bilan ulanish, API chaqiruvlari, statistika, legenda, kontur.

### Qarorlar

| Savol | Qaror |
|---|---|
| Routing | `react-router` (v7) — `/` → `/map` redirect, `/map`, 404 |
| Sidebar | Doim ko'rinadi (320px, navy), yig'ish tugmasi yo'q |
| Asosiy xarita | Faqat OSM raster (MapLibre), sputnik yo'q |
| Header select | Viloyat/tuman select'lari bor, lekin bo'sh va `disabled` |
| Paket menejeri | npm (`package-lock.json`), yarn yo'q |
| Qurilma | Faqat desktop |

### 1. Tuzilma

```
frontend/
├── CLAUDE.md
├── index.html              title "Agroxarita", Inter (Google Fonts), favicon
├── package.json            react 19, react-dom, react-router, maplibre-gl, zustand, lucide-react,
│                           clsx, tailwind-merge; dev: vite, @vitejs/plugin-react, typescript,
│                           tailwindcss 4 + @tailwindcss/vite, oxlint
├── vite.config.ts          port 5173; `/api`, `/tiles` proxy — hozircha izohda (keyingi task)
├── tsconfig*.json          strict
├── .oxlintrc.json
├── public/
│   ├── brand/              qxv.png, digitagro.png (old/public/brand dan nusxa)
│   └── favicon.*           old/public dan nusxa
└── src/
    ├── main.tsx
    ├── app/router.tsx      createBrowserRouter
    ├── layouts/MapLayout.tsx   header + sidebar + <Outlet/>
    ├── components/
    │   ├── Header.tsx
    │   ├── Sidebar.tsx
    │   └── ui/             Button, Select, Panel (float-panel)
    ├── features/map/
    │   ├── MapView.tsx     MapLibre xaritasi
    │   ├── MapControls.tsx o'ng tepa boshqaruvlar
    │   └── config.ts       OSM style, markaz, zoom chegaralari
    ├── pages/
    │   ├── MapPage.tsx
    │   └── NotFound.tsx
    ├── store/useUi.ts      faolBolim (sidebar dropdown)
    ├── lib/cn.ts           clsx + tailwind-merge
    └── styles/index.css    @theme tokenlari, .float-panel, .sidebar-navy
```

`features/` — funksiya bo'yicha: keyin `features/border`, `features/kontur` qo'shiladi.

### 2. Dizayn (V1 dan)

- [ ] `styles/index.css` — `old/src/index.css` dagi `@theme` tokenlari aynan: `paper`, `surface`,
      `sunken`, `line`, `ink`, `body`, `muted`, `faint`, `navy`, `navy-light`, `sky`, `leaf*`, `wheat`,
      `water`, `clay`, `score-*`, `--radius-card`, `--font-sans: Inter`.
- [ ] `.float-panel` va `.sidebar-navy` utility'lari V1 dagidek.
- [ ] Shrift — Inter 400/500/600/700, `index.html` orqali.

### 3. Layout

- [ ] **Header** (68px, oq, pastki chegara): logo — "agro" (`leaf`) + "xarita" (`navy`), qisqa tavsif,
      viloyat va tuman `Select` (bo'sh, `disabled`, placeholder "Viloyat" / "Tuman"),
      "Loyiha haqida" tugmasi (hozircha hech narsa qilmaydi).
- [ ] **Sidebar** (320px, `.sidebar-navy`, doim ko'rinadi): tepada logo; bo'limlar dropdown —
      Hudud, Yer, Tuproq, Agrokimyo, Relyef; ochilganda "Ma'lumot yo'q" placeholder;
      bir vaqtda bitta bo'lim ochiq (`useUi.faolBolim`); pastda "© Qishloq xo'jaligi vazirligi".
- [ ] **Xarita** — qolgan joyni to'liq egallaydi, sahifada scroll yo'q.

### 4. Xarita

- [ ] MapLibre, style — OSM raster source (`https://tile.openstreetmap.org/{z}/{x}/{y}.png`,
      atribusiya "© OpenStreetMap contributors"), fon `paper`.
- [ ] Boshlang'ich ko'rinish — butun O'zbekiston (`fitBounds` [55.9, 37.1, 73.2, 45.6]), `minZoom` 4, `maxZoom` 18.
- [ ] `maxBounds` — O'zbekiston atrofi (biroz zaxira bilan).
- [ ] `MapControls` (o'ng tepa, `.float-panel`): yaqinlashtirish, uzoqlashtirish, boshlang'ich
      ko'rinishga qaytish; pastda chapda masshtab (MapLibre `ScaleControl`, metrik).
- [ ] Xarita obyekti komponent o'chganda `remove()` qilinadi (StrictMode'da ikki marta yaratilmasin).

### Tayyorlik mezoni

- `npm run build` va `npm run lint` — xatosiz.
- `npm run dev` → `http://localhost:5173/` → `/map` ga o'tadi; header, sidebar, OSM xarita ko'rinadi.
- Sidebar bo'limlari ochiladi/yopiladi; boshqaruv tugmalari ishlaydi; noma'lum yo'l → 404 sahifa.
- 1440×900 va 1920×1080 da skrinshot bilan tekshirildi (Playwright), V1 ko'rinishiga yaqin.

### Ijro tartibi

1. `frontend-dev` — butun Task 2 (Task 1 bilan parallel ishlashi mumkin — fayllar kesishmaydi).
2. Asosiy sessiya — skrinshot tekshiruvi.
3. `reviewer` — diff → commit.

---

## Task 3 — Viloyat → tuman → massiv tanlovi va xarita

**Maqsad:** header select'lari backendga ulanadi; xarita tanlovga qarab viloyat, tuman va massiv
chegaralarini ko'rsatadi.

### Qarorlar

| Savol | Qaror |
|---|---|
| Tanlash usuli | **Faqat header select'lari** — xaritani bosib tanlash yo'q |
| Viloyat tanlanganda qo'shni viloyatlar | Oddiy ko'rinadi (xiralashtirish yo'q) — 2026-09-29 o'zgartirildi |
| Tuman tanlanganda tashqi hudud | Maska yo'q — 2026-09-29 o'zgartirildi (backend `maska` tile'i qoldi, frontend ishlatmaydi) |
| Massiv nomlari | Ko'rsatilmaydi (hover/popup yo'q) |
| Tanlov holati | URL: `/map?viloyat=14&tuman=1401` (Samarqand → Bulung‘ur) |

### Holatlar

| Holat | Xarita | Kamera |
|---|---|---|
| Hech narsa tanlanmagan | 14 viloyat chegarasi | Butun O'zbekiston |
| Viloyat tanlangan | Tanlangan viloyat chegarasi qalin + uning barcha tumanlari; boshqa viloyatlar xira | `fitBounds(viloyat.bbox)` |
| Tuman tanlangan | **Faqat** shu tuman chegarasi (qizil, qalin) + uning massivlari; tashqarida yengil maska; boshqa viloyat/tumanlar yashirin | `fitBounds(tuman.bbox)` |

### 1. Backend (`backend-dev`)

- [ ] **Massiv zoom:** `?tuman=` berilganda massiv tile'i `z >= 6` dan beriladi (`z < 9` — `geom_mvt_s`);
      filtrsiz — avvalgidek `9–16`.
- [ ] **Maska tile qatlami:** `GET /tiles/maska/{z}/{x}/{y}.pbf?tuman={kod}` — tile to'rtburchagi
      minus tuman geometriyasi (`ST_Difference(ST_TileEnvelope, tuman)`), qatlam nomi `maska`, zoom 0–16
      (`z < 9` — `geom_mvt_s`). Tuman tile'dan tashqarida — butun tile to'rtburchagi; tile to'liq tuman
      ichida — `204`. `?tuman` majburiy (yo'q/butun son emas → `400`, mavjud emas → `404`).
      **GeoJSON ishlatilmaydi — hamma geometriya faqat MVT orqali.**
- [ ] Testlar va `docs/api.md` yangilanadi.

### 2. Frontend (`frontend-dev`)

- [ ] `vite.config.ts`: `/api`, `/tiles` → `http://127.0.0.1:8000` proxy yoqiladi.
- [ ] TanStack Query (`app/providers.tsx`); `features/border/api.ts`: `useViloyatlar()`,
      `useTumanlar(regionId)`; tiplar `docs/api.md` bo'yicha.
- [ ] `features/border/useTanlov.ts` — URL `searchParams` bilan: `viloyat`, `tuman`; viloyat o'zgarsa
      tuman tozalanadi; noto'g'ri qiymat (404) — tanlov tozalanadi.
- [ ] Header: Viloyat select (+ "Barcha viloyatlar"), Tuman select (viloyat tanlanmaguncha `disabled`,
      + "Barcha tumanlar"); yuklanish va xato holatlari.
- [ ] `features/border/BorderLayers.tsx` — MapLibre qatlamlari (tile URL: `${location.origin}/tiles/...`):
  - `viloyat` (line, source zoom 0–14): oddiy — navy; viloyat tanlanganda — tanlangani qalin,
    boshqalari xira (opacity ~0.35); tuman tanlanganda — yashirin.
  - `tuman` (line, source zoom 5–14, filtrsiz tile): `filter` bilan faqat tanlangan viloyat tumanlari;
    tuman tanlanganda — faqat shu `kod`, qizil (`clay`), qalin.
  - `massiv` (fill + line, `?tuman={kod}` bilan tile URL, source zoom 6–16): faqat tuman tanlanganda;
    faqat chegara (navy), to'ldirish yo'q — 2026-09-29 yashil rang olib tashlandi.
  - `maska` (vector fill, `/tiles/maska/{z}/{x}/{y}.pbf?tuman={kod}`, source zoom 0–16): faqat tuman
    tanlanganda, `ink` ~0.25 opacity. GeoJSON source ishlatilmaydi.
- [ ] Kamera: tanlovda `fitBounds(bbox, {padding: 48, duration: 800})`; tanlov tozalansa — boshlang'ich ko'rinish.
- [ ] Hover yo'q, xaritada click bilan tanlash yo'q.

### Tayyorlik mezoni

- `npm run dev` → `/map`: 14 viloyat ko'rinadi.
- Viloyat tanlanganda yaqinlashadi, uning tumanlari chiqadi, qo'shnilar xira.
- Tuman tanlanganda faqat u va massivlari, tashqarisi maska ostida — eng katta tumanda ham massivlar ko'rinadi.
- URL'dan tanlov tiklanadi, "orqaga" ishlaydi.
- Playwright: 3 holat skrinshoti (1440×900); `npm run build`, `npm run lint`, `pytest` — o'tadi.

### Ijro tartibi

1. `backend-dev` (1-bo'lim) → asosiy sessiya `pytest` va `docs/api.md` ni tekshiradi.
2. Keyin `frontend-dev` (2-bo'lim).
3. Asosiy sessiya — integratsiya va skrinshot tekshiruvi.
3. `reviewer` → commit.

---

## Task 4 — `land` app: konturlar (model, import, MVT, xarita)

**Maqsad:** `GIS.gdb` → `contour` (948 141 kontur) bazaga yuklanadi; tuman tanlanganda konturlar
xaritada MVT orqali ko'rinadi.

### Qarorlar

| Savol | Qaror |
|---|---|
| Import kaliti | GDB `OBJECTID` (FID) → `manba_fid` (unique). `kontur_raqami`/`yagona_kontur` takrorlanadi |
| Yer turi maydonlari | **Hammasi** yuklanadi (alohida ustunlar) |
| Frontend | Shu taskka kiradi |
| Zoom | Konturlar `z >= 9` dan |
| Geometriya | Faqat MVT (GeoJSON yo'q) |

### Manba tekshiruvi (2026-09-29)

- 948 141 qator, EPSG:3857, 3D Measured MultiPolygon → `ST_Force2D`.
- `kontur_raqami` — butun son, 1 ta NULL; `umumiy_maydoni` — 0.01…828 953, jami ~16.96 mln (ga), 1 ta NULL.
- `distrikt_id` NULL yo'q, 173 kodning hammasi `Tuman.kod` da bor.
- (`distrikt_id`, `kontur_raqami`) takrori: 5 466 guruh / 12 833 qator; `yagona_kontur` 929 573 unique, 9 bo'sh.

### 1. Model `Kontur` (`apps/land`) — `backend-dev`

| Maydon | Tur | Manba |
|---|---|---|
| `id` | BigAutoField | — (MVT'dagi `id`) |
| `manba_fid` | BigIntegerField, unique | GDB `OBJECTID` / FID |
| `tuman` | FK → `border.Tuman`, index | `distrikt_id` = `Tuman.kod` |
| `kontur_raqami` | IntegerField, null | `kontur_raqami` |
| `yagona_kontur`, `eski_kontur` | CharField, null | shu nomlar |
| `umumiy_maydoni` | FloatField, null (ga) | `umumiy_maydoni` |
| Yer turi ustunlari (~45 ta) | FloatField, null | manbadagi nomlar aynan: `haydalma_yer_sug` … `boshqa_yer`, `jami_qx_yeri`, `jami_qx_sug_yeri` |
| `mfy`, `massiv`, `satr`, `izox` | CharField/TextField, null | shu nomlar (matn, normallashtirilgan) |
| `geom` | MultiPolygon 4326, GiST | `ST_MakeValid(ST_Force2D(...))` → 4326 |
| `geom_mvt` | MultiPolygon 3857, GiST | import vaqtida |

`tuman_shahar`, `viloyat_res`, `region_id` saqlanmaydi (FK orqali olinadi).
Indekslar: `(tuman, kontur_raqami)` (unique emas).

### 2. MVT — `backend-dev`

`GET /tiles/kontur/{z}/{x}/{y}.pbf?tuman={kod}`

- `?tuman` **majburiy** (yo'q/butun son emas → 400, mavjud emas → 404).
- Qatlam nomi `kontur`, zoom **9–18**; oraliqdan tashqarida → 204.
- Atributlar: `id`, `kontur_raqami`, `maydon` (`umumiy_maydoni`, 2 xona).
- `z < 13`: `ST_SimplifyPreserveTopology` (zoomga qarab) + piksel'dan kichik konturlar tashlanadi.
- Parametrli SQL, `Cache-Control` boshqa qatlamlar kabi; `docs/api.md` yangilanadi.

### 3. Admin — `backend-dev`

`KonturAdmin`: `list_display` (kontur_raqami, tuman, umumiy_maydoni), `search_fields` (kontur_raqami, yagona_kontur),
`list_filter` tuman viloyati, `show_full_result_count = False`, `raw_id_fields = ("tuman",)`.

### 4. Import — `gis-data`

`python manage.py import_kontur [--tuman KOD] [--quruq]`

- [ ] `gdal.VectorTranslate` (venv wheel, OSGeo4W emas) → staging jadval (`land_kontur_staging`), FID → `manba_fid`.
- [ ] Bitta SQL `INSERT ... SELECT`: `ST_Force2D` → `ST_MakeValid` → faqat poligon qismlar → `ST_Multi`
      → `ST_Transform(4326)`; `geom_mvt` — 3857; `tuman` — `distrikt_id` join.
- [ ] Idempotent: bitta tranzaksiyada to'liq almashtirish; `--tuman` — faqat shu tuman.
- [ ] Hisobot: yuklangan, bog'lanmagan (tuman yo'q), tuzatilgan/bo'sh geometriya, takror raqamlar soni, vaqt.
- [ ] `umumiy_maydoni` birligini tekshirish: `ST_Area(geom::geography)/10000` bilan namunada solishtirish.
- [ ] Testlar: kichik test manbasi tmp_path'da, idempotentlik, `--tuman`, bog'lanmagan qator.

### 5. Frontend — `frontend-dev` (backend tugagach)

- [ ] Tuman tanlanganda `kontur` vector source: `/tiles/kontur/{z}/{x}/{y}.pbf?tuman={kod}`, minzoom 9, maxzoom 18.
- [ ] Line qatlam: V1 dagidek qizil (`clay`), qalinroq; massivlar ustida, maska ostida emas.
- [ ] `z < 9` da konturlar ko'rinmaydi — xaritada kichik ishora "Konturlarni ko'rish uchun yaqinlashtiring".
- [ ] Hover/click yo'q (keyingi task).

### Tayyorlik mezoni

- `import_kontur` → ~948 ming qator, bog'lanmagan 0; ikkinchi ishga tushirishda soni o'zgarmaydi.
- Eng ko'p konturli tumanda z 9–11 tile hajmi va vaqti o'lchangan (maqsad: < 500 KB, < 300 ms).
- `pytest`, `npm run build`, `npm run lint` — o'tadi; Bulung'ur va eng ko'p konturli tuman skrinshoti.

### Ijro tartibi (ketma-ket)

1. `backend-dev` — model, migratsiya, MVT, admin, testlar, `docs/api.md`.
2. `gis-data` — `import_kontur`, testlar, haqiqiy import va o'lchovlar.
3. Asosiy sessiya — tekshiruv.
4. `frontend-dev` — 5-bo'lim.
5. `reviewer` → commit.

---

## Task 5 — Konturlarni tumanga geometrik bog'lash, tur, Google sputnik, qatlamlar paneli

### Qarorlar

| Savol | Qaror |
|---|---|
| Tumanga bog'lash | Yangi `tuman_geo` — eng katta kesishuv maydoni bo'yicha; kontur **kesilmaydi** |
| `?tuman=` kontur tile filtri | `tuman_geo` bo'yicha |
| Sug'oriladigan | `jami_qx_sug_yeri > 0` **yoki** `haydalma_yer_sug > 0` → `tur = sugoriladigan` |
| Pilot | Avval **Kogon tumani (2004)**, tasdiqdan keyin respublika |
| Sputnik | `https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}` |
| Kontur rangi | `tur` bo'yicha |

### Holat (2026-09-29)

Kogon tumani: `distrikt_id` bo'yicha 8 996 kontur; chegarasi bilan kesishadigani 8 580, ulardan 116 tasi
boshqa tumanga yozilgan — ya'ni ~530 kontur Kogon chegarasidan tashqarida.

### 1. Backend (`backend-dev`)

- [ ] `Kontur.tuman_geo` — FK `border.Tuman`, null, index. `Kontur.tur` — CharField choices
      (`sugoriladigan`, `aniqlanmagan`; keyin kengayadi), default `aniqlanmagan`, index.
- [ ] `manage.py kontur_tuman [--tuman KOD]` — SQL: har kontur uchun `ST_Area(ST_Intersection(k.geom, t.geom))`
      eng katta tuman (avval `&&` + `ST_Intersects`, faqat 2+ tumanga tegadiganlar uchun Intersection hisoblanadi —
      tezlik uchun). `--tuman` — shu tuman chegarasiga tegadigan konturlar. Hisobot: yangilangan, `tuman` ≠ `tuman_geo`
      soni (tumanlar bo'yicha top-10), chegarani kesuvchilar, hech tumanga tushmaganlar, vaqt.
- [ ] `manage.py kontur_tur [--tuman KOD]` — qoida SQL'da: `COALESCE(jami_qx_sug_yeri,0) > 0 OR
      COALESCE(haydalma_yer_sug,0) > 0` → `sugoriladigan`, aks holda `aniqlanmagan`. `--tuman` — `tuman_geo` bo'yicha.
      Hisobot: tur bo'yicha son va gektar.
- [ ] Kontur tile: filtr `tuman_geo_id`; atributlarga `tur` qo'shiladi. Kontrakt `docs/api.md` da.
- [ ] `import_kontur` oxirida ikkala buyruq mantiqi chaqiriladi (yangi import ham to'liq bo'lsin).
- [ ] Testlar: eng katta kesishuv tanlanadi, chegarani kesuvchi, hech biriga tushmaydigan, tur qoidasi (NULL'lar bilan).
- [ ] **Ishga tushirish faqat Kogon (2004)** uchun: `kontur_tuman --tuman 2004`, `kontur_tur --tuman 2004`.
      Respublika bo'yicha — foydalanuvchi tasdiqlagach.

### 2. Frontend (`frontend-dev`, backend tugagach)

- [ ] Asosiy xarita: **OSM** va **Google sputnik** (yuqoridagi URL, atribusiya "© Google").
- [ ] Qatlamlar paneli (o'ng tepa, `.float-panel`, tugma bilan ochiladi): asosiy xarita radio (OSM / Sputnik);
      qatlamlar checkbox — Viloyat, Tuman, Massiv, Kontur. Holat `useUi` da, `localStorage` da saqlanadi (try/catch).
- [ ] Kontur `tur` bo'yicha: `sugoriladigan` — to'ldirish (masalan `water` ~0.35) + chegara; `aniqlanmagan` —
      faqat chegara (`clay`). Sputnik ustida ham ko'rinadigan kontrast.
- [ ] Legenda (chap past, kichik): kontur turlari ranglari — faqat tuman tanlanganda.

### Tayyorlik mezoni

- Kogon: `tuman_geo` bo'yicha konturlar faqat tuman chegarasi ichida (skrinshot); hisobot raqamlari.
- `pytest`, `npm run build`, `npm run lint` — o'tadi.
- Skrinshot: Kogon OSM va Sputnik'da, qatlamlar paneli ochiq holatda.

### Ijro tartibi (ketma-ket)

1. `backend-dev` — 1-bo'lim, Kogon'da ishga tushirish, hisobot.
2. Asosiy sessiya — tekshiruv.
3. `frontend-dev` — 2-bo'lim.
4. Foydalanuvchi tasdiqlagach — respublika bo'yicha `kontur_tuman` va `kontur_tur`.

---

## Task 6 — `soil` app: tuproq poligonlari (model + import)

**Maqsad:** `GIS.gdb` → `Soil` (75 480 poligon, respublika) bazaga yuklanadi. **API, tile va frontend yo'q** — keyingi tasklarda.

### Manba tekshiruvi (2026-09-29)

| Maydon | Holat |
|---|---|
| `globalid` | 75 480 unique, NULL yo'q → import kaliti |
| Geometriya | EPSG:4326, 3D MultiPolygon; 785 invalid |
| `mexanikasi_id`, `shorlanishi_id`, `yuvilishi_id`, `toshlanishi_id`, `klass_id` | GDB coded-value domenlar (kirill); ID — asosiy qiymat |
| `mexanikasi`, `shorlanishi`, … `klasss` (matn) | Lotin, lekin ID bilan **mos emas** (bir ID — turli matn; `klasss` asosan bo'sh) → faqat audit uchun |
| `ball_bonitet` | son, to'liq; `bonitet_bali` (matn) 64 181 bo'sh |
| `yer_osti_suvi_id` | matn, tartibsiz: `1-2`, `1 - 2`, `1,5 - 2`, `>10`, `' '`, NULL (14 374) |
| `cad_raqami` | tuman kodi (`2010` → `Tuman.kod`), 89 bo'sh |
| `maydoni` | son (ga — importda tekshiriladi) |

### 1. Model — `backend-dev`

- App `apps/soil`.
- `TuproqLugat` — domen lug'ati: `tur` (`mexanika` / `shorlanish` / `yuvilish` / `toshlanish` / `klass`),
  `kod` (int), `nom` (lotin; domen kirill nomidan transliteratsiya), unique (`tur`, `kod`).
- `Tuproq`:
  - `globalid` (unique), `tuman` FK (null; `cad_raqami` → `Tuman.kod`, bo'lmasa geometrik — eng katta kesishuv),
  - `mexanika`, `shorlanish`, `yuvilish`, `toshlanish`, `klass` — FK → `TuproqLugat` (null, PROTECT),
  - `bonitet` (float, `ball_bonitet`), `maydon` (float, `maydoni`),
  - `yer_osti_suvi` (matn, normallashtirilgan), `yer_osti_suvi_min`, `yer_osti_suvi_max` (float, metr, null),
  - `massiv_nomi` (matn), `manba` (JSONField — manba matn maydonlari: viloya, tuman, massiv, mexanikasi…klasss, bonitet_bali),
  - `geom` (MultiPolygon 4326, GiST), `geom_mvt` (3857, GiST — keyingi tile uchun).
- Kirill → lotin transliteratsiya util (`apps/border/normalizatsiya.py` uslubida, apostrof qoidasi bilan).
- Admin: ro'yxat (bonitet, mexanika, sho'rlanish, tuman), filtrlar, `show_full_result_count=False`.
- Testlar: model, transliteratsiya, yer osti suvi parse (`1-2`, `1 - 2`, `1,5 - 2`, `>10`, `<1`, `' '`, NULL).

### 2. Import — `gis-data`

`python manage.py import_tuproq [--quruq] [--data-dir]`

- [ ] Domenlar GDB'dan o'qiladi → `TuproqLugat` (update_or_create).
- [ ] Poligonlar: `VectorTranslate` → staging → `INSERT ... SELECT` (Force2D → MakeValid → poligon qismlar → Multi);
      `geom_mvt` 3857; idempotent (TRUNCATE + INSERT bitta tranzaksiyada).
- [ ] Domen ID'si lug'atda yo'q bo'lsa — NULL + hisobot.
- [ ] Hisobot: yuklangan, invalid tuzatilgan, tuman bo'yicha bog'langan (cad / geometrik / bog'lanmagan),
      lug'at bo'yicha taqsimot, yer osti suvi parse qilinmagan qiymatlar ro'yxati, `maydoni` birligi (geografik maydon bilan mediana nisbat).

### Ijro tartibi

1. `backend-dev` — 1-bo'lim → tekshiruv.
2. `gis-data` — 2-bo'lim, haqiqiy import → tekshiruv.
### Natija (2026-09-29)

- `soil_tuproq` 75 480, lug'at 63 (klass 10, mexanika 9, sho'rlanish 9, toshlanish 17, yuvilish 18); pytest 172.
- `maydon` — gektar (geografik maydon bilan mediana 1.0000); jami 4.37 mln ga; bonitet 21–95, mediana 52.
- Tuman: `cad_raqami` bo'yicha — hammasi mos; 89 ta cad bo'sh → geometrik; bog'lanmagan 1.
  1 994 poligon markazi o'z tumani chegarasidan tashqarida (manba `cad_raqami` va chegara farqi — keyin ko'rib chiqiladi).
- `yer_osti_suvi` parse qilinmagan: 1 023 qator, 40 noyob (`10<`, `2-3 м`, `10 <`, `2-3, 3-5`, `-`, `10>`, `>10м`) —
  `yer_osti_suvi_parse` kengaytirilishi kerak.
- Import agenti avtorizatsiya xatosi bilan to'xtadi; ma'lumot to'liq yuklangan, tekshiruv asosiy sessiyada qilindi.

### Keyingi: Bulung'ur (1401) — qolgan yerlarni tuproq bilan tekshirish

`tur = aniqlanmagan` konturlar: tuproq poligonlari bilan qoplanishi ≥ 50% → yangi tur `qx_tuproq`
("Qishloq xo'jaligi yeri (tuproq bo'yicha)"); frontend QX qatlami `sugoriladigan` + `qx_tuproq` ni ko'rsatadi.
Avval hisobot (son, ga), keyin yangilash.

---

## Task 7 — Kontur bosilganda chap panel (V1 kabi)

**Maqsad:** kontur bosilganda chapda 400px panel ochiladi: sarlavha + tablar. Mavjud ma'lumot — haqiqiy
(kontur atributlari, tuproq), qolgan tablar — mock.

### 1. Backend — `backend-dev`

`GET /api/konturlar/{id}/` (faqat atributlar, geometriya yo'q):

```json
{
  "id": 965892, "kontur_raqami": 8744, "yagona_kontur": "14:01:08744", "maydon": 18.61,
  "tur": "sugoriladigan", "tuman": {"kod": 1401, "nom": "Bulung‘ur tumani"},
  "viloyat": {"region_id": 14, "nom": "Samarqand"}, "massiv": "...", "mfy": "...",
  "yer_turlari": [{"kod": "haydalma_lalmi", "nom": "Haydalma (lalmi)", "maydon": 18.29}],
  "tuproq": {"bonitet": 52, "mexanika": "O‘rta qumoqli", "shorlanish": "...", "yuvilish": "...",
             "toshlanish": "...", "klass": "V", "yer_osti_suvi": "1–2", "qoplanish": 0.93} | null,
  "bbox": [..]
}
```

- `yer_turlari` — faqat 0 dan katta ustunlar, kamayish tartibida; o'qiladigan nomlar lug'ati.
- `tuproq` — kontur bilan eng katta kesishuvli tuproq poligoni (bazada, bitta so'rov); yo'q bo'lsa `null`.
- Mavjud bo'lmagan id → 404. Test + `docs/api.md`.

### 2. Frontend — `frontend-dev`

- Kontur bosilganda (popup o'rniga) `?kontur={id}` URL'ga yoziladi va chapda panel ochiladi (sidebar ustida,
  `left-3 top-3 bottom-3`, 400px, oq, `rounded-card`, soya); X yoki Esc bilan yopiladi.
- Xaritada tanlangan kontur — oq qalin chegara (`kontur-tanlangan`, filter id bo'yicha).
- Sarlavha: "Kontur {kontur_raqami}", massiv · MFY; badge'lar: maydon (ga), tur.
- Tablar (V1 tartibi, lucide ikonalar): **Ma'lumot** (haqiqiy: identifikatorlar, tuman, yer turlari jadvali),
  **Tuproq** (haqiqiy: bonitet shkalasi, mexanika, sho'rlanish, yuvilish, toshlanish, klass, yer osti suvi;
  agrokimyo — mock), **Tavsiya**, **Ekinlar**, **Iqlim**, **Relyef** — mock (aniq "Namuna ma'lumot" belgisi bilan).
- V1 komponentlari uslubida: `Satr` (100px label + qiymat), badge, shkala (h-4px).
- Default ochiq tab — Ma'lumot.

### Ijro tartibi

1. `backend-dev` (border refaktori tugagach) → tekshiruv. 2. `frontend-dev` → skrinshot tekshiruvi. 3. Commit.

---

## Task 8 — Agrokimyo: kaliy (`GIS.gdb` → `Kaliy`)

### Manba (2026-09-29)

- 103 000 poligon, EPSG:3857, MultiPolygon. Yillar: 2020 (18 973), 2022 (14 577), 2023 (24 620), 2024 (55 830) —
  bir joy turli yillarda takrorlanishi mumkin.
- `darajasi` / `gradatsiyasi` (mg/kg): Juda kam `<100`, Kam `101-200`, O'rtacha `201-300`, Ko'p `401-500`, Juda ko'p `>400`
  (manbada gradatsiyalar biroz nomuvofiq — matn sifatida saqlanadi).
- `district_cad` — tuman kodi (130 xil, `Tuman.kod`), `area` — ga (tekshiriladi), `region`/`district` — domen kodlari.

### Qarorlar

- Umumiy model `soil.Agrokimyo` — keyin gumus, fosfor ham shu jadvalga (`korsatkich`).
- Daraja — tartibli kod: 1 juda kam, 2 kam, 3 o'rtacha, 4 ko'p, 5 juda ko'p.
- Konturga: eng so'nggi yil ichida eng katta kesishuv.

### 1. Backend — `backend-dev`

- Model `Agrokimyo`: `korsatkich` (`kaliy`/`fosfor`/`gumus`, index), `yil` (int, index), `daraja` (1..5, null),
  `daraja_nom`, `gradatsiya` (matn), `tuman` FK (null; `district_cad` → kod, bo'lmasa eng katta kesishuv), `maydon` (ga),
  `manba` JSON (viloyat, tuman, region, district, region_cad), `geom` 4326 + `geom_mvt` 3857 (GiST). Admin.
- `import_agrokimyo --qatlam Kaliy --korsatkich kaliy` — staging → INSERT…SELECT (Force2D, MakeValid, Multi),
  shu `korsatkich` qatorlarini almashtiradi (bitta tranzaksiya). Daraja matndan: `Juda kam`→1 … `Juda ko'p`→5
  (apostrof variantlari). Hisobot: soni, yil/daraja taqsimoti, tuman bog'lanishi, `area` birligi (mediana nisbat), invalid.
- `GET /api/konturlar/{id}/` ga `agrokimyo`: `{"kaliy": {"daraja": 2, "daraja_nom": "Kam", "gradatsiya": "101-200",
  "yil": 2024, "qoplanish": 0.87} | null}` (eng so'nggi yil, eng katta kesishuv). `docs/api.md`, testlar.
- Haqiqiy import va Bulung'ur (1401) namunaviy konturlarda tekshiruv.

### 2. Frontend — `frontend-dev` (Task 7 paneli tugagach)

- Kontur panelidagi Tuproq tab → agrokimyo blokida **Kaliy** — haqiqiy (V1 dagi daraja ko'rinishi, yil bilan);
  gumus, fosfor — mock qoladi.

---

## Task 9 — `climate` app: 10 yillik ob-havo (sug'oriladigan yerlar, 0.1° grid)

**Qarorlar:** manba — Copernicus CDS, ERA5-Land (API kalit foydalanuvchidan); grid 0.1° — sug'oriladigan konturlar
tushgan **1 448 katak**; davr — 2016-01-01…2025-12-31 (10 yil).

- **Modellar:** `IqlimKatak` (katak kodi, `geom` 0.1° to'rtburchak 4326 + `geom_mvt`, markaz, sug'oriladigan maydon ga,
  tuman — eng katta ulush); `IqlimKunlik` (katak FK, sana; t_min, t_max, t_ort, yog'in mm, ET0 mm, radiatsiya,
  shamol, nisbiy namlik — unique katak+sana; ~5.3 mln qator); `IqlimOylik` (katak, yil, oy — agregatlar);
  `IqlimYillik` (katak, yil: FAH >10°C, sovuqsiz kunlar, oxirgi bahorgi / birinchi kuzgi sovuq, yillik yog'in, ET0).
- **Yuklash:** `cdsapi` bilan O'zbekiston bbox bo'yicha oylik NetCDF (`reanalysis-era5-land`, kunlik agregat yoki soatlik→kunlik),
  `data/era5/` ga (git'da yo'q); `import_iqlim` — NetCDF → katak markazidagi qiymatlar → `IqlimKunlik`, keyin oylik/yillik.
  Qayta ishga tushirsa davom etadi (yuklangan oylar o'tkaziladi).
- **API:** `GET /api/konturlar/{id}/` ga `iqlim` (kontur tushgan katak: yillik ko'rsatkichlar + 12 oylik o'rtacha).
- **Frontend (keyin):** kontur panelidagi Iqlim tab — haqiqiy (V1 tuzilishida).
- **Kerak:** CDS akkaunt + API kalit (`~/.cdsapirc`), ERA5-Land litsenziyasini akkauntda qabul qilish.

---

## Task 10 — `relief` app: balandlik (Copernicus DEM GLO-30)

**Qarorlar:** manba — Copernicus DEM GLO-30 (AWS open data, kalitsiz); faqat **sug'oriladigan** konturlar (~730 ming).

- DEM tile'lar (1°×1°, `s3://copernicus-dem-30m` / HTTPS) sug'oriladigan konturlar bbox bo'yicha `data/dem/` ga,
  VRT mozaika. Qiyalik va yo'nalish (`gdal.DEMProcessing`, metrik proyeksiyada).
- **Model:** `KonturRelyef` (OneToOne `land.Kontur`): balandlik min / o'rtacha / max (m), qiyalik o'rtacha (°),
  qiyalik sinfi (tekis <1°, yengil 1–3°, o'rta 3–7°, tik >7°), yo'nalish (asosiy tomon: Sh, ShSh, …), hisoblangan sana.
- **Hisoblash:** `hisobla_relyef [--tuman KOD]` — zonal statistika (tuman bo'yicha bo'laklarda, parallel ishchilar mumkin),
  qayta ishga tushirsa davom etadi.
- **API:** `GET /api/konturlar/{id}/` ga `relyef`. **Frontend (keyin):** Relyef tab — haqiqiy.