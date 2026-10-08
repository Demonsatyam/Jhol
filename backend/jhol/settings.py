import os
from pathlib import Path

import dj_database_url
from dotenv import load_dotenv

BASE_DIR = Path(__file__).resolve().parent.parent
load_dotenv(BASE_DIR.parent / ".env")

SECRET_KEY = os.environ.get("DJANGO_SECRET_KEY", "dev-only-change-me")
DEBUG = os.environ.get("DEBUG", "1") == "1"
ALLOWED_HOSTS = ["*"]

INSTALLED_APPS = ["corsheaders", "core"]
MIDDLEWARE = ["corsheaders.middleware.CorsMiddleware", "django.middleware.common.CommonMiddleware"]
ROOT_URLCONF = "jhol.urls"
WSGI_APPLICATION = "jhol.wsgi.application"

DATABASES = {"default": dj_database_url.config(default="postgresql://jhol:jhol_dev_pw@localhost:5432/jhol")}
DEFAULT_AUTO_FIELD = "django.db.models.BigAutoField"
USE_TZ = True

CORS_ALLOWED_ORIGINS = os.environ.get("CORS_ALLOWED_ORIGINS", "http://localhost:3000").split(",")
DATA_UPLOAD_MAX_MEMORY_SIZE = 10 * 1024 * 1024
