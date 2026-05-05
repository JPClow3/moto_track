"""Test settings using SQLite for environments without PostgreSQL."""


from .dev import *  # noqa: F403,F401

DEBUG = False

DATABASES = {
    "default": {
        "ENGINE": "django.db.backends.sqlite3",
        "NAME": ":memory:",
    }
}

EMAIL_BACKEND = "django.core.mail.backends.locmem.EmailBackend"
PASSWORD_HASHERS = ["django.contrib.auth.hashers.MD5PasswordHasher"]
SITE_DOMAIN = ""

# Ensure allauth doesn't require email verification in tests
ACCOUNT_EMAIL_VERIFICATION = "none"

CACHES = {
    "default": {
        "BACKEND": "django.core.cache.backends.dummy.DummyCache",
    }
}
