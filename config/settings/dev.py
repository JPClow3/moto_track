from .base import *  # noqa: F403,F401

DEBUG = True
# Allow Django's test client default host (`testserver`) in shell/tests helpers.
ALLOWED_HOSTS = ["127.0.0.1", "localhost", "testserver"]
