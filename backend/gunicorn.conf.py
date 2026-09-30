"""Gunicorn (production, docker). Qiymatlar env orqali o'zgartiriladi."""
import multiprocessing
import os

bind = os.getenv("GUNICORN_BIND", "0.0.0.0:8000")
# tile/DEM so'rovlari CPU va bazaga og'ir — sync worker, soni yadroga qarab
workers = int(os.getenv("GUNICORN_WORKERS", multiprocessing.cpu_count() * 2 + 1))
threads = int(os.getenv("GUNICORN_THREADS", "2"))
timeout = int(os.getenv("GUNICORN_TIMEOUT", "120"))
graceful_timeout = 30
keepalive = 5
# xotira sizib ketmasin: har worker ~N so'rovdan keyin qayta tug'iladi
max_requests = int(os.getenv("GUNICORN_MAX_REQUESTS", "2000"))
max_requests_jitter = 200
accesslog = "-"
errorlog = "-"
loglevel = os.getenv("GUNICORN_LOGLEVEL", "info")
forwarded_allow_ips = "*"
