#!/usr/bin/env bash
# Fixture test for scripts/check-test-coverage.sh's working-tree window: in a
# throwaway worktree at HEAD (running the working copy of the gate), an unstaged runtime source edit alone must fail,
# and with an unstaged edit to its covering test it must pass.
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
  out="$(cd "$WT" && bash scripts/check-test-coverage.sh 2>&1)"; code=$?
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

echo "test-check-test-coverage: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
