#!/usr/bin/env python3
"""Run the same checks executed in CI, locally."""
import subprocess
import sys


def run(cmd, title):
    print(f"\n{'=' * 60}\n{title}\n{'=' * 60}")
    result = subprocess.run(cmd)
    if result.returncode != 0:
        print(f"FAILED: {title}")
        sys.exit(result.returncode)
    print(f"OK: {title}")


def main():
    python = sys.executable
    run(
        [
            python,
            "-m",
            "pytest",
            "tests/unit",
            "tests/integration",
            "tests/system",
            "tests/regression",
            "tests/performance",
            "tests/security",
            "-q",
        ],
        "Unit + Integration + System + Regression + Performance + Security Tests",
    )
    run([python, "-m", "bandit", "-r", "apps", "-ll"], "Bandit Security Scan")
    run([python, "-m", "pip_audit", "-r", "requirements/prod.txt"], "pip-audit Dependency Scan")
    print("\nAll local CI checks passed.")


if __name__ == "__main__":
    main()
