#!/usr/bin/env bash
# Fixture test for scripts/check-types.sh. CHECK_TYPES_CMD replaces
# `npm run check`, so no astro run is needed.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-types.sh"
PASSED=0
FAILED=0
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT

# expect <pass|fail> <name> <last line> : runs the gate on $D/out.txt, exiting $D/code
expect() {
  local out code
  out="$(CHECK_TYPES_CMD="cat '$D/out.txt'; exit \$(cat '$D/code')" bash "$GATE" 2>&1)"; code=$?
  if { [ "$1" = pass ] && [ "$code" -eq 0 ]; } || { [ "$1" = fail ] && [ "$code" -ne 0 ]; } && [ "$(tail -1 <<< "$out")" = "$3" ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $2 (want $1, last \"$3\", exit $code)" >&2; echo "$out" | sed 's/^/    /' >&2
  fi
}

printf 'Result (900 files):\n- 0 errors\n- 0 warnings\n- 0 hints\n\n' > "$D/out.txt"; echo 0 > "$D/code"
expect pass "clean run" "check: 0 errors, 0 warnings, 0 hints"

printf 'src/x.ts:1:1 - error ts(2345)\nResult (900 files):\n- 1 error\n- 0 warnings\n- 0 hints\n\n' > "$D/out.txt"; echo 1 > "$D/code"
expect fail "an error is the last line, not the hints" "check: 1 errors, 0 warnings, 0 hints"

printf 'Result:\n- 0 errors\n- 0 warnings\n- 2 hints\n\n' > "$D/out.txt"; echo 0 > "$D/code"
expect fail "a hint fails even on exit 0" "check: 0 errors, 0 warnings, 2 hints"

printf 'crashed\n' > "$D/out.txt"; echo 1 > "$D/code"
expect fail "no summary" "check: no summary found (exit 1)"

printf 'Result:\n- 0 errors\n- 0 warnings\n- 0 hints\n' > "$D/out.txt"; echo 2 > "$D/code"
expect fail "non-zero exit with a clean summary" "check: 0 errors, 0 warnings, 0 hints"

echo "check-types: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
