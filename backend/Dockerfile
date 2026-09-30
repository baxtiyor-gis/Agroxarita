# Agroxarita backend: Django + GeoDjango + gunicorn.
# GDAL/GEOS/PROJ va Python bindinglari rasmiy OSGeo obrazidan (backend osgeo.gdal ni ishlatadi).
FROM ghcr.io/osgeo/gdal:ubuntu-small-3.10.3

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PATH=/opt/venv/bin:$PATH

RUN apt-get update \
 && apt-get install -y --no-install-recommends python3-venv python3-pip libpq5 \
 && rm -rf /var/lib/apt/lists/*

# system-site-packages: obrazdagi osgeo (GDAL bindinglari) venv ichida ko'rinadi
RUN python3 -m venv --system-site-packages /opt/venv

WORKDIR /app
COPY requirements.txt requirements-prod.txt ./
# numpy pip'dan o'rnatilmaydi: obrazdagi osgeo.gdal_array tizim numpy'si (1.26) bilan yig'ilgan, numpy 2 bilan yuklanmaydi
# (requirements.txt dagi numpy>=2 — Windows'dagi GDAL wheel uchun)
RUN sed -i '/^numpy/d' requirements.txt \
 && echo 'numpy<2' > /tmp/cheklov.txt \
 && pip install -c /tmp/cheklov.txt -r requirements-prod.txt \
 && python -c "from osgeo import gdal, gdal_array; import numpy; print('GDAL', gdal.__version__, 'numpy', numpy.__version__)"

COPY . .
# uid 1000 bazaviy obrazda band (ubuntu). Serverda data/ egasining uid'i beriladi (.env: AGRO_UID) — /data ga yozish uchun
ARG AGRO_UID=10001
RUN chmod +x docker-entrypoint.sh \
 && useradd --system --uid ${AGRO_UID} --home /app agro \
 && mkdir -p /app/staticfiles /data \
 && chown -R agro /app/staticfiles

USER agro
ENV DATA_DIR=/data STATIC_ROOT=/app/staticfiles
EXPOSE 8000

ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["gunicorn", "config.wsgi:application", "-c", "gunicorn.conf.py"]
