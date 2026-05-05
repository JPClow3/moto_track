import os

import dj_database_url

from .base import *  # noqa: F403,F401

DATABASES = {
    "default": dj_database_url.parse(
        os.getenv("TEST_DATABASE_URL")
        or (os.getenv("DATABASE_URL") if os.getenv("CI") else "")
        or f"sqlite:///{BASE_DIR / 'test.sqlite3'}",  # noqa: F405
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
