# Ma'lumotlarni ko'chirish va o'g'irlashdan himoyalash rejasi

> Holat: 2026-yil 25-sentabr · Loyiha: Raqamli agroxarita

## 1. Hozirgi holat — nima ochiq

Ilova to'liq statik: ma'lumot fayllari brauzerga to'g'ridan-to'g'ri yuboriladi. Saytni ochgan
**har kim** quyidagi fayllarni bitta havola bilan to'liq yuklab oladi:

| Fayl | Mazmuni | Hajm |
|---|---|---|
| `data/geom.geojson` | 9 257 kontur geometriyasi (kadastr chegaralari) | 3,0 MB |
| `data/attrs.json` | tuproq, agrokimyo, relyef, 5 yillik ekinlar | 0,9 MB |
| `data/xojalik_attrs.json`, `xojalik_geom.geojson` | 964 fermer konturi, STIR, kadastr raqami | 2,0 MB |
| `data/iqlim.json`, `relyef.*`, `gorizontal.geojson` | iqlim, relyef (ochiq manbalardan) | 2,5 MB |

- Kadastr konturlari, tuproq/agrokimyo (institut ma'lumoti) va **fermerlarning STIR raqamlari**
  eng qimmatli va nozik qism.
- Git repolari (GitHub, GitLab) **yopiq** — tekshirildi, anonim kirish 404. Lekin ma'lumot
  fayllari repo ichida: repoga kirish huquqi bor har kim ularni oladi.

**Asosiy tamoyil:** brauzer xaritani chizishi uchun ma'lumotni olishi shart, olingan narsani esa
ko'chirib bo'ladi. Shuning uchun maqsad — *o'g'irlashni imkonsiz qilish* emas, **kim, qancha va
qanday ko'rishini cheklash** va **sizib chiqsa, manbasini aniqlash**.

## 2. Himoya choralari — samaradorlik bo'yicha

### 1-daraja. Kirishni cheklash (eng muhim, birinchi navbatda)

| Chora | Nima beradi |
|---|---|
| **Login** — Agroportal / OneID orqali (SSO) | Begona odam ma'lumotni umuman ko'rmaydi; har bir foydalanuvchi ma'lum |
| **Rollar**: ko'ruvchi / mutaxassis / administrator | Fermer faqat o'z konturini, tuman mutaxassisi — o'z tumanini ko'radi |
| Tarmoq cheklovi (ichki tarmoq, VPN yoki ruxsat etilgan IP) — alternativa | Tez joriy qilinadi, lekin mobil/tashqi foydalanuvchilar uchun noqulay |

Ma'lumot fayllari nginx darajasida **faqat tasdiqlangan sessiya** bilan beriladi
(`auth_request`), statik papka ochiq qolmaydi.

### 2-daraja. Ma'lumotni bo'laklab berish (backend)

| Chora | Nima beradi |
|---|---|
| **Vektor tayllar** (MVT/PMTiles) o'rniga butun GeoJSON | Geometriya zoom bo'yicha bo'laklab, soddalashtirilib beriladi; bitta fayl bilan hammasini olib ketib bo'lmaydi |
| **Atributlar API orqali** — kontur bosilganda, bittadan | To'liq jadval hech qachon brauzerga bormaydi |
| **Statistika serverda** hisoblanadi | Sidebar raqamlari uchun xom ma'lumot kerak emas |
| **So'rovlar chegarasi** (rate limit) — foydalanuvchi va IP bo'yicha | Avtomatik yig'ib olish (scraping) sekinlashadi va ko'rinib qoladi |
| `/map` sahifasi — faqat so'ralgan STIR + kadastr bo'yicha javob | Hozirgi 964 fermerlik umumiy fayl olib tashlanadi |

### 3-daraja. Kuzatish va iz qoldirish

| Chora | Nima beradi |
|---|---|
| **Kirish jurnali** (kim, qachon, qaysi kontur/hudud) | Shubhali ommaviy yuklab olish aniqlanadi |
| Ogohlantirish: bir foydalanuvchi qisqa vaqtda juda ko'p kontur so'rasa | Scrapingni erta to'xtatish |
| **Suv belgisi** — ekran va eksport qilingan rasmlarda foydalanuvchi nomi/sana | Skrinshot tarqalsa, manbasi ma'lum |
| Ma'lumotda ko'rinmas "tuzoq" belgilar (har foydalanuvchiga mikro-farqlar) | Sizib chiqqan nusxa kimdan ekani aniqlanadi (ixtiyoriy, murakkab) |

### 4-daraja. Repo va jarayon

- Xom manba ma'lumotlar (GDB, shape) repoga **kirmaydi** — allaqachon `.gitignore` da.
- Tayyor ma'lumot fayllari ham repodan chiqariladi: alohida xavfsiz saqlashda (masalan, obyekt
  saqlash — S3/MinIO), deploy paytida serverga yuklanadi.
- Repolarga kirish — faqat loyiha jamoasi; ikki bosqichli autentifikatsiya majburiy.
- Ma'lumot beruvchi tashkilotlar bilan **foydalanish shartlari** (kim ko'rishi mumkin, uchinchi
  shaxslarga berish taqiqi) yozma kelishiladi.

## 3. Nima qilinmaydi (samarasiz)

- JSON'ni shifrlash yoki "chalkashtirish" — kalit baribir brauzer kodida bo'ladi, bir necha
  daqiqada aylanib o'tiladi.
- Sichqonchaning o'ng tugmasini, ishlab chiquvchi vositalarini o'chirish — himoya bermaydi,
  foydalanuvchini bezovta qiladi.

## 4. Bosqichlar

| Bosqich | Ishlar | Taxminiy muddat | Natija |
|---|---|---|---|
| **1. Tezkor** | Login (Agroportal SSO yoki vaqtincha IP/VPN cheklovi); nginx orqali `data/` ni faqat sessiya bilan berish; `xojalik_*` fayllarini ochiq papkadan olib tashlash | 1–2 hafta | Begona kirish yopiladi |
| **2. Backend** | Kontur atributlari va `/map` uchun API; statistika serverda; rate limit; kirish jurnali | 3–4 hafta | To'liq jadval brauzerga bormaydi |
| **3. Vektor tayllar** | Geometriyani MVT/PMTiles ga o'tkazish, zoom bo'yicha soddalashtirish | 2 hafta | Geometriyani ommaviy olish qiyinlashadi |
| **4. Kuzatish** | Ogohlantirishlar, suv belgisi, repodan ma'lumot fayllarini chiqarish, shartnomalar | doimiy | Sizib chiqish aniqlanadi |

**Tavsiya:** 1-bosqichni pilot namoyishidan oldin, 2-bosqichni boshqa tumanlarga
kengaytirishdan oldin bajarish.

## 5. Qarorlar kerak

1. Login qaysi tizim orqali: Agroportal SSO, OneID yoki o'zimizniki?
2. Kim nimani ko'radi: fermer, tuman mutaxassisi, vazirlik — rollar ro'yxati.
3. Ma'lumot beruvchi tashkilotlar (Kadastr agentligi, institut) bilan foydalanish shartlari.
4. Backend va deploy (nginx, API) uchun DevOps mas'uli.
