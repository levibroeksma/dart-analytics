#!/usr/bin/env bash
# D148 nudge: list changed test files whose assertions changed while no
# describe/it title did. A pure subject rename (`expect(a.x).toBe(1)` ->
# `expect(a.y).toBe(1)`) leaves the asserted literals alone and is skipped.
# Usage: check-test-repointing.sh [base-ref]   (default origin/main; diffs <base-ref>...HEAD)
# Prints one line per flagged file; always exits 0 (non-blocking).
set -uo pipefail
BASE="${1:-origin/main}"
ASSERT='(\.toBe\(|\.toEqual\(|\.parse\(|expect\()'

normalise() {
  grep -E "^$1.*$ASSERT" | sed -E "s/^$2//; s/expect\([^)]*\)/expect()/; s/[[:space:]]+//g" | sort
}

for f in $(git diff --name-only "$BASE"...HEAD -- 'app/tests/**/*.test.ts' 'app/tests/**/*.itest.ts'); do
  diff_out=$(git diff -U0 "$BASE"...HEAD -- "$f")
  added=$(normalise '\+' '\+' <<< "$diff_out")
  [ -z "$added" ] && continue
  removed=$(normalise '-' '-' <<< "$diff_out")
  [ "$added" = "$removed" ] && continue
  if ! grep -qE '^[+-].*\b(describe|it)\(' <<< "$diff_out"; then
    echo "$f: assertion literal(s) changed, no describe/it title changed in the same diff"
  fi
done
exit 0
