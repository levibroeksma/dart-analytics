#!/usr/bin/env bash
# Fixture test for scripts/check-test-coverage.sh: in a throwaway worktree at
# HEAD (running the working copy of the gate), an unstaged runtime source edit
# alone must fail, and with an unstaged edit to its covering test it must pass.
# Then, against HEAD only: a pure rename of a declared name and a block moved
# whole into another changed file are exempt; a rename of an undeclared name
# (a parameter), a rename plus a logic edit, and a moved block whose new home's
# test is untouched still fail.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SOURCE="app/src/lib/utils/is-nav-active.ts"
TEST="app/tests/utils/is-nav-active.test.ts"
TMP="$(mktemp -d)"
WT="$TMP/wt"
cleanup() {
  git -C "$ROOT" worktree remove --force "$WT" >/dev/null 2>&1
  rm -rf "$TMP"
}
trap cleanup EXIT

PASSED=0
FAILED=0

expect() {
  local name="$1" want="$2" out code
  out="$(cd "$WT" && TEST_COVERAGE_BASE_REF="${BASE:-origin/main}" bash scripts/check-test-coverage.sh 2>&1)"; code=$?
  if [ "$code" -eq "$want" ]; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1))
    echo "FAIL: $name exited $code, wanted $want: $out" >&2
  fi
}

if ! git -C "$ROOT" worktree add --detach "$WT" HEAD >/dev/null 2>&1; then
  echo "test-check-test-coverage: could not create a worktree" >&2
  exit 1
fi

cp "$ROOT/scripts/check-test-coverage.sh" "$WT/scripts/check-test-coverage.sh"
cp "$ROOT/scripts/check_test_coverage.py" "$WT/scripts/check_test_coverage.py"
printf '\nexport const probeUnstaged = 1;\n' >> "$WT/$SOURCE"
expect "unstaged source edit, no test edit" 1
printf '\n// probe\n' >> "$WT/$TEST"
expect "unstaged source and test edits" 0

DEST="app/src/lib/utils/route-class.ts"
DEST_TEST="app/tests/utils/route-class.test.ts"
reset() { git -C "$WT" checkout -q -- app && git -C "$WT" clean -qfd -- app; }
BASE=HEAD

reset
sed -i 's/isNavActive/isNavRouteActive/' "$WT/$SOURCE"
expect "rename of a declared function" 0

reset
sed -i 's/matchPrefix/prefixToMatch/g' "$WT/$SOURCE"
expect "rename of an undeclared name (parameter)" 1

reset
sed -i 's/isNavActive/isNavRouteActive/; s/return false;/return true;/' "$WT/$SOURCE"
expect "rename plus a logic edit" 1

reset
printf '\nexport function probeMoved(a: number): number {\n  return a + 1;\n}\n' >> "$WT/$SOURCE"
git -C "$WT" -c core.hooksPath=/dev/null -c user.name=probe -c user.email=probe@example.com \
  commit -qam "probe: block to move" || { echo "could not commit probe" >&2; exit 1; }
head -n -4 "$WT/$SOURCE" > "$TMP/src" && cp "$TMP/src" "$WT/$SOURCE"
printf '\nexport function probeMoved(a: number): number {\n  return a + 1;\n}\n' >> "$WT/$DEST"
expect "block moved, new home's test untouched" 1
printf '\n// probe\n' >> "$WT/$DEST_TEST"
expect "block moved, new home's test touched" 0

echo "test-check-test-coverage: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
