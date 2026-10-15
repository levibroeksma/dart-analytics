# Training Tags Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking. Pair either with the `capturing-discovered-work` skill (root `CLAUDE.md`).

**Goal:** Define a curated tag vocabulary (`docs/game-rules/TAGS.md`), tag all 24 exercises and 51 rulesets, and make `scripts/check-game-rules.sh` enforce it.

**Architecture:** Docs + one bash gate. `TAGS.md` holds the axes and values in fixed tables; the gate parses them (no hard-coded values) and checks each rules file's `## Tags` section. No migration, no app code.

**Tech Stack:** Markdown, bash, POSIX awk (CI and the container run `mawk`; no `gawk`-only features).

**Spec:** `docs/superpowers/specs/2026-10-15-training-tags-design.md`

## Global Constraints

- Branch `docs/training-tags` (exists, spec committed as `3923ae2`). One PR.
- Tag keys are UPPER_SNAKE; vocabulary lives only in `docs/game-rules/TAGS.md`.
- Axis order (spec §3.1): Skill, Session role, Format, Difficulty, Mechanic, Pressure, Family.
- `## Tags` sits directly after `## Identity`, in every exercise and ruleset file; never in routine or trivia files.
- Family: rulesets only, never in a `### Routine step` block.
- Tags describe the default preset; not versioned.
- Gate stays blocking by default; `GAME_RULES_GATE=warn` downgrades.
- Decisions append-only; next id from `bash scripts/next-decision-id.sh` (D461 at plan time — re-run before PR).
- Commit messages end with the attribution trailer from the session (`Co-Authored-By: …` + `Claude-Session: …`). No model id in commits/PR.
- Discovered work → GitHub issue (`discovered-work`), never fixed here.

## Deviation from spec §6 commit order

Spec lists "gate + test" before the tag commits. `.husky/pre-commit` runs `check-game-rules.sh`, so requiring `## Tags` before files carry it blocks commits 4–5. Therefore: Task 2 adds the Tags *validation* (runs only when the section exists); Task 4 adds `Tags` to the required headings once every file is tagged. Same five commits, same content.

## Review Focus

1. A game marked `standalone, routine step` with only a flat table → gate must demand both subsections (test case "routine-step game with flat table").
2. Exercises all carry `Entry points: routine step` but must stay flat → gate must not demand subsections for exercises (test case "exercise, flat table" passes; "exercise with subsections" fails).
3. Typo in an axis name (`Session Role`) or value (`WARMUP`) → named finding, not silent pass (cases "unknown axis", "unknown value").
4. `TAGS.md` missing or renamed → gate fails with "vocabulary file not found", not a pass with zero axes (add case in Task 2).
5. A `## Tags` heading added to a routine or trivia file → "section not allowed" (case "Tags on a routine").

---

## File map

| File | Change |
| --- | --- |
| `docs/game-rules/TAGS.md` | Create — vocabulary |
| `docs/game-rules/README.md` | One-line pointer to `TAGS.md` |
| `docs/game-rules/templates/EXERCISE_TEMPLATE.md`, `GAME_RULESET_TEMPLATE.md` | Add `## Tags` section + authoring rules |
| `docs/game-rules/templates/ROUTINE_TEMPLATE.md`, `TRIVIA_TEMPLATE.md` | One line: no Tags |
| `.claude/skills/authoring-game-rules/references/{game,exercise,routine,trivia}.md` | Required-headings + tag-on-authoring note |
| `docs/architecture/00-Context-Map.md:50` | Register `TAGS.md` in the authoring pack |
| `scripts/check-game-rules.sh` | Tag check, path args, `GAME_RULES_TAGS`, forbidden list |
| `scripts/test-check-game-rules.sh` | Create — fixture test |
| `.husky/pre-commit`, `.claude/skills/run-all-gates/SKILL.md` | Run the test |
| `docs/architecture/00-File-Inventory.md:554` | Update gate row; add test row |
| `docs/game-rules/training/exercises/*.md` (24) | `## Tags` |
| `docs/game-rules/rulesets/*.md` (51) | `## Tags`; `121.md`, `score-training.md` Entry points |
| `decisions/context-system.md` | Append D461 |

---

### Task 1: Vocabulary, templates, skill references, context map

