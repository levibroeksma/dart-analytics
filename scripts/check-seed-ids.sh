#!/usr/bin/env bash
# Guard: no two seed files define a row with the same id in the same table.
# Seeds insert with ON CONFLICT DO NOTHING, so a reused id silently drops the
# later row and nothing fails until a read finds it missing. Looks at the first
# column of each `INSERT INTO <table> (id, ...) VALUES` tuple whose value is a
# UUID literal; repeats inside one file are the file's own business.
# Override the directory with SEED_DIR (relative paths resolve from the repo
# root). Runs from any cwd.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
case "${SEED_DIR:-}" in
  "") SEED_DIR="$ROOT/database/seeds" ;;
  /*) ;;
  *) SEED_DIR="$ROOT/$SEED_DIR" ;;
esac

python3 - "$SEED_DIR" <<'PY'
import collections, glob, os, re, sys

UUID = r"'([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})'"
INSERT = re.compile(
    r"INSERT\s+INTO\s+(\w+)\s*\(([^)]*)\)\s*VALUES(.*?)(?:ON\s+CONFLICT|;)",
    re.S | re.I,
)
defs = collections.defaultdict(set)
files = sorted(glob.glob(os.path.join(sys.argv[1], "*.sql")))
for path in files:
    text = re.sub(r"--[^\n]*", "", open(path).read())
    for m in INSERT.finditer(text):
        columns = [c.strip() for c in m.group(2).split(",")]
        if columns[0] != "id":
            continue
        for tuple_ in re.finditer(r"\(\s*" + UUID, m.group(3)):
            defs[(m.group(1), tuple_.group(1))].add(os.path.basename(path))

clashes = {key: names for key, names in defs.items() if len(names) > 1}
for (table, ident), names in sorted(clashes.items()):
    print(f"{table} {ident} defined in {', '.join(sorted(names))}", file=sys.stderr)
if clashes:
    print(
        "check-seed-ids: FAIL - ON CONFLICT DO NOTHING drops the later row; give it the next free id",
        file=sys.stderr,
    )
    sys.exit(1)
print(f"check-seed-ids: PASS ({len(defs)} ids across {len(files)} seed files)")
PY
