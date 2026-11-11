#!/usr/bin/env bash
# Fixture test for .claude/hooks/unit-size-note.py (PostToolUse Edit|Write).
# UNIT_SIZE_ROOT replaces the repo root; UNIT_SIZE_COUNTS="<now>,<head>"
# replaces the two fallow runs with fixed counts.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
HOOK="$ROOT/.claude/hooks/unit-size-note.py"
PASSED=0
FAILED=0
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT
mkdir -p "$D/app/src/lib" "$D/app/node_modules/.bin" "$D/docs"
printf 'export const a = 1;\n' > "$D/app/src/lib/x.ts"
printf '# doc\n' > "$D/docs/x.md"
: > "$D/app/node_modules/.bin/fallow"

# run <stdin> [VAR=val...] : sets OUT and CODE
run() {
  local in="$1"; shift
  OUT="$(printf '%s' "$in" | env UNIT_SIZE_ROOT="$D" "$@" python3 "$HOOK" 2>&1)"; CODE=$?
}
payload() { printf '{"tool_name":"Edit","tool_input":{"file_path":"%s"}}' "$1"; }
# expect <note|silent> <name> [needle]
expect() {
  if [ "$CODE" -eq 0 ] && { { [ "$1" = silent ] && [ -z "$OUT" ]; } || { [ "$1" = note ] && grep -qF -- "$3" <<< "$OUT" && grep -qF '"hookEventName": "PostToolUse"' <<< "$OUT"; }; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $2 (want $1, exit $CODE)" >&2; echo "$OUT" | sed 's/^/    /' >&2
  fi
}

run "$(payload "$D/app/src/lib/x.ts")" UNIT_SIZE_COUNTS=1,0
expect note "a new long function is reported" "app/src/lib/x.ts: 1 function over 60 lines after this edit (0 before)"

run "$(payload "$D/app/src/lib/x.ts")" UNIT_SIZE_COUNTS=2,1
expect note "one more long function is reported" "2 functions over 60 lines after this edit (1 before)"

run "$(payload "$D/app/src/lib/x.ts")" UNIT_SIZE_COUNTS=1,1
expect silent "a function already long at HEAD stays quiet"

run "$(payload "$D/app/src/lib/x.ts")" UNIT_SIZE_COUNTS=0,1
expect silent "an improvement stays quiet"

run "$(payload "$D/docs/x.md")" UNIT_SIZE_COUNTS=1,0
expect silent "a file outside app/src stays quiet"

rm "$D/app/node_modules/.bin/fallow"
run "$(payload "$D/app/src/lib/x.ts")"
expect silent "fallow missing stays quiet"
: > "$D/app/node_modules/.bin/fallow"

run 'not json' UNIT_SIZE_COUNTS=1,0
expect silent "a malformed payload stays quiet"

run "$(payload "$D/app/src/lib/missing.ts")" UNIT_SIZE_COUNTS=1,0
expect silent "a file that does not exist stays quiet"

echo "unit-size-note: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
