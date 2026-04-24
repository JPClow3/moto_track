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
