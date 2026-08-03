#!/usr/bin/env bash
# SPENT one-shot migration tooling (2026-08-02), retained for provenance
# only. Proves the historical split-decisions.sh run was lossless against an
# ephemeral /tmp snapshot that does not survive a fresh clone — most checks
# below legitimately SKIP once that snapshot is gone, and an all-SKIP run
# still exits non-zero (see the exit-code note near the bottom). This script
# is not the ongoing guard for the split ledger: scripts/check-decision-ids.sh
# is, and it needs no snapshot.
#
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
# Map drift is mode-aware, chosen by DECISIONS.md's live content:
#   - Pre-migration mode — DECISIONS.md still has `^| D\d+ |` rows: map ids
#     are compared against those live ledger ids, exactly as before the
#     router reduction. This is the meaningful ordering the migration
#     depends on and it does not change.
#   - Router mode — DECISIONS.md has zero decision rows (the post-Task-3
#     state): the ledger comparison is meaningless, so map ids are compared
#     against the snapshot's id set instead, which is the correct stand-in
#     for "the ledger" once the rows have moved out of DECISIONS.md.
#   - Skip — router mode with no snapshot on disk (it lives under /tmp and
#     is not guaranteed to survive into a later session): there is no ledger
#     and no stand-in, so Map drift can prove nothing and is reported as
#     SKIP, not OK or FAIL. An all-SKIP run still exits non-zero — see exit
#     code note near the bottom of the embedded script.
#
# Of the four checks, only Missing and Altered actually read the snapshot's
# row *contents*; Duplicated reads only decisions/** (an id appearing twice
# in the output is wrong regardless of history, so it always runs) and Map
# drift reads the snapshot only in router mode, as above. So "snapshot
# missing" SKIPs Missing, Altered, and (in router mode) Map drift, but
# Duplicated still produces a real OK or FAIL.
#
# Exit code when one or more checks report SKIP (including the all-SKIP
# case): non-zero. A clean `exit 0` should mean every check actually ran
# and passed; if some checks could not run at all, that is not the same
# thing as "nothing is wrong" and must not look identical to a full pass.
#
# Blind spots:
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

[ -f "$MAP" ] || { echo "FAIL: $MAP not found" >&2; exit 1; }
[ -f "$LEDGER" ] || { echo "FAIL: $LEDGER not found" >&2; exit 1; }

# The snapshot is only a hard requirement while DECISIONS.md still holds its
# rows (pre-migration mode): at that point it was just written by
# split-decisions.sh and its absence means something is actually wrong.
# Once DECISIONS.md has been reduced to a router, a missing snapshot is
# expected (it lives under /tmp and may not survive into a later session) —
# that case is handled per-check below instead of failing here.
if [ ! -f "$SNAPSHOT" ] && grep -qE '^\| D[0-9]+ \|' "$LEDGER"; then
  echo "FAIL: $SNAPSHOT not found — run scripts/split-decisions.sh first (DECISIONS.md still holds ledger rows)" >&2
  exit 1
fi

python3 - "$SNAPSHOT" "$MAP" "$LEDGER" "$OUT_DIR" <<'PY'
import re
import sys
from pathlib import Path

snapshot_path, map_path, ledger_path, out_dir = sys.argv[1:5]
ROW_RE = re.compile(r'^\| D([0-9]+) \|')
FAIL = False
SKIPPED = 0


