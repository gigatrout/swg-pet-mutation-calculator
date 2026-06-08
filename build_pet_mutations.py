#!/usr/bin/env python3
"""Regenerate pet_mutations_data.js from swgpets.com mirror HTML.

  python3 build_pet_mutations.py --mirror ~/git/swgPets/mirror/pet
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DEFAULT_MIRROR = Path.home() / "git" / "swgPets" / "mirror" / "pet"
OUT_JS = ROOT / "pet_mutations_data.js"


def slug_to_name(slug: str) -> str:
    return slug.replace("+", " ").replace("_", " ")


def parse_title_value(cell_html: str, prefix: str) -> str | None:
    for title in re.findall(r'title="([^"]+)"', cell_html):
        if title.startswith(prefix):
            return title.split(":", 1)[1].strip()
    return None


def strip_cell_text(cell_html: str) -> str:
    text = re.sub(r"<[^>]+>", "", cell_html)
    text = re.sub(r"\s+", " ", text).strip()
    return text


def parse_mutation_table(html: str) -> list[dict] | None:
    if "1st Mutation" not in html:
        return None
    mut = html.split("name='mut'")[1] if "name='mut'" in html else html
    mut = mut[:20000]

    def row_cells(label: str) -> list[str]:
        match = re.search(rf"<th[^>]*>.*?{label}.*?</th>(.*?)</tr>", mut, re.S | re.I)
        if not match:
            return []
        return re.findall(r"<td[^>]*>(.*?)</td>", match.group(1), re.S)

    result_cells = row_cells("Result")
    lyase_cells = row_cells("Lyase")
    iso_matches = list(
        re.finditer(r"<th[^>]*>.*?Isomerase.*?</th>(.*?)</tr>", mut, re.S | re.I)
    )
    top_cells = iso_matches[0].group(1) if iso_matches else ""
    bottom_cells = iso_matches[1].group(1) if len(iso_matches) > 1 else ""
    top_cells = re.findall(r"<td[^>]*>(.*?)</td>", top_cells, re.S)
    bottom_cells = re.findall(r"<td[^>]*>(.*?)</td>", bottom_cells, re.S)

    if len(result_cells) < 3 or len(lyase_cells) < 3:
        return None

    stages: list[dict] = []
    for i in range(3):
        result_cell = result_cells[i]
        link_match = re.search(r'href="/pet/([^"?]+)', result_cell)
        result_text = strip_cell_text(result_cell)
        lyase = parse_title_value(lyase_cells[i], "Lyase") or strip_cell_text(lyase_cells[i])
        iso_top = (
            parse_title_value(top_cells[i], "Top Isomerase")
            if i < len(top_cells)
            else None
        ) or (strip_cell_text(top_cells[i]) if i < len(top_cells) else "")
        iso_bottom = (
            parse_title_value(bottom_cells[i], "Bottom Isomerase")
            if i < len(bottom_cells)
            else None
        ) or (strip_cell_text(bottom_cells[i]) if i < len(bottom_cells) else "")

        stage: dict = {
            "stage": i + 1,
            "result": result_text,
            "resultSlug": link_match.group(1) if link_match else None,
            "lyase": lyase,
            "isomeraseTop": iso_top,
            "isomeraseBottom": iso_bottom,
        }
        if i == 2:
            stage["appearanceOnly"] = True
        stages.append(stage)
    return stages


def parse_pet_page(path: Path) -> dict:
    html = path.read_text(encoding="latin-1", errors="replace")
    slug = path.parent.name

    name_match = re.search(
        r"Pet Name&nbsp;&nbsp;</nobr></span></td><td[^>]*>.*?<font color='yellow'>([^<]+)</font>",
        html,
        re.S | re.I,
    )
    name = name_match.group(1).strip() if name_match else slug_to_name(slug)

    family_match = re.search(
        r'Family&nbsp;&nbsp;</nobr></span></td><td[^>]*>.*?<a href="/pets\?family=([^"]+)">([^<]+)</a>',
        html,
        re.S | re.I,
    )
    family = family_match.group(2).strip() if family_match else None

    image_key = None
    img_match = re.search(
        r"primary_img'[^']*value='images/swgpets/300_swgpets-([^.]+)\.png'",
        html,
        re.I,
    )
    if img_match:
        image_key = img_match.group(1)
    else:
        switch_match = re.search(r"Switch_Color\('([^']+)'", html)
        if switch_match:
            image_key = switch_match.group(1)

    mutated_from = None
    for pattern in (
        r"Mutated From&nbsp;&nbsp;</nobr></span></td><td[^>]*>.*?href=\"/pet/([^\"]+)\"",
        r"Mutated from:&nbsp;.*?href=\"/pet/([^\"]+)\"",
        r"This pet is Mutated from:.*?href=\"/pet/([^\"]+)\"",
    ):
        match = re.search(pattern, html, re.S | re.I)
        if match:
            mutated_from = match.group(1)
            break

    stages = parse_mutation_table(html)
    kind = "base" if stages else ("result" if mutated_from else "other")

    entry: dict = {"slug": slug, "name": name, "kind": kind}
    if image_key:
        entry["imageKey"] = image_key
    if family:
        entry["family"] = family
    if stages:
        entry["stages"] = stages
    if mutated_from:
        entry["mutatedFrom"] = mutated_from
    return entry


def find_highlight_stage(base: dict | None, result_slug: str, result_name: str) -> int | None:
    if not base or not base.get("stages"):
        return None
    for stage in base["stages"]:
        if stage.get("resultSlug") == result_slug:
            return stage["stage"]
        if stage.get("result", "").lower() == result_name.lower():
            return stage["stage"]
    return None


def attach_highlight_stages(pets: list[dict], by_slug: dict[str, dict]) -> None:
    for pet in pets:
        if pet.get("kind") != "result" or not pet.get("mutatedFrom"):
            continue
        base = by_slug.get(pet["mutatedFrom"])
        highlight = find_highlight_stage(base, pet["slug"], pet["name"])
        if highlight is not None:
            pet["highlightStage"] = highlight


def emit_js(pets: list[dict], by_slug: dict[str, dict], out_path: Path) -> None:
    payload = {"pets": pets, "bySlug": by_slug}
    body = json.dumps(payload, indent=2, ensure_ascii=True)
    out_path.write_text(
        "// Generated by build_pet_mutations.py — do not edit by hand.\n"
        f"export const PET_MUTATIONS = {body};\n",
        encoding="utf-8",
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--mirror",
        type=Path,
        default=DEFAULT_MIRROR,
        help=f"Path to mirror/pet directory (default: {DEFAULT_MIRROR})",
    )
    parser.add_argument(
        "--out",
        type=Path,
        default=OUT_JS,
        help=f"Output JS path (default: {OUT_JS})",
    )
    args = parser.parse_args()

    mirror = args.mirror.expanduser()
    if not mirror.is_dir():
        print(f"Mirror not found: {mirror}", file=sys.stderr)
        return 1

    pages = sorted(mirror.glob("*/index.html"))
    if not pages:
        print(f"No pet pages under {mirror}", file=sys.stderr)
        return 1

    seen_slugs: dict[str, tuple[Path, dict]] = {}
    pets: list[dict] = []
    slug_aliases: dict[str, str] = {}
    warnings: list[str] = []

    for page in pages:
        slug = page.parent.name
        canonical = slug.lower().replace("+", "_")
        entry = parse_pet_page(page)
        if canonical in seen_slugs:
            kept_path, kept_entry = seen_slugs[canonical]
            kept_score = (1 if kept_entry.get("stages") else 0) + (
                1 if kept_entry.get("mutatedFrom") else 0
            )
            new_score = (1 if entry.get("stages") else 0) + (
                1 if entry.get("mutatedFrom") else 0
            )
            if new_score > kept_score:
                slug_aliases[kept_path.parent.name] = slug
                seen_slugs[canonical] = (page, entry)
                pets = [p for p in pets if p["slug"] != kept_path.parent.name]
                pets.append(entry)
            else:
                slug_aliases[slug] = kept_path.parent.name
                warnings.append(
                    f"Duplicate slug variant: {slug} → alias of {kept_path.parent.name}"
                )
            continue
        seen_slugs[canonical] = (page, entry)
        if entry["kind"] == "other":
            warnings.append(f"No mutation data: {slug}")
        pets.append(entry)

    pets.sort(key=lambda p: p["name"].lower())
    by_slug = {p["slug"]: p for p in pets}
    for alias, target in slug_aliases.items():
        if target in by_slug:
            by_slug[alias] = by_slug[target]
    attach_highlight_stages(pets, by_slug)

    emit_js(pets, by_slug, args.out)

    base_count = sum(1 for p in pets if p.get("stages"))
    result_count = sum(1 for p in pets if p.get("mutatedFrom"))
    print(f"Wrote {args.out} ({len(pets)} pets, {base_count} with stages, {result_count} mutation results)")
    if warnings:
        print(f"Warnings ({len(warnings)}):")
        for w in warnings[:20]:
            print(f"  - {w}")
        if len(warnings) > 20:
            print(f"  ... and {len(warnings) - 20} more")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