**Files:**
- Create: `docs/game-rules/TAGS.md`
- Modify: `docs/game-rules/README.md`, the four templates, the four skill references, `docs/architecture/00-Context-Map.md:50`

**Interfaces:**
- Produces: `TAGS.md` with a `## Axes` table `| Axis | Rule | Exclusive | Scope |` and one `## <Axis name>` section per axis holding `| Key | Name | Meaning |`. Rule ∈ `primary`/`one`/`many`; Exclusive is a key or `—`; Scope ∈ `all`/`game-standalone`. Task 2's parser depends on exactly these headings and column positions.

- [ ] **Step 1: Create `docs/game-rules/TAGS.md`**

```markdown
# Training Tags

The fixed vocabulary for the `## Tags` section of every exercise
(`training/exercises/`) and game ruleset (`rulesets/`). Routines and trivia
tools carry no tags; a routine's tags will be derived from its steps.
Non-canonical like the rest of `docs/game-rules/`. Design:
`docs/superpowers/specs/2026-10-15-training-tags-design.md`.

`scripts/check-game-rules.sh` reads the tables below. Keep their headings and
columns exactly as they are: a `## ` heading per axis, named as in the Axes
table, holding a `| Key | Name | Meaning |` table.

## Rules

- **Default preset.** Tags describe the item at its default config. Where a
  setting changes the item's character, the default wins until template
  overrides exist.
- **Format** lists every player format the rules file describes, scheduled or
  not, except `Dropped` rows.
- **Not versioned.** If a later version changes an item's character, edit its
  tags in place.
- **Routine step.** A game whose `Entry points:` include `routine step` has
  `### Standalone` and `### Routine step` subsections, each a complete table.
  The Routine step block has no Family row and may list several Difficulty
  values, each labelled with its template or preset, e.g.
  `INTERMEDIATE (1 dart), ADVANCED (2 darts)`.
- **Skill.** Exactly one value is marked `(primary)` and comes first; the
  rest are secondary.
- **Extending.** A new value or axis is a row here plus a decision in
  `decisions/context-system.md`. Renaming or removing one is a new decision
  citing `Supersedes:` and updates every rules file in the same change.

## Axes

| Axis | Rule | Exclusive | Scope |
| --- | --- | --- | --- |
| Skill | primary | — | all |
| Session role | many | — | all |
| Format | many | — | all |
| Difficulty | one | — | all |
| Mechanic | many | — | all |
| Pressure | many | NONE | all |
| Family | one | — | game-standalone |

`primary`: one value marked `(primary)`, any number of others. `one`: exactly
one value. `many`: one or more. `Exclusive`: a value that may not be combined
with any other on that axis. `game-standalone`: rulesets only, and never in a
`### Routine step` block.

## Skill

| Key | Name | Meaning |
| --- | --- | --- |
| SCORING | Scoring | Treble-scoring power |
| SWITCHING | Switching | Moving between targets |
| DOUBLES | Doubles | Hitting doubles |
| CHECKOUT | Checkout | Finishing a score |
| BULL | Bull | Hitting the bull |
| ACCURACY | Accuracy | Singles and grouping |
| CONTROL | Control | Hitting a planned total |

## Session role

| Key | Name | Meaning |
| --- | --- | --- |
| WARM_UP | Warm-up | Low-stakes start that loosens the arm |
| CORE | Core | The main drill block of a session |
| FINISHER | Finisher | Closes a session with pressure on the last darts |
| BENCHMARK | Benchmark | A fixed test that is comparable over time |
| RECREATIONAL | Recreational | Played for fun rather than to drill one thing |

## Format

| Key | Name | Meaning |
| --- | --- | --- |
| SOLO | Solo | One player |
| ONE_V_ONE | 1v1 | Two players head to head |
| MULTIPLAYER | Multiplayer | Three or more players, each for themselves |
| TEAMS | Teams | Players grouped into sides |

## Difficulty

| Key | Name | Meaning |
| --- | --- | --- |
| BEGINNER | Beginner | Playable from the first session |
| INTERMEDIATE | Intermediate | Needs a steady hit on a chosen single |
| ADVANCED | Advanced | Needs regular trebles or doubles |
| EXPERT | Expert | Built for strong league or tour-level players |

## Mechanic

