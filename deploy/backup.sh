#!/usr/bin/env bash
# PostGIS bazasini zaxiralash (pg_dump -Fc) va rotatsiya: 7 kunlik + 4 haftalik (yakshanba) + 6 oylik (1-kun).
# systemd timer (agroxarita-backup.timer) har kuni ishga tushiradi. Qo'lda: sudo /opt/agroxarita/deploy/backup.sh
set -euo pipefail

ILDIZ="${ILDIZ:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ILDIZ"
set -a; . ./.env; set +a
PAPKA="${BACKUP_PATH:-$ILDIZ/backups}"
mkdir -p "$PAPKA"/{kunlik,haftalik,oylik}

SANA="$(date +%Y%m%d_%H%M)"
FAYL="$PAPKA/kunlik/agroxarita_${SANA}.dump"

# db konteyneri ichida dump; /backups = $BACKUP_PATH (docker-compose.yml)
docker compose exec -T db pg_dump -U "$DB_USER" -d "$DB_NAME" -Fc -Z 6 -f "/backups/kunlik/$(basename "$FAYL")"

# dump butunligini tekshirish (ro'yxat o'qiladimi)
docker compose exec -T db pg_restore -l "/backups/kunlik/$(basename "$FAYL")" >/dev/null

[ "$(date +%u)" = "7" ] && cp "$FAYL" "$PAPKA/haftalik/"
[ "$(date +%d)" = "01" ] && cp "$FAYL" "$PAPKA/oylik/"

# rotatsiya
ls -1t "$PAPKA"/kunlik/*.dump 2>/dev/null | tail -n +8 | xargs -r rm -f
ls -1t "$PAPKA"/haftalik/*.dump 2>/dev/null | tail -n +5 | xargs -r rm -f
ls -1t "$PAPKA"/oylik/*.dump 2>/dev/null | tail -n +7 | xargs -r rm -f

echo "$(date '+%F %T') backup tayyor: $FAYL ($(du -h "$FAYL" | cut -f1))"
