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
# Diagnostics render each id with its original spelling as it appears in the
# source it came from (e.g. `D05`, not the normalised-int `D5`) — the
# normalised int is only ever used as the dict/set key, never printed —
# so a failure message stays grep-able against DECISIONS.md and
# scripts/decision-map.txt verbatim.
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


def spelling(padded_digits: str) -> str:
    """Render an id's original digit spelling (e.g. '05') as `D05`."""
    return f"D{padded_digits}"


# --- snapshot ----------------------------------------------------------------
# snapshot[id] is the full original row text; snapshot_digits[id] is that same
# row's original `D<digits>` spelling, kept alongside the normalised int key
# so diagnostics never lose the ledger's zero-padding.
snapshot: dict[int, str] = {}
snapshot_digits: dict[int, str] = {}
with open(snapshot_path, encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        if not line:
            continue
        id_str, row = line.split("\t", 1)
        id_num = int(id_str)
        snapshot[id_num] = row
        m = ROW_RE.match(row)
        snapshot_digits[id_num] = m.group(1) if m else id_str

# --- every `| D<n> |` occurrence under decisions/** ---------------------------
occurrences: dict[int, list[tuple[str, str]]] = {}
occurrence_digits: dict[int, str] = {}
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
            occurrence_digits.setdefault(id_num, m.group(1))


def id_spelling(id_num: int) -> str:
    """Best-available original spelling for an id, preferring the snapshot
    (the ledger's own text) then the occurrence text found under decisions/**."""
    digits = snapshot_digits.get(id_num) or occurrence_digits.get(id_num)
    return spelling(digits) if digits is not None else f"D{id_num}"


# --- Class 1: Missing ----------------------------------------------------------
missing = sorted(i for i in snapshot if i not in occurrences)
if missing:
    fail("Missing: " + f"{len(missing)} id(s) in snapshot absent from {out_dir}/**: "
         + ", ".join(id_spelling(i) for i in missing))
else:
    print(f"OK: Missing — all {len(snapshot)} snapshot ids present in {out_dir}/**")

# --- Class 2: Duplicated ---------------------------------------------------------
dup_ids = sorted(i for i, occ in occurrences.items() if len(occ) > 1)
if dup_ids:
    for i in dup_ids:
        locs = ", ".join(f for f, _ in occurrences[i])
        fail(f"Duplicated: {id_spelling(i)} appears {len(occurrences[i])}x ({locs})")
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
        fail(f"Altered: {id_spelling(i)} in {fpath} differs byte-for-byte from its snapshot text")
else:
    print("OK: Altered — every matched row is byte-identical to its snapshot text")

# --- Class 4: Map drift -------------------------------------------------------------
map_ids: set[int] = set()
map_digits: dict[int, str] = {}
with open(map_path, encoding="utf-8") as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#") or ":" not in line:
            continue
        _, ids_part = line.split(":", 1)
        for tok in ids_part.split():
            id_num = int(tok)
            map_ids.add(id_num)
            map_digits.setdefault(id_num, tok)

ledger_ids: set[int] = set()
ledger_digits: dict[int, str] = {}
with open(ledger_path, encoding="utf-8") as f:
    for raw in f:
        line = raw.rstrip("\n")
        m = ROW_RE.match(line)
        if m:
            id_num = int(m.group(1))
            ledger_ids.add(id_num)
            ledger_digits.setdefault(id_num, m.group(1))

only_in_map = sorted(map_ids - ledger_ids)
only_in_ledger = sorted(ledger_ids - map_ids)
if only_in_map or only_in_ledger:
    if only_in_map:
        fail("Map drift: id(s) in map absent from ledger: "
             + ", ".join(spelling(map_digits[i]) for i in only_in_map))
    if only_in_ledger:
        fail("Map drift: id(s) in ledger absent from map: "
             + ", ".join(spelling(ledger_digits[i]) for i in only_in_ledger))
else:
    print(f"OK: Map drift — {len(map_ids)} map ids and {len(ledger_ids)} ledger ids agree exactly")

sys.exit(1 if FAIL else 0)
PY
