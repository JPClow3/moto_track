"""
Build-time Django settings.

Used for tasks like `collectstatic` during container builds, without requiring
production secrets to be present at build time.
"""

import os

# pylint: disable=wrong-import-position

# `config.settings.base` requires `DJANGO_SECRET_KEY` with no default.
# For image builds we provide a safe placeholder so importing prod settings works.
os.environ.setdefault("DJANGO_SECRET_KEY", "build-only-not-a-secret-" + ("x" * 64))

# `config.settings.prod` requires non-empty object-storage settings at import
# time. Collectstatic does not need a real bucket; runtime containers must set
# the real bucket and credentials.
os.environ.setdefault("R2_BUCKET_NAME", "build-placeholder-bucket")
os.environ.setdefault("R2_ACCOUNT_ID", "build-placeholder-account")

# `config.settings.prod` refuses to boot without SMTP credentials. During
# collectstatic / `manage.py check --deploy` we have no outbound mail to send,
# so neuter the validation by pointing at the no-op console backend.
os.environ.setdefault("EMAIL_BACKEND", "django.core.mail.backends.console.EmailBackend")

from .prod import *  # noqa: F403,F401 pylint: disable=wildcard-import,unused-wildcard-import

# Keep SECRET_KEY explicit for clarity (and to ensure it is non-insecure and long enough).
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]  # noqa: F405
