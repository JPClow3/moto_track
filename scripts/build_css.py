#!/usr/bin/env python3
"""Bootstrap Tailwind CSS binary and run build/watch commands."""

import argparse
import os
import subprocess

# Ensure the binary is present
import bootstrap_tailwind


def get_project_root():
    return os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def run_tailwind(mode):
    binary = bootstrap_tailwind.download_tailwind()
    root = get_project_root()
    input_path = os.path.join(root, "static", "css", "input.css")
    output_path = os.path.join(root, "static", "css", "tailwind.generated.css")
    config_path = os.path.join(root, "tailwind.config.js")

    cmd = [
        binary,
        "-i", input_path,
        "-o", output_path,
        "--config", config_path,
    ]

    if mode == "watch":
        cmd.append("--watch")
    elif mode == "build":
        cmd.append("--minify")

    print("Running:", " ".join(cmd))
    subprocess.run(cmd, check=True)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Build or watch Tailwind CSS")
    parser.add_argument("--watch", action="store_true", help="Watch for changes")
    parser.add_argument("--build", action="store_true", help="Minified production build")
    args = parser.parse_args()

    if args.watch:
        mode = "watch"
    elif args.build:
        mode = "build"
    else:
        mode = "dev"

    run_tailwind(mode)
