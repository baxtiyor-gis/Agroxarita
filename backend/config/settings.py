import os
from pathlib import Path

import environ

BASE_DIR = Path(__file__).resolve().parent.parent

env = environ.Env(DEBUG=(bool, False))
# overwrite=True: tizim env (masalan OSGeo4W GDAL_LIBRARY_PATH) .env ni buzmasin
environ.Env.read_env(BASE_DIR / ".env", overwrite=True)

SECRET_KEY = env("SECRET_KEY")
DEBUG = env("DEBUG")
ALLOWED_HOSTS = env.list("ALLOWED_HOSTS", default=["localhost", "127.0.0.1"])

# GDAL/GEOS — venv ichidagi wheel DLL'lari (OSGeo4W emas)
GDAL_LIBRARY_PATH = env("GDAL_LIBRARY_PATH", default=None)
GEOS_LIBRARY_PATH = env("GEOS_LIBRARY_PATH", default=None)
if os.name == "nt" and GDAL_LIBRARY_PATH:
    _osgeo = Path(GDAL_LIBRARY_PATH).parent
    os.add_dll_directory(str(_osgeo))
    # tizimdagi GDAL_DATA/PROJ_* (PostgreSQL, OSGeo4W) wheel ma'lumotlarini buzmasin
    os.environ["GDAL_DATA"] = str(_osgeo / "data" / "gdal")
    os.environ["PROJ_DATA"] = os.environ["PROJ_LIB"] = str(_osgeo / "data" / "proj")

DATA_DIR = Path(env("DATA_DIR", default="../data"))
if not DATA_DIR.is_absolute():
    DATA_DIR = (BASE_DIR / DATA_DIR).resolve()

INSTALLED_APPS = [
    "django.contrib.admin",
    "django.contrib.contenttypes",
    "django.contrib.auth",
    "django.contrib.sessions",
    "django.contrib.messages",
    "django.contrib.staticfiles",
    "django.contrib.gis",
    "rest_framework",
    "rest_framework_gis",
    "corsheaders",
    "apps.border",
    "apps.land",
    "apps.relief",
    "apps.crop",
    "apps.soil",
    "apps.climate",
    "apps.tiles",
]

MIDDLEWARE = [
    "corsheaders.middleware.CorsMiddleware",
    "django.middleware.security.SecurityMiddleware",
    "django.contrib.sessions.middleware.SessionMiddleware",
    "django.middleware.common.CommonMiddleware",
    "django.middleware.csrf.CsrfViewMiddleware",
    "django.contrib.auth.middleware.AuthenticationMiddleware",
    "django.contrib.messages.middleware.MessageMiddleware",
    "django.middleware.clickjacking.XFrameOptionsMiddleware",
]

# Faqat /admin/ uchun (API autentifikatsiyasiz qoladi)
TEMPLATES = [
    {
        "BACKEND": "django.template.backends.django.DjangoTemplates",
        "DIRS": [],
        "APP_DIRS": True,
        "OPTIONS": {
            "context_processors": [
                "django.template.context_processors.request",
                "django.contrib.auth.context_processors.auth",
                "django.contrib.messages.context_processors.messages",
            ],
        },
    },
]

ROOT_URLCONF = "config.urls"
WSGI_APPLICATION = "config.wsgi.application"

DATABASES = {
    "default": {
        "ENGINE": "django.contrib.gis.db.backends.postgis",
        "NAME": env("DB_NAME"),
        "USER": env("DB_USER"),
        "PASSWORD": env("DB_PASSWORD"),
        "HOST": env("DB_HOST", default="localhost"),
        "PORT": env("DB_PORT", default="5432"),
    }
}

# Copernicus CDS (Task 9); kalit .env da, git'da yo'q
CDS_API_URL = env("CDS_API_URL", default="https://cds.climate.copernicus.eu/api")
CDS_API_KEY = env("CDS_API_KEY", default="")
ERA5_DIR = DATA_DIR / "era5"

# Tile keshi (soniya). Dev'da 0 — ma'lumot qayta hisoblanganda brauzer eski tile'ni ko'rsatmasin
TILE_CACHE_MAX_AGE = env.int("TILE_CACHE_MAX_AGE", default=3600)
# Chegara tile'lari (viloyat/tuman/massiv/maska) — brauzer keshi (soniya); server xotirasida ham keshlanadi
TILE_STATIK_MAX_AGE = env.int("TILE_STATIK_MAX_AGE", default=86400)

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.locmem.LocMemCache",
        "LOCATION": "tile",
        "OPTIONS": {"MAX_ENTRIES": 20000},
    }
}

CORS_ALLOWED_ORIGINS = env.list("CORS_ALLOWED_ORIGINS", default=["http://localhost:5173"])

REST_FRAMEWORK = {
    "DEFAULT_RENDERER_CLASSES": ["rest_framework.renderers.JSONRenderer"],
    "DEFAULT_PAGINATION_CLASS": None,
    "UNAUTHENTICATED_USER": None,
    "DEFAULT_AUTHENTICATION_CLASSES": [],
    "DEFAULT_PERMISSION_CLASSES": [],
}

LANGUAGE_CODE = "uz"
TIME_ZONE = "Asia/Tashkent"
USE_I18N = False
USE_TZ = True
STATIC_URL = "static/"
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