| Key | Name | Meaning |
| --- | --- | --- |
| COUNTDOWN | Countdown | Score down from a start to exactly zero |
| TERRITORIAL | Territorial | Claim and close numbers |
| SEQUENTIAL | Sequential | Hit targets in a set board order |
| ACCUMULATION | Accumulation | Pile up points |
| ELIMINATION | Elimination | Lose lives; players drop out |
| CHASE | Chase | One player pursues another along a track |
| SIMULATION | Simulation | Models another sport or game |
| ADJACENCY | Adjacency | Targets defined by board neighbours |
| LADDER | Ladder | Climb a fixed sequence of targets |
| THRESHOLD | Threshold | Reach a set score per visit |
| FIXED_COUNT | Fixed count | A set number of darts at each target |

## Pressure

| Key | Name | Meaning |
| --- | --- | --- |
| NONE | None | A miss costs nothing beyond the dart (Score Threshold) |
| PENALTY | Penalty | A miss costs points (Halve-It) |
| SETBACK | Setback | A miss moves progress back one step; progress is kept (ATC Intermediate, Doubles Lock) |
| RESET | Reset | A miss sends progress back to the start (Doubles Snakes & Ladders, Bullseye 500) |

## Family

| Key | Name | Meaning |
| --- | --- | --- |
| STANDARD | Standard | Played in leagues and competition |
| PUB | Pub | A pub or social game |
| REGIONAL | Regional | Tied to a region or national tradition |
| NOVELTY | Novelty | A one-off or themed twist |
```

- [ ] **Step 2: `EXERCISE_TEMPLATE.md`** — add to "Authoring rules" list (after the "Headings carry no version number." bullet):

```markdown
- `## Tags` takes one flat table, axes in `docs/game-rules/TAGS.md` order,
  values only from that file, no Family row. An exercise that wraps a game
  tags itself; it never inherits the game's tags.
```

and in the copyable sections, between `## Identity` block and `## Exercise type`:

```markdown
## Tags

| Axis | Tags |
| --- | --- |
| Skill | … (primary) |
| Session role | … |
| Format | SOLO |
| Difficulty | … |
| Mechanic | … |
| Pressure | … |
```

- [ ] **Step 3: `GAME_RULESET_TEMPLATE.md`** — add to "Authoring rules" (after the headings bullet):

```markdown
- `## Tags` uses the axes and values in `docs/game-rules/TAGS.md`, in its
  order, plus a Family row. If `Entry points:` include `routine step`, split it
  into `### Standalone` and `### Routine step`, each a complete table; the
  Routine step block has no Family row and may label several Difficulty
  values by preset.
```

and between `## Identity` and `## Objective` in the copyable part:

```markdown
## Tags

| Axis | Tags |
| --- | --- |
| Skill | … (primary) |
| Session role | … |
| Format | … |
| Difficulty | … |
| Mechanic | … |
| Pressure | … |
| Family | … |
```

- [ ] **Step 4: `ROUTINE_TEMPLATE.md`, `TRIVIA_TEMPLATE.md`** — add one bullet to each "Authoring rules" list:

```markdown
- No `## Tags` section: tags live on exercises and games (`docs/game-rules/TAGS.md`).
```

- [ ] **Step 5: skill references**
  - `references/game.md` "Required headings": change `` `Features` · `Identity` · `Objective` `` to `` `Features` · `Identity` · `Tags` · `Objective` `` and append after the "Header fields" paragraph ending "`standalone, routine step`.":
    ```markdown
    Tag the game when it is first authored (`docs/game-rules/TAGS.md`). A
    `standalone, routine step` game splits `## Tags` into `### Standalone` and
    `### Routine step`.
    ```
  - `references/exercise.md` "Required headings": insert `` `Tags` · `` after `` `Identity` · ``; append under the heading list:
    ```markdown
    Tag the exercise when it is first authored: one flat table from
    `docs/game-rules/TAGS.md`, no Family row.
    ```
  - `references/routine.md` and `references/trivia.md`: after the "**No `Capture` section** …" paragraph add:
    ```markdown
    **No `Tags` section** — tags live on exercises and games; a routine's or
    tool's profile is derived, never stored (`docs/game-rules/TAGS.md`).
    ```

- [ ] **Step 6: `docs/game-rules/README.md`** — add one line where the README lists the tree's parts (read the file first; place it beside `templates/`):

```markdown
- `TAGS.md` — the tag vocabulary for exercises and games.
```

- [ ] **Step 7: context map** — in `docs/architecture/00-Context-Map.md:50`, change `the matching \`docs/game-rules/templates/\` template,` to `the matching \`docs/game-rules/templates/\` template, \`docs/game-rules/TAGS.md\`,`. Update the token estimate (`~10.3k`) per `context-maintenance` skill's procedure (measure `TAGS.md`, add it).

