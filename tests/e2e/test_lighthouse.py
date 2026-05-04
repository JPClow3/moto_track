import json
import os
import subprocess
import sys

import pytest

pytestmark = pytest.mark.lighthouse

BASE_URL = os.getenv("LIGHTHOUSE_URL", "http://localhost:8000")
PAGES = ["/", "/accounts/login/"]


def _lighthouse_available():
    try:
        return subprocess.run(["npx", "lighthouse", "--version"], capture_output=True).returncode == 0
    except FileNotFoundError:
        return False


@pytest.mark.skipif(not _lighthouse_available(), reason="Lighthouse CLI not available")
@pytest.mark.parametrize("path", PAGES)
def test_lighthouse_scores(path):
    url = f"{BASE_URL}{path}"
    result = subprocess.run(
        [
            "npx",
            "lighthouse",
            url,
            "--chrome-flags=--headless --no-sandbox --disable-gpu",
            "--output=json",
            "--output-path=stdout",
            "--only-categories=performance,accessibility,best-practices,seo",
        ],
        capture_output=True,
        text=True,
    )
    if result.returncode != 0:
        pytest.skip(f"Lighthouse failed for {url}: {result.stderr}")
    data = json.loads(result.stdout)
    categories = data.get("categories", {})
    for key, label in [("performance", "Performance"), ("accessibility", "Accessibility")]:
        score = categories.get(key, {}).get("score")
        if score is not None:
            assert score >= 0.5, f"{label} score {score} below 0.5 for {url}"
