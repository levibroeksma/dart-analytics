#!/usr/bin/env bash
# Context-map token-budget drift gate — Context Maintenance (root CLAUDE.md).
# Compares human-authored ~Nk values in 00-Context-Map.md to chars/4 estimates.
# Never rewrites the map. Per-file tolerance 20%; per-pack tolerance 30% (approx
# when non-.md entries are skipped). See D133.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

python3 - <<'PY'
from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(".").resolve()
MAP = Path("docs/architecture/00-Context-Map.md")
ARCH = Path("docs/architecture")
FAIL = 0

FILE_ROW = re.compile(
    r"\|\s*`([^`]+)`\s*\|[^|]*\|[^|]*\|\s*(~[\d.]+k)\s*\|"
)
PACK_ROW = re.compile(
    r"\|\s*([^|]+?)\s*\|\s*([^|]+?)\s*\|\s*(~[\d.]+k)\s*\|"
)
BACKTICK = re.compile(r"`([^`]+)`")


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def chars4_k(path: Path) -> float:
    return len(path.read_text(encoding="utf-8")) / 4 / 1000


def parse_claimed(token: str) -> float:
    return float(token[1:-1])  # strip leading ~ and trailing k


def fmt_k(v: float) -> str:
    r = round(v * 10) / 10
    return f"~{int(r)}k" if r == int(r) else f"~{r}k"


def resolve_inventory_path(ref: str) -> Path | None:
    """Resolve a File Inventory backtick path to a real file."""
    candidates = [
        ARCH / ref,
        ARCH / "05-Database" / ref,
        ROOT / ref,
        ROOT / "docs" / ref,
        ROOT / "database" / ref,
        ROOT / "app" / ref,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def resolve_pack_md(ref: str) -> Path | None:
    if not ref.endswith(".md"):
        return None
    if ref == "DECISIONS.md":
        p = ROOT / "DECISIONS.md"
        return p if p.is_file() else None
    if ref == "app/CLAUDE.md":
        p = ROOT / "app" / "CLAUDE.md"
        return p if p.is_file() else None
    candidates = [
        ARCH / ref,
        ARCH / "05-Database" / ref,
        ROOT / ref,
        ROOT / "docs" / ref,
        ROOT / "app" / ref,
    ]
    for c in candidates:
        if c.is_file():
            return c
    return None


def check_files(text: str) -> None:
    # Only scan File Inventory section (after "# File Inventory")
    if "# File Inventory" not in text:
        err("00-Context-Map.md missing # File Inventory heading")
        return
    inv = text.split("# File Inventory", 1)[1]
    # stop before Non-Canonical / later sections that lack ~Tokens
    for stop in ("# Non-Canonical Source Material", "# Current Implementation State", "# Maintenance Protocol"):
        if stop in inv:
            inv = inv.split(stop, 1)[0]
            break
    for m in FILE_ROW.finditer(inv):
        ref, claimed_s = m.group(1), m.group(2)
        path = resolve_inventory_path(ref)
        if path is None:
            err(f"inventory path not found: `{ref}` claimed={claimed_s}")
            continue
        computed = chars4_k(path)
        claimed = parse_claimed(claimed_s)
        if computed <= 0:
            err(f"{ref}: computed token estimate is 0")
            continue
        drift = abs(claimed - computed) / computed
        if drift > 0.20:
            err(
                f"{ref} claimed={claimed_s} computed={fmt_k(computed)} "
                f"(drift={drift:.0%} > 20%)"
            )


def check_packs(text: str) -> None:
    if "# Context Packs" not in text:
        err("00-Context-Map.md missing # Context Packs heading")
        return
    section = text.split("# Context Packs", 1)[1]
    if "# Authority Order" in section:
        section = section.split("# Authority Order", 1)[0]
    for m in PACK_ROW.finditer(section):
        task, load, claimed_s = (x.strip() for x in m.groups())
        if task in ("Task type",) or task.startswith("-"):
            continue
        refs = BACKTICK.findall(load)
        total = 0.0
        skipped: list[str] = []
        for ref in refs:
            path = resolve_pack_md(ref)
            if path is None:
                skipped.append(ref)
                continue
            total += chars4_k(path)
        if total <= 0:
            err(f"pack `{task}`: no .md files resolved (skipped={skipped})")
            continue
        claimed = parse_claimed(claimed_s)
        drift = abs(claimed - total) / total
        approx = " approx" if skipped else ""
        if drift > 0.30:
            err(
                f"pack `{task}` claimed={claimed_s} computed={fmt_k(total)} "
                f"(drift={drift:.0%} > 30%){approx} skipped={skipped}"
            )


def main() -> int:
    if not MAP.is_file():
        err(f"missing {MAP}")
        return 1
    text = MAP.read_text(encoding="utf-8")
    check_files(text)
    check_packs(text)
    if FAIL:
        return 1
    print("OK: context-map per-file and per-pack token budgets within tolerance.")
    return 0


sys.exit(main())
PY
