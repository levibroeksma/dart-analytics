#!/usr/bin/env bash
# Refinement-coverage gate (Task 10 review incident): a shared-schema
# migration silently dropped a superRefine bounding duration_value; the two
# tests covering it were repointed at a different invalid input and stayed
# green, so nothing but a by-hand diff caught the dropped constraint.
#
# The enforcement that matters is NOT in this script. It is in
# app/src/lib/game/rulesets/refinement-contract.ts (a typed, per-field
# declaration of the boundaries each refinement must accept and reject) and
# app/tests/lib/game/rulesets/refinement-contract.test.ts, which runs
# safeParse over every declared boundary and asserts the real outcome. Delete
# or weaken a refinement and the declared reject cases start parsing
# successfully, so the suite fails. No comment, test title or dummy assertion
# can satisfy an executed parse.
#
# This script does one narrow, honestly checkable job on top of that: it
# asserts the set of schemas carrying a `.superRefine(`/`.refine(` in
# app/src/lib/game/rulesets/types.ts is EXACTLY the set of schemas declared in
# the contract file, and that the contract is still imported by a test. So a
# refinement added or removed without touching the contract fails the build.
#
# WHAT THIS CANNOT CATCH (inherent to any self-declared manifest, stated
# plainly rather than papered over):
#   * A developer who deletes a refinement AND its contract entry in the same
#     edit passes both this script and the contract test. The sets still
#     match; there is simply nothing left to execute. Only human review of the
#     diff catches that. What is now caught is the accidental case — the one
#     that actually happened — where a refinement is lost during a
#     consolidation and the tests around it are quietly repointed.
#   * Boundary values the contract does not declare. The contract test proves
#     the declared boundaries hold, not that they are the right boundaries.
#   * Refinements in files other than types.ts; only that file is scanned.
set -euo pipefail
cd "$(git rev-parse --show-toplevel 2>/dev/null || echo .)"

TYPES_FILE="app/src/lib/game/rulesets/types.ts"
CONTRACT_FILE="app/src/lib/game/rulesets/refinement-contract.ts"
TESTS_DIR="app/tests/lib/game/rulesets"

for required in "$TYPES_FILE" "$CONTRACT_FILE"; do
  if [ ! -f "$required" ]; then
    echo "FAIL: $required not found" >&2
    exit 1
  fi
done

if [ ! -d "$TESTS_DIR" ]; then
  echo "FAIL: $TESTS_DIR not found" >&2
  exit 1
fi

# Schemas in types.ts that carry a refinement, attributed to the nearest
# preceding `export const NAME =` declaration. Comments are stripped first so
# a `.refine(` mentioned in prose never counts as a real one.
REFINED=$(awk '
  { line = $0 }
  in_block {
    if (line ~ /\*\//) { sub(/^.*\*\//, "", line); in_block = 0 } else { next }
  }
  { sub(/\/\/.*$/, "", line) }
  line ~ /\/\*/ {
    if (line ~ /\*\//) { gsub(/\/\*.*\*\//, "", line) }
    else { sub(/\/\*.*$/, "", line); in_block = 1 }
  }
  line ~ /^export const [A-Za-z0-9_]+/ {
    match(line, /^export const [A-Za-z0-9_]+/)
    name = substr(line, 14, RLENGTH - 13)
  }
  line ~ /\.superRefine\(|\.refine\(/ { if (name != "") print name }
' "$TYPES_FILE" | sort -u)

# `|| true`: an empty contract file is a legitimate state to report on (both
# sets empty), not a reason for the script to abort under `set -e`.
DECLARED=$(grep -oE 'schemaName:[[:space:]]*"[A-Za-z0-9_]+"' "$CONTRACT_FILE" \
  | grep -oE '"[A-Za-z0-9_]+"' | tr -d '"' | sort -u || true)

FAIL=0

while IFS= read -r name; do
  [ -z "$name" ] && continue
  echo "FAIL: $name has a superRefine/refine in $TYPES_FILE but no entry in $CONTRACT_FILE — declare the boundaries it must accept and reject there so the contract test executes them" >&2
  FAIL=1
done < <(comm -23 <(printf '%s\n' "$REFINED") <(printf '%s\n' "$DECLARED"))

while IFS= read -r name; do
  [ -z "$name" ] && continue
  echo "FAIL: $name is declared in $CONTRACT_FILE but no longer has a superRefine/refine in $TYPES_FILE — if the removal is deliberate, drop its contract entry in the same commit" >&2
  FAIL=1
done < <(comm -13 <(printf '%s\n' "$REFINED") <(printf '%s\n' "$DECLARED"))

# The contract is inert unless a test executes it. This only proves the import
# still exists; the assertions themselves are the test file's job.
if ! grep -rqE 'REFINEMENT_CONTRACTS' "$TESTS_DIR"; then
  echo "FAIL: no test under $TESTS_DIR imports REFINEMENT_CONTRACTS — the contract in $CONTRACT_FILE is never executed" >&2
  FAIL=1
fi

if [ "$FAIL" -ne 0 ]; then
  exit 1
fi

if [ -z "$REFINED" ]; then
  echo "OK: no refinements in $TYPES_FILE and none declared in $CONTRACT_FILE."
  exit 0
fi

COUNT=$(printf '%s\n' "$REFINED" | wc -l | tr -d ' ')
echo "OK: $COUNT refined schema(s) in $TYPES_FILE match the contract in $CONTRACT_FILE: $(printf '%s\n' "$REFINED" | paste -sd, - | tr ',' ' ' | sed 's/ /, /g')."
echo "     Boundaries are enforced by execution in $TESTS_DIR/refinement-contract.test.ts, not by this script."
