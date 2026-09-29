# Agroxarita API (Task 1)

Backend ↔ frontend kontrakti. Faqat JSON (tile — `.pbf`), pagination yo'q, nomlar faqat lotinda.
Xato javobi: `{"detail": "aniq xabar"}` (status 400/404/503). Dev: backend `http://localhost:8000`.

## Umumiy

| Metod | Yo'l | Javob |
|---|---|---|
| GET | `/api/health/` | `{"status":"ok","postgis":"3.x"}`; baza yo'q bo'lsa `503` `{"status":"xato","detail":...}` |

## Hudud API (select forma uchun)

`bbox` = `[minLon, minLat, maxLon, maxLat]` (EPSG:4326) — tanlanganda xaritani `fitBounds` qilish uchun.
Geometriya API'da qaytmaydi (u tile orqali). Ro'yxatlar `nom` bo'yicha alifbo tartibida.

### GET `/api/viloyatlar/`
```json
[{"region_id": 3, "nom": "Andijon viloyati", "bbox": [71.9, 40.4, 73.1, 41.2]}]
```

### GET `/api/viloyatlar/{region_id}/`
```json
{"region_id": 3, "nom": "Andijon viloyati", "soato": "1703", "bbox": [71.9, 40.4, 73.1, 41.2]}
```
- `region_id` mavjud emas -> `404` `{"detail": "region_id=99 viloyat topilmadi."}`

### GET `/api/tumanlar/?viloyat={region_id}`
Parametrsiz — barcha tumanlar (206 ta). `viloyat` berilsa — shu viloyatniki.
```json
[{"kod": 1201, "nom": "Bulung'ur tumani", "tip": "tuman", "region_id": 12, "bbox": [66.9, 39.5, 67.6, 40.0]}]
```
- `tip`: `tuman` | `shahar`.
- `viloyat` butun son emas -> `400` `{"detail": "'viloyat' parametri butun son bo'lishi kerak."}`
- `viloyat` mavjud emas -> `404` (bo'sh ro'yxat emas).

### GET `/api/tumanlar/{kod}/`
```json
{"kod": 1201, "nom": "Bulung'ur tumani", "tip": "tuman", "soato": "1712201", "region_id": 12, "bbox": [66.9, 39.5, 67.6, 40.0]}
```
- `kod` mavjud emas -> `404`.
- `kod` = `region_id` * 100 + tartib (`12:01` -> `1201`); kontur/massiv bilan bog'lanish shu kod orqali.

## Kontur (Task 7)

