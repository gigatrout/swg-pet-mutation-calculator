#!/usr/bin/env python3
"""Regenerate hydro_combos_data.js from Hydro Combos.xls (green/yellow sheet)."""

from __future__ import annotations

import json
import sys
from pathlib import Path

try:
    import xlrd
except ImportError as exc:  # pragma: no cover
    raise SystemExit("pip install xlrd") from exc

ROOT = Path(__file__).resolve().parent
DEFAULT_XLS = Path("/Volumes/michael/SWG/Hydro Combos.xls")
OUT_JS = ROOT / "hydro_combos_data.js"


def pat(wb, sh, r: int, c: int) -> int:
    return wb.xf_list[sh.cell_xf_index(r, c)].background.pattern_colour_index


def val(sh, r: int, c: int):
    if r >= sh.nrows or c >= sh.ncols:
        return None
    raw = sh.cell(r, c).value
    if raw == "":
        return None
    if isinstance(raw, float) and raw == int(raw):
        return int(raw)
    return raw


def read_combo_block(wb, sh, top_row: int, hydro_total: int) -> list[dict]:
    """One block: 3 rows (D/I/A) × 3 session columns; green row = hydrolase purity per session."""
    if top_row + 3 >= sh.nrows or pat(wb, sh, top_row + 3, 1) != 50:
        return []
    if val(sh, top_row, 1) is None:
        return []

    combos: list[dict] = []
    c = 1
    while c + 2 < sh.ncols:
        if not all(pat(wb, sh, top_row + 3, sc) == 50 for sc in range(c, c + 3)):
            c += 1
            continue

        sessions: list[dict] = []
        purities: list[int] = []
        valid = True
        for sc in range(c, c + 3):
            raw_dia = (val(sh, top_row, sc), val(sh, top_row + 1, sc), val(sh, top_row + 2, sc))
            raw_purity = val(sh, top_row + 3, sc)
            if any(d is None for d in raw_dia) or raw_purity is None:
                valid = False
                break
            dia = [int(d) for d in raw_dia]
            purity = int(raw_purity)
            sessions.append({"dia": dia, "pool": purity})
            purities.append(purity)

        if valid and sum(purities) == hydro_total:
            combos.append(
                {
                    "sessions": sessions,
                    "purities": purities,
                    "label": "·".join(str(p) for p in purities),
                    "sessionPools": "·".join(str(p) for p in purities),
                    "total": {"dia": category_totals(sessions), "pool": sum(purities)},
                }
            )
        c += 4

    return combos


def category_totals(sessions: list[dict]) -> list[int]:
    """Grand Def · Int · Agg hydro placed (sum each row across sessions)."""
    totals = [0, 0, 0]
    for sess in sessions:
        for i, n in enumerate(sess["dia"]):
            totals[i] += n
    return totals


def parse_sheet(wb, name: str, hydro_total: int) -> tuple[list[dict], list[dict]]:
    sh = wb.sheet_by_name(name)
    headers = []
    for r in range(3, 6):
        headers.append(
            {
                "label": f"{int(val(sh, r, 1))}·{int(val(sh, r, 2))}·{int(val(sh, r, 4))}",
                "m1Purity": int(val(sh, r, 3)),
                "final": int(val(sh, r, 5)),
            }
        )

    combos: list[dict] = []
    row = 0
    while row + 3 < sh.nrows:
        block = read_combo_block(wb, sh, row, hydro_total)
        if block:
            combos.extend(block)
            row += 4
        else:
            row += 1

    seen: set[tuple] = set()
    uniq: list[dict] = []
    for combo in combos:
        key = tuple(tuple(s["dia"]) for s in combo["sessions"])
        if key in seen:
            continue
        seen.add(key)
        uniq.append(combo)
    return headers, uniq


def main() -> int:
    xls = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_XLS
    if not xls.is_file():
        print(f"Missing workbook: {xls}", file=sys.stderr)
        return 1

    wb = xlrd.open_workbook(str(xls), formatting_info=True)
    h48, c48 = parse_sheet(wb, "M1 - 48 Point Hydro Combos", 48)
    h36, c36 = parse_sheet(wb, "M2 - 36 Point Hydro Combos", 36)
    data = {
        "m48": {
            "title": "48pt (1 mutation)",
            "hydroTotal": 48,
            "mutations": 1,
            "starters": h48,
            "combos": c48,
        },
        "m36": {
            "title": "36pt (2 mutations)",
            "hydroTotal": 36,
            "mutations": 2,
            "starters": h36,
            "combos": c36,
        },
    }
    OUT_JS.write_text(f"export const HYDRO_COMBOS = {json.dumps(data, indent=2)};\n", encoding="utf-8")
    print(f"Wrote {OUT_JS} — {len(c48)} × 48pt, {len(c36)} × 36pt paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
