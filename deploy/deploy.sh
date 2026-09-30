#!/usr/bin/env bash
# Yangi versiyani yoqish — qo'lda, serverning o'zida (CI/CD va registry yo'q):
#   git pull --ff-only && ./deploy/deploy.sh      # joriy koddan build, teg = commit SHA
#   ./deploy/deploy.sh "$(cat .tag_oldingi)"      # oldingi versiyaga qaytish (obraz serverda saqlangan)
set -euo pipefail

ILDIZ="${ILDIZ:-$(cd "$(dirname "$0")/.." && pwd)}"
cd "$ILDIZ"
TAG="${1:-$(git rev-parse --short HEAD)}"
export TAG   # shell qiymati .env dagidan ustun — build/up shu teg bilan

OLDINGI="$(grep -E '^TAG=' .env | cut -d= -f2 || true)"

# Shu tegli obraz serverda bo'lsa (rollback) — qayta yig'ilmaydi. Build muvaffaqiyatsiz bo'lsa ishlab turgan stekka tegilmaydi.
if docker image inspect "agroxarita/backend:${TAG}" "agroxarita/frontend:${TAG}" >/dev/null 2>&1; then
  echo "obraz mavjud: $TAG — build o'tkazib yuborildi"
else
  # umumiy server: build past prioritetda, boshqa ilovalarga CPU bosimi bermasin
  nice -n 15 docker compose build backend web
fi

# .env dagi TAG ni yangilash (rollback uchun oldingisi saqlanadi)
[ "$OLDINGI" = "$TAG" ] || echo "$OLDINGI" > .tag_oldingi
sed -i "s/^TAG=.*/TAG=${TAG}/" .env

# --remove-orphans faqat shu compose loyihasiga (name: agroxarita) tegishli
docker compose up -d --remove-orphans db redis
docker compose up -d backend web   # backend ishga tushganda migrate + collectstatic (RUN_MIGRATIONS=1)

# sog'lik tekshiruvi (2 daqiqagacha)
for i in $(seq 1 24); do
  if docker compose exec -T backend python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/api/health/', timeout=5)" 2>/dev/null; then
    echo "deploy tayyor: $TAG"
    # Eslatma: `docker image prune` ataylab yo'q — umumiy serverda boshqa loyihalar obrazlarini o'chiradi.
    # Eski agroxarita obrazlari: docker images 'agroxarita/*' → keraksizini `docker rmi` bilan qo'lda.
    exit 0
  fi
  sleep 5
done

echo "health tekshiruvi o'tmadi — oldingi versiyaga qaytarilmoqda ($OLDINGI)" >&2
sed -i "s/^TAG=.*/TAG=${OLDINGI}/" .env
TAG="$OLDINGI" docker compose up -d backend web
exit 1
