#!/usr/bin/env bash
# Migrates DECISIONS.md's per-decision table rows into decisions/<path>.md
# domain files, per scripts/decision-map.txt (D01-D183, see that file's header
# for the id-gap and zero-padding notes).
#
# Sequence:
#   1. Snapshot every row currently in DECISIONS.md to /tmp/decisions-before.tsv
#      as `normalised_id<TAB>full_original_line` — this is the only copy of
#      "what the row looked like before the move" and is what
#      verify-decision-split.sh checks the output against.
#   2. Read scripts/decision-map.txt for the id -> target-file assignment.
#   3. Read scripts/decision-front-matter.txt (sidecar) for each target file's
#      front-matter block, so this script never hardcodes front-matter prose
#      it would otherwise need editing to change (see that file's header).
#   4. Write each decisions/<path>.md as: front-matter, the 4-column table
#      header, then that file's rows in ascending numeric id order, copied
#      byte-for-byte from the snapshot. Never writes a row it did not read
#      from the snapshot; never rewords, rewraps, or re-aligns a row.
#
# Idempotent: safe to re-run, each target file is fully rewritten each time.
#
# Blind spots:
#   - Assumes one decision row per physical line in DECISIONS.md's tables
#     (true for all 163 rows today). A row wrapped across lines would not be
#     recognised as a single unit and would corrupt the snapshot.
#   - Does not check that decision-map.txt is exhaustive/disjoint against the
#     live ledger (Task 1 already verified this once) — an id present in
#     DECISIONS.md but absent from every map line is silently not written to
#     any target file. verify-decision-split.sh's Map-drift class is what
#     catches that, not this script.
set -euo pipefail
cd "$(git rev-parse --show-toplevel)"

LEDGER="DECISIONS.md"
MAP="scripts/decision-map.txt"
FRONT_MATTER="scripts/decision-front-matter.txt"
SNAPSHOT="/tmp/decisions-before.tsv"
OUT_DIR="decisions"

[ -f "$LEDGER" ] || { echo "FAIL: $LEDGER not found" >&2; exit 1; }
[ -f "$MAP" ] || { echo "FAIL: $MAP not found" >&2; exit 1; }
[ -f "$FRONT_MATTER" ] || { echo "FAIL: $FRONT_MATTER not found" >&2; exit 1; }

python3 - "$LEDGER" "$MAP" "$FRONT_MATTER" "$SNAPSHOT" "$OUT_DIR" <<'PY'
import re
import sys
from pathlib import Path

ledger_path, map_path, fm_path, snapshot_path, out_dir = sys.argv[1:6]

ROW_RE = re.compile(r'^\| D([0-9]+) \|')
HEADER = [
    "| # | Source | Decision | Rationale |",
    "| - | ------ | -------- | --------- |",
]


def fail(msg: str) -> None:
    print(f"FAIL: {msg}", file=sys.stderr)
    sys.exit(1)


# --- 1. Snapshot pre-migration rows verbatim --------------------------------
rows: dict[int, str] = {}
order: list[int] = []
with open(ledger_path, encoding="utf-8") as f:
    for line in f:
        line = line.rstrip("\n")
        m = ROW_RE.match(line)
        if not m:
            continue
        id_num = int(m.group(1))
        if id_num in rows:
            fail(f"duplicate D{id_num} within {ledger_path} itself — refusing to snapshot")
        rows[id_num] = line
        order.append(id_num)

if not order:
    fail(f"no `| D<n> |` rows found in {ledger_path} — nothing to migrate")

with open(snapshot_path, "w", encoding="utf-8") as f:
    for id_num in order:
        f.write(f"{id_num}\t{rows[id_num]}\n")

# --- 2. Read the id -> target-file map --------------------------------------
targets: dict[str, list[int]] = {}
id_to_path: dict[int, str] = {}
with open(map_path, encoding="utf-8") as f:
    for raw in f:
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if ":" not in line:
            fail(f"malformed line in {map_path}: {raw!r}")
        path, ids_part = line.split(":", 1)
        path = path.strip()
        ids = [int(tok) for tok in ids_part.split()]
        targets[path] = ids
        for id_num in ids:
            if id_num in id_to_path:
                fail(f"D{id_num} mapped to both {id_to_path[id_num]} and {path} in {map_path}")
            id_to_path[id_num] = path

# --- 3. Read the front-matter sidecar ---------------------------------------
fm_blocks: dict[str, list[str]] = {}
current: str | None = None
buf: list[str] = []
block_re = re.compile(r"^===\s*(\S+)\s*===\s*$")
with open(fm_path, encoding="utf-8") as f:
    for raw in f:
        line = raw.rstrip("\n")
        m = block_re.match(line)
        if m:
            token = m.group(1)
            if token == "end":
                if current is not None:
                    fm_blocks[current] = buf
                current = None
                buf = []
            else:
                current = token
                buf = []
        elif current is not None:
            buf.append(line)

# --- 4. Write each target file -----------------------------------------------
written = 0
for path, ids in sorted(targets.items()):
    if path not in fm_blocks:
        fail(f"no front-matter block for '{path}' in {fm_path} (expected '=== {path} ===')")
    missing = [i for i in ids if i not in rows]
    if missing:
        fail(f"{path}: id(s) mapped but absent from {ledger_path}: "
             + ", ".join(f"D{i}" for i in missing))

    fm_lines = [l for l in fm_blocks[path] if l.strip() != ""]
    body = ["<!--", *fm_lines, "-->", ""] + HEADER
    for id_num in sorted(ids):
        body.append(rows[id_num])

    out_path = Path(out_dir) / f"{path}.md"
    out_path.parent.mkdir(parents=True, exist_ok=True)
    out_path.write_text("\n".join(body) + "\n", encoding="utf-8")
    written += len(ids)
    print(f"wrote {out_path} ({len(ids)} rows)")

print(f"OK: split {written}/{len(order)} decisions across {len(targets)} files; "
      f"snapshot at {snapshot_path}")
PY
