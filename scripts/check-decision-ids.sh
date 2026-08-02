#!/usr/bin/env bash
# Decision-id integrity gate — durable guard for the split ledger under
# decisions/** (root CLAUDE.md Context Maintenance; DECISIONS.md is the
# router — see DECISIONS.md's own header and decisions/context-system.md).
# Unlike scripts/verify-decision-split.sh (proves the one-time migration was
# lossless against a /tmp snapshot, and legitimately SKIPs once that snapshot
# is gone), this gate needs no snapshot and is meant to keep passing forever.
#
# Four checks, each anchored on POSITION, never on the bare token `D\d+`:
#   1. Uniqueness    — every id row (`^| D\d+ |`) or block heading
#                      (`^### D\d+`) across decisions/** appears exactly once
#                      (no id in two files, none twice in one file).
#   2. No regression — none of the 163 ids present at the 2026-08-02 ledger
#                      split has disappeared from decisions/**.
#   3. Supersedes    — every `^Supersedes: D\d+` line inside decisions/**
#                      names an id that still exists somewhere in decisions/**.
#   4. Router shape  — DECISIONS.md itself holds zero id rows and zero id
#                      headings; it routes to decisions/**, it never
#                      duplicates it.
#
# BLIND SPOT — darts notation: `D18` is also darts shorthand for double 18,
# and app/src/modules/game/checkout-path.module.ts alone carries ~40 such
# tokens (D2..D20, D25) used throughout the game engines. An unanchored
# `D\d+` scan over that file would report dozens of duplicate "decision ids"
# that are not decisions at all. Two independent guards against that here:
#   - every match is position-anchored: a row must open the line as
#     `| D<n> |` (the id sits in the very first table cell) and a heading
#     must open the line as `### D<n>`. A mid-sentence mention such as
#     "amends D67" or "per D60" — real prose that already exists inside
#     decisions/** itself — matches neither anchor and is correctly ignored.
#   - the scan set is decisions/**.md and DECISIONS.md ONLY. app/src/** is
#     never read by this script, so the checkout-path table cannot reach it
#     even in principle, anchored or not.
#
# BLIND SPOT — code-fenced example: DECISIONS.md's own "How to add a
# decision" section contains a fenced ```markdown example block showing the
# literal template text `### D184 — Short imperative title` and
# `Supersedes: D86`. That is documentation prose, not a real entry. Check 4
# strips fenced code blocks (paired ``` lines) from DECISIONS.md before
# scanning it, or that example would permanently fail the router check.
#
# GLOB NOTE: `git ls-files 'decisions/**/*.md'` — the literal pattern named
# in this task's own planning prose — only matches files at least one
# directory below decisions/ under this repo's git (2.43): it silently
# returns just the 4 files under decisions/frontend/ and misses the 6
# top-level ones (architecture.md, database.md, api.md, game-engine.md,
# testing.md, context-system.md). This script uses `decisions/**.md`
# instead, verified to return all 10.
#
# ID normalisation: D01..D09 are zero-padded, D10+ are not. Every id is
# compared as an int internally, but every diagnostic prints the ORIGINAL
# spelling as found in its source line (`D05`, never the normalised `D5`) so
# a failure message stays directly grep-able against decisions/**.
#
# Baseline choice (check 2): the 163 ids are embedded literally below, not
# derived from scripts/decision-map.txt. That map is the migration's own
# input and is expected to be hand-edited going forward whenever a decision
# is re-filed to a different domain file (see DECISIONS.md's "How to add a
# decision": "add it to the routing table and scripts/decision-map.txt").
# If this check derived its baseline from the map, an edit that accidentally
# dropped an id from the map at the same time as a real deletion would
# corrupt its own oracle and the ledger together, and the two corrupted sets
# would compare as equal — reporting nothing missing. An embedded,
# independent baseline has no such failure mode. This also means ids added
# after the split (D184 onward) fall correctly outside its scope: they never
# appeared in the 2026-08-02 baseline, so their absence is not flagged as an
# error here — new decisions are protected by review, not by this check.
# Re-filing an id from one domain file to another (which does not remove it
# from decisions/** as a whole) does not trip this check either, by design —
# only checks 1/3/4 care which file an id lives in or supersedes.
#
# No range()/max-id arithmetic anywhere: the baseline is a literal id list,
# not "everything from 1 to the current max" (163 decisions exist but ids
# are non-contiguous — 20 were never issued — so range(1, max) reports 20
# phantom losses on a perfectly clean tree).
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

DECISIONS_DIR="decisions"
ROUTER="DECISIONS.md"

[ -d "$DECISIONS_DIR" ] || { echo "FAIL: $DECISIONS_DIR/ not found" >&2; exit 1; }
[ -f "$ROUTER" ] || { echo "FAIL: $ROUTER not found" >&2; exit 1; }

python3 - "$DECISIONS_DIR" "$ROUTER" <<'PY'
import re
import subprocess
import sys

decisions_dir, router_path = sys.argv[1:3]
FAIL = 0


def err(msg: str) -> None:
    global FAIL
    print(f"FAIL: {msg}", file=sys.stderr)
    FAIL = 1


def ok(msg: str) -> None:
    print(f"OK: {msg}")


