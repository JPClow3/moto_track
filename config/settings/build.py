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

from .prod import *  # noqa: F403,F401 pylint: disable=wildcard-import,unused-wildcard-import

# Keep SECRET_KEY explicit for clarity (and to ensure it is non-insecure and long enough).
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]  # noqa: F405

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

from .prod import *  # noqa: F403,F401 pylint: disable=wildcard-import,unused-wildcard-import

# Keep SECRET_KEY explicit for clarity (and to ensure it is non-insecure and long enough).
SECRET_KEY = os.environ["DJANGO_SECRET_KEY"]  # noqa: F405
*** End Patch"}]}Oops applypatch freeform required. Let's do proper. We'll call ApplyPatch. ಗಿನ let's do. We'll correct patch. We'll include single newline at end.  }
