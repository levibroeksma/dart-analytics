#!/usr/bin/env bash
# Mock-reset hook gate (#1374): no expression-bodied mock reset in a Vitest
# hook under app/tests. `beforeEach(() => fn.mockReset())` returns the mock,
# and Vitest runs a function returned from a hook as teardown, calling the
# mock once more with no arguments after each test.
#
# WHAT THIS CANNOT CATCH: a hook body split across lines, or another
# function-returning call (e.g. mockImplementation) in an expression body.
set -u
cd "${CHECK_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"

FILE_MODE=0
TARGETS=(app/tests)
if [ "$#" -gt 0 ]; then
  FILE_MODE=1
  TARGETS=()
  for a in "$@"; do [ -f "$a" ] && TARGETS+=("$a"); done
  [ "${#TARGETS[@]}" -eq 0 ] && exit 0
fi

RE='(beforeEach|afterEach|beforeAll|afterAll)\(\(\) =>[[:space:]]*[^{[:space:]][^{};]*\.mock(Reset|Clear|Restore)\(\)[[:space:]]*\)'
HITS=$(grep -RHInE --include='*.ts' --include='*.tsx' --include='*.js' --include='*.mjs' "$RE" "${TARGETS[@]}" 2>/dev/null || true)
if [ -n "$HITS" ]; then
  echo "FAIL: expression-bodied mock reset in a Vitest hook — the returned mock runs as teardown. Use a block body: beforeEach(() => { fn.mockReset(); }):" >&2
  echo "$HITS" >&2
  exit 1
fi

[ "$FILE_MODE" -eq 1 ] && exit 0
echo "OK: no expression-bodied mock reset in Vitest hooks under app/tests."
