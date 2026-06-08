#!/usr/bin/env python3
"""Generate nutrient_alloc_data.js — slider allocation table from Hydro Combos sessions."""

from __future__ import annotations

import json
import re
from collections import deque
from pathlib import Path

ROOT = Path(__file__).resolve().parent
COMBOS_JS = ROOT / "hydro_combos_data.js"
OUT_JS = ROOT / "nutrient_alloc_data.js"
OUT_JSON = ROOT / "nutrient_alloc_table.json"

NUTRIENT_TABLE = [
    [20, 0, 0],
    [17, 3, 0],
    [13, 6, 1],
    [8, 9, 3],
    [4, 13, 3],
    [3, 14, 3],
    [3, 13, 4],
    [3, 9, 8],
    [1, 6, 13],
    [0, 3, 17],
    [0, 0, 20],
]


def trim_cycle(pool: int, ratios: list[int], order: list[int]) -> list[int]:
    vals = list(ratios)
    excess = sum(vals) - pool
    idx_i = 0
    idle = 0
    while excess > 0:
        idx = order[idx_i % len(order)]
        idx_i += 1
        if vals[idx] > 0:
            vals[idx] -= 1
            excess -= 1
            idle = 0
        else:
            idle += 1
            if idle >= len(order):
                fb = next((j for j, v in enumerate(vals) if v > 0), -1)
                if fb < 0:
                    break
                vals[fb] -= 1
                excess -= 1
                idle = 0
    return vals


def split_center(pool: int, ratios: list[int]) -> list[int]:
    total = sum(ratios)
    end = (pool * ratios[0]) // total
    return [end, max(0, pool - 2 * end), end]


def intel_heavy(pool: int, ratios: list[int]) -> list[int] | None:
    d, i, a = ratios
    if i <= d or i <= a:
        return None
    vals = list(ratios)
    excess = sum(vals) - pool
    while excess > 0:
        d, i, a = vals
        if d > a:
            vals = [d + 1, i - 1, a - 1]
        elif d < a:
            vals = [d - 1, i - 1, a + 1]
        else:
            vals = [d, i - 1, a - 1]
        excess -= 1
    if any(v < 0 for v in vals) or sum(vals) != pool:
        return None
    return vals


def int_agg_second(pool: int, ratios: list[int]) -> list[int]:
    d, i, a = ratios
    excess = d + i + a - pool
    result = trim_cycle(pool, ratios, [1, 1, 0])
    if a < d and a < i and excess > 1:
        shifts = (excess - 1) // 2
        for _ in range(shifts):
            if result[0] <= 0:
                break
            result[0] -= 1
            result[2] += 1
    return result


def bfs_order(pool: int, ratios: list[int], target: list[int]) -> list[int] | None:
    tgt = ",".join(str(x) for x in target)
    q: deque[tuple[list[int], list[int]]] = deque([(list(ratios), [])])
    seen = {",".join(str(x) for x in ratios)}
    while q:
        vals, seq = q.popleft()
        if len(seq) > 25:
            continue
        if ",".join(str(x) for x in vals) == tgt:
            return seq
        if sum(vals) <= pool:
            continue
        for idx in range(3):
            if vals[idx] <= 0:
                continue
            nvals = list(vals)
            nvals[idx] -= 1
            key = ",".join(str(x) for x in nvals)
            if key in seen:
                continue
            seen.add(key)
            q.append((nvals, seq + [idx]))
    return None


def load_combos() -> dict:
    text = COMBOS_JS.read_text(encoding="utf-8")
    start = text.index("{")
    end = text.rindex("}") + 1
    return json.loads(text[start:end])


def unique_sessions(data: dict) -> dict[str, dict]:
    sessions: dict[str, dict] = {}
    for pack in data.values():
        for combo in pack["combos"]:
            for s in combo["sessions"]:
                key = f"{s['pool']}:{','.join(str(x) for x in s['dia'])}"
                sessions[key] = s
    return sessions