### GET `/api/konturlar/{id}/`
Faqat atributlar (geometriya yo'q; xarita — MVT). Javob:
```json
{"id": 965892, "kontur_raqami": 8744, "yagona_kontur": "14:01:08744", "maydon": 18.61, "tur": "sugoriladigan",
 "tuman": {"kod": 1401, "nom": "Bulung'ur tumani"}, "viloyat": {"region_id": 14, "nom": "Samarqand"},
 "massiv": "...", "mfy": "...",
 "yer_turlari": [{"kod": "haydalma_lalmi", "nom": "Haydalma (lalmi)", "maydon": 18.29, "jami": false}],
 "tuproq": {"bonitet": 52, "mexanika": "O'rta qumoqli", "shorlanish": "...", "yuvilish": "...",
            "toshlanish": "...", "klass": "V", "yer_osti_suvi": "1-2", "qoplanish": 0.93},
 "agrokimyo": {
    "kaliy": {"daraja": 2, "daraja_nom": "Kam", "gradatsiya": "101-200", "yil": 2025, "qoplanish": 0.87},
    "fosfor": {"daraja": 2, "daraja_nom": "Kam", "gradatsiya": "16-30", "yil": null, "qoplanish": 1.0},
    "gumus": {"daraja": 3, "daraja_nom": "O'rtacha", "gradatsiya": "0,81-1,20", "yil": 2025, "qoplanish": 1.0}
  },
 "relyef": {"balandlik": {"min": 810.5, "ortacha": 815.2, "max": 821.0},
            "qiyalik": {"ortacha": 1.88, "sinf": "yengil", "sinf_nom": "Yengil (1-3°)"},
            "yonalish": {"kod": "ShSh", "nom": "Shimoli-sharq", "gradus": 38.5}},
 "bbox": [minLon, minLat, maxLon, maxLat]}
```
- `tuman`/`viloyat` — geometrik tuman (`tuman_geo`) bo'yicha; u yo'q bo'lsa manba `tuman`.
- `maydon` — `umumiy_maydoni` (ga, 2 xona).
- `yer_turlari` — faqat 0 dan katta ustunlar, `maydon` (ga) kamayish tartibida; `jami: true` — yig'indi ustunlar (`jami_qx_yeri`, `jami_qx_sug_yeri`), ular boshqa turlarning yig'indisi (qo'shib hisoblanmasin).
- `tuproq` — kontur bilan eng katta kesishuvli tuproq poligoni; kesishuv yo'q bo'lsa `null`. `qoplanish` — kontur maydonining tuproq bilan qoplangan ulushi (0..1, 2 xona, barcha kesishgan poligonlar bo'yicha). Lug'at maydonlari topilmasa `null`.
- `agrokimyo.kaliy` — kontur kesishgan poligonlarning **eng so'nggi yili** ichida eng katta kesishuvli poligon; kesishuv yo'q bo'lsa `null`. `daraja` 1..5 (1 juda kam, 2 kam, 3 o'rtacha, 4 ko'p, 5 juda ko'p; noma'lum bo'lsa `null`), `gradatsiya` — manba matni (mg/kg), `qoplanish` — shu yil poligonlarining kontur ulushi (0..1). `agrokimyo.fosfor` — xuddi shunday tuzilma; manbada yil yo'q, shuning uchun `yil` doim `null` (eng katta kesishuvli poligon olinadi). Fosfor gradatsiyalari mg/kg: `<15`/`0-15` (1), `16-30` (2), `31-45` (3), `46-60` (4), `>60`/`60<` (5) — manba matni o'zgartirilmaydi. `agrokimyo.gumus` — xuddi shunday, lekin 6 daraja (foiz): 1 juda kam (<0,40), 2 kam, 3 o'rtacha (0,81-1,20), 4 ko'proq (1,21-1,60), 5 ko'p (1,61-2,0), 6 yuqori (>2,01); yillar 2020-2025. `maydon` gumus uchun ST_Area(geography) dan hisoblangan (manbada `area` yo'q).
- `massiv`, `mfy` — bazada kirill bo'lsa ham javobda lotinga o'giriladi.
- `relyef` — Copernicus DEM GLO-30 (30 m) dan kontur ichidagi piksellar statistikasi; faqat sug'oriladigan konturlar uchun hisoblangan, aks holda (yoki DEM bo'lmasa) `null`. `balandlik` — dengiz sathidan, m. `qiyalik.ortacha` — gradus (metrik proyeksiyada), `sinf`: `tekis` (<1°), `yengil` (1-3°), `orta` (3-7°), `tik` (>7°). `yonalish` — nishab qaragan tomon (aspect doiraviy o'rtacha): `Sh`, `ShSh`, `Sq`, `JSq`, `J`, `JG`, `G`, `ShG`; `gradus` — azimut (0=shimol, soat yo'nalishida); butunlay tekis konturda `null` bo'lishi mumkin.
- `id` mavjud emas -> `404` `{"detail": ...}`.

## Vektor tile (MVT)

`GET /tiles/{qatlam}/{z}/{x}/{y}.pbf` — XYZ sxema (MapLibre `tiles: ["…/tiles/viloyat/{z}/{x}/{y}.pbf"]`).
Tile ichidagi qatlam nomi = URL dagi `{qatlam}`. Extent 4096, buffer 64.

