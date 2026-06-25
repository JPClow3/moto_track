import os

import dj_database_url
from django.core.exceptions import ImproperlyConfigured

from .base import *  # noqa: F403,F401

ALLOWED_HOSTS = ["*"]

_test_database_url = os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")
_test_settings_selected = os.getenv("DJANGO_SETTINGS_MODULE") == "config.settings.test"
if not _test_database_url and _test_settings_selected:
    raise ImproperlyConfigured("Set TEST_DATABASE_URL or DATABASE_URL to a PostgreSQL database for tests.")
_test_database_url = _test_database_url or "postgresql://postgres:postgres@localhost:5432/moto_test"
if not _test_database_url.startswith(("postgres://", "postgresql://")):
    raise ImproperlyConfigured("Tests must run against PostgreSQL; SQLite test databases are not supported.")

DATABASES = {
    "default": dj_database_url.parse(
        _test_database_url,
        conn_max_age=0,
    )
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
SITE_DOMAIN = ""
ACCOUNT_EMAIL_VERIFICATION = "none"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}