def main() -> None:
    data = load_combos()
    sessions = unique_sessions(data)

    # Learn trim order per (game_pos, excess) from combo sessions.
    order_map: dict[str, list[int]] = {}
    session_pos: dict[str, int] = {}

    for key, s in sessions.items():
        pool = s["pool"]
        target = s["dia"]
        excess = 20 - pool
        candidates: list[tuple[int, list[int]]] = []

        for pos in range(11):
            ratios = NUTRIENT_TABLE[pos]
            if pos == 5 and ratios[0] == ratios[2]:
                got = split_center(pool, ratios)
                if got == target:
                    candidates.append((pos, []))
                continue
            if pool == 19:
                ih = intel_heavy(pool, ratios)
                if ih == target:
                    candidates.append((pos, []))
            order = bfs_order(pool, ratios, target)
            if order is not None:
                got = trim_cycle(pool, ratios, order)
                if got == target:
                    candidates.append((pos, order))

        if not candidates:
            continue

        # Prefer the candidate whose (pos, excess) slot is still empty.
        chosen = None
        for pos, order in candidates:
            pk = f"{pos}:{excess}"
            if pk not in order_map:
                chosen = (pos, order)
                break
        if chosen is None:
            chosen = candidates[0]

        pos, order = chosen
        pk = f"{pos}:{excess}"
        if pk not in order_map and order:
            order_map[pk] = order
        session_pos[key] = pos

    def order_for(pos: int, pool: int) -> list[int] | None:
        excess = 20 - pool
        pk = f"{pos}:{excess}"
        if pk in order_map:
            return order_map[pk]
        # Nearest excess with a known order at this position.
        best: list[int] | None = None
        best_dist = 999
        for e in range(1, 20):
            pk2 = f"{pos}:{e}"
            if pk2 not in order_map:
                continue
            dist = abs(e - excess)
            if dist < best_dist:
                best_dist = dist
                best = order_map[pk2]
        return best

    def alloc(pool: int, pos: int) -> list[int]:
        ratios = NUTRIENT_TABLE[pos]
        if pool >= 20:
            return list(ratios)
        if pos == 5 and ratios[0] == ratios[2]:
            return split_center(pool, ratios)
        if pool == 19:
            ih = intel_heavy(pool, ratios)
            if ih is not None:
                return ih
        d, i, a = ratios
        excess = 20 - pool
        order = order_for(pos, pool)
        if order:
            return trim_cycle(pool, ratios, order)
        if i > d and i > a and a > d and excess > 1:
            return int_agg_second(pool, ratios)
        ih = intel_heavy(pool, ratios)
        if ih is not None:
            return ih
        return trim_cycle(pool, ratios, [1, 1, 0])

    table = [[alloc(pool, pos) for pool in range(21)] for pos in range(11)]

    hits = 0
    misses: list[str] = []
    for key, s in sessions.items():
        pool = s["pool"]
        target = s["dia"]
        ok = False
        for ui in range(11):
            pos = 10 - ui
            if alloc(pool, pos) == target:
                ok = True
                break
        if ok:
            hits += 1
        else:
            misses.append(key)

    OUT_JSON.write_text(json.dumps(table), encoding="utf-8")

    js = (
        "// AUTO-GENERATED by build_nutrient_alloc.py — do not edit.\n"
        '"use strict";\n\n'
        f"export const NUTRIENT_ALLOC_TABLE = {json.dumps(table)};\n"
    )
    OUT_JS.write_text(js, encoding="utf-8")

    print(f"Wrote {OUT_JS.name} and {OUT_JSON.name}")
    print(f"Combo sessions matched: {hits}/{len(sessions)}")
    if misses:
        print(f"Unmatched ({len(misses)}):")
        for m in misses:
            print(f"  {m}")


if __name__ == "__main__":
    main()
