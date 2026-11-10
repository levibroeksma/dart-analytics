#!/usr/bin/env bash
# Fixture test for scripts/check-dupes.sh. DUPES_JSON and DUPES_BASELINE point
# the gate at fixtures, so no fallow run is needed.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-dupes.sh"
PASSED=0
FAILED=0
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT

# json <omitted> <group>... : group = "a.ts,b.ts" (instance files)
json() {
  local om="$1"; shift; local g f first arr=""
  for g in "$@"; do
    first=1; local inst=""
    IFS=, read -ra fs <<< "$g"
    for f in "${fs[@]}"; do inst+="${first:+}{\"file\":\"$f\"},"; done
    arr+="{\"instances\":[${inst%,}]},"
  done
  echo "{\"clone_groups\":[${arr%,}],\"clone_groups_omitted\":$om}"
}

# expect <pass|fail> <name> <needle>  (uses $D/cur.json, $D/base.txt)
expect() {
  local out code
  out="$(DUPES_JSON="$D/cur.json" DUPES_BASELINE="$D/base.txt" bash "$GATE" 2>&1)"; code=$?
  if { [ "$1" = pass ] && [ "$code" -eq 0 ]; } || { [ "$1" = fail ] && [ "$code" -ne 0 ] && grep -qF -- "$3" <<< "$out"; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $2 (want $1${3:+, \"$3\"}, exit $code)" >&2; echo "$out" | sed 's/^/    /' >&2
  fi
}

json 0 "a.ts,b.ts" "a.ts,b.ts" "c.ts,d.ts" > "$D/cur.json"
printf '2\ta.ts | b.ts\n1\tc.ts | d.ts\n' > "$D/base.txt"
expect pass "same as baseline"

json 0 "a.ts,b.ts" "a.ts,b.ts" "c.ts,d.ts" "e.ts,f.ts" > "$D/cur.json"
expect fail "group on new file set" "new clone group: e.ts | f.ts"

json 0 "a.ts,b.ts" "a.ts,b.ts" "a.ts,b.ts" "c.ts,d.ts" > "$D/cur.json"
expect fail "count above baseline" "new clone group: a.ts | b.ts"

json 0 "a.ts,b.ts" "c.ts,d.ts" > "$D/cur.json"
expect fail "one group fewer" "stale baseline row, lower it: a.ts | b.ts"

json 0 "b.ts,a.ts" "b.ts,a.ts" "d.ts,c.ts" > "$D/cur.json"
expect pass "instance order does not matter"

json 3 "a.ts,b.ts" "a.ts,b.ts" "c.ts,d.ts" > "$D/cur.json"
expect fail "omitted groups" "omitted"

json 0 "a.ts,b.ts" "e.ts,f.ts" > "$D/cur.json"
DUPES_JSON="$D/cur.json" DUPES_BASELINE="$D/base.txt" bash "$GATE" --update >/dev/null 2>&1
expect pass "update then rerun"

echo "check-dupes tests: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
