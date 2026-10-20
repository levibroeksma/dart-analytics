#!/usr/bin/env bash
# Fixture test for scripts/check-tag-seeds.sh. Runs the gate from a foreign
# cwd against the committed catalog tag seed (must pass) and against a copy
# with one appended byte (must fail with the stale message).
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-tag-seeds.sh"
SEED="$ROOT/database/seeds/0042_catalog_tags.sql"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
unset TAG_SEED_FILE
STALE_MSG='catalog tag seed is stale — run npm run tags:generate'

PASSED=0
FAILED=0

# run_gate <seed path or empty> : runs the gate from $TMP, output to stdout.
run_gate() {
  (cd "$TMP" && TAG_SEED_FILE="$1" bash "$GATE" 2>&1)
}

# expect_pass <case name> <seed path or empty>
expect_pass() {
  local out code
  out="$(run_gate "$2")"; code=$?
  if [ "$code" -eq 0 ]; then
    PASSED=$((PASSED + 1)); return
  fi
  FAILED=$((FAILED + 1))
  echo "FAIL: $1 (want pass, exit $code)" >&2
  echo "$out" | sed 's/^/    /' >&2
}

# expect_stale <case name> <seed path>
expect_stale() {
  local out code
  out="$(run_gate "$2")"; code=$?
  if [ "$code" -ne 0 ] && grep -qF -- "$STALE_MSG" <<< "$out"; then
    PASSED=$((PASSED + 1)); return
  fi
  FAILED=$((FAILED + 1))
  echo "FAIL: $1 (want stale message, exit $code)" >&2
  echo "$out" | sed 's/^/    /' >&2
}

expect_pass "untouched seed, absolute TAG_SEED_FILE" "$SEED"
expect_pass "untouched seed, committed default path" ""

cp "$SEED" "$TMP/drifted.sql"
printf 'x' >> "$TMP/drifted.sql"
expect_stale "seed with one appended byte" "$TMP/drifted.sql"

echo "test-check-tag-seeds: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
