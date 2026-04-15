import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403,F401 pylint: disable=wildcard-import,unused-wildcard-import

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
SECURE_SSL_REDIRECT = True

SECURE_HSTS_SECONDS = 31536000
SECURE_HSTS_INCLUDE_SUBDOMAINS = True
SECURE_HSTS_PRELOAD = True

SESSION_COOKIE_SECURE = True
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_SECURE = True
CSRF_COOKIE_HTTPONLY = False
CSRF_COOKIE_SAMESITE = "Lax"

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

STORAGES = {
    "default": {
        "BACKEND": "django.core.files.storage.FileSystemStorage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

# Railway: persist user-uploaded media by mounting a volume (e.g. at /data).
# Set RAILWAY_VOLUME_MOUNT_PATH to the mount point (defaults to /data).
MEDIA_ROOT = Path(os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "/data")) / "media"

# Fail fast if an insecure SECRET_KEY is used in production.
if SECRET_KEY.startswith("django-insecure-") or len(SECRET_KEY) < 50:  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be a long, random value (>= 50 chars) in production."
    )


def _parse_hosts(value: str) -> list[str]:
    return [h.strip() for h in value.split(",") if h.strip()]


# Keep explicit env hosts, but auto-include Railway domains when available.
_env_hosts = _parse_hosts(os.getenv("DJANGO_ALLOWED_HOSTS", ""))
_railway_hosts = [h for h in [os.getenv("RAILWAY_PUBLIC_DOMAIN"), os.getenv("RAILWAY_PRIVATE_DOMAIN")] if h]
_fallback_hosts = ["127.0.0.1", "localhost"]

ALLOWED_HOSTS = list(dict.fromkeys(_env_hosts + _railway_hosts + _fallback_hosts))

# Align CSRF trusted origins with allowed hosts to avoid production POST failures.
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(
        [f"https://{host}" for host in ALLOWED_HOSTS if host not in {"127.0.0.1", "localhost"}]
        + ["http://127.0.0.1", "http://localhost"]
    )
)
