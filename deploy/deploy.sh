#!/usr/bin/env bash
# Yangi versiyani yoqish (CI deploy bosqichi SSH orqali chaqiradi yoki qo'lda):
#   ./deploy/deploy.sh <tag>      # masalan commit SHA; bo'sh bo'lsa latest
set -euo pipefail

ILDIZ="${ILDIZ:-/opt/agroxarita}"
cd "$ILDIZ"
TAG="${1:-latest}"

# .env dagi TAG ni yangilash (rollback uchun oldingisi saqlanadi)
OLDINGI="$(grep -E '^TAG=' .env | cut -d= -f2 || true)"
echo "$OLDINGI" > .tag_oldingi
sed -i "s/^TAG=.*/TAG=${TAG}/" .env

docker compose pull backend web
docker compose up -d --remove-orphans db redis
docker compose up -d backend web   # backend ishga tushganda migrate + collectstatic (RUN_MIGRATIONS=1)

# sog'lik tekshiruvi (2 daqiqagacha)
for i in $(seq 1 24); do
  if docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=5)" 2>/dev/null; then
    echo "deploy tayyor: $TAG"
    docker image prune -f >/dev/null
    exit 0
  fi
  sleep 5
done

echo "health tekshiruvi o'tmadi — oldingi versiyaga qaytarilmoqda ($OLDINGI)" >&2
sed -i "s/^TAG=.*/TAG=${OLDINGI}/" .env
docker compose up -d backend web
exit 1