- [ ] **Step 8: Verify**

Run: `bash scripts/check-game-rules.sh && bash scripts/check-context-map.sh && bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh`
Expected: all PASS (Tags not required yet; templates are not checked).

- [ ] **Step 9: Commit**

```bash
git add docs/game-rules/TAGS.md docs/game-rules/README.md docs/game-rules/templates .claude/skills/authoring-game-rules/references docs/architecture/00-Context-Map.md
git commit -m "docs(game-rules): add TAGS.md vocabulary, templates and skill notes"
```

---

### Task 2: Gate tag check + fixture test

**Files:**
- Modify: `scripts/check-game-rules.sh`
- Create: `scripts/test-check-game-rules.sh`
- Modify: `.husky/pre-commit`, `.claude/skills/run-all-gates/SKILL.md`, `docs/architecture/00-File-Inventory.md:554`

**Interfaces:**
- Consumes: `TAGS.md` table format from Task 1.
- Produces: `check-game-rules.sh [file…]` — with args, checks only those paths (shape from a `*docs/game-rules/<folder>/` suffix); env `GAME_RULES_TAGS` overrides the vocabulary path. Findings on stderr, prefixed `  Tags: ` / `  Tags (Standalone): ` / `  Tags (Routine step): `.

- [ ] **Step 1: Write the failing test** — create `scripts/test-check-game-rules.sh`:

```bash
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

echo "test-check-game-rules: $PASSED passed, $FAILED failed"
[ "$FAILED" -eq 0 ]
```

- [ ] **Step 2: Run to verify it fails**

Run: `bash scripts/test-check-game-rules.sh`
Expected: exit 1, most cases `FAIL:` (the current gate ignores path args and walks the whole tree, so this run takes ~3 min; pass cases may pass, fail cases fail). The prototype of this test went 3 passed / 16 failed against the current gate.

