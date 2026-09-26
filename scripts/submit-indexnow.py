"""Notify IndexNow about recently edited URLs listed in the public sitemap."""

import argparse
import json
from datetime import datetime, timedelta, timezone
from pathlib import Path
from urllib.error import HTTPError
from urllib.request import Request, urlopen
from xml.etree import ElementTree

SITE = "https://moto-track.net"
HOST = "moto-track.net"
KEY_URL = f"{SITE}/indexnow-key.txt"
SITEMAP_URL = f"{SITE}/sitemap.xml"
INDEXNOW_URL = "https://api.indexnow.org/indexnow"
XML = {"sm": "http://www.sitemaps.org/schemas/sitemap/0.9"}


def fetch(url):
    with urlopen(Request(url, headers={"User-Agent": "MotoTrackIndexNow/1.0"}), timeout=30) as response:
        return response.read()


def recent(lastmod, cutoff):
    if not lastmod:
        return False
    modified = datetime.fromisoformat(lastmod.replace("Z", "+00:00"))
    if modified.tzinfo is None:
        modified = modified.replace(tzinfo=timezone.utc)
    return modified >= cutoff


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--all", action="store_true", help="Submit all current sitemap URLs once")
    args = parser.parse_args()

    key = (Path(__file__).resolve().parent.parent / "static" / "indexnow-key.txt").read_text(encoding="utf-8").strip()
    if fetch(KEY_URL).decode("utf-8").strip() != key:
        raise RuntimeError("The public IndexNow key does not match the deployed key")

    root = ElementTree.fromstring(fetch(SITEMAP_URL))
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    urls = []
    for entry in root.findall("sm:url", XML):
        location = entry.findtext("sm:loc", default="", namespaces=XML)
        lastmod = entry.findtext("sm:lastmod", default="", namespaces=XML)
        if location.startswith(f"{SITE}/") and (args.all or recent(lastmod, cutoff)):
            urls.append(location)

    if not urls:
        print("No recently changed sitemap URLs to notify.")
        return

    payload = json.dumps({"host": HOST, "key": key, "keyLocation": KEY_URL, "urlList": urls}).encode("utf-8")
    request = Request(
        INDEXNOW_URL,
        data=payload,
        headers={"Content-Type": "application/json; charset=utf-8"},
        method="POST",
    )
    try:
        with urlopen(request, timeout=30) as response:
            status = response.status
    except HTTPError as error:
        raise RuntimeError(f"IndexNow rejected the request (HTTP {error.code})") from error
    if status not in (200, 202):
        raise RuntimeError(f"Unexpected IndexNow response: HTTP {status}")
    print(f"IndexNow accepted {len(urls)} URLs (HTTP {status}).")


if __name__ == "__main__":
    main()
