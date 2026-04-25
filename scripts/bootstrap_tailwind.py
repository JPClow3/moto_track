#!/usr/bin/env python3
"""Download the Tailwind CSS standalone binary for the current platform."""

import os
import platform
import stat
import urllib.request

TAILWIND_VERSION = "v3.4.19"
BASE_URL = f"https://github.com/tailwindlabs/tailwindcss/releases/download/{TAILWIND_VERSION}"

TOOLS_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), ".tools")


def get_asset_name():
    system = platform.system()
    machine = platform.machine()

    if system == "Windows":
        return "tailwindcss-windows-x64.exe"
    if system == "Darwin":
        if machine == "arm64":
            return "tailwindcss-macos-arm64"
        return "tailwindcss-macos-x64"
    if system == "Linux":
        if machine in ("aarch64", "arm64"):
            return "tailwindcss-linux-arm64"
        return "tailwindcss-linux-x64"
    raise RuntimeError(f"Unsupported platform: {system} {machine}")


def download_tailwind():
    exe_name = "tailwindcss.exe" if platform.system() == "Windows" else "tailwindcss"
    tailwind_path = os.path.join(TOOLS_DIR, exe_name)

    if os.path.exists(tailwind_path):
        print(f"Tailwind binary already exists: {tailwind_path}")
        return tailwind_path

    asset = get_asset_name()
    url = f"{BASE_URL}/{asset}"
    os.makedirs(TOOLS_DIR, exist_ok=True)

    print(f"Downloading Tailwind CSS {TAILWIND_VERSION} ({asset})...")
    urllib.request.urlretrieve(url, tailwind_path)

    if platform.system() != "Windows":
        os.chmod(tailwind_path, os.stat(tailwind_path).st_mode | stat.S_IEXEC)

    print(f"Tailwind binary ready: {tailwind_path}")
    return tailwind_path


if __name__ == "__main__":
    download_tailwind()