- [ ] **Step 3: Implement — `scripts/check-game-rules.sh`** (all edits below; prototype-verified against the cases above)

  a. After `MODE="${GAME_RULES_GATE:-block}"`:
  ```bash
  TAGS_FILE="${GAME_RULES_TAGS:-docs/game-rules/TAGS.md}"
  ```
  b. `shape_forbidden`: `routine|trivia) echo "Capture" ;;` → `routine|trivia) echo "Capture,Tags" ;;`
  c. Replace block `# 1b. forbidden headings` body with:
  ```bash
    # 1b. forbidden headings
    local IFS=','
    read -ra forbidden <<< "$(shape_forbidden "$shape")"
    unset IFS
    for h in "${forbidden[@]}"; do
      grep -qE "^## $h( |$)" "$file" && note "section not allowed for a $shape: ## $h"
    done
  ```
  d. Before `# 8. applicability tokens`:
  ```bash
    # 7b. Tags section against the TAGS.md vocabulary
    if shape_has_entry "$shape" && grep -qE '^## Tags( |$)' "$file"; then
      check_tags "$file" "$shape"
    fi

  ```
  e. Before `# Every bold Glossary term must appear verbatim inside a Features row name.`, add `check_tags`:
  ```bash
  # Tags tables: axes, values and counts come from TAGS.md, never from here.
  # A game whose Entry points include routine step splits into ### Standalone
  # and ### Routine step; everything else has one flat table.
  check_tags() {
    local file="$1" shape="$2" routine=0 line
    if [ ! -f "$TAGS_FILE" ]; then
      note "Tags: vocabulary file not found: $TAGS_FILE"
      return
    fi
    grep -q '^Entry points:.*routine step' "$file" && routine=1
    while IFS= read -r line; do
      [ -n "$line" ] && note "$line"
    done < <(awk -v shape="$shape" -v routine="$routine" '
  function trim(s) { gsub(/^[ \t]+|[ \t]+$/, "", s); return s }
  function cell(line, i,   c) { split(line, c, "|"); return trim(c[i]) }
  function is_table_body(line) {
    return line ~ /^\|/ && line !~ /^\|[ :-]*-+/
  }
  # ---- pass 1: TAGS.md ------------------------------------------------------
  FNR == NR {
    if ($0 ~ /^## /) { sect = trim(substr($0, 4)); hdr = 0; next }
    if (!is_table_body($0)) next
    if (!hdr) { hdr = 1; next }
    if (sect == "Axes") {
      a = cell($0, 2)
      naxes++; order[naxes] = a; known[a] = 1
      rule[a] = cell($0, 3); excl[a] = cell($0, 4); scope[a] = cell($0, 5)
    } else if (sect in known) {
      value[sect, cell($0, 2)] = 1
    }
    next
  }
  # ---- pass 2: rules file ---------------------------------------------------
  /^## Tags[ \t]*$/ { intags = 1; next }
  /^## /            { intags = 0 }
  !intags           { next }
  /^### / {
    b = trim(substr($0, 5))
    if (b != "Standalone" && b != "Routine step") { print "Tags: unknown subsection \"### " b "\""; next }
    if (b in seenblock) { print "Tags: duplicate subsection \"### " b "\""; next }
    seenblock[b] = 1; nblocks++; blk = b; bhdr = 0
    next
  }
  is_table_body($0) {
    if (blk == "") blk = "flat"
    if (!bhdr) { bhdr = 1; next }
    nrows[blk]++
    rowaxis[blk, nrows[blk]] = cell($0, 2)
    rowvals[blk, nrows[blk]] = cell($0, 3)
    if (!(blk in tables)) { tables[blk] = 1; tableorder[++ntables] = blk }
  }
  END {
    if (naxes == 0) { print "Tags: no axes parsed from TAGS.md"; exit }
    if (ntables == 0) { print "Tags: no tag table"; exit }
    if (shape == "exercise" && nblocks > 0)
      print "Tags: an exercise has one flat table, no subsections"
    if (shape == "game" && routine && !(("Standalone" in tables) && ("Routine step" in tables)))
      print "Tags: Entry points include routine step, so Tags needs ### Standalone and ### Routine step"
    if (shape == "game" && !routine && nblocks > 0)
      print "Tags: subsections are only for a game whose Entry points include routine step"
    if (("flat" in tables) && nblocks > 0)
      print "Tags: a table sits outside the ### Standalone / ### Routine step subsections"
    for (t = 1; t <= ntables; t++) check_block(tableorder[t])
  }
  function wants(a, blk) {
    if (scope[a] == "all") return 1
    if (scope[a] == "game-standalone") return shape == "game" && blk != "Routine step"
    return 0
  }
  function check_block(blk,   where, i, k, a, pos, n, vals, j, v, lab, nv, nprim, seen, got, expect) {
    where = (blk == "flat") ? "Tags" : "Tags (" blk ")"
    n = 0
    for (k = 1; k <= naxes; k++) if (wants(order[k], blk)) expect[++n] = order[k]
    pos = 1
    for (i = 1; i <= nrows[blk]; i++) {
      a = rowaxis[blk, i]
      if (!(a in known))    { print where ": unknown axis \"" a "\""; continue }
      if (!wants(a, blk))   { print where ": axis \"" a "\" is not allowed here"; continue }
      if (a in got)         { print where ": axis \"" a "\" appears twice"; continue }
      got[a] = 1
      if (expect[pos] != a) print where ": axis \"" a "\" is out of order (TAGS.md order)"
      pos++
      nv = split(rowvals[blk, i], vals, ",")
      nprim = 0; delete seen
      for (j = 1; j <= nv; j++) {
        v = trim(vals[j]); lab = ""
        if (match(v, /\([^)]*\)$/)) { lab = trim(substr(v, RSTART + 1, RLENGTH - 2)); v = trim(substr(v, 1, RSTART - 1)) }
        if (v == "") { print where ": empty value in \"" a "\""; continue }
        if (!((a, v) in value)) print where ": \"" v "\" is not a " a " value in TAGS.md"
        if (v in seen) print where ": \"" v "\" listed twice in \"" a "\""
        seen[v] = 1
        if (rule[a] == "primary") {
          if (lab == "primary") { nprim++; if (j != 1) print where ": the primary " a " must come first" }
          else if (lab != "") print where ": unexpected label \"(" lab ")\" on \"" v "\""
        } else if (rule[a] == "one" && blk == "Routine step" && nv > 1) {
          if (lab == "") print where ": \"" v "\" needs a preset label, e.g. \"" v " (3 darts)\""
        } else if (lab != "") print where ": unexpected label \"(" lab ")\" on \"" v "\""
      }
      if (rule[a] == "primary" && nprim != 1) print where ": " a " needs exactly one (primary) value, found " nprim
      if (rule[a] == "one" && nv > 1 && blk != "Routine step") print where ": " a " takes exactly one value"
      if (excl[a] != "" && excl[a] != "—" && (excl[a] in seen) && nv > 1) print where ": " excl[a] " cannot be combined with another " a " value"
    }
    for (k = 1; k <= n; k++) if (!(expect[k] in got)) print where ": missing axis \"" expect[k] "\""
  }
    ' "$TAGS_FILE" "$file")
  }

  ```
  The awk body must contain no single quote (it is a single-quoted bash string).

  f. `shapes_for`: prefix each pattern with `*` (`*docs/game-rules/rulesets/*`, `*docs/game-rules/training/exercises/*`, `*docs/game-rules/training/routines/*`, `*docs/game-rules/training/trivia/*`).
  g. Walk input: replace `done < <(git ls-files 'docs/game-rules/**/*.md' | sort)` with
  ```bash
  done < <(if [ "$#" -gt 0 ]; then printf '%s\n' "$@"; else git ls-files 'docs/game-rules/**/*.md' | sort; fi)
  ```
  h. Header comment: add one paragraph after the "Blocking by default" paragraph:
  ```bash
  # Tags sections are checked against docs/game-rules/TAGS.md (override with
  # GAME_RULES_TAGS). Path arguments check only those files, which is how
  # scripts/test-check-game-rules.sh aims it at fixtures.
  ```