# Frozen at the 2026-08-02 ledger split (scripts/decision-map.txt at that
# commit): 163 decisions, D01-D183, 20 ids never issued. Embedded literally —
# see the header comment above for why this is not derived from
# scripts/decision-map.txt.
BASELINE_IDS = {
    1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17,
    20, 21, 22, 23, 24, 25, 26, 27, 28, 74, 95, 135, 136, 137,
    30, 31, 32, 33, 34, 35, 36, 37, 60, 61, 62, 63, 64, 65, 66, 67, 68, 69,
    70, 71, 72, 73, 75, 76, 78, 131, 132, 149, 172,
    40, 111, 112, 114, 119, 122, 125, 138, 139, 140, 141, 142, 143, 144, 145,
    146, 150, 151, 152, 153, 154, 177, 178, 180, 181, 183,
    99, 101, 104, 148, 166,
    41, 82, 83, 84, 85, 87, 103, 105, 106, 115, 117, 155, 156, 182,
    79, 80, 92, 97, 116, 121, 123, 124, 127, 128, 170, 171, 173, 179,
    77, 81, 86, 88, 89, 90, 91, 98, 100, 118, 120,
    108, 126, 129, 130, 161, 174, 175, 176,
    50, 51, 52, 93, 94, 96, 102, 107, 109, 110, 113, 133, 134, 147, 157, 158,
    159, 160, 162, 163, 164, 165, 167, 168, 169,
}
assert len(BASELINE_IDS) == 163, f"baseline transcription error: {len(BASELINE_IDS)} ids, expected 163"

ROW_RE = re.compile(r"^\| D([0-9]+) \|")
HEADING_RE = re.compile(r"^### D([0-9]+)")
SUPERSEDES_RE = re.compile(r"^Supersedes:\s*D([0-9]+)")


def spelling(digits: str) -> str:
    return f"D{digits}"


# git ls-files, not find/rglob: stays consistent with the rest of the check-*
# suite and only ever sees tracked files. `decisions/**.md` — see the GLOB
# NOTE above for why `decisions/**/*.md` under-matches on this git version.
files = subprocess.run(
    ["git", "ls-files", f"{decisions_dir}/**.md"],
    capture_output=True, text=True, check=True,
).stdout.split()
files.sort()

if not files:
    err(f"no .md files found under {decisions_dir}/ via git ls-files")
    sys.exit(1)

# id -> list of (file, original_digit_spelling) for every row/heading match
occurrences: dict[int, list[tuple[str, str]]] = {}
# id -> list of (file, line_no) for every `Supersedes:` declaration found
supersedes: list[tuple[int, str, int]] = []

for path in files:
    with open(path, encoding="utf-8") as f:
        for lineno, raw in enumerate(f, start=1):
            line = raw.rstrip("\n")
            m = ROW_RE.match(line)
            if m:
                occurrences.setdefault(int(m.group(1)), []).append((path, m.group(1)))
                continue
            m = HEADING_RE.match(line)
            if m:
                occurrences.setdefault(int(m.group(1)), []).append((path, m.group(1)))
                continue
            m = SUPERSEDES_RE.match(line)
            if m:
                supersedes.append((int(m.group(1)), path, lineno))

digit_spelling: dict[int, str] = {}
for id_num, occs in occurrences.items():
    digit_spelling[id_num] = occs[0][1]


def id_label(id_num: int) -> str:
    digits = digit_spelling.get(id_num)
    return spelling(digits) if digits is not None else f"D{id_num}"


# --- Check 1: uniqueness ----------------------------------------------------
dup_ids = sorted(i for i, occs in occurrences.items() if len(occs) > 1)
if dup_ids:
    for i in dup_ids:
        locs = ", ".join(f for f, _ in occurrences[i])
        err(f"duplicate id {id_label(i)} appears {len(occurrences[i])}x ({locs})")
else:
    ok(f"uniqueness — {len(occurrences)} distinct id(s) across {len(files)} file(s) under {decisions_dir}/, none duplicated")

# --- Check 2: no regression against the 2026-08-02 baseline -----------------
present_ids = set(occurrences.keys())
missing = sorted(BASELINE_IDS - present_ids)
if missing:
    err(
        f"{len(missing)} baseline id(s) missing from {decisions_dir}/**: "
        + ", ".join(f"D{i:02d}" if i < 10 else f"D{i}" for i in missing)
    )
else:
    ok(f"no regression — all {len(BASELINE_IDS)} baseline ids (D01-D183, 20 unissued) still present in {decisions_dir}/**")

# --- Check 3: Supersedes targets exist --------------------------------------
if supersedes:
    dangling = [(target, f, ln) for target, f, ln in supersedes if target not in present_ids]
    if dangling:
        for target, f, ln in dangling:
            err(f"{f}:{ln}: Supersedes: D{target} — no such id exists in {decisions_dir}/**")
    else:
        ok(f"Supersedes — all {len(supersedes)} target(s) resolve to an existing id in {decisions_dir}/**")
else:
    ok("Supersedes — no `Supersedes:` declarations found in decisions/** (nothing to check)")

# --- Check 4: DECISIONS.md is a router (no decision rows/headings) ---------
with open(router_path, encoding="utf-8") as f:
    router_text = f.read()

# Strip fenced code blocks first — the "How to add a decision" section's own
# ```markdown example legitimately contains `### D184 ...` / `Supersedes:
# D86` as template prose, not a real entry. See the header comment's
# code-fenced-example blind spot.
router_lines_no_fences: list[str] = []
in_fence = False
for line in router_text.split("\n"):
    if line.strip().startswith("```"):
        in_fence = not in_fence
        continue
    if not in_fence:
        router_lines_no_fences.append(line)

router_rows = [ln for ln in router_lines_no_fences if ROW_RE.match(ln)]
router_headings = [ln for ln in router_lines_no_fences if HEADING_RE.match(ln)]
if router_rows or router_headings:
    for ln in router_rows:
        err(f"{router_path} contains a decision row outside a code fence: {ln!r}")
    for ln in router_headings:
        err(f"{router_path} contains a decision heading outside a code fence: {ln!r}")
else:
    ok(f"{router_path} is a router — no decision rows or headings outside its code-fenced example")

if FAIL:
    sys.exit(1)
sys.exit(0)
PY
