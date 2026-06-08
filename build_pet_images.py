#!/usr/bin/env python3
"""Download swgpets 300px pet renders into assets/pet-images/ for offline use.

  python3 build_pet_images.py
  python3 build_pet_images.py --from-data pet_mutations_data.js
"""

from __future__ import annotations

import argparse
import json
import re
import sys
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_DATA = ROOT / "pet_mutations_data.js"
OUT_DIR = ROOT / "assets" / "pet-images"
SWGPETS_BASE = "https://www.swgpets.com/images/swgpets/"


def load_image_keys(data_path: Path) -> list[str]:
    text = data_path.read_text(encoding="utf-8")
    match = re.search(r"export const PET_MUTATIONS = (\{.*\});\s*$", text, re.S)
    if not match:
        raise ValueError(f"Could not parse PET_MUTATIONS from {data_path}")
    payload = json.loads(match.group(1))
    keys: set[str] = set()
    for pet in payload.get("pets", []):
        key = pet.get("imageKey")
        if key:
            keys.add(key)
    return sorted(keys)


def download_image(key: str, dest: Path, timeout: float) -> bool:
    filename = f"300_swgpets-{key}.png"
    url = f"{SWGPETS_BASE}{filename}"
    result = subprocess.run(
        ["curl", "-sfL", "--max-time", str(int(timeout)), url, "-o", str(dest)],
        capture_output=True,
    )
    return result.returncode == 0 and dest.is_file() and dest.stat().st_size > 0


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--from-data",
        type=Path,
        default=DEFAULT_DATA,
        help=f"pet_mutations_data.js path (default: {DEFAULT_DATA})",
    )
    parser.add_argument(
        "--timeout",
        type=float,
        default=30.0,
        help="HTTP timeout per image in seconds",
    )
    parser.add_argument(
        "--force",
        action="store_true",
        help="Re-download even if file already exists",
    )
    args = parser.parse_args()

    data_path = args.from_data.expanduser()
    if not data_path.is_file():
        print(f"Data file not found: {data_path}", file=sys.stderr)
        print("Run build_pet_mutations.py first.", file=sys.stderr)
        return 1

    keys = load_image_keys(data_path)
    if not keys:
        print("No imageKey entries found.", file=sys.stderr)
        return 1

    OUT_DIR.mkdir(parents=True, exist_ok=True)
    ok = 0
    skipped = 0
    failed: list[str] = []

    for key in keys:
        dest = OUT_DIR / f"300_swgpets-{key}.png"
        if dest.is_file() and not args.force:
            skipped += 1
            ok += 1
            continue
        if download_image(key, dest, args.timeout):
            ok += 1
            print(f"  {key}")
        else:
            failed.append(key)

    print(
        f"Done: {ok}/{len(keys)} local images in {OUT_DIR}"
        + (f" ({skipped} already present)" if skipped else "")
    )
    if failed:
        print(f"Failed ({len(failed)}): {', '.join(failed[:20])}", file=sys.stderr)
        if len(failed) > 20:
            print(f"  ... and {len(failed) - 20} more", file=sys.stderr)
    return 0 if not failed else 2


if __name__ == "__main__":
    raise SystemExit(main())
