#!/usr/bin/env bash
# Fixture test for scripts/check-history-versions.sh: a descending file and one
# whose only disorder sits below the floor pass; a duplicated or ascending
# version at or above the floor fails.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-history-versions.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

PASSED=0
FAILED=0

fixture() {
  local name="$1"; shift
  : > "$TMP/$name"
  for version in "$@"; do
    printf '> **Version:** %s (2026-11-10 — entry)\n>\n' "$version" >> "$TMP/$name"
  done
}

check() {
  local name="$1" want="$2" out code
  out="$(HISTORY_FLOOR=1.200.0 bash "$GATE" "$TMP/$name" 2>&1)"; code=$?
  if [ "$code" -eq "$want" ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    echo "FAIL: $name exited $code, wanted $want: $out" >&2
  fi
}

fixture descending 1.203.0 1.202.0 1.201.0
fixture duplicate 1.203.0 1.203.0 1.202.0
fixture ascending 1.201.0 1.202.0
fixture below-floor 1.201.0 1.150.0 1.151.0 1.151.0
fixture empty

check descending 0
check duplicate 1
check ascending 1
check below-floor 0
check empty 0
check missing 1

echo "test-check-history-versions: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
