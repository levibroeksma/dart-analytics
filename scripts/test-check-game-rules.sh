#!/usr/bin/env bash
# Fixture test for scripts/check-game-rules.sh's Tags check. Each case copies a
# real rules file into a temp docs/game-rules/ tree, swaps in a Tags section,
# and asserts the gate's exit code and, for a failing case, its finding.
set -uo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
GATE="$ROOT/scripts/check-game-rules.sh"
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
export GAME_RULES_TAGS="$ROOT/docs/game-rules/TAGS.md"
unset GAME_RULES_GATE

PASSED=0
FAILED=0

# fixture <source rules file> <shape folder> <name> : copy with any Tags
# section removed and the Tags block read from stdin inserted before Objective.
fixture() {
  local src="$ROOT/$1" dir="$TMP/docs/game-rules/$2" out tags
  out="$dir/$3.md"
  mkdir -p "$dir"
  tags="$(cat)"
  awk -v tags="$tags" '
    /^## Tags( |$)/ { skip = 1; next }
    /^## / { skip = 0 }
    skip { next }
    /^## Objective( |$)/ && tags != "" { print tags; print ""; tags = "" }
    { print }
  ' "$src" > "$out"
  echo "$out"
}

# expect <pass|fail> <case name> <file> [finding substring] [VAR=value]
expect() {
  local want="$1" name="$2" file="$3" needle="${4:-}" out code
  out="$(env ${5:-} bash "$GATE" "$file" 2>&1)"; code=$?
  if [ "$want" = pass ] && [ "$code" -eq 0 ]; then
    PASSED=$((PASSED + 1)); return
  fi
  if [ "$want" = fail ] && [ "$code" -ne 0 ] && grep -qF -- "$needle" <<< "$out"; then
    PASSED=$((PASSED + 1)); return
  fi
  FAILED=$((FAILED + 1))
  echo "FAIL: $name (want $want${needle:+, \"$needle\"}, exit $code)" >&2
  echo "$out" | sed 's/^/    /' >&2
}

EX=docs/game-rules/training/exercises/warm-up.md
GAME_RS=docs/game-rules/rulesets/around-the-clock.md
GAME=docs/game-rules/rulesets/501.md
ROUTINE=docs/game-rules/training/routines/pre-match-warm-up.md

FLAT_EX='## Tags

| Axis | Tags |
| --- | --- |
| Skill | CHECKOUT (primary), DOUBLES |
| Session role | CORE |
| Format | SOLO |
| Difficulty | INTERMEDIATE |
| Mechanic | COUNTDOWN |
| Pressure | NONE |'

FLAT_GAME="$FLAT_EX
| Family | STANDARD |"

SWAPPED='## Tags

| Axis | Tags |
| --- | --- |
| Session role | CORE |
| Skill | CHECKOUT (primary) |
| Format | SOLO |
| Difficulty | INTERMEDIATE |
| Mechanic | COUNTDOWN |
| Pressure | NONE |'

SPLIT_GAME='## Tags

### Standalone

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP |
| Format | SOLO, ONE_V_ONE |
| Difficulty | BEGINNER |
| Mechanic | SEQUENTIAL |
| Pressure | NONE |
| Family | STANDARD |

### Routine step

| Axis | Tags |
| --- | --- |
| Skill | ACCURACY (primary) |
| Session role | WARM_UP, CORE |
| Format | SOLO |
| Difficulty | INTERMEDIATE (1 dart), ADVANCED (2 darts), EXPERT (3 darts) |
| Mechanic | SEQUENTIAL |
| Pressure | SETBACK |'

# --- valid shapes ------------------------------------------------------------
expect pass "exercise, flat table" "$(fixture $EX training/exercises ok-ex <<< "$FLAT_EX")"
expect pass "game, flat table with Family" "$(fixture $GAME rulesets ok-game <<< "$FLAT_GAME")"
expect pass "routine-step game, two blocks" "$(fixture $GAME_RS rulesets ok-split <<< "$SPLIT_GAME")"

# --- vocabulary --------------------------------------------------------------
expect fail "unknown value" "$(fixture $EX training/exercises bad-value <<< "${FLAT_EX/COUNTDOWN/BOGUS}")" \
  '"BOGUS" is not a Mechanic value'
expect fail "unknown axis" "$(fixture $EX training/exercises bad-axis <<< "$FLAT_EX
| Colour | RED |")" 'unknown axis "Colour"'
expect fail "missing axis" "$(fixture $EX training/exercises no-format <<< "$(grep -v '^| Format' <<< "$FLAT_EX")")" \
  'missing axis "Format"'
expect fail "axis out of order" "$(fixture $EX training/exercises order <<< "$SWAPPED")" 'out of order'
expect fail "vocabulary file missing" "$(fixture $EX training/exercises no-vocab <<< "$FLAT_EX")" \
  'vocabulary file not found' GAME_RULES_TAGS="$TMP/absent.md"

# --- shape and block ---------------------------------------------------------
expect fail "Family on an exercise" "$(fixture $EX training/exercises ex-family <<< "$FLAT_GAME")" \
  'axis "Family" is not allowed here'
expect fail "game missing Family" "$(fixture $GAME rulesets game-no-family <<< "$FLAT_EX")" \
  'missing axis "Family"'
expect fail "Family in Routine step block" "$(fixture $GAME_RS rulesets rs-family <<< "$SPLIT_GAME
| Family | STANDARD |")" 'axis "Family" is not allowed here'
expect fail "routine-step game with flat table" "$(fixture $GAME_RS rulesets rs-flat <<< "$FLAT_GAME")" \
  'so Tags needs ### Standalone and ### Routine step'
expect fail "standalone game with subsections" "$(fixture $GAME rulesets sa-split <<< "$SPLIT_GAME")" \
  'subsections are only for a game whose Entry points include routine step'
expect fail "exercise with subsections" "$(fixture $EX training/exercises ex-split <<< "$SPLIT_GAME")" \
  'an exercise has one flat table'

# --- counts ------------------------------------------------------------------
expect fail "no primary skill" "$(fixture $EX training/exercises no-primary <<< "${FLAT_EX/ (primary)/}")" \
  'needs exactly one (primary) value, found 0'
expect fail "two primary skills" "$(fixture $EX training/exercises two-primary <<< "${FLAT_EX/DOUBLES/DOUBLES (primary)}")" \
  'needs exactly one (primary) value, found 2'
expect fail "NONE with another Pressure" "$(fixture $EX training/exercises none-mix <<< "${FLAT_EX/| NONE |/| NONE, SETBACK |}")" \
  'NONE cannot be combined'
expect fail "two Difficulty outside Routine step" "$(fixture $EX training/exercises two-diff <<< "${FLAT_EX/| INTERMEDIATE |/| INTERMEDIATE, ADVANCED |}")" \
  'Difficulty takes exactly one value'
expect fail "unlabelled Difficulty in Routine step" "$(fixture $GAME_RS rulesets rs-unlabelled <<< "${SPLIT_GAME/INTERMEDIATE (1 dart)/INTERMEDIATE}")" \
  'needs a preset label'

# --- forbidden on routine ----------------------------------------------------
expect fail "Tags on a routine" "$(fixture $ROUTINE training/routines rt-tags <<< "$FLAT_EX")" \
  'section not allowed for a routine: ## Tags'

# --- required ------------------------------------------------------------------
expect fail "exercise without Tags" "$(fixture $EX training/exercises no-tags <<< "")" 'missing section: ## Tags'
expect fail "game without Tags" "$(fixture $GAME rulesets no-tags <<< "")" 'missing section: ## Tags'

echo "test-check-game-rules: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