- [ ] **Step 4: Run the test and the full gate**

Run: `bash scripts/test-check-game-rules.sh && bash scripts/check-game-rules.sh | tail -2`
Expected: `test-check-game-rules: 20 passed, 0 failed`; gate `79 file(s) checked … PASS`.

- [ ] **Step 5: Wire the test**
  - `.husky/pre-commit`: after `&& bash scripts/check-game-rules.sh \` add `&& bash scripts/test-check-game-rules.sh \`.
  - `.claude/skills/run-all-gates/SKILL.md`: after the `bash scripts/check-game-rules.sh` line in the command block add `bash scripts/test-check-game-rules.sh`; append to the `check-game-rules.sh` paragraph: ``It also checks each `## Tags` section against `docs/game-rules/TAGS.md`; `test-check-game-rules.sh` proves that check on fixtures. (2026-10-15, D461)``
  - `docs/architecture/00-File-Inventory.md:554`: in the gate row, after "Glossary → Features agreement." insert `` `## Tags` against `docs/game-rules/TAGS.md` (D461).`` Add a row below it:
    ```markdown
    | `scripts/test-check-game-rules.sh` | Fixture test for `check-game-rules.sh`'s Tags check: copies real rules files into a temp tree with valid and malformed Tags sections and asserts exit code and finding (2026-10-15, D461) | canonical |
    ```

- [ ] **Step 6: Verify registration gates**

Run: `bash scripts/check-context-map.sh && bash scripts/check-file-locations.sh && bash scripts/check-doc-links.sh`
Expected: PASS. (D461 is cited before Task 5 adds it; no gate checks citations, and Task 5 lands it on the same branch.)

- [ ] **Step 7: Commit**

```bash
git add scripts/check-game-rules.sh scripts/test-check-game-rules.sh .husky/pre-commit .claude/skills/run-all-gates/SKILL.md docs/architecture/00-File-Inventory.md
git commit -m "chore(gates): check Tags sections against TAGS.md, with fixture test"
```

---

### Task 3: Tag the 24 exercises

**Files:** Modify `docs/game-rules/training/exercises/*.md` (all except `README.md`).

**Interfaces:** Consumes Task 1 vocabulary and Task 2 gate.

