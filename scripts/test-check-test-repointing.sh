#!/usr/bin/env bash
# Fixture test for scripts/check-test-repointing.sh: a throwaway git repo per case.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASSED=0
FAILED=0

# case <name> <before> <after> <flagged|clean>
run_case() {
  local name="$1" before="$2" after="$3" want="$4" t out
  t="$(mktemp -d)"
  (
    cd "$t" && git init -q -b main && git config user.email t@t && git config user.name t
    mkdir -p app/tests/lib && printf "%s\n" "$before" > app/tests/lib/a.test.ts
    git add -A && git commit -q -m base
    printf "%s\n" "$after" > app/tests/lib/a.test.ts
    git commit -qam change
  )
  out="$(cd "$t" && bash "$ROOT/scripts/check-test-repointing.sh" HEAD~1)"
  if { [ "$want" = flagged ] && [ -n "$out" ]; } || { [ "$want" = clean ] && [ -z "$out" ]; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $name (want $want, got: $out)" >&2
  fi
  rm -rf "$t"
}

run_case "literal changed" $'it("a", () => {\n  expect(x).toBe(1);\n});' $'it("a", () => {\n  expect(x).toBe(2);\n});' flagged
run_case "subject renamed only" $'it("a", () => {\n  expect(x.old).toBe(1);\n});' $'it("a", () => {\n  expect(x.next).toBe(1);\n});' clean
run_case "title changed too" $'it("a", () => {\n  expect(x).toBe(1);\n});' $'it("b", () => {\n  expect(x).toBe(2);\n});' clean
run_case "no assertion change" $'it("a", () => {\n  expect(x).toBe(1);\n});' $'it("a", () => {\n  const y = 1;\n  expect(x).toBe(1);\n});' clean

echo "check-test-repointing: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
