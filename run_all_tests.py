#!/usr/bin/env python
"""Run full pytest suite and write output to file."""
import os
import subprocess
import sys

os.environ.setdefault("DJANGO_SETTINGS_MODULE", "config.settings.dev")

output_file = "pytest_output.txt"
args = [sys.executable, "-m", "pytest", "tests/unit", "tests/integration", "tests/system", "tests/regression", "tests/security", "-v", "--tb=short"]

with open(output_file, "w") as f:
    result = subprocess.run(args, stdout=f, stderr=subprocess.STDOUT)

print(f"Exit code: {result.returncode}")
print(f"Output written to {output_file}")
