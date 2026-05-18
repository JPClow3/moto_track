"""Production Django settings."""

import os
from pathlib import Path

from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403,F401 pylint: disable=wildcard-import,unused-wildcard-import

DEBUG = False
SECURE_PROXY_SSL_HEADER = ("HTTP_X_FORWARDED_PROTO", "https")
USE_HTTPS = os.getenv("DJANGO_USE_HTTPS", "true").strip().lower() in {
    "1",
    "true",
    "yes",
    "on",
}

SECURE_SSL_REDIRECT = USE_HTTPS
# Exempt /healthz/ from the HTTPS redirect (Codex P2). Container HEALTHCHECK
# and intra-VPC LB probes hit the app over plain HTTP — if we redirect them,
# `curl --fail` happily treats the 301 as success and never reaches the actual
# DB probe in `healthz()`, so the container can be marked healthy with a dead
# database. The path is a no-secret read-only liveness endpoint, safe to serve
# over HTTP for probes; real user traffic still arrives via Caddy/the edge
# which terminates TLS upstream.
SECURE_REDIRECT_EXEMPT = [r"^healthz/$"]

SECURE_HSTS_SECONDS = 31536000 if USE_HTTPS else 0
SECURE_HSTS_INCLUDE_SUBDOMAINS = USE_HTTPS
SECURE_HSTS_PRELOAD = USE_HTTPS

SESSION_COOKIE_SECURE = USE_HTTPS
SESSION_COOKIE_HTTPONLY = True
SESSION_COOKIE_SAMESITE = "Lax"

CSRF_COOKIE_SECURE = USE_HTTPS
# I-H6: CSRF cookie does not need to be readable from JS — Django reads the
# token from the form/meta tag (or the X-CSRFToken header sent by HTMX, which
# we wire up in base.html), so HttpOnly is safe and prevents XSS exfiltration.
CSRF_COOKIE_HTTPONLY = True
CSRF_COOKIE_SAMESITE = "Lax"

SECURE_CONTENT_TYPE_NOSNIFF = True
X_FRAME_OPTIONS = "DENY"
SECURE_REFERRER_POLICY = "strict-origin-when-cross-origin"

STORAGES = {
    "default": {
        "BACKEND": "storages.backends.s3boto3.S3Boto3Storage",
    },
    "staticfiles": {
        "BACKEND": "whitenoise.storage.CompressedStaticFilesStorage",
    },
}

MEDIA_ROOT = Path(
    os.getenv(
        "VOLUME_MOUNT_PATH",
        os.getenv("RAILWAY_VOLUME_MOUNT_PATH", "/data"),
    )
) / "media"

# S3 (django-storages) - default file storage
# Only set access keys when provided; empty strings break boto3 and block IAM instance roles.
_aws_access_key = os.getenv("AWS_ACCESS_KEY_ID")
_aws_secret_key = os.getenv("AWS_SECRET_ACCESS_KEY")
if _aws_access_key:
    AWS_ACCESS_KEY_ID = _aws_access_key
if _aws_secret_key:
    AWS_SECRET_ACCESS_KEY = _aws_secret_key

AWS_STORAGE_BUCKET_NAME = os.getenv("AWS_STORAGE_BUCKET_NAME", "")
AWS_S3_REGION_NAME = os.getenv("AWS_S3_REGION_NAME", "us-east-1")
AWS_S3_ENDPOINT_URL = os.getenv("AWS_S3_ENDPOINT_URL") or None

if not AWS_STORAGE_BUCKET_NAME:
    raise ImproperlyConfigured("AWS_STORAGE_BUCKET_NAME must be set in production.")

AWS_DEFAULT_ACL = None
AWS_QUERYSTRING_AUTH = True
AWS_S3_OBJECT_PARAMETERS = {
    # Cache media objects for 1 day by default; tune per your needs.
    "CacheControl": "max-age=86400",
}

# Fail fast if an insecure SECRET_KEY is used in production.
if SECRET_KEY.startswith("django-insecure-") or len(SECRET_KEY) < 50:  # noqa: F405
    raise ImproperlyConfigured(
        "DJANGO_SECRET_KEY must be a long, random value (>= 50 chars) in production."
    )


def _parse_hosts(value: str) -> list[str]:
    return [h.strip() for h in value.split(",") if h.strip()]


_env_hosts = _parse_hosts(os.getenv("DJANGO_ALLOWED_HOSTS", ""))
_railway_hosts = [h for h in (os.getenv("RAILWAY_PUBLIC_DOMAIN"), os.getenv("RAILWAY_PRIVATE_DOMAIN")) if h]
_fallback_hosts = ["127.0.0.1", "localhost"]

ALLOWED_HOSTS = list(dict.fromkeys(_env_hosts + _railway_hosts + _fallback_hosts))

# Align CSRF trusted origins with allowed hosts to avoid production POST failures.
# B-L1: when DJANGO_CSRF_TRUSTED_ORIGINS is set we use it verbatim so prod
# operators can override the derived list. Localhost fallbacks are only added
# when no explicit override is provided.
_explicit_csrf = _parse_hosts(os.getenv("DJANGO_CSRF_TRUSTED_ORIGINS", ""))
if _explicit_csrf:
    CSRF_TRUSTED_ORIGINS = _explicit_csrf
else:
    CSRF_TRUSTED_ORIGINS = list(
        dict.fromkeys(
            [f"https://{host}" for host in ALLOWED_HOSTS if host not in {"127.0.0.1", "localhost"}]
            + [f"http://{host}" for host in ALLOWED_HOSTS if host not in {"127.0.0.1", "localhost"}]
        )
    )

# --------------------------------------------------------------------------- #
# Caching + sessions: Redis is already running for Celery; wire it up as the
# Django cache and session store so we stop hitting Postgres for every session
# read/write and so any `cache.get/set` in app code has a real backend.
# REDIS_URL defaults match the docker-compose `redis` service. In managed-host
# deployments (Upstash, ElastiCache, etc.) point REDIS_URL at the provider.
# --------------------------------------------------------------------------- #
REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/1")
CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.redis.RedisCache",
        "LOCATION": REDIS_URL,
        "TIMEOUT": int(os.getenv("DJANGO_CACHE_TIMEOUT", "300")),
        "KEY_PREFIX": "mototrack",
    }
}
# Cached-DB sessions: writes go to Postgres (durability), reads served from
# Redis (speed). Hot path: every request reads the session.
SESSION_ENGINE = "django.contrib.sessions.backends.cached_db"
SESSION_CACHE_ALIAS = "default"

# --------------------------------------------------------------------------- #
# Outbound email. The shared base.py defaults to the console backend (good for
# dev). In prod the operator MUST supply SMTP credentials — otherwise password
# resets, email verification, and admin alerts would silently disappear into
# stdout. We refuse to boot in that state.
# --------------------------------------------------------------------------- #
EMAIL_BACKEND = os.getenv("EMAIL_BACKEND", "django.core.mail.backends.smtp.EmailBackend")
if (
    EMAIL_BACKEND == "django.core.mail.backends.smtp.EmailBackend"
    and not os.getenv("EMAIL_HOST")
):
    raise ImproperlyConfigured(
        "EMAIL_HOST must be configured in production (or set EMAIL_BACKEND to a "
        "non-SMTP backend explicitly — e.g. anymail provider, console for staging)."
    )