def fail(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = True


def ok(msg: str) -> None:
    print(f"OK: {msg}")


def skip(msg: str) -> None:
    global SKIPPED
    SKIPPED += 1
    print(f"SKIP: {msg}")


def spelling(padded_digits: str) -> str:
    """Render an id's original digit spelling (e.g. '05') as `D05`."""
    return f"D{padded_digits}"


# --- ledger --------------------------------------------------------------------
# DECISIONS.md is git-tracked and always present (unlike the /tmp snapshot),
# so this is read unconditionally and used to pick the Map drift mode below:
# pre-migration (rows still present) vs router (reduced, zero rows).
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

mode = "pre-migration" if ledger_ids else "router"
snapshot_available = Path(snapshot_path).is_file()
# The bash wrapper already hard-fails on (pre-migration mode + no snapshot),
# so if we get here with no snapshot, mode is guaranteed to be "router".

# --- snapshot ------------------------------------------------------------------
# snapshot[id] is the full original row text; snapshot_digits[id] is that same
# row's original `D<digits>` spelling, kept alongside the normalised int key
# so diagnostics never lose the ledger's zero-padding. Left empty (not an
# error) when the snapshot is absent in router mode; callers below must check
# snapshot_available rather than infer absence from an empty dict, since an
# empty dict would otherwise read as "trivially satisfied".
snapshot: dict[int, str] = {}
snapshot_digits: dict[int, str] = {}
if snapshot_available:
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
    (the ledger's own text) then the occurrence text found under decisions/**,
    then the live ledger's own spelling."""
    digits = snapshot_digits.get(id_num) or occurrence_digits.get(id_num) or ledger_digits.get(id_num)
    return spelling(digits) if digits is not None else f"D{id_num}"


# --- Class 1: Missing ----------------------------------------------------------
# Needs the snapshot's row content; an empty snapshot dict is indistinguishable
# from "nothing missing", so this must SKIP rather than silently pass when the
# snapshot file itself is absent.
if not snapshot_available:
    skip(f"Missing — {snapshot_path} not found; cannot tell what should be in {out_dir}/** without the pre-migration snapshot (router mode)")
else:
    missing = sorted(i for i in snapshot if i not in occurrences)
    if missing:
        fail("Missing: " + f"{len(missing)} id(s) in snapshot absent from {out_dir}/**: "
             + ", ".join(id_spelling(i) for i in missing))
    else:
        ok(f"Missing — all {len(snapshot)} snapshot ids present in {out_dir}/**")

# --- Class 2: Duplicated ---------------------------------------------------------
# Reads only decisions/** occurrences, never the snapshot — an id duplicated
# in the output is wrong regardless of migration history, so this always runs.
dup_ids = sorted(i for i, occ in occurrences.items() if len(occ) > 1)
if dup_ids:
    for i in dup_ids:
        locs = ", ".join(f for f, _ in occurrences[i])
        fail(f"Duplicated: {id_spelling(i)} appears {len(occurrences[i])}x ({locs})")
else:
    ok(f"Duplicated — no id appears more than once across {out_dir}/**")

# --- Class 3: Altered --------------------------------------------------------------
# Needs the snapshot's row content for comparison; with an empty snapshot dict
# every occurrence would trivially skip the `i not in snapshot` guard below and
# report a vacuous pass, so this must SKIP explicitly instead.
if not snapshot_available:
    skip(f"Altered — {snapshot_path} not found; cannot compare {out_dir}/** rows against pre-migration text (router mode)")
else:
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
        ok("Altered — every matched row is byte-identical to its snapshot text")

# --- Class 4: Map drift -------------------------------------------------------------
# Mode-aware: while DECISIONS.md still holds its rows (pre-migration), compare
# the map against those live ledger ids — the meaningful ordering the
# migration itself depends on. Once DECISIONS.md is a router (router mode),
# the live ledger has nothing to compare against, so the snapshot's id set is
# the correct stand-in for "the ledger" instead. If the snapshot is also gone
# in router mode, there is no ledger and no stand-in — SKIP rather than pass
# or fail.
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

if mode == "pre-migration":
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
        ok(f"Map drift — {len(map_ids)} map ids and {len(ledger_ids)} ledger ids agree exactly "
           f"(pre-migration mode; DECISIONS.md still holds {len(ledger_ids)} rows)")
elif not snapshot_available:
    skip(f"Map drift — DECISIONS.md holds no rows (router mode) and {snapshot_path} not found; "
         f"no ledger and no snapshot stand-in to compare the map against")
else:
    snap_ids = set(snapshot.keys())
    only_in_map = sorted(map_ids - snap_ids)
    only_in_snapshot = sorted(snap_ids - map_ids)
    if only_in_map or only_in_snapshot:
        if only_in_map:
            fail("Map drift: id(s) in map absent from snapshot: "
                 + ", ".join(spelling(map_digits[i]) for i in only_in_map))
        if only_in_snapshot:
            fail("Map drift: id(s) in snapshot absent from map: "
                 + ", ".join(spelling(snapshot_digits[i]) for i in only_in_snapshot))
    else:
        ok(f"Map drift — {len(map_ids)} map ids and {len(snap_ids)} snapshot ids agree exactly "
           f"(router mode; DECISIONS.md holds no rows)")

if FAIL:
    sys.exit(1)
if SKIPPED:
    print(f"SKIP: {SKIPPED} of 4 check(s) could not run — treating as non-zero so this is never mistaken for a full pass", file=sys.stderr)
    sys.exit(1)
sys.exit(0)
PY
