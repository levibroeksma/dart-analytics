#!/usr/bin/env bash
# Fixture test for scripts/check-engine-kernels.sh. Each case builds a tiny
# repo tree in a temp dir and asserts the gate's exit code and finding.
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-engine-kernels.sh"
PASSED=0
FAILED=0

# tree <name> : fresh fixture root with one game engine and one rules file.
tree() {
  local t
  t="$(mktemp -d)"
  mkdir -p "$t/app/src/modules/game" "$t/app/src/modules/training/exercises" "$t/docs/game-rules/rulesets"
  printf 'import { x } from "./board-progression.module";\n' > "$t/app/src/modules/game/foo.engine.module.ts"
  printf '# Foo\n\nKernel: TRACK\n' > "$t/docs/game-rules/rulesets/foo.md"
  echo "$t"
}
row() { echo "app/src/modules/game/foo.engine.module.ts | $1 | $2 | $3 | $4" > "$5/scripts-engine-kernels.txt"; }

# expect <pass|fail> <name> <root> [needle]
expect() {
  local out code
  out="$(ENGINE_KERNELS_ROOT="$3" ENGINE_KERNELS_FILE="$3/scripts-engine-kernels.txt" bash "$GATE" 2>&1)"; code=$?
  if { [ "$1" = pass ] && [ "$code" -eq 0 ]; } || { [ "$1" = fail ] && [ "$code" -ne 0 ] && grep -qF -- "$4" <<< "$out"; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $2 (want $1${4:+, \"$4\"}, exit $code)" >&2; echo "$out" | sed 's/^/    /' >&2
  fi
  rm -rf "$3"
}

T=$(tree); row TRACK PENDING docs/game-rules/rulesets/foo.md "Track PR 9" "$T"
expect pass "pending row, no kernel import" "$T"

T=$(tree); : > "$T/scripts-engine-kernels.txt"
expect fail "engine not in registry" "$T" "not listed in"

T=$(tree); row TRACK PENDING docs/game-rules/rulesets/foo.md "x" "$T"; echo "app/src/modules/game/gone.engine.module.ts | TRACK | PENDING | - | x" >> "$T/scripts-engine-kernels.txt"
expect fail "row for missing engine" "$T" "gone.engine.module.ts does not exist"

T=$(tree); row TRACK KERNEL_BOUND docs/game-rules/rulesets/foo.md "" "$T"
expect fail "KERNEL_BOUND without import" "$T" "does not import ./track-kernel.module"

T=$(tree); printf 'import { a } from "./track-kernel.module";\n' > "$T/app/src/modules/game/foo.engine.module.ts"; row TRACK KERNEL_BOUND docs/game-rules/rulesets/foo.md "" "$T"
expect pass "KERNEL_BOUND with import" "$T"

T=$(tree); printf 'import { a } from "./track-kernel.module";\n' > "$T/app/src/modules/game/foo.engine.module.ts"; row TRACK PENDING docs/game-rules/rulesets/foo.md "Track PR 9" "$T"
expect fail "stale PENDING row" "$T" "imports a kernel but is marked PENDING"

T=$(tree); row MARKS PENDING docs/game-rules/rulesets/foo.md "x" "$T"
expect fail "rules file disagrees" "$T" "says Kernel: TRACK"

T=$(tree); row TRAK PENDING - "x" "$T"
expect fail "unknown kernel" "$T" "unknown kernel TRAK"

T=$(tree); row TRACK HAND_WRITTEN - "x" "$T"
expect fail "HAND_WRITTEN status with family kernel" "$T" "HAND_WRITTEN status needs kernel HAND_WRITTEN"

T=$(tree); row TRACK PENDING - "" "$T"
expect fail "PENDING without reason" "$T" "needs a reason"

echo "test-check-engine-kernels: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
