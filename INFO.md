# Agroxarita — texnik ma'lumot

> Loyiha haqida umumiy ma'lumot: [README.md](README.md)

Bulung'ur tumani qishloq xo'jaligi yerlari uchun raqamli agroxarita: har bir kontur bo'yicha tuproq tarkibi, relyef va agrokimyoviy ko'rsatkichlar tahlil qilinib, eng maqbul ekin turlari tavsiya etiladi.

```bash
npm install
npm run dev      # http://localhost:5173
npm run build
```

---

## Loyiha maqsadi

Xorijiy tajriba asosida tajriba-sinov tariqasida Farg'ona va Bulung'ur tumanlaridagi qishloq xo'jaligi yer maydonlarida har bir kontur bo'yicha tuproq tarkibi, joylashuv relyefi, suv bilan ta'minlanganlik darajasi, so'nggi o'n yillikdagi meteorologik va agrotexnik ko'rsatkichlarni tahlil qilib, eng maqbul ekin turlarini joylashtirish.

| Omil | Holat |
|---|---|
| Tuproq tarkibi | ✅ bonitet, mexanika, sho'rlanish, gumus / fosfor / kaliy |
| Relyef | ✅ SRTM 30 m DEM — balandlik, qiyalik, yo'nalish |
| Suv ta'minoti | ✅ sug'orma dehqonchilik zonasi deb qabul qilingan |
| Meteorologiya | ❌ hali yo'q |

---

## Ma'lumot manbalari

`Data/Shape/` ichida:

