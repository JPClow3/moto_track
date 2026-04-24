#!/usr/bin/env python
"""Small test runner to work around shell env-var issues on Windows."""
import os
import subprocess
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

# Run pytest with specified args
args = [sys.executable, "-m", "pytest"] + sys.argv[1:]
sys.exit(subprocess.call(args))
