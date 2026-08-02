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
#      A duplicate `=== path ===` marker or an unterminated block (a new
#      header appearing before the previous block's `=== end ===`) is a hard
#      failure naming the offending marker and its line number — never a
#      silent overwrite and never a silently dropped block.
#   4. Pre-flight: reject if any front-matter value is a TODO placeholder.
#      Reports every offending (path, line) pair before exiting.
#   5. Pre-flight: reject if any mapped target path has no front-matter block,
#      or any id mapped to a path is absent from the ledger snapshot. Reports
#      every offending path across the whole map before exiting — same
#      all-offenders-at-once contract as step 4. This guard used to live
#      inside the writer loop (step 7) and could leave a half-written
#      decisions/ tree if a later path failed after an earlier one had
#      already been written; it is now fully hoisted so no decisions/*.md is
#      ever written unless every path is known to succeed.
#   6. Remove any decisions/**/*.md not named by the current map (a path
#      renamed or dropped from decision-map.txt since the last run) —
#      decision-map.txt is the single source of truth for what should exist,
#      so a stale file is deleted rather than silently left behind. Every
#      deletion is printed.
#   7. Write each decisions/<path>.md as: front-matter, the 4-column table
#      header, then that file's rows in ascending numeric id order, copied
#      byte-for-byte from the snapshot. Never writes a row it did not read
#      from the snapshot; never rewords, rewraps, or re-aligns a row.
#
# Steps 4-5 run to completion and report every offender before step 6 or 7
# touches decisions/ at all — a failure anywhere in 4-5 leaves decisions/
# completely untouched.
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
import os
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
# A duplicate `=== path ===` marker or a block left unterminated when the next
# header appears is an explicit, immediate failure naming the offending
# marker and line number — never a silent overwrite, never a silently
# dropped block.
fm_blocks: dict[str, list[str]] = {}
current: str | None = None
current_line: int | None = None
buf: list[str] = []
block_re = re.compile(r"^===\s*(\S+)\s*===\s*$")
with open(fm_path, encoding="utf-8") as f:
    for lineno, raw in enumerate(f, start=1):
        line = raw.rstrip("\n")
        m = block_re.match(line)
        if m:
            token = m.group(1)
            if token == "end":
                if current is None:
                    fail(f"{fm_path}:{lineno}: '=== end ===' marker with no open block")
                fm_blocks[current] = buf
                current = None
                current_line = None
                buf = []
            else:
                if current is not None:
                    fail(
                        f"{fm_path}:{current_line}: block '=== {current} ===' is never "
                        f"terminated — next marker '=== {token} ===' found at line {lineno} "
                        f"before an '=== end ===' closed it"
                    )
                if token in fm_blocks:
                    fail(
                        f"{fm_path}:{lineno}: duplicate block '=== {token} ===' — this path "
                        f"already has a front-matter block earlier in the file; a second "
                        f"block would silently overwrite the first"
                    )
                current = token
                current_line = lineno
                buf = []
        elif current is not None:
            buf.append(line)

if current is not None:
    fail(
        f"{fm_path}:{current_line}: block '=== {current} ===' is never terminated — "
        f"reached end of file with no '=== end ==='"
    )

# --- 4. Pre-flight: reject TODO placeholders --------------------------------
allow_todo = os.environ.get("ALLOW_TODO_FRONTMATTER", "").lower() == "1"
offenders: list[tuple[str, str]] = []
todo_re = re.compile(r"\bTODO\b")
for path, lines in fm_blocks.items():
    for line in lines:
        if todo_re.search(line):
            offenders.append((path, line))

if offenders and not allow_todo:
    error_msg = (
        f"Front-matter contains TODO placeholders in {fm_path}.\n"
        f"Replace all placeholders before running the migration — see\n"
        f"docs/superpowers/plans/2026-08-02-decision-ledger-split.md Task 3 Step 1.\n\n"
        f"Offending entries:\n"
    )
    for path, line in offenders:
        error_msg += f"  {path}: {line}\n"
    fail(error_msg.rstrip())

# --- 5. Pre-flight: reject unwritable target paths --------------------------
# Both conditions below used to be checked inline in the writer loop (former
# step 5), where fail()'s immediate exit meant a path that tripped either
# check *after* an earlier path had already been written left a half-migrated
# decisions/ tree with a non-zero exit. Hoisted here, over the full sorted
# target list, so every offender is collected and reported together and
# nothing is written unless every path will succeed.
write_offenders: list[str] = []
for path, ids in sorted(targets.items()):
    if path not in fm_blocks:
        write_offenders.append(
            f"no front-matter block for '{path}' in {fm_path} (expected '=== {path} ===')"
        )
    missing = [i for i in ids if i not in rows]
    if missing:
        write_offenders.append(
            f"{path}: id(s) mapped but absent from {ledger_path}: "
            + ", ".join(f"D{i}" for i in missing)
        )

if write_offenders:
    error_msg = f"Cannot write decisions/ — {len(write_offenders)} problem(s) found:\n"
    for o in write_offenders:
        error_msg += f"  {o}\n"
    fail(error_msg.rstrip())

# --- 6. Remove stale target files not named by the current map --------------
# decision-map.txt is the single source of truth for what should exist under
# decisions/. A path renamed or dropped from the map since the last run would
# otherwise leave its old decisions/<path>.md behind with no warning.
# Removal (not just detection) is used, since a stale file left in place is
# indistinguishable from a live one to a casual reader of decisions/ — but
# every deletion is printed so it is never silent.
out_root = Path(out_dir)
if out_root.is_dir():
    current_paths = set(targets.keys())
    for existing in sorted(out_root.rglob("*.md")):
        rel = existing.relative_to(out_root)
        rel_str = str(rel)
        if rel_str.endswith(".md"):
            rel_str = rel_str[: -len(".md")]
        if rel_str not in current_paths:
            existing.unlink()
            print(f"removed stale {existing} (no longer in {map_path})")
    # Prune now-empty subdirectories the deletions above may have left behind.
    for d in sorted((p for p in out_root.rglob("*") if p.is_dir()), reverse=True):
        if not any(d.iterdir()):
            d.rmdir()

# --- 7. Write each target file -----------------------------------------------
written = 0
for path, ids in sorted(targets.items()):
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
