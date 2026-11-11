#!/usr/bin/env bash
# Fixture test for scripts/check-html-parity.sh. PARITY_DIST and PARITY_BASE
# point the gate at fixture directories, so no build runs.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-html-parity.sh"
PASSED=0
FAILED=0
D="$(mktemp -d)"
trap 'rm -rf "$D"' EXIT

# fresh : two identical trees, $D/base and $D/dist
fresh() {
  rm -rf "$D/base" "$D/dist"
  mkdir -p "$D/base/games" "$D/dist/games"
  printf '<html><body>home</body></html>\n' | tee "$D/base/index.html" > "$D/dist/index.html"
  printf '<html><body>games</body></html>\n' | tee "$D/base/games/index.html" > "$D/dist/games/index.html"
}
# expect <pass|fail> <name> <needle>
expect() {
  local out code
  out="$(PARITY_DIST="$D/dist" PARITY_BASE="$D/base" bash "$GATE" 2>&1)"; code=$?
  if { [ "$1" = pass ] && [ "$code" -eq 0 ] && grep -qF -- "$3" <<< "$out"; } || { [ "$1" = fail ] && [ "$code" -ne 0 ] && grep -qF -- "$3" <<< "$out"; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $2 (want $1, \"$3\", exit $code)" >&2; echo "$out" | sed 's/^/    /' >&2
  fi
}

fresh
expect pass "identical trees" "html parity: 2 files identical"

fresh; printf '<html><body>games </body></html>\n' > "$D/dist/games/index.html"
expect fail "one changed byte" "DIFF games/index.html"

fresh; printf 'x\n' > "$D/dist/extra.html"
expect fail "file only in the build" "DIFF extra.html"

fresh; rm "$D/dist/index.html"
expect fail "file only in the base" "DIFF index.html"

fresh
printf '<svg id="paused-play-fill-0838b027"/>\n' > "$D/base/index.html"
printf '<svg id="paused-play-fill-d628f89a"/>\n' > "$D/dist/index.html"
expect pass "the build-random gradient id is masked" "html parity: 2 files identical"

fresh; rm -rf "$D/base"
expect fail "no base saved" "no base: run --save"

echo "check-html-parity tests: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
