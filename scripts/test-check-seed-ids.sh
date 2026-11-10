#!/usr/bin/env bash
# Fixture test for scripts/check-seed-ids.sh: the committed seeds pass, and two
# fixture seeds defining one game_types id fail naming both files.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-seed-ids.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unset SEED_DIR

FAILED=0
fail() { FAILED=$((FAILED + 1)); echo "FAIL: $1" >&2; }

(cd "$TMP" && bash "$GATE" >/dev/null 2>&1) || fail "committed seeds should pass"

ID="0198f000-0000-7000-8000-0000000000aa"
for name in 0001_a 0002_b; do
  cat > "$TMP/$name.sql" <<SQL
INSERT INTO game_types (id, implementation_key)
VALUES ('$ID', '${name}') ON CONFLICT (id) DO NOTHING;
SQL
done
out="$(SEED_DIR="$TMP" bash "$GATE" 2>&1)"; code=$?
[ "$code" -ne 0 ] || fail "duplicate id should fail"
grep -qF "0001_a.sql, 0002_b.sql" <<< "$out" || fail "failure should name both files"

rm "$TMP/0002_b.sql"
SEED_DIR="$TMP" bash "$GATE" >/dev/null 2>&1 || fail "single definition should pass"

if [ "$FAILED" -eq 0 ]; then echo "test-check-seed-ids: PASS"; exit 0; fi
exit 1