| Qatlam | Zoom (min–max) | Atributlar | Filtr |
|---|---|---|---|
| `viloyat` | 0–14 | `region_id`, `nom` | — |
| `tuman` | 5–14 | `kod`, `nom`, `tip`, `region_id` | `?viloyat={region_id}` |
| `massiv` | 9–16 (`?tuman=` bilan **6–16**) | `nom`, `kod` (tuman kodi) | `?tuman={kod}` |
| `maska` | 0–16 | — (faqat geometriya) | `?tuman={kod}` **majburiy** |
| `kontur` | 9–18 | `id`, `kontur_raqami`, `maydon` (ga, 2 xona), `tur` (`sugoriladigan` \| `aniqlanmagan`) | `?tuman={kod}` **majburiy** (`tuman_geo` bo'yicha) |

`maska` — tile to'rtburchagi minus tuman geometriyasi (`ST_Difference`); tuman tile'ga tegmasa — butun
tile to'rtburchagi; tile to'liq tuman ichida bo'lsa — `204`. `z < 9` da `geom_mvt_s`. `?tuman` yo'q yoki
butun son emas -> `400`, tuman mavjud emas -> `404`. GeoJSON ishlatilmaydi — geometriya faqat MVT.

`kontur` — tuman konturlari (`land_kontur.geom_mvt`). `?tuman` yo'q yoki butun son emas -> `400`, tuman
mavjud emas -> `404`, zoom 9–18 dan tashqarida -> `204`. `z < 13` da `ST_SimplifyPreserveTopology`
(tolerantlik = piksel/2, piksel = 40075016.68 / (256 * 2^z) m) va maydoni bir piksel'dan kichik konturlar
tashlanadi; `z >= 13` da soddalashtirishsiz. Filtr `tuman_geo_id` indeksi + `geom_mvt && ST_TileEnvelope`.

`?tuman` — **geometrik** tuman (`Kontur.tuman_geo`: kontur bilan eng katta kesishuv maydoni bo'yicha; kontur
kesilmaydi), manba `distrikt_id` (`Kontur.tuman`) emas. `tuman_geo` NULL bo'lgan (hech tumanga tushmagan)
konturlar tile'da chiqmaydi. `tur`: `jami_qx_sug_yeri > 0` yoki `haydalma_yer_sug > 0` -> `sugoriladigan`,
aks holda `aniqlanmagan` (kelajakda kengayadi).
`tuman_geo` va `tur` to'ldirish: `manage.py kontur_tuman [--tuman KOD]`, `manage.py kontur_tur [--tuman KOD]`
(`import_kontur` oxirida avtomatik chaqiriladi). `kontur_tuman --tuman` — tuman_id shu, chegarasiga tegadigan
yoki hozir tuman_geo shu konturlarni qayta hisoblaydi; `kontur_tur --tuman` — `tuman_geo` bo'yicha.

Massiv zoom: filtrsiz — `9–16`; `?tuman={kod}` berilganda — `6–16` (oraliqdan tashqarida `204`).
MapLibre `source` da `minzoom`/`maxzoom` ni jadvaldagidek bering. `z < 9` da soddalashtirilgan
geometriya (`geom_mvt_s`), `z >= 9` da to'liq (`geom_mvt`) ishlatiladi.

Javoblar:

| Holat | Status |
|---|---|
| Tile bor | `200`, `Content-Type: application/vnd.mapbox-vector-tile`, `Cache-Control: public, max-age=3600` |
| Tile bo'sh (obyekt yo'q yoki filtr hech nimani topmadi) | `204` (tanasiz) |
| Zoom qatlam oralig'idan tashqarida | `204` |
| `z` 0–22 dan tashqarida, yoki `x`/`y` `0..2^z-1` dan tashqarida | `400` |
| `viloyat`/`tuman` filtri butun son emas | `400` |
| Noma'lum qatlam | `404` `{"detail": "Noma'lum qatlam: 'x'. Mavjudlari: viloyat, tuman, massiv, maska, kontur."}` |

Tekshiruv tartibi: qatlam (404) -> z/x/y (400) -> filtr (400) -> zoom oralig'i (204) -> bo'sh tile (204).
`?viloyat` faqat `tuman` qatlamiga, `?tuman` faqat `massiv`, `maska` va `kontur` qatlamlariga ta'sir qiladi (boshqasida e'tiborsiz).
