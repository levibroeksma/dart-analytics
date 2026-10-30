#!/usr/bin/env bash
# Fixture test for the per-file mode of the edit-time gate scripts:
#   CHECK_ROOT=<dir> bash scripts/check-X.sh <relpath>...
# Each case builds a tiny tree in a temp dir (no git, no other repo files).
set -uo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
PASSED=0
FAILED=0

# tree <relpath> <content> : fresh root holding one file.
tree() {
  local t
  t="$(mktemp -d)"
  mkdir -p "$t/$(dirname "$1")"
  printf '%s\n' "$2" > "$t/$1"
  echo "$t"
}

# expect <pass|fail> <name> <root> <gate> <needle|-> <relpath>...
expect() {
  local want="$1" name="$2" t="$3" gate="$4" needle="$5" out code
  shift 5
  out="$(CHECK_ROOT="$t" bash "$ROOT/scripts/check-$gate.sh" "$@" 2>&1)"; code=$?
  if { [ "$want" = pass ] && [ "$code" -eq 0 ] && [ -z "$out" ]; } ||
     { [ "$want" = fail ] && [ "$code" -eq 1 ] && grep -qF -- "$needle" <<< "$out"; }; then
    PASSED=$((PASSED + 1))
  else
    FAILED=$((FAILED + 1)); echo "FAIL: $name (want $want${needle:+, \"$needle\"}, exit $code)" >&2; echo "$out" | sed 's/^/    /' >&2
  fi
  rm -rf "$t"
}

A=app/src/components/a/X.astro
T=$(tree $A '<div x-bind:class="y"></div>')
expect fail "astro-conventions: x-bind" "$T" astro-conventions "x-bind" $A
T=$(tree $A '<div :class="y"></div>')
expect pass "astro-conventions: :class" "$T" astro-conventions - $A

T=$(tree $A '<div class:list={["a"]}></div>')
expect fail "astro-class-composition: class:list" "$T" astro-class-composition "class:list" $A
T=$(tree $A '<div class={cn("a")}></div>')
expect pass "astro-class-composition: cn" "$T" astro-class-composition - $A

T=$(tree $A '<div class="!flex"></div>')
expect fail "style-tokens: !flex" "$T" style-tokens "$A:1" $A
T=$(tree $A '<div class="flex"></div>')
expect pass "style-tokens: flex" "$T" style-tokens - $A

B=app/src/lib/x.ts
T=$(tree $B $'function f(): void { // x\n}')
expect fail "no-inline-comments: inline //" "$T" no-inline-comments "$B:1" $B
T=$(tree $B $'/** x */\nfunction f(): void {\n}')
expect pass "no-inline-comments: JSDoc" "$T" no-inline-comments - $B
T=$(tree $B $'// Task 3 added this\nexport const a = 1;')
expect fail "no-inline-comments: history citation" "$T" no-inline-comments "D255" $B

T=$(mktemp -d)
expect fail "file-locations: ts under components" "$T" file-locations "app/src/components/a/x.ts" app/src/components/a/x.ts
T=$(mktemp -d)
expect pass "file-locations: ts under lib" "$T" file-locations - app/src/lib/x.ts
T=$(mktemp -d)
expect pass "file-locations: ts under pages/api" "$T" file-locations - app/src/pages/api/x.ts

# Scope: a violating sibling that is not passed as an arg is ignored.
for g in astro-conventions astro-class-composition style-tokens; do
  T=$(tree app/src/components/a/Bad.astro '<div x-bind:class="y" class:list={[1]} class="!flex"></div>')
  printf '<div></div>\n' > "$T/$A"
  expect pass "$g: sibling ignored" "$T" $g - $A
done
T=$(tree app/src/lib/bad.ts $'function f(): void { // x\n}')
printf 'export const a = 1;\n' > "$T/$B"
expect pass "no-inline-comments: sibling ignored" "$T" no-inline-comments - $B
T=$(tree app/src/components/a/x.ts 'export const a = 1;')
expect pass "file-locations: sibling ignored" "$T" file-locations - app/src/lib/x.ts

echo "check-file-mode: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
