"""Production Django settings."""

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
CSRF_TRUSTED_ORIGINS = list(
    dict.fromkeys(
        [f"https://{host}" for host in ALLOWED_HOSTS if host not in {"127.0.0.1", "localhost"}]
        + ["http://127.0.0.1", "http://localhost"]
    )
)
