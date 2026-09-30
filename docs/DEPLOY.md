# Agroxarita V2 — production va birinchi ishga tushirish

Stek (bitta Linux server, `docker compose`, katalog `/opt/agroxarita`):

| Servis | Obraz | Vazifa |
|---|---|---|
| `db` | `postgis/postgis:17-3.5` | PostgreSQL 17 + PostGIS, volume `pgdata`, `/backups` — zaxiralar |
| `redis` | `redis:7-alpine` | Django kesh (tile, iqlim, ekin ro'yxati) — gunicorn worker'lari orasida umumiy |
| `backend` | `…/backend` | Django + GeoDjango, **gunicorn** (`backend/gunicorn.conf.py`), ishga tushganda `migrate` + `collectstatic` |
| `web` | `…/frontend` | nginx: React build + `/api`, `/tiles`, `/admin` → backend, `/static` |
| `manage` | `…/backend` | bir martalik buyruqlar (`profiles: tools`) |

Tizim servislari (`deploy/systemd/`): `agroxarita.service` (server yuklanganda stekni ko'taradi),
`agroxarita-backup.service` + `.timer` (har kuni 02:30 backup).

CI/CD — `.gitlab-ci.yml` (dev.digitagro.uz GitLab): `build` (obrazlar, SHA tegi) → `test` (pytest production
obrazida PostGIS servis bilan; frontend lint + build) → `release` (main: `latest`) → `deploy` (main, **qo'lda**
tugma, SSH orqali `deploy/deploy.sh <sha>`, health tekshiruvi, muvaffaqiyatsiz bo'lsa oldingi tegga qaytadi).

**GitHub Actions** (`.github/workflows/ci-cd.yml`, github.com/baxtiyor-gis/Agroxarita) — xuddi shu oqim:
`frontend` (lint + build) va `backend` (obraz + pytest PostGIS bilan) → `release` (main: `ghcr.io/<owner>/<repo>/…`
`:<sha>` va `:latest`) → `deploy` (faqat qo'lda: Actions → ci-cd → Run workflow → `deploy = true`).
Secrets: `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER`, `DEPLOY_PATH`; `production` environment'da
tasdiqlovchi qo'yish tavsiya etiladi. Serverni qaysi registry'dan tortishini `.env` dagi `REGISTRY_IMAGE` belgilaydi —
ikkala tizimdan bir vaqtda deploy qilmang, bittasini asosiy qiling.

---

## Dasturchi uchun qisqa qo'llanma

### A. Yangi versiyani chiqarish (har safar)
1. O'zgarishni branchda qiling, lokal tekshiring:
   `backend`: `.venv\Scripts\python.exe -m pytest -q`; `frontend`: `npm run lint; npm run build`.
   Model o'zgargan bo'lsa — migratsiya faylini commit qilishni unutmang (`manage.py makemigrations`).
2. `main` ga merge qiling va push qiling (`git push origin main`).
3. GitLab → CI/CD → Pipelines: `build` → `test` → `release` yashil bo'lishini kuting.
4. `deploy:production` tugmasini bosing (qo'lda). U serverda `git pull` + `./deploy/deploy.sh <sha>` qiladi:
   yangi obrazlar tortiladi, backend ishga tushganda `migrate` va `collectstatic` avtomatik, `/api/health/` tekshiriladi.
   Health o'tmasa — avtomatik oldingi versiyaga qaytadi (pipeline qizil bo'ladi).
5. Tekshiring: sayt ochiladi, `https://<domen>/api/health/` → `{"status": "ok", ...}`.

Qo'lda (CI siz) chiqarish yoki qaytarish — serverda:
```bash
cd /opt/agroxarita
git pull --ff-only
./deploy/deploy.sh <commit-sha>      # yoki latest
./deploy/deploy.sh "$(cat .tag_oldingi)"   # oldingi versiyaga qaytish
```
Ma'lumot importi kerak bo'lsa (yangi ekin yili va h.k.) — deploydan keyin:
`docker compose run --rm manage import_ekin --yil 2027` (fayl `/opt/agroxarita/data/` ga oldin qo'yiladi),
so'ng keshni tozalash: `docker compose exec redis redis-cli FLUSHDB`.

### B. Prodda backupni ishga tushirish (bir marta)
```bash
cd /opt/agroxarita
chmod +x deploy/*.sh
sudo cp deploy/systemd/agroxarita.service deploy/systemd/agroxarita-backup.service deploy/systemd/agroxarita-backup.timer /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable --now agroxarita.service          # server qayta yuklanganda stek o'zi ko'tariladi
sudo systemctl enable --now agroxarita-backup.timer     # har kuni 02:30
sudo systemctl start agroxarita-backup.service          # birinchi backupni hozir olish
journalctl -u agroxarita-backup.service -n 20           # natija: "backup tayyor: ..."
ls -lh backups/kunlik/
systemctl list-timers | grep agroxarita                 # keyingi ishga tushish vaqti
```
- Zaxiralar `BACKUP_PATH` (default `/opt/agroxarita/backups`): `kunlik/` 7 ta, `haftalik/` 4 ta (yakshanba),
  `oylik/` 6 ta (oyning 1-kuni). Har dump `pg_restore -l` bilan tekshiriladi.
- Qo'lda backup: `sudo systemctl start agroxarita-backup.service` (yoki `./deploy/backup.sh`).
- Tiklash: `./deploy/restore.sh backups/kunlik/agroxarita_YYYYmmdd_HHMM.dump` ("ha" deb tasdiqlanadi;
  backend va web vaqtincha to'xtaydi).
- Oyiga bir marta tiklashni alohida serverda sinab ko'ring. Zaxiralarni boshqa joyga (boshqa server/disk)
  ko'chirish hali sozlanmagan — shu serverning o'zi ishdan chiqsa zaxira ham yo'qoladi.

### C. Birinchi baza (lokaldan)
Lokal baza nusxasi `data/backups/agroxarita_20260930.dump` (git'da emas, fleshkada beriladi). Serverda
`/opt/agroxarita/backups/` ga qo'yib, quyidagi 4-bosqichdagi `pg_restore` bilan tiklanadi. DEM fayllari ham shu
yo'l bilan (`data/dem/dem.vrt` + `Copernicus_DSM_*.tif`) `/opt/agroxarita/data/dem/` ga.

---

## Birinchi ishga tushirish rejasi

### 0. Oldindan kerak (kimdan)
- Server: Ubuntu 22.04/24.04, **≥ 8 vCPU, 16–32 GB RAM, ≥ 150 GB SSD** (baza ~9.2 GB + indekslar, DEM ~1.7 GB,
  zaxiralar 7+4+6 nusxa). Domen nomi va TLS sertifikati (yoki tashqi proksi).
- GitLab: loyiha registry yoqilgan, runner (docker executor, `privileged` — dind uchun).
- Deploy foydalanuvchisi uchun SSH kalit juftligi; serverdan GitLab'ga o'qish uchun **deploy token**.

### 1. Serverni tayyorlash
```bash
sudo apt update && sudo apt install -y ca-certificates curl git
curl -fsSL https://get.docker.com | sudo sh
sudo useradd -m -s /bin/bash -G docker deploy
sudo mkdir -p /opt/agroxarita && sudo chown deploy: /opt/agroxarita
sudo timedatectl set-timezone Asia/Tashkent
# deploy foydalanuvchisiga CI ning ochiq kalitini qo'shing: ~deploy/.ssh/authorized_keys
```

### 2. Repo va sozlamalar
```bash
sudo -iu deploy
git clone -b main https://<deploy-token-user>:<token>@dev.digitagro.uz/gis/agro-xarita.git /opt/agroxarita
cd /opt/agroxarita
cp .env.example .env && nano .env      # SECRET_KEY, DB_PASSWORD, ALLOWED_HOSTS, domen, PG xotira, REGISTRY_IMAGE
chmod 600 .env
chmod +x deploy/*.sh
mkdir -p data/dem backups
```
`SECRET_KEY`: `python3 -c "import secrets; print(secrets.token_urlsafe(50))"`.

### 3. Ma'lumotlarni ko'chirish (lokal Windows → server)
Bazani importlarni serverda qayta yurgizmasdan, tayyor holatda ko'chiramiz (importlar soatlab ketadi).

Lokal (PowerShell, `backend/` dan; PostgreSQL 17 `bin` PATH da):
```powershell
pg_dump -h localhost -U agro-xarita -d agroxarita -Fc -Z 6 -f agroxarita_init.dump
```
Serverga yuborish (`scp` yoki WinSCP):
- `agroxarita_init.dump` → `/opt/agroxarita/backups/agroxarita_init.dump`
- DEM (relyef tile uchun): `data/dem/dem.vrt` + `data/dem/Copernicus_DSM_*.tif` → `/opt/agroxarita/data/dem/`
  (`slope.tif`, `aspect.tif`, `dem_lcc.tif` shart emas — ular faqat `hisobla_relyef` uchun, ~3.6 GB).
- (ixtiyoriy) `data/era5/` — iqlimni serverda yangilash uchun.

### 4. Birinchi ko'tarish
```bash
cd /opt/agroxarita
echo "<token>" | docker login -u <user> --password-stdin registry.dev.digitagro.uz
docker compose pull
docker compose up -d db redis
# bazani tiklash (db konteyneri PostGIS extension bilan bo'sh baza yaratgan)
docker compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --no-owner -j 4 /backups/agroxarita_init.dump
# (DB_USER/DB_NAME — .env dagi qiymatlar; `set -a; . ./.env; set +a` bilan yuklang)
docker compose up -d backend web       # migrate + collectstatic avtomatik
docker compose run --rm manage createsuperuser
curl -s http://127.0.0.1:8080/api/health/   # {"status": "ok", ...}
```

### 5. Tizim servislari va backup
```bash
sudo cp deploy/systemd/agroxarita*.{service,timer} /etc/systemd/system/
sudo systemctl daemon-reload
sudo systemctl enable agroxarita.service agroxarita-backup.timer
sudo systemctl start agroxarita-backup.timer
sudo systemctl start agroxarita-backup.service && ls -lh backups/kunlik/   # birinchi zaxirani tekshirish
systemctl list-timers | grep agroxarita
```
Tiklashni sinab ko'ring (alohida serverda yoki texnik oynada): `./deploy/restore.sh backups/kunlik/<fayl>.dump`.

### 6. Tashqi proksi / TLS
`web` konteyneri `HTTP_BIND` (default `127.0.0.1:8080`) da tinglaydi. Serverdagi nginx/Caddy yoki korporativ
proksi `https://domen` → `127.0.0.1:8080`, sarlavhalar: `Host`, `X-Forwarded-Proto: https`, `X-Forwarded-For`.

### 7. CI/CD ni ulash
GitLab → Settings → CI/CD → Variables: `SSH_PRIVATE_KEY`, `SSH_KNOWN_HOSTS`, `DEPLOY_HOST`, `DEPLOY_USER=deploy`,
`DEPLOY_PATH=/opt/agroxarita` (protected, masked). `main` protected branch. Pipeline yashil bo'lgach
`deploy:production` tugmasi bilan chiqariladi.

### 8. `V2` → `main`
`main` — `V2` ning ajdodi, birlashtirish fast-forward bo'ladi:
```bash
git checkout main && git merge --ff-only V2 && git push origin main
```
(push — faqat aniq ruxsat bilan). Birinchi pipeline obrazlarni yig'adi va `latest` qiladi; 4-bosqichdagi
`docker compose pull` shundan keyin ishlaydi.

### 9. Tekshiruv ro'yxati
- [ ] `/api/health/` ok, xarita ochiladi, tuman tanlanadi, kontur tile'lari < 300 ms
- [ ] Kontur paneli: Ma'lumot, Tuproq, Relyef, Ekinlar (2022–2026), Iqlim tablari
- [ ] DEM rasteri (Balandlik) chiqadi — `data/dem/dem.vrt` o'qiladi
- [ ] `/admin/` login ishlaydi (CSRF_TRUSTED_ORIGINS to'g'ri)
- [ ] Backup timer faol, birinchi dump bor, restore sinovdan o'tgan
- [ ] Server qayta yuklangandan keyin stek o'zi ko'tariladi

---

## Kundalik amallar
| Amal | Buyruq |
|---|---|
| Loglar | `docker compose logs -f backend web` |
| Django buyruq | `docker compose run --rm manage <buyruq> [arg]` (masalan `import_ekin --yil 2026 --qayta`) |
| Iqlimni yangilash (joriy yil) | `docker compose run --rm manage yukla_era5 --joriy --import` |
| Keshni tozalash | `docker compose exec redis redis-cli FLUSHDB` |
| Qo'lda backup | `sudo systemctl start agroxarita-backup.service` |
| Versiyani qaytarish | `./deploy/deploy.sh <oldingi-sha>` (`.tag_oldingi` da) |

Zaxiralar: `backups/kunlik` (7), `haftalik` (4, yakshanba), `oylik` (6, oyning 1-kuni). Keyingi qadam —
zaxiralarni boshqa serverga/obyekt saqlashga ko'chirish (rsync yoki S3), chunki hozir ular shu serverda.
