from .base import *  # noqa: F403,F401

DEBUG = True
# Allow Django's test client default host (`testserver`) in shell/tests helpers.
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]
ACCOUNT_EMAIL_VERIFICATION = "none"

# Remove whitenoise in dev/tests: Django's staticfiles app handles serving.
MIDDLEWARE = [
    m for m in MIDDLEWARE  # noqa: F405
    if m != "whitenoise.middleware.WhiteNoiseMiddleware"
]

# B-L7: surface accidental N+1s during local development by logging them.
# Activated only when the package is installed (so CI/tests can opt out).
try:
    import nplusone  # noqa: F401
except ImportError:
    pass
else:
    INSTALLED_APPS = list(INSTALLED_APPS) + ["nplusone.ext.django"]  # noqa: F405
    MIDDLEWARE = ["nplusone.ext.django.NPlusOneMiddleware"] + MIDDLEWARE  # noqa: F405
    NPLUSONE_LOGGER = __import__("logging").getLogger("nplusone")
    NPLUSONE_LOG_LEVEL = __import__("logging").WARN
