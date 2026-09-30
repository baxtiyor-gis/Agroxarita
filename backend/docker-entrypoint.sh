#!/bin/sh
# Backend konteyneri: baza tayyorligini kutish, (ixtiyoriy) migratsiya va static, keyin buyruq.
set -e

until python -c "import psycopg, os; psycopg.connect(host=os.environ['DB_HOST'], port=os.environ.get('DB_PORT', '5432'), dbname=os.environ['DB_NAME'], user=os.environ['DB_USER'], password=os.environ['DB_PASSWORD']).close()" 2>/dev/null; do
  echo "baza kutilmoqda..."
  sleep 2
done

if [ "${RUN_MIGRATIONS:-0}" = "1" ]; then
  python manage.py migrate --noinput
  python manage.py collectstatic --noinput
fi

exec "$@"
