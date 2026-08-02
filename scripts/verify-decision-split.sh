#!/usr/bin/env bash
# Verifies scripts/split-decisions.sh moved every decision losslessly.
#
# Compares /tmp/decisions-before.tsv (the pre-migration snapshot
# split-decisions.sh writes) against decisions/**/*.md, and
# scripts/decision-map.txt against DECISIONS.md, failing on any of:
#   Missing     an id in the snapshot absent from decisions/**
#   Duplicated  an id appearing in more than one file, or twice in one file
#   Altered     a row's text differing byte-for-byte from its snapshot text
#   Map drift   an id in the map absent from the ledger, or a ledger id
#               absent from the map
#
# Every id match is anchored on `^| D[0-9]+ |` (position, not the darts sense
# of "D18" = double 18) and restricted to decisions/** + DECISIONS.md;
# app/src/** (e.g. checkout-path.module.ts's ~40 double/treble tokens) is
# never scanned.
#
# Blind spots:
#   - Map drift reads DECISIONS.md's *current* content as "the ledger". Task 3
#     runs this before reducing DECISIONS.md to a router, when the ledger
#     still holds all 163 original rows — that ordering is what makes this
#     check meaningful. Once the router reduction has happened, re-running
#     this script will report every mapped id as "absent from ledger"; at
#     that point the snapshot's id set is the correct stand-in for the ledger,
#     not this script's current live read.
#   - An id present in decisions/** with no snapshot counterpart at all (e.g.
#     a decision hand-added after the split with no pre-migration source) is
#     not one of the four classes above and is not flagged here — this script
#     proves the historical move was lossless, it is not a general-purpose
#     content linter for decisions/**.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

SNAPSHOT="/tmp/decisions-before.tsv"
MAP="scripts/decision-map.txt"
LEDGER="DECISIONS.md"
OUT_DIR="decisions"

[ -f "$SNAPSHOT" ] || { echo "FAIL: $SNAPSHOT not found — run scripts/split-decisions.sh first" >&2; exit 1; }
[ -f "$MAP" ] || { echo "FAIL: $MAP not found" >&2; exit 1; }
[ -f "$LEDGER" ] || { echo "FAIL: $LEDGER not found" >&2; exit 1; }

python3 - "$SNAPSHOT" "$MAP" "$LEDGER" "$OUT_DIR" <<'PY'
import re
import sys
from pathlib import Path

snapshot_path, map_path, ledger_path, out_dir = sys.argv[1:5]
ROW_RE = re.compile(r'^\| D([0-9]+) \|')
FAIL = False


def fail(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = True


# --- snapshot ----------------------------------------------------------------
snapshot: dict[int, str] = {}
with open(snapshot_path, encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line:
            continue
        id_str, row = line.split("\t", 1)
        snapshot[int(id_str)] = row

# --- every `| D<n> |` occurrence under decisions/** ---------------------------
occurrences: dict[int, list[tuple[str, str]]] = {}
out_files = sorted(Path(out_dir).rglob("*.md")) if Path(out_dir).is_dir() else []
for path in out_files:
    with open(path, encoding="utf-8") as f:
        for line in f:
            line = line.rstrip("\n")
            m = ROW_RE.match(line)
            if not m:
                continue
            id_num = int(m.group(1))
            occurrences.setdefault(id_num, []).append((str(path), line))

# --- Class 1: Missing ----------------------------------------------------------
missing = sorted(i for i in snapshot if i not in occurrences)
if missing:
    fail("Missing: " + f"{len(missing)} id(s) in snapshot absent from {out_dir}/**: "
         + ", ".join(f"D{i}" for i in missing))
else:
    print(f"OK: Missing — all {len(snapshot)} snapshot ids present in {out_dir}/**")

# --- Class 2: Duplicated ---------------------------------------------------------
dup_ids = sorted(i for i, occ in occurrences.items() if len(occ) > 1)
if dup_ids:
    for i in dup_ids:
        locs = ", ".join(f for f, _ in occurrences[i])
        fail(f"Duplicated: D{i} appears {len(occurrences[i])}x ({locs})")
else:
    print(f"OK: Duplicated — no id appears more than once across {out_dir}/**")

# --- Class 3: Altered --------------------------------------------------------------
altered: list[tuple[int, str]] = []
for i, occ in occurrences.items():
    if i not in snapshot:
        continue
    for fpath, text in occ:
        if text != snapshot[i]:
            altered.append((i, fpath))
if altered:
    for i, fpath in altered:
        fail(f"Altered: D{i} in {fpath} differs byte-for-byte from its snapshot text")
else:
    print("OK: Altered — every matched row is byte-identical to its snapshot text")

# --- Class 4: Map drift -------------------------------------------------------------
map_ids: set[int] = set()
with open(map_path, encoding="utf-8") as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        _, ids_part = line.split(":", 1)
        for tok in ids_part.split():
            map_ids.add(int(tok))

ledger_ids: set[int] = set()
with open(ledger_path, encoding="utf-8") as f:
    for raw in f:
        line = raw.rstrip("\n")
        m = ROW_RE.match(line)
        if m:
            ledger_ids.add(int(m.group(1)))

only_in_map = sorted(map_ids - ledger_ids)
only_in_ledger = sorted(ledger_ids - map_ids)
if only_in_map or only_in_ledger:
    if only_in_map:
        fail("Map drift: id(s) in map absent from ledger: " + ", ".join(f"D{i}" for i in only_in_map))
    if only_in_ledger:
        fail("Map drift: id(s) in ledger absent from map: " + ", ".join(f"D{i}" for i in only_in_ledger))
else:
    print(f"OK: Map drift — {len(map_ids)} map ids and {len(ledger_ids)} ledger ids agree exactly")

sys.exit(1 if FAIL else 0)
PY