- [ ] **Step 1: Draft the matrix first.** For each exercise read `## Identity`, `## Exercise type`, `## Objective`, `## Config & presets` (default preset) and `## How to practise`. Write one row per file in `tag-matrix.md` in the session scratchpad directory: file · Skill · Session role · Format · Difficulty · Mechanic · Pressure. Rubric:
  - **Skill primary** = what the objective rewards. Checkout/finishing exercises → CHECKOUT; doubles-only → DOUBLES; bull → BULL; score per visit → SCORING; target hopping → SWITCHING; singles/grouping → ACCURACY; hitting an exact total → CONTROL. Secondary = any other skill the default run needs.
  - **Session role**: WARM_UP for low-stakes loosening; BENCHMARK for a fixed test with a comparable score (fixed dart count or fixed target set); FINISHER for checkout pressure at the end; CORE for drills. Several allowed.
  - **Format**: exercises are SOLO unless their file describes a 1v1 (`Applies to` 1v1).
  - **Difficulty**: of the default preset only.
  - **Mechanic**: how a run moves (Task 1 meanings). Several allowed.
  - **Pressure**: from the fail rule of the default preset. NONE alone or any of PENALTY/SETBACK/RESET.
  - No Family row.
- [ ] **Step 2: Insert** each table directly after the `## Identity` section (before `## Exercise type`), as `## Tags` + blank line + table + blank line. Do not touch other lines.
- [ ] **Step 3: Verify**

Run: `bash scripts/check-game-rules.sh | tail -2 && grep -L '^## Tags' docs/game-rules/training/exercises/*.md`
Expected: PASS; grep lists only `README.md`.

- [ ] **Step 4: Commit**

```bash
git add docs/game-rules/training/exercises
git commit -m "docs(game-rules): tag all exercises"
```

---

### Task 4: Tag the 51 rulesets, Entry points fix, require Tags

**Files:** Modify `docs/game-rules/rulesets/*.md` (all except `README.md`), `scripts/check-game-rules.sh` (`shape_headings`), `scripts/test-check-game-rules.sh`.

- [ ] **Step 1: Entry points fix (spec §4.5)**
  - `121.md:4` → `Entry points: standalone, routine step`. Add Features row after the `Timed mode` row:
    ```markdown
    | Runs as a routine step (timed) | V2 | Single | Pinned by the 121 (timed) template as `121_V2` (`09-Training/01-Routines.md` §11, D360); a V2 session seats one player |
    ```
  - `score-training.md:4` → `Entry points: standalone, routine step`. Add Features row after `Timed session (minutes, default 5)`:
    ```markdown
    | Runs as a routine step (timed) | V1 | All | |
    ```
    and after the `## Config & presets` table add: `As a routine step the duration is the step's allocation and replaces this setting.`
  - Check every other ruleset against §11's list (`TUOD_V1`, `SCORE_TRAINING_V1`, `121_V2`, `AROUND_THE_CLOCK_V2`). `ten-up-one-down.md` and `around-the-clock.md` already carry it; any other mismatch gets the same fix.
- [ ] **Step 2: Draft the matrix** (append to the scratchpad matrix): file · Skill · Session role · Format · Difficulty · Mechanic · Pressure · Family · routine step y/n. Same rubric as Task 3, plus:
  - **Format**: from Features `Applies to` and the Players setting (Single → SOLO, 1v1 → ONE_V_ONE, 2+ → MULTIPLAYER; TEAMS only if the file describes sides). Exclude `Dropped` rows.
  - **Family**: STANDARD (league/competition: 501, cricket), PUB, REGIONAL (a named national or local tradition, e.g. English cricket), NOVELTY (themed: football, battleship). DolfDarts' category is only a hint (the host is blocked in this environment); the rules file wins.
  - **Routine step block** (4 games): Format SOLO; Difficulty labelled per seeded template. Pins:
    - `around-the-clock.md`: exactly the spec §4.3 example (Standalone + Routine step, `INTERMEDIATE (1 dart), ADVANCED (2 darts), EXPERT (3 darts)`, Pressure SETBACK in Routine step). Re-check Standalone Pressure against the default preset.
    - `ten-up-one-down.md`: Routine step Session role includes FINISHER (template "Finishing"); Skill CHECKOUT primary.
    - `121.md`: Skill CHECKOUT (primary), DOUBLES; Mechanic COUNTDOWN, LADDER.
    - `score-training.md`: Skill SCORING (primary); Mechanic ACCUMULATION; Pressure NONE.