| Fayl | Mazmuni |
|---|---|
| `Contour.shp` | **9 259 kontur**, 55 atribut (yer turlari maydoni, MFY, massiv) |
| `district.shp` | Tuman chegarasi (kadastr 14:01) |
| `New File Geodatabase.gdb` | `soil` (251 poligon: bonitet, mexanika, sho'rlanish), `Kaliy` / `Gumus` / `Fosfor` (5 823 poligon) |
| `Contour_joined.gpkg` | Barcha manbalar birlashtirilgan natija (QGIS'da ko'rish uchun) |
| `TAHLIL.md` | Ma'lumot tahlili va sifat hisoboti |

### Fazoviy bog'lash

Kalitlar mos kelmagani uchun (`рақами` bo'sh, `yangi_k_r` ↔ `kontur_raq` diapazoni farq qiladi) bog'lash **faqat fazoviy** amalga oshirilgan: `ST_Intersects`, bir nechta mos kelsa **eng katta kesishma maydoni** bo'yicha.

| Bog'lanish | Qamrov |
|---|---|
| Agrokimyo → Contour | 8 211 / 9 257 (88.7 %) |
| Tuproq (soil) → Contour | 8 184 / 9 257 (88.4 %) |

Sifat: **yuqori** (≥90 % qoplama) 4 537 kontur, **o'rta** 2 555, **past** 1 356. Har bir konturda `join_sifati` belgisi saqlanadi — past sifatli bog'lanishlar UI'da ochiq ko'rsatiladi.

> **CRS ogohlantirishi:** manba fayllar Web Mercator (EPSG:3857) da. Bu 40° kenglikda maydonni ~1.7× shishiradi. Barcha maydon hisob-kitoblari UTM 42N (EPSG:32642) da bajarilgan.

---

## Tavsiya algoritmi

`src/lib/tavsiya.ts` — Agrobooks qo'llanmasidagi agrotexnik me'yorlar asosida (37 ekin, `public/data/crops.json`).

```
ball = 100 × bonitet × sho'rlanish × suv × mexanika × qiyalik × foydalanish × ahamiyat
     − agrokimyo_jarimasi
```

Har bir ko'paytuvchi o'z sababini qaytaradi va kartochkada ko'rsatiladi — shuning uchun "nega bu tavsiya?" tugmasi kerak emas.

### Muhim qoidalar

- **Mavsum bo'yicha guruhlash.** Bug'doy (kuzgi) va g'o'za (bahorgi) raqib emas — ular almashlab ekish tizimining turli qismlari. Guruhlamasa ro'yxat noto'g'ri tanlovga majburlaydi.
- **Asosiy ekinlarga ustunlik.** Diapazon ataylab tor (1.0–0.88): ahamiyat tartiblashga ta'sir qiladi, ammo tuproq shartlarini bosib ketmaydi.
- **Unumdor yerga oziqa ekini tavsiya etilmaydi.** Bonitet ≥75 da yem-xashak ×0.5, 65–74 da ×0.7.
- **Dukkakli ekinlar** gumus kam yerda kam jarima oladi — azotni o'zi to'playdi.
- **Tuproq mexanikasiga guruh sezgirligi.** Og'ir gilli tuproqda sabzavot 0.7, g'alla 0.9; qumoqda teskari.
- **Ko'p yillik ekinzorni** (bog', uzumzor) bir yillik ekinga almashtirish jarimalanadi.
- **Tuproq o'rganilmagan konturlar.** Bonitet ma'lumoti yo'q 1 073 konturning asosiy qismi lalmi (lalmilarning 72 %) va yaylov (59 %) — bonitirovka sug'oriladigan dala yerlarida o'tkazilgan. Bunday konturlarda koeffitsient 0.55 va "dala tekshiruvi kerak" ogohlantirishi.
- **Sho'rxok yerlar** (354 kontur) — melioratsiyasiz hech qanday ekin o'smaydi, past ball va aniq shart bilan ko'rsatiladi.

---

## Tuzilishi

```
src/
  lib/
    types.ts       Crop, AttrPack, Kontur, Tavsiya turlari
    data.ts        ma'lumot yuklash, ustunli saqlashdan obyektga yig'ish
    tavsiya.ts     moslik bali va mavsum bo'yicha guruhlash
    ranglar.ts     klasslangan shkalalar (gradient emas)
    utils.ts
  store/
    useApp.ts      filtr, tanlov, qatlam holati (zustand)
  components/
    Xarita.tsx          MapLibre, sun'iy yo'ldosh, DEM, feature-state ranglash
    XaritaBoshqaruv.tsx o'ng tepadagi vertikal panel: qatlamlar, home, zoom
    Legenda.tsx         klasslangan legenda, katakka bosilsa filtr
    KonturKarta.tsx     chap kartochka: Tavsiya / Tuproq / Relyef / Ma'lumot
    FiltrPanel.tsx      chap panel, akkordeon filtrlar
    EkinTanlov.tsx      ekin mosligi tanlovi (mavsum → guruh)
    Logo.tsx, Shkala.tsx
public/data/
  attrs.json     9 257 kontur atributlari (0.62 MB, ustunli saqlash)
  geom.geojson   geometriya (2.9 MB, gzip 0.4 MB)
  crops.json     37 ekin agrotexnik me'yorlari
```

**Stek:** Vite + React 19 + TypeScript, Tailwind v4, MapLibre GL JS, zustand, lucide-react.

Backend yo'q — hamma narsa statik, tavsiya brauzerda hisoblanadi.

### Nega ustunli saqlash

9 257 obyekt uchun `{id, massiv, bonitet, ...}` massivi ~2.5 MB bo'lardi. Ustunlar + lug'atlar (`lug.massiv`, `lug.mfy`, `lug.grad`) bilan **0.62 MB**. `data.ts` dagi `kontur(i)` funksiyasi kerak bo'lganda obyektga yig'adi.

---

## Ma'lumotlar

`public/data/` ichidagi uch fayl repo tarkibida — app ularni to'g'ridan-to'g'ri o'qiydi, backend kerak emas.

| Fayl | Hajm | Mazmuni |
|---|---|---|
| `attrs.json` | 0.62 MB | 9 257 kontur atributlari (ustunli saqlash) |
| `geom.geojson` | 2.9 MB | Geometriya, WGS84, soddalashtirilgan |
| `crops.json` | 0.04 MB | 37 ekin agrotexnik me'yorlari |

### 2026-yil ekinlari

`data/New File Geodatabase.gdb` → `ekin_2026` (1 600 poligon, `crop_name` GDB domeni orqali nomlanadi)
konturlarga **intersect** bilan bog'lanadi (UTM 42N). Natija `attrs.json` da: `lug.ekin26` va `col.ekin26`.

- Kontur maydonining 5 % dan kichik kesishmalari tashlanadi; asosiy ekin — kamida 20 % egallagan eng katta qism.
- 18 ekin, 3 523 kontur; ekin maydonining 96 % konturlar ichiga tushadi.
- Fermer nomi, INN, kadastr kabi shaxsiy maydonlar o'qilmaydi — `attrs.json` ochiq statik fayl.

Manba geo-ma'lumotlar (`Data/`, ~40 MB) git'ga kiritilmagan — alohida saqlanadi.

---

## Bajarilmagan

- Tematik ko'rsatkichlarni tanlash (bonitet, NPK, relyef xoroplet qatlamlari) — kod tayyor (`ranglar.ts`, `Legenda.tsx`), UI'da tanlash joyi yo'q
- Eksport (CSV / GeoJSON)
- Mobil ko'rinish
- URL bilan filtr sinxronizatsiyasi
- Meteorologik ma'lumotlar

## Ma'lumot sifati bo'yicha ochiq masalalar

Manba ma'lumotlar papkasidagi `TAHLIL.md` da batafsil. Eng muhimlari:

- **Kaliy layerida mantiqiy xato:** `Жуда кам` darajasi `400<` gradatsiya bilan — 321 yozuv, 2 495 ga. Manbadagidek qoldirilgan.
- MFY nomlari normallashtirildi (70 → 51), lekin nomlar 30 belgiga kesilgan — asl nomlar qayta tiklanishi kerak
- `soil` da 26, `Kaliy` da 86 poligon boshqa tumandan (1402)
