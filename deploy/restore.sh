#!/usr/bin/env bash
# Zaxiradan tiklash: ./deploy/restore.sh backups/kunlik/agroxarita_YYYYmmdd_HHMM.dump
# Diqqat: mavjud baza obyektlari almashtiriladi (--clean). Backend to'xtatiladi va keyin qayta yoqiladi.
set -euo pipefail

ILDIZ="${ILDIZ:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ILDIZ"
set -a; . ./.env; set +a

FAYL="${1:?dump fayl yo'lini bering (BACKUP_PATH ichida)}"
NOM="${FAYL#${BACKUP_PATH:-$ILDIZ/backups}/}"
NOM="${NOM#backups/}"

read -r -p "'$DB_NAME' bazasi '$NOM' dan tiklanadi. Davom etilsinmi? (ha/yo'q) " javob
[ "$javob" = "ha" ] || { echo "bekor qilindi"; exit 1; }

docker compose stop backend web
docker compose exec -T db pg_restore -U "$DB_USER" -d "$DB_NAME" --clean --if-exists --no-owner -j 2 "/backups/$NOM"
docker compose start backend web
echo "tiklandi: $NOM"
