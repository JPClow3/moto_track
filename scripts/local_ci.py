#!/usr/bin/env python3
"""Run the same checks executed in CI, locally."""
import os
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
    if not (os.getenv("TEST_DATABASE_URL") or os.getenv("DATABASE_URL")):
        print(
            "Set TEST_DATABASE_URL or DATABASE_URL to a PostgreSQL database before running local CI.\n"
            "Alternatively use: docker compose --profile test up --build "
            "--abort-on-container-exit --exit-code-from test"
        )
        sys.exit(2)

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