- [ ] **Step 3: Insert** tables after `## Identity` (flat for standalone-only; `### Standalone` + `### Routine step` for the four).
- [ ] **Step 4: Failing test for the requirement** — append to `scripts/test-check-game-rules.sh` before the summary line:
```bash
# --- required ------------------------------------------------------------------
expect fail "exercise without Tags" "$(fixture $EX training/exercises no-tags <<< "")" 'missing section: ## Tags'
expect fail "game without Tags" "$(fixture $GAME rulesets no-tags <<< "")" 'missing section: ## Tags'
```
Run: `bash scripts/test-check-game-rules.sh` → Expected: 2 FAIL (Tags not required yet).
- [ ] **Step 5: Require it** — `shape_headings`: insert `Tags,` after `Identity,` in the `game)` and `exercise)` lines.
- [ ] **Step 6: Verify**

Run: `bash scripts/test-check-game-rules.sh && bash scripts/check-game-rules.sh | tail -2`
Expected: `22 passed, 0 failed`; `79 file(s) checked, 0 with findings … PASS`.

- [ ] **Step 7: Commit**

```bash
git add docs/game-rules/rulesets scripts/check-game-rules.sh scripts/test-check-game-rules.sh
git commit -m "docs(game-rules): tag all rulesets, mark 121 and Score Training routine-eligible, require Tags"
```

---

### Task 5: Decision, maintenance, gates, PR

**Files:** Modify `decisions/context-system.md`.

- [ ] **Step 1: Id** — `bash scripts/next-decision-id.sh` (expect D461; if not, replace D461 everywhere in this branch).
- [ ] **Step 2: Append** to `decisions/context-system.md`:

```markdown
### D461 — Exercises and games carry tags from a fixed vocabulary in `docs/game-rules/TAGS.md`
Status: Accepted · Date: 2026-10-15
Decision: every exercise and ruleset file under `docs/game-rules/` has a required `## Tags` section after `## Identity`, drawn from `docs/game-rules/TAGS.md`: Skill (one primary, any secondary), Session role, Format, Difficulty, Mechanic, Pressure (NONE exclusive), and Family (rulesets only). A game whose `Entry points:` include `routine step` splits it into complete `### Standalone` and `### Routine step` blocks; the latter has no Family and may label Difficulty per preset. Routines and trivia carry no tags. `scripts/check-game-rules.sh` parses `TAGS.md` and enforces the section; `scripts/test-check-game-rules.sh` proves it on fixtures. `121.md` and `score-training.md` gain `routine step`, matching `09-Training/01-Routines.md` §11. Spec: `docs/superpowers/specs/2026-10-15-training-tags-design.md`.
Reason: weekly plans with a focus per day, and routines that cover every part of the game, need items grouped by what they train. DolfDarts' axes were the start: Category kept as Family minus Team and Training, Mechanic kept minus Training and Party plus LADDER/THRESHOLD/FIXED_COUNT, Difficulty kept, Players became Format, Time dropped (step duration already owns it); Skill, Session role and Pressure added. A fixed vocabulary keeps a later seed lossless.
Consequences: tags are informational; nothing reads them. Deferred: database lookup and link tables seeded from the rules files, template-level overrides (replacing labelled Difficulty), derived routine profiles and week balance, tag filters in the routine builder and `/training`, a focus per schedule day, tags on routines and trivia. A new value or axis is a `TAGS.md` row plus a decision; a rename or removal supersedes this one and updates every rules file in the same change.
Supersedes: none
```

- [ ] **Step 3: Gates** — run `context-maintenance` skill, then `run-all-gates` skill (includes `check-decision-ids.sh`, `check-game-rules.sh`, `test-check-game-rules.sh`). Fix anything they flag that this change caused; file the rest as `discovered-work` issues.
- [ ] **Step 4: Commit**

```bash
git add decisions/context-system.md
git commit -m "docs(decisions): D461 training tags"
```

- [ ] **Step 5: Finish** — `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` (push + PR). PR body: summary, the deviation note above, and the review matrix from the scratchpad (75 rows: item · primary skill · session role · difficulty · routine step y/n), plus any discovered-work issue links.
