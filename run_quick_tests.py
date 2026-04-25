#!/usr/bin/env python
"""Run targeted tests for recently changed templates and views."""
import os
import subprocess
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

output_file = "pytest_quick_output.txt"
args = [
    sys.executable, "-m", "pytest",
    "tests/unit/test_core_views.py",
    "tests/unit/test_accounts.py",
    "-v", "--tb=short", "-x"
]

with open(output_file, "w") as f:
    result = subprocess.run(args, stdout=f, stderr=subprocess.STDOUT)

print(f"Exit code: {result.returncode}")
