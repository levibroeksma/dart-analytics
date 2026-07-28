#!/usr/bin/env bash
# CHECK-constraint mirror gate (D149): a Zod bound that lets a value through
# a SQL CHECK constraint rejects aborts the whole batch write transaction with
# a 500 instead of a VALIDATION_FAILED naming the offending record. D149
# mirrors every CHECK on the 3 batch-write tables (exercise_stages, turns,
# darts) once, in the shared batch schema — this script proves each one is
# acknowledged there, via a `// MIRRORS: chk_x` anchor comment.
#
# Scope: only CHECK constraints on exercise_stages/turns/darts, sourced from
# each migration's migrate:up region (never migrate:down — that is rollback
# SQL, not the applied-forward schema). A constraint dropped in a later
# migration's migrate:up (chk_turn_completed_after_created, migration 0015)
# is correctly excluded from the required set.
#
# WHAT THIS CANNOT CATCH (stated plainly, same convention as
# check-refinement-coverage.sh): this proves an anchor exists, not that its
# numeric bound is identical to the CHECK expression. Real enforcement of
# bound agreement is app/tests/pages/api/sessions/constraint-mirror.test.ts,
# which executes safeParse against the declared boundary values.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

SCHEMA_FILE="app/src/pages/api/sessions/types.ts"
if [ ! -f "$SCHEMA_FILE" ]; then
  echo "FAIL: $SCHEMA_FILE not found" >&2
  exit 1
fi

python3 - "$SCHEMA_FILE" <<'PY'
import re
import sys
from pathlib import Path

schema_file = Path(sys.argv[1])
allowed_tables = {"exercise_stages", "turns", "darts"}
migrations_dir = Path("database/migrations")

table_re = re.compile(r"\b(?:ALTER TABLE|CREATE TABLE)\s+([A-Za-z_][A-Za-z0-9_]*)", re.IGNORECASE)
add_re = re.compile(r"ADD CONSTRAINT\s+(chk_[A-Za-z0-9_]+)", re.IGNORECASE)
drop_re = re.compile(r"DROP CONSTRAINT\s+(chk_[A-Za-z0-9_]+)", re.IGNORECASE)
inline_chk_re = re.compile(r"CONSTRAINT\s+(chk_[A-Za-z0-9_]+)\s+CHECK", re.IGNORECASE)


def migrate_up_region(text: str) -> str:
    start = text.find("-- migrate:up")
    if start == -1:
        return text
    start = text.find("\n", start) + 1
    end = text.find("-- migrate:down", start)
    return text[start:] if end == -1 else text[start:end]


files = sorted(migrations_dir.glob("*.sql"))
if not files:
    print(f"FAIL: no migrations found under {migrations_dir}", file=sys.stderr)
    sys.exit(1)

live: set[str] = set()
for path in files:
    region = migrate_up_region(path.read_text(encoding="utf-8"))
    current_table = None
    for line in region.splitlines():
        m = table_re.search(line)
        if m:
            current_table = m.group(1).lower()
            continue
        if current_table not in allowed_tables:
            continue
        m = add_re.search(line)
        if m:
            live.add(m.group(1))
            continue
        m = drop_re.search(line)
        if m:
            live.discard(m.group(1))
            continue
        m = inline_chk_re.search(line)
        if m:
            live.add(m.group(1))

schema_text = schema_file.read_text(encoding="utf-8")
anchored: set[str] = set()
for m in re.finditer(r"//\s*MIRRORS:\s*([a-z0-9_,\s]+?)$", schema_text, re.MULTILINE):
    for name in m.group(1).split(","):
        name = name.strip()
        if name:
            anchored.add(name)

tables_str = ", ".join(sorted(allowed_tables))
missing = sorted(live - anchored)
stale = sorted(anchored - live)
fail = False

for name in missing:
    print(
        f"FAIL: {name} is a CHECK constraint on {tables_str} in database/migrations/ "
        f"with no `// MIRRORS: {name}` anchor in {schema_file} — bound it beside the "
        f"field it constrains (D149)",
        file=sys.stderr,
    )
    fail = True

for name in stale:
    print(
        f"FAIL: {schema_file} anchors `{name}` but no live migration defines that "
        f"constraint on {tables_str} anymore — remove the stale anchor",
        file=sys.stderr,
    )
    fail = True

if fail:
    sys.exit(1)

names = ", ".join(sorted(live))
print(f"OK: {len(live)} CHECK constraint(s) on {tables_str} all have a `// MIRRORS:` anchor in {schema_file}: {names}.")
print("     Bound agreement is enforced by execution in app/tests/pages/api/sessions/constraint-mirror.test.ts, not by this script.")
PY
