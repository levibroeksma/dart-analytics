# Track Kernel — PR 0 + PR 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the five rule-kernel families binding architecture (PR 0), then land the Track kernel with Doubles Training as its first engine (PR 1).

**Architecture:** PR 0 is docs plus scripts. It adds a canonical Pattern 18 subsection, a `Kernel:` header on every rules file, a registry that maps every engine to its kernel, and two gates that hold the docs and the code to that registry. PR 1 adds `track-kernel.module.ts` (a pure per-dart reducer driven by a `TrackRules` record of policy functions) and `track-policies.ts`. It then rebinds Doubles Training onto them behind a projection to the unchanged legacy state, proven equal by the differential oracle.

**Tech Stack:** TypeScript, Vitest, Bash gates, Markdown docs.

**Spec:** `docs/superpowers/specs/2026-10-17-track-kernel-design.md` (parent: `2026-10-15-rule-kernels-design.md`).

**Later PRs:** PRs 2–7 (Bob's 27, Singles Training, Around the Clock, Shanghai, Target Scoring, Switching Target Scoring) each get their own plan. Each is written after the previous PR merges, against the kernel as it actually landed. Spec §8 fixes their scope.

## Global Constraints

- Branch per PR. PR 0 is `chore/kernel-families-gates`, built on the spec branch `docs/track-kernel-spec`. PR 1 is `refactor/track-kernel-doubles`, branched from fresh `origin/main` only after PR 0 merges.
- Never `--no-verify`. The pre-commit hook runs every `check-*.sh`.
- Commit trailer on every commit:
  ```
  Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
  Claude-Session: https://claude.ai/code/session_017ishGxJ81EA5Sn8MYrA7Gg
  ```
- No exported `type`/`interface` in implementation files; they go in `types.ts`/`interfaces.ts` barrels (`check-type-barrels.sh`).
- No inline `//` comments inside function bodies (`check-no-inline-comments.sh`). Use JSDoc above functions.
- Fallow cognitive complexity ≤ 15 per function. Duplication count must not rise.
- `npm run check` (run in `app/`) ends with 0 errors, 0 warnings, 0 hints.
- Decision ids come from `bash scripts/next-decision-id.sh` at commit time, never hard-coded. This plan writes `D466`.
- Header field name is **`Kernel:`**, not "Family". `Family` is already a Tags axis (`docs/game-rules/TAGS.md`).
- Kernel values: `TRACK | CHECKOUT | VISIT_POINTS | MARKS | ELIMINATION | HAND_WRITTEN`.
- PR 1 is a refactor. `foldDoublesTrainingState`, `applyDoublesTrainingDart`, `initialDoublesTrainingState` and `state()` keep their signatures and output, and the existing Doubles tests and goldens pass with **no edits**.

## Spec refinements made by this plan

These are already applied to the spec, in the same commit as this plan:

1. The engine gate is a new script `scripts/check-engine-kernels.sh` reading a registry `scripts/engine-kernels.txt`. It is not a section of `check-game-engines.sh`, which only scans `modules/game/`, while the registry also covers the exercise engines. It is fixture-testable the same way `test-check-game-rules.sh` is.
2. `TrackRules` takes `target(seat)` in place of `path(seat)` plus `cycle`. Path walking is a policy (`pathTarget`), and cycling arrives with its first caller (PR 6).
3. The match outcome stays in each engine's fold for now. `TrackRules` gains an `outcome` member only when a second engine needs the same outcome code (PR 2 or later).
4. The formal `RuleKernel` interface from the umbrella spec is deferred until a second family exists. Track exposes functions. A type with a single implementer adds nothing.

## Review Focus

1. **A finished seat recorded into.** `applyDoublesTrainingDart` on a `COMPLETE` seat must throw the exact legacy message. Pinned in Task 1.2.
2. **A hit on the third dart.** `hitDartNumber` must be 3 and the visit closed. Pinned in Task 1.2.
3. **A BULL hit on the last target.** The seat goes `COMPLETE`, `targetIndex` stays 20 and `dartsThisVisit` is 0. Pinned in Task 1.2.
4. **A rules file with `Kernel:` on a routine or trivia shape.** It must fail, and the shape check must not crash. Pinned in Task 0.1 (fixture "routine with Kernel").
5. **A registry row whose engine file was deleted or renamed.** It must fail rather than be silently skipped. Pinned in Task 0.2.

---

# PR 0 — Kernel families are architecture

Branch: `git checkout -b chore/kernel-families-gates docs/track-kernel-spec`. PR 0 carries the spec and this plan, so they land with the architecture they describe. Merge `origin/main` into it first if `main` has moved.

### Task 0.1: `Kernel:` header on every rules file, plus its gate

**Files:**
- Modify: all 51 `docs/game-rules/rulesets/*.md` and 24 `docs/game-rules/training/exercises/*.md`
- Modify: `docs/game-rules/templates/GAME_RULESET_TEMPLATE.md`, `docs/game-rules/templates/EXERCISE_TEMPLATE.md`
- Modify: `.claude/skills/authoring-game-rules/SKILL.md`, `.claude/skills/authoring-game-rules/references/game.md`, `.claude/skills/authoring-game-rules/references/exercise.md`
- Modify: `scripts/check-game-rules.sh` (header-field block, after the `Entry points:` check at ~line 113)
- Modify: `scripts/test-check-game-rules.sh` (new cases before the final `echo`)

**Interfaces:**
- Produces: every `game`/`exercise` rules file has exactly one line `^Kernel: (TRACK|CHECKOUT|VISIT_POINTS|MARKS|ELIMINATION|HAND_WRITTEN)$`, and every `routine`/`trivia` file has none. Task 0.2's registry cross-checks these values.

Order matters. The existing 22 fixture cases copy real rules files, so the backfill (Steps 1–4) lands before the gate (Step 7), or every existing case breaks.

- [ ] **Step 1: Write the assignment table** to `/tmp/claude-0/-home-user-dart-analytics/2f7c0385-63e0-55cb-89fe-cecf5704b1ed/scratchpad/kernels.tsv` (scratch, not committed). One `<file stem>\t<KERNEL>` per line:

```
121	CHECKOUT
501	HAND_WRITTEN
ace	VISIT_POINTS
aces	HAND_WRITTEN
around-the-clock	TRACK
baseball-darts	TRACK
battleship-darts	HAND_WRITTEN
bingo-darts	HAND_WRITTEN
blackjack-darts	HAND_WRITTEN
bobs-27	TRACK
bowling-darts	VISIT_POINTS
bowls-darts	HAND_WRITTEN
brag	VISIT_POINTS
bull-500	VISIT_POINTS
castle	VISIT_POINTS
cricket	MARKS
dolf	VISIT_POINTS
doubles-training	TRACK
english-cricket	VISIT_POINTS
fives	VISIT_POINTS
follow-the-leader	ELIMINATION
football-darts	VISIT_POINTS
gold-hunt	VISIT_POINTS
golf-darts	VISIT_POINTS
gotcha	VISIT_POINTS
hare-and-hounds	ELIMINATION
high-and-low	VISIT_POINTS
indy-500	VISIT_POINTS
killer	ELIMINATION
knockout	VISIT_POINTS
lawn-darts-indoor	HAND_WRITTEN
mickey-mouse	MARKS
mulligan	MARKS
neighbours	MARKS
nine-lives	TRACK
noughts-and-crosses	HAND_WRITTEN
overs	VISIT_POINTS
poker-darts	HAND_WRITTEN
prisoner	ELIMINATION
score-training	VISIT_POINTS
scram	MARKS
shanghai	TRACK
shoot-out	MARKS
shove-hapenny	HAND_WRITTEN
singles-training	TRACK
snooker-darts	HAND_WRITTEN
steeplechase	TRACK
tactics	MARKS
ten-up-one-down	CHECKOUT
tennis-darts	HAND_WRITTEN
warfare	MARKS
170-practice	CHECKOUT
420	CHECKOUT
a1-routine	MARKS
bull-up-practice	HAND_WRITTEN
bullseye-500	VISIT_POINTS
bullseye-checkout	CHECKOUT
catch-40	CHECKOUT
doubles-lock	TRACK
doubles-snakes-and-ladders	TRACK
finishing-pyramid	CHECKOUT
frustration	CHECKOUT
halve-it	TRACK
halving-doubles	CHECKOUT
hit-count	TRACK
hubbe	CHECKOUT
jdc-challenge	TRACK
mikkos-megatrain	TRACK
nine-dart-century	VISIT_POINTS
random-checkout	CHECKOUT
score-threshold	VISIT_POINTS
switchblade	TRACK
switching-target-scoring	TRACK
target-scoring	TRACK
warm-up	HAND_WRITTEN
```

- [ ] **Step 2: Insert the header line** after `Entry points:` in each file:

```bash
cd /home/user/dart-analytics
while IFS=$'\t' read -r stem kernel; do
  f=$(ls docs/game-rules/rulesets/"$stem".md docs/game-rules/training/exercises/"$stem".md 2>/dev/null | head -1)
  [ -n "$f" ] || { echo "MISSING $stem"; continue; }
  sed -i "0,/^Entry points:.*/s//&\nKernel: $kernel/" "$f"
done < /tmp/claude-0/-home-user-dart-analytics/2f7c0385-63e0-55cb-89fe-cecf5704b1ed/scratchpad/kernels.tsv
grep -L '^Kernel:' docs/game-rules/rulesets/*.md docs/game-rules/training/exercises/*.md
```

Expected: no `MISSING` lines and no files listed by `grep -L`. Then confirm that `bash scripts/check-game-rules.sh && bash scripts/test-check-game-rules.sh` still pass (`22 passed`): the gate ignores the unknown line for now.

- [ ] **Step 3: Update the templates.** In `GAME_RULESET_TEMPLATE.md`, change the header block under "Ruleset sections" to:

```
Current version: none (V1 in design)
Entry points: standalone
Kernel: TRACK
```

Add this bullet to the author-guidance list above it (next to the `## Tags` bullet):

```
- `Kernel:` names the rule-kernel family the engine will be built on —
  `TRACK`, `CHECKOUT`, `VISIT_POINTS`, `MARKS`, `ELIMINATION` or
  `HAND_WRITTEN` (Pattern 18 §Rule-kernel families). It is not the `Family`
  Tags axis. Pick it with the kernel-config questions in
  `.claude/skills/authoring-game-rules/SKILL.md` Step 1.
```

Make the same two edits in `EXERCISE_TEMPLATE.md`, using `Entry points: routine step` as its existing value.

- [ ] **Step 4: Update the skill.**
  - In `SKILL.md`'s Step 1 axes table, add the row `| Kernel | **TRACK** · **CHECKOUT** · **VISIT_POINTS** · **MARKS** · **ELIMINATION** · **HAND_WRITTEN** — the family the engine will use (Pattern 18 §Rule-kernel families); a game needing more than two new kernel settings is HAND_WRITTEN |`.
  - In `references/game.md` and `references/exercise.md` § Header fields, add `Kernel: TRACK` to the code block, plus the line: "`Kernel:` is required on a game or exercise and absent on a routine or trivia tool; `check-game-rules.sh` rejects any other value."

- [ ] **Step 5: Write the failing fixture cases.** Append before `echo "test-check-game-rules: ..."` in `scripts/test-check-game-rules.sh`:

```bash
# --- Kernel header -------------------------------------------------------------
# kfixture <source> <shape folder> <name> <sed expression> : copy with an edit.
kfixture() {
  local dir="$TMP/docs/game-rules/$2" out
  out="$dir/$3.md"
  mkdir -p "$dir"
  sed -E "$4" "$ROOT/$1" > "$out"
  echo "$out"
}
expect fail "game missing Kernel" "$(kfixture $GAME rulesets k-missing '/^Kernel:/d')" \
  "no 'Kernel:' header field"
expect fail "exercise with unknown Kernel" "$(kfixture $EX training/exercises k-bad 's/^Kernel: .*/Kernel: TRAK/')" \
  "'Kernel:' does not parse: TRAK"
expect fail "routine with Kernel" "$(kfixture $ROUTINE training/routines k-routine 's/^(Current version:.*)$/\1\nKernel: TRACK/')" \
  "'Kernel:' is not used by a routine"
expect pass "game with Kernel" "$(kfixture $GAME rulesets k-ok 's/^$/&/')"
```

- [ ] **Step 6: Run the fixtures and confirm they fail.**

Run: `bash scripts/test-check-game-rules.sh`
Expected: `23 passed, 3 failed`. The failures are "game missing Kernel", "exercise with unknown Kernel" and "routine with Kernel", because the gate does not check `Kernel:` yet.

- [ ] **Step 7: Implement the check.** In `scripts/check-game-rules.sh`, directly after the `fi` that closes the `Entry points:` block (the line after `note "'Entry points:' is not used by a $shape (standalone by definition)"`'s `fi`), insert:

```bash
  # 6b. Kernel header (rule-kernel family; Pattern 18)
  if shape_has_entry "$shape"; then
    local kl
    kl="$(grep -m1 '^Kernel:' "$file" || true)"
    if [ -z "$kl" ]; then
      note "no 'Kernel:' header field"
    elif ! grep -qE '^Kernel: (TRACK|CHECKOUT|VISIT_POINTS|MARKS|ELIMINATION|HAND_WRITTEN)$' <<< "$kl"; then
      note "'Kernel:' does not parse: ${kl#Kernel: }"
    fi
  elif grep -q '^Kernel:' "$file"; then
    note "'Kernel:' is not used by a $shape"
  fi
```

Also add `# kernel:   'Kernel:' header required exactly where 'Entry points:' is` to the shape-contract comment block at the top.

- [ ] **Step 8: Run the gates.**

Run: `bash scripts/check-game-rules.sh && bash scripts/test-check-game-rules.sh`
Expected: `check-game-rules: PASS` and `test-check-game-rules: 26 passed, 0 failed`.

- [ ] **Step 9: Commit.**

```bash
git add scripts/check-game-rules.sh scripts/test-check-game-rules.sh docs/game-rules .claude/skills/authoring-game-rules
git commit -m "chore(game-rules): require a Kernel header on every game and exercise"
```

### Task 0.2: Engine-kernel registry plus gate plus fixture tests

**Files:**
- Create: `scripts/engine-kernels.txt`
- Create: `scripts/check-engine-kernels.sh`
- Create: `scripts/test-check-engine-kernels.sh`
- Modify: `.husky/pre-commit` (after `check-game-engines.sh`), `.github/workflows/quality.yml` (step after "Game-engine contract gate")

**Interfaces:**
- Consumes: the `Kernel:` lines from Task 0.1.
- Produces:
  - Registry row format: `<engine path> | <KERNEL> | <KERNEL_BOUND|PENDING|HAND_WRITTEN> | <rules file or -> | <reason>`.
  - A `KERNEL_BOUND` engine must import `./<kernel-slug>-kernel.module` (slug = lower-case kernel with `_`→`-`, e.g. `track-kernel.module`).
  - PR 1 flips the Doubles row to `KERNEL_BOUND`.

- [ ] **Step 1: Write the registry** `scripts/engine-kernels.txt`:

```
# Engine → rule-kernel registry (Pattern 18 §Rule-kernel families; D466).
# <engine path> | <KERNEL> | <KERNEL_BOUND|PENDING|HAND_WRITTEN> | <rules file or -> | <reason>
# KERNEL_BOUND: imports ./<kernel>-kernel.module. PENDING: migrates later, reason names the plan.
# HAND_WRITTEN: kernel column is HAND_WRITTEN, reason says why. Gate: scripts/check-engine-kernels.sh.
app/src/modules/game/around-the-clock.engine.module.ts | TRACK | PENDING | docs/game-rules/rulesets/around-the-clock.md | Track PR 4
app/src/modules/game/bobs27.engine.module.ts | TRACK | PENDING | docs/game-rules/rulesets/bobs-27.md | Track PR 2
app/src/modules/game/cricket.engine.module.ts | MARKS | PENDING | docs/game-rules/rulesets/cricket.md | Marks family plan
app/src/modules/game/doubles-training.engine.module.ts | TRACK | PENDING | docs/game-rules/rulesets/doubles-training.md | Track PR 1
app/src/modules/game/five-oh-one.engine.module.ts | HAND_WRITTEN | HAND_WRITTEN | docs/game-rules/rulesets/501.md | sets/legs match format (umbrella spec §5)
app/src/modules/game/one-twenty-one.engine.module.ts | CHECKOUT | PENDING | docs/game-rules/rulesets/121.md | Checkout family plan
app/src/modules/game/score-training.engine.module.ts | VISIT_POINTS | PENDING | docs/game-rules/rulesets/score-training.md | Visit-points family plan
app/src/modules/game/shanghai.engine.module.ts | TRACK | PENDING | docs/game-rules/rulesets/shanghai.md | Track PR 5
app/src/modules/game/singles-training.engine.module.ts | TRACK | PENDING | docs/game-rules/rulesets/singles-training.md | Track PR 3
app/src/modules/game/tactics.engine.module.ts | MARKS | PENDING | docs/game-rules/rulesets/tactics.md | Marks family plan
app/src/modules/game/tuod.engine.module.ts | CHECKOUT | PENDING | docs/game-rules/rulesets/ten-up-one-down.md | Checkout family plan
app/src/modules/training/exercises/bull-up.engine.module.ts | HAND_WRITTEN | HAND_WRITTEN | docs/game-rules/training/exercises/bull-up-practice.md | single target, counting only; a kernel adds nothing (Track spec §5)
app/src/modules/training/exercises/bullseye-checkout.engine.module.ts | CHECKOUT | PENDING | docs/game-rules/training/exercises/bullseye-checkout.md | Checkout family plan
app/src/modules/training/exercises/checkout-sequence.engine.module.ts | CHECKOUT | PENDING | docs/game-rules/training/exercises/catch-40.md | Checkout family plan
app/src/modules/training/exercises/double-pattern.engine.module.ts | TRACK | PENDING | - | re-checked when its exercise shell is next touched (Track spec §5)
app/src/modules/training/exercises/random-checkout.engine.module.ts | CHECKOUT | PENDING | docs/game-rules/training/exercises/random-checkout.md | Checkout family plan
app/src/modules/training/exercises/score-threshold.engine.module.ts | VISIT_POINTS | PENDING | docs/game-rules/training/exercises/score-threshold.md | Visit-points family plan
app/src/modules/training/exercises/switching-target-scoring.engine.module.ts | TRACK | PENDING | docs/game-rules/training/exercises/switching-target-scoring.md | Track PR 7
app/src/modules/training/exercises/switching.engine.module.ts | TRACK | PENDING | - | re-checked when its exercise shell is next touched (Track spec §5)
app/src/modules/training/exercises/target-scoring.engine.module.ts | TRACK | PENDING | docs/game-rules/training/exercises/target-scoring.md | Track PR 6
app/src/modules/training/exercises/warm-up.engine.module.ts | HAND_WRITTEN | HAND_WRITTEN | docs/game-rules/training/exercises/warm-up.md | timed, dartless ExerciseEngine (umbrella spec §5)
```

Verify the Checkout Sequence rules file is `catch-40.md` with `grep -l "CHECKOUT_SEQUENCE" docs/game-rules/training/exercises/*.md`. If it isn't, use the file that grep prints.

- [ ] **Step 2: Write the failing fixture test** `scripts/test-check-engine-kernels.sh`:

```bash
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
```

- [ ] **Step 3: Run it and confirm it fails.**

Run: `bash scripts/test-check-engine-kernels.sh`
Expected: every case FAILs (the gate script does not exist), giving `0 passed, 10 failed`.

- [ ] **Step 4: Write the gate** `scripts/check-engine-kernels.sh`:

```bash
#!/usr/bin/env bash
# Rule-kernel family gate (Pattern 18 §Rule-kernel families; D466).
# Every *.engine.module.ts under app/src/modules/game and
# app/src/modules/training/exercises is listed exactly once in
# scripts/engine-kernels.txt, and its row is true of the code and the docs:
#   KERNEL_BOUND  -> the file imports ./<kernel>-kernel.module
#   PENDING       -> the file imports no *-kernel.module (else the row is stale)
#   HAND_WRITTEN  -> kernel column HAND_WRITTEN, imports no *-kernel.module
#   rules file    -> '-' or a file whose 'Kernel:' header equals the kernel
# ENGINE_KERNELS_ROOT / ENGINE_KERNELS_FILE override paths for fixtures.
#
# WHAT THIS CANNOT CATCH: that a KERNEL_BOUND engine routes its rules through
# the kernel rather than merely importing it; the oracle and goldens own that.
set -u
ROOT="${ENGINE_KERNELS_ROOT:-$(git rev-parse --show-toplevel 2>/dev/null || echo .)}"
REG="${ENGINE_KERNELS_FILE:-$ROOT/scripts/engine-kernels.txt}"
cd "$ROOT"
FAIL=0
KERNELS="TRACK CHECKOUT VISIT_POINTS MARKS ELIMINATION HAND_WRITTEN"

fail() { echo "FAIL: $1" >&2; FAIL=1; }
trim() { sed -E 's/^[[:space:]]+|[[:space:]]+$//g' <<< "$1"; }

[ -f "$REG" ] || { echo "FAIL: registry $REG not found" >&2; exit 1; }
ROWS="$(grep -vE '^[[:space:]]*(#|$)' "$REG" || true)"
LISTED="$(cut -d'|' -f1 <<< "$ROWS" | sed -E 's/[[:space:]]+$//')"

for file in $(find app/src/modules/game app/src/modules/training/exercises -maxdepth 1 -name '*.engine.module.ts' 2>/dev/null | sort); do
  grep -qxF "$file" <<< "$LISTED" || fail "$file is not listed in $REG"
done

COUNT=0
while IFS='|' read -r path kernel status rules reason; do
  path="$(trim "$path")"; kernel="$(trim "$kernel")"; status="$(trim "$status")"
  rules="$(trim "$rules")"; reason="$(trim "$reason")"
  [ -n "$path" ] || continue
  COUNT=$((COUNT + 1))
  [ -f "$path" ] || { fail "$path does not exist (registry row is stale)"; continue; }
  grep -qw -- "$kernel" <<< "$KERNELS" || { fail "$path: unknown kernel $kernel"; continue; }
  imports_kernel=0
  grep -qE "from \"\./[a-z-]+-kernel\.module\"" "$path" && imports_kernel=1
  case "$status" in
    KERNEL_BOUND)
      slug="$(tr 'A-Z_' 'a-z-' <<< "$kernel")"
      grep -qF "from \"./${slug}-kernel.module\"" "$path" || fail "$path is KERNEL_BOUND but does not import ./${slug}-kernel.module" ;;
    PENDING)
      [ -n "$reason" ] || fail "$path: PENDING needs a reason"
      [ "$imports_kernel" -eq 0 ] || fail "$path imports a kernel but is marked PENDING; flip it to KERNEL_BOUND" ;;
    HAND_WRITTEN)
      [ "$kernel" = HAND_WRITTEN ] || fail "$path: HAND_WRITTEN status needs kernel HAND_WRITTEN"
      [ -n "$reason" ] || fail "$path: HAND_WRITTEN needs a reason"
      [ "$imports_kernel" -eq 0 ] || fail "$path is HAND_WRITTEN but imports a kernel" ;;
    *) fail "$path: unknown status $status" ;;
  esac
  if [ "$rules" != "-" ]; then
    if [ ! -f "$rules" ]; then
      fail "$path: rules file $rules does not exist"
    else
      declared="$(grep -m1 '^Kernel:' "$rules" | sed 's/^Kernel: //')"
      [ "$declared" = "$kernel" ] || fail "$path: registry says $kernel but $rules says Kernel: ${declared:-<none>}"
    fi
  fi
done <<< "$ROWS"

[ "$FAIL" -eq 0 ] && echo "OK: engine kernels — $COUNT engine(s) match $REG, their imports and their rules files."
exit $FAIL
```

- [ ] **Step 5: Run the fixtures, then the real tree.**

Run: `bash scripts/test-check-engine-kernels.sh && bash scripts/check-engine-kernels.sh`
Expected: `test-check-engine-kernels: 10 passed, 0 failed` and `OK: engine kernels — 21 engine(s) match ...`.

- [ ] **Step 6: Wire the gate in.**
  - In `.husky/pre-commit`, after `&& bash scripts/check-game-engines.sh \`, add:
    ```
           && bash scripts/check-engine-kernels.sh \
           && bash scripts/test-check-engine-kernels.sh \
    ```
  - In `.github/workflows/quality.yml`, after the "Game-engine contract gate" step, add:
    ```yaml
          - name: Engine-kernel family gate
            run: bash scripts/check-engine-kernels.sh && bash scripts/test-check-engine-kernels.sh
    ```

- [ ] **Step 7: Commit.**

```bash
chmod +x scripts/check-engine-kernels.sh scripts/test-check-engine-kernels.sh
git add scripts/engine-kernels.txt scripts/check-engine-kernels.sh scripts/test-check-engine-kernels.sh .husky/pre-commit .github/workflows/quality.yml
git commit -m "chore(scripts): gate every engine on its rule-kernel family"
```

### Task 0.3: Canonical Pattern 18 subsection plus mirrors

**Files:**
- Modify: `docs/architecture/04-Architecture-patterns.md` (version line ~10; Pattern 18 `## Application`, after the D462 shell paragraph ~line 818; `## Rule`)
- Modify: `app/src/modules/game/CLAUDE.md`, `app/src/modules/training/CLAUDE.md`
- Modify: `docs/architecture/07-Frontend/09-Adding-A-Game.md` (before "## The touch list")
- Modify: `docs/architecture/00-File-Inventory.md` (rows for the three new scripts and the registry, next to the `check-game-engines.sh` row at ~line 256; the `04-Architecture-patterns.md` row's summary)

- [ ] **Step 1: Add the subsection** after the D462 shell paragraph in Pattern 18 `## Application`:

```markdown
### Rule-kernel families <!-- 2026-10-17, D466 -->

A dart engine is three layers: an **L1 rule kernel** (pure; everything a
ruleset decides), the **L2 engine shell** above, and an **L3 game
definition** (rulesetVersionKey + Zod config → the kernel's rules). Every
game and exercise engine belongs to exactly one family, or is a named
hand-written opt-out:

| Kernel | Decides | Kernel module | Status |
| --- | --- | --- | --- |
| `TRACK` | walk a target path; hit test, points, visit judgement, seat end | `modules/game/track-kernel.module.ts` | designated, kernel pending |
| `CHECKOUT` | finish a target score under bust rules; attempt budget; ladder moves | `checkout-kernel.module.ts` | designated, kernel pending |
| `VISIT_POINTS` | points from a visit's darts; goal, bust, void, compare | `visit-points-kernel.module.ts` | designated, kernel pending |
| `MARKS` | marks on categories; close order; closed-number scoring | `marks-kernel.module.ts` | designated, kernel pending |
| `ELIMINATION` | lives, cross-seat effects, last standing | `elimination-kernel.module.ts` | designated, kernel pending |
| `HAND_WRITTEN` | opt-out: 501 (match format), Warm-Up (dartless), Bull-Up (counting only), the simulations | — | — |

- `scripts/engine-kernels.txt` is the registry of every engine's kernel and
  status (`KERNEL_BOUND`, `PENDING`, `HAND_WRITTEN`).
  `scripts/check-engine-kernels.sh` holds it true against the code's imports
  and the rules files' `Kernel:` header. `scripts/check-game-rules.sh`
  requires that header on every game and exercise rules file.
- **Fit rule:** a game needing more than two new kernel settings is
  `HAND_WRITTEN`.
- **Changing a family** — adding one, or moving a game between families or
  to `HAND_WRITTEN` — takes a decision entry and an edit to this table. It is
  never done in code or a rules file alone.
- A kernel's rules are a record of named policy functions built per read
  from the configuration snapshot; nothing about them is stored.
```

- [ ] **Step 2: Add a `## Rule` bullet** after the D462 line "Where the shell fits, a new engine is a spec bound to it, not a hand-written class.":

```markdown
- Every engine belongs to one rule-kernel family or is `HAND_WRITTEN` (§Rule-kernel families); a family move needs a decision entry. (D466)
```

- [ ] **Step 3: Bump the version line** to `1.11.0 (Pattern 18: rule-kernel families are architecture — registry, two gates, Kernel: header 2026-10-17, D466; prior 1.10.0: Pattern 18: single-stage dart engines ...` and keep the rest of the existing line verbatim after `prior 1.10.0:`.

- [ ] **Step 4: Add the mirrors.**
  - `app/src/modules/game/CLAUDE.md` and `app/src/modules/training/CLAUDE.md`, one bullet each in their engine section: `- Every *.engine.module.ts has a row in scripts/engine-kernels.txt (its rule-kernel family and status); check-engine-kernels.sh fails a new engine without one. See 04-Architecture-patterns.md Pattern 18 §Rule-kernel families (D466).`
  - `09-Adding-A-Game.md`, a new section before "## The touch list":

```markdown
## Pick the kernel first

Before any file below: the rules file's `Kernel:` header names the game's
rule-kernel family (`04-Architecture-patterns.md` Pattern 18 §Rule-kernel
families), and the engine gets a row in `scripts/engine-kernels.txt`. A
game whose family has a built kernel is a kernel-config mapper, not a
hand-written reducer. `HAND_WRITTEN` needs the fit rule's justification.
```

  - Update the `updated:` front-matter of `09-Adding-A-Game.md` to `2026-10-17`.
  - `00-File-Inventory.md`, three rows after the `check-game-engines.sh` row:

```
| `scripts/engine-kernels.txt` | Registry: every engine's rule-kernel family, status, rules file (Pattern 18 §Rule-kernel families, D466, 2026-10-17) | canonical |
| `scripts/check-engine-kernels.sh` | Guard: the registry lists every engine and matches its kernel import and its rules file's `Kernel:` header (D466, 2026-10-17) | canonical |
| `scripts/test-check-engine-kernels.sh` | Fixture test for `check-engine-kernels.sh` (D466, 2026-10-17) | canonical |
```

  Append `; rule-kernel families subsection (D466, 2026-10-17)` to the `04-Architecture-patterns.md` row's summary.

- [ ] **Step 5: Run the doc gates.**

Run: `bash scripts/check-doc-links.sh && bash scripts/check-doc-sync.sh 2>/dev/null; bash scripts/check-context-budget.sh`
Expected: OK lines. If `check-doc-sync.sh` does not exist, skip it. Fix any broken link it reports.

### Task 0.4: Decision entry

**Files:**
- Modify: `decisions/game-engine.md` (append)

- [ ] **Step 1: Confirm the id.** Run `bash scripts/next-decision-id.sh`. It must print `D466` (see Global Constraints).

- [ ] **Step 2: Append:**

```markdown
### D466 — Rule-kernel families are architecture, enforced by registry and gates
Status: Accepted · Date: 2026-10-17
Decision: every game and exercise engine belongs to one rule-kernel family — TRACK, CHECKOUT, VISIT_POINTS, MARKS, ELIMINATION — or is HAND_WRITTEN. The canonical statement is Pattern 18 §Rule-kernel families. `scripts/engine-kernels.txt` lists every engine with its kernel and status (KERNEL_BOUND, PENDING, HAND_WRITTEN); `scripts/check-engine-kernels.sh` fails an unlisted engine, a stale row, a KERNEL_BOUND engine without its kernel import, and a row that disagrees with the rules file's new `Kernel:` header, which `scripts/check-game-rules.sh` requires on every game and exercise. Adding a family or moving a game between families takes a decision entry.
Reason: the families were a spec-level plan (`docs/superpowers/specs/2026-10-15-rule-kernels-design.md`, `2026-10-17-track-kernel-design.md`); specs are non-canonical, so nothing stopped a new engine from bypassing them. A registry plus two gates makes the placement checkable at commit time, and the `Kernel:` header puts it in front of whoever authors the rules, before any spec.
Consequences: a new engine cannot land without a registry row; each kernel migration PR flips its row from PENDING to KERNEL_BOUND. The header is `Kernel:`, not `Family:`, because `Family` is already a Tags axis. Initial assignments follow the umbrella spec §5 as amended by the Track spec §5 (Prisoner, Hare and Hounds → ELIMINATION; Neighbours, A1 Routine → MARKS; Bullseye 500, Golf, DOLF → VISIT_POINTS; Bullseye Checkout → CHECKOUT; Bull-Up → HAND_WRITTEN).
Supersedes: none.
```

- [ ] **Step 3: Run** `bash scripts/check-decision-ids.sh`. Expected: OK.

- [ ] **Step 4: Commit Tasks 0.3 and 0.4 together.**

```bash
git add docs/architecture decisions/game-engine.md app/src/modules/game/CLAUDE.md app/src/modules/training/CLAUDE.md scripts
git commit -m "docs(architecture): rule-kernel families are canonical in Pattern 18 (D466)"
```

### Task 0.5: Spec refinements plus history row plus PR

**Files:**
- Modify (only if implementation diverged): `docs/superpowers/specs/2026-10-17-track-kernel-design.md`
- Modify: `docs/architecture/00-Context-Map-History.md` (append row, following its existing format)

- [ ] **Step 1: Check the spec** still matches the code as built. The refinements were applied with the plan; fix the spec only if implementation diverged.
- [ ] **Step 2: Append a history row** to `00-Context-Map-History.md`: `2026-10-17 | Pattern 18 §Rule-kernel families; engine-kernels registry + check-engine-kernels.sh; Kernel: header on rules files (D466)`, in that file's column format.
- [ ] **Step 3: Run all gates.** Use the `run-all-gates` skill. Every pre-commit script must pass, plus `cd app && npm test` (no app code changed; this is a sanity check).
- [ ] **Step 4: Commit, push, open the PR.** Follow `finishing-a-dart-branch`: push with `git push -u origin chore/kernel-families-gates`, then open the PR. The title is "Rule-kernel families are architecture (registry, gates, Kernel: header)". The body summarises the tasks and ends with the generated line plus the session link. Then subscribe to the PR's activity and drive it to green.

---

# PR 1 — Track kernel plus Doubles Training

Branch (after PR 0 merges): `git fetch origin main && git checkout -b refactor/track-kernel-doubles origin/main`

### Task 1.1: Freeze the legacy engine plus oracle (commit 1)

**Files:**
- Create: `app/tests/modules/game/legacy/doubles-training.legacy.ts`
- Create: `app/tests/modules/game/doubles-training.oracle.test.ts`

**Interfaces:**
- Consumes: `runOracle({ build, legacy, seeds, steps, undoRate, rehydrateEvery })` from `app/tests/modules/game/support/engine-oracle.ts`.
- Produces: `LegacyDoublesTrainingEngine` (test-only; deleted in Task 1.4).

- [ ] **Step 1: Copy the module.** `cp app/src/modules/game/doubles-training.engine.module.ts app/tests/modules/game/legacy/doubles-training.legacy.ts`. In the copy:
  - Rewrite every `./x` import as `@modules/game/x`.
  - Delete `export const doublesTrainingEngineFactory = ...` and the `registerEngineFactory(...)` call, along with the now-unused imports `registerEngineFactory` and `dartGameEngineFactory`.
  - Rename the class to `LegacyDoublesTrainingEngine`.
  - Remove `export` from every function except the class.

- [ ] **Step 2: Write the oracle test** `app/tests/modules/game/doubles-training.oracle.test.ts`:

```ts
import { describe, it, vi, beforeEach, afterEach } from "vitest";
import { DoublesTrainingEngine } from "@modules/game/doubles-training.engine.module";
import { LegacyDoublesTrainingEngine } from "./legacy/doubles-training.legacy";
import { runOracle } from "./support/engine-oracle";
import type { DoublesTrainingSnapshot, Seated } from "@lib/types";

const seat = (n: number, side: string) => ({
  participantRef: `participant-${n}`,
  displayName: `P${n}`,
  sideKey: side,
  participantTypeKey: "PLAYER" as const,
});
const LOW = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 25];
const config = (
  seats: number,
  targetOrder: number[] = LOW,
): Seated<DoublesTrainingSnapshot> => ({
  mode: "EASY",
  orderMode: "LOW_TO_HIGH",
  targetOrder,
  seats: Array.from({ length: seats }, (_, i) => seat(i + 1, "ABC"[i]!)),
});
const SEEDS = Array.from({ length: 40 }, (_, i) => i + 1);

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-11-01T10:00:00Z"));
});
afterEach(() => vi.useRealTimers());

describe("Doubles Training — kernel vs legacy oracle", () => {
  for (const [name, cfg] of [
    ["solo", config(1)],
    ["duo", config(2)],
    ["trio", config(3)],
    ["solo high-to-low", config(1, [...LOW].reverse())],
  ] as const) {
    it(`${name}: indistinguishable through every public method`, () => {
      runOracle({
        build: (prior) => new DoublesTrainingEngine(cfg, prior),
        legacy: (prior) => new LegacyDoublesTrainingEngine(cfg, prior),
        seeds: SEEDS,
        steps: 260,
        undoRate: 0.12,
        rehydrateEvery: 19,
      });
    });
  }
});
```

If `[...LOW].reverse()` with BULL first violates the snapshot's order schema, use the HIGH_TO_LOW order the engine test file uses at ~line 871 (copy its `targetOrder` array).

- [ ] **Step 3: Run it.** Run `cd app && npx vitest run tests/modules/game/doubles-training.oracle.test.ts`. Expected: PASS, since the engine and the legacy copy are still the same code.

- [ ] **Step 4: Commit.**

```bash
git add app/tests/modules/game/legacy app/tests/modules/game/doubles-training.oracle.test.ts
git commit -m "test(doubles-training): freeze legacy engine and add kernel oracle"
```

### Task 1.2: Track kernel plus first policies

**Files:**
- Modify: `app/src/modules/game/types.ts` (append near `BoardTarget`, ~line 408)
- Modify: `app/src/modules/game/interfaces.ts` (append after `DartGameEngineClass`)
- Create: `app/src/modules/game/track-kernel.module.ts`
- Create: `app/src/modules/game/track-policies.ts`
- Test: `app/tests/modules/game/track-kernel.module.test.ts`, `app/tests/modules/game/track-policies.test.ts`

**Interfaces:**
- Produces (types.ts):
  ```ts
  export type TrackStatus = "IN_PROGRESS" | "DONE" | "OUT";
  export type TrackSeat<TExt> = SeatState & {
    targetIndex: number;
    score: number;
    dartsThisVisit: number;
    hitsThisVisit: number;
    status: TrackStatus;
    ext: TExt;
  };
  export type JudgedDart = {
    observation: DartObservation;
    target: BoardTarget;
    hit: boolean;
    points: number;
  };
  ```
- Produces (interfaces.ts):
  ```ts
  /** One Track ruleset as named policies (Pattern 18 §Rule-kernel families). */
  export interface TrackRules<TExt> {
    readonly doneMessage: string;
    target(seat: TrackSeat<TExt>): BoardTarget;
    hit(target: BoardTarget, observation: DartObservation): boolean;
    points(target: BoardTarget, observation: DartObservation, hit: boolean): number;
    onDart?(seat: TrackSeat<TExt>, dart: JudgedDart): TrackSeat<TExt>;
    visitOpen(seat: TrackSeat<TExt>): boolean;
    onVisitClose?(seat: TrackSeat<TExt>): TrackSeat<TExt>;
  }
  ```
- Produces (track-kernel.module.ts):
  - `initialTrackSeat<TExt>(seat: SeatFact, ext: TExt): TrackSeat<TExt>`
  - `applyTrackDart<TExt>(seat: TrackSeat<TExt>, observation: DartObservation, rules: TrackRules<TExt>): TrackSeat<TExt>`
  - `foldTrackSeats<TExt>(turns: readonly TurnFact[], seats: readonly SeatFact[], initialExt: () => TExt, rules: TrackRules<TExt>): TrackSeat<TExt>[]`
- Produces (track-policies.ts):
  - `pathTarget<TExt>(path: readonly BoardTarget[]): (seat: TrackSeat<TExt>) => BoardTarget`
  - `noPoints(): number`
  - `closeOnHitOrAfter<TExt>(darts: number): (seat: TrackSeat<TExt>) => boolean`
  - `advanceToEnd<TExt>(lastIndex: number): (seat: TrackSeat<TExt>) => TrackSeat<TExt>`

- [ ] **Step 1: Write the failing kernel test** `app/tests/modules/game/track-kernel.module.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  applyTrackDart,
  foldTrackSeats,
  initialTrackSeat,
} from "@modules/game/track-kernel.module";
import type { TrackRules } from "@modules/game/interfaces";
import type { DartObservation, TrackSeat, TurnFact } from "@modules/game/types";

const SEAT = { participantRef: "p1", displayName: "P1", sideKey: "A", participantTypeKey: "PLAYER" as const };
const hitOn = (n: number): DartObservation => ({ hitTargetNumber: n, hitZoneKey: "OUTER_SINGLE", locationX: null, locationY: null });
const MISS: DartObservation = { hitTargetNumber: null, hitZoneKey: "MISS", locationX: null, locationY: null };

/** Toy ruleset: targets 1..3 as singles, 1 point per hit, 3-dart visits, advance per visit, log of closed visits. */
const toy: TrackRules<{ closed: number[] }> = {
  doneMessage: "done",
  target: (seat) => ({ kind: "NUMBER", number: seat.targetIndex + 1 }) as never,
  hit: (target, o) => o.hitTargetNumber === (target as unknown as { number: number }).number,
  points: (_t, _o, hit) => (hit ? 1 : 0),
  onDart: (seat, dart) => (dart.hit && seat.ext.closed.length === 0 ? { ...seat, ext: { closed: seat.ext.closed } } : seat),
  visitOpen: (seat) => seat.dartsThisVisit < 3,
  onVisitClose: (seat) => ({
    ...seat,
    targetIndex: seat.targetIndex + 1,
    status: seat.targetIndex === 2 ? "DONE" : seat.status,
    ext: { closed: [...seat.ext.closed, seat.hitsThisVisit] },
  }),
};
const fresh = (): TrackSeat<{ closed: number[] }> => initialTrackSeat(SEAT, { closed: [] });

describe("track kernel", () => {
  it("initialTrackSeat starts at index 0, zero counters, IN_PROGRESS", () => {
    expect(fresh()).toEqual({
      participantRef: "p1", sideKey: "A", targetIndex: 0, score: 0,
      dartsThisVisit: 0, hitsThisVisit: 0, status: "IN_PROGRESS", ext: { closed: [] },
    });
  });

  it("judges a dart: points into score, counters up, visit still open", () => {
    const s = applyTrackDart(fresh(), hitOn(1), toy);
    expect(s).toMatchObject({ score: 1, dartsThisVisit: 1, hitsThisVisit: 1, targetIndex: 0 });
  });

  it("closes the visit when visitOpen turns false: onVisitClose sees the counters, then they reset", () => {
    let s = fresh();
    for (const o of [hitOn(1), MISS, hitOn(1)]) s = applyTrackDart(s, o, toy);
    expect(s).toMatchObject({ targetIndex: 1, dartsThisVisit: 0, hitsThisVisit: 0, score: 2, ext: { closed: [2] } });
  });

  it("onDart runs before visitOpen is read", () => {
    const seen: number[] = [];
    const rules = {
      ...toy,
      onDart: (seat: TrackSeat<{ closed: number[] }>) => {
        seen.push(seat.dartsThisVisit);
        return seat;
      },
    };
    applyTrackDart(fresh(), MISS, rules);
    expect(seen).toEqual([1]);
  });

  it("throws doneMessage on a seat that is not IN_PROGRESS", () => {
    expect(() => applyTrackDart({ ...fresh(), status: "DONE" }, MISS, toy)).toThrow("done");
    expect(() => applyTrackDart({ ...fresh(), status: "OUT" }, MISS, toy)).toThrow("done");
  });

  it("foldTrackSeats folds each seat only over its own turns", () => {
    const turn = (ref: string, darts: DartObservation[]): TurnFact =>
      ({ participantRef: ref, darts: darts.map((d) => ({ ...d })) }) as unknown as TurnFact;
    const seats = foldTrackSeats(
      [turn("p1", [hitOn(1), MISS, MISS]), turn("p2", [MISS])],
      [SEAT, { ...SEAT, participantRef: "p2", sideKey: "B" }],
      () => ({ closed: [] }),
      toy,
    );
    expect(seats.map((s) => [s.targetIndex, s.dartsThisVisit])).toEqual([[1, 0], [0, 1]]);
  });
});
```

Before writing the toy `target`/`hit`, check the real `BoardTarget` shape at `app/src/modules/game/types.ts:408`. Replace the `as never` casts with a real `BoardTarget` value and `isHitOn` from `board-progression.module` if that type-checks cleanly. Prefer real types over casts, since `npm run check` must report 0 hints.

- [ ] **Step 2: Run it.** `cd app && npx vitest run tests/modules/game/track-kernel.module.test.ts`. Expected: FAIL, "Cannot find module '@modules/game/track-kernel.module'".

- [ ] **Step 3: Add the types** to `types.ts` and the interface to `interfaces.ts`, exactly as given under Interfaces above. Import `BoardTarget`, `DartObservation`, `JudgedDart` and `TrackSeat` into `interfaces.ts` from `./types`, following the file's existing import style.

- [ ] **Step 4: Write** `app/src/modules/game/track-kernel.module.ts`:

```ts
import type { SeatFact } from "@lib/types";
import type { TrackRules } from "./interfaces";
import { foldSeatStates } from "./seat-state.module";
import type {
  DartObservation,
  JudgedDart,
  TrackSeat,
  TurnFact,
} from "./types";

/** A Track seat before its first dart: first target, zero counters, `ext` as given. */
export function initialTrackSeat<TExt>(seat: SeatFact, ext: TExt): TrackSeat<TExt> {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: 0,
    score: 0,
    dartsThisVisit: 0,
    hitsThisVisit: 0,
    status: "IN_PROGRESS",
    ext,
  };
}

/**
 * The Track kernel's one reducer (Pattern 18 §Rule-kernel families): judge
 * the dart against the seat's target, add its points, run `onDart`, and when
 * `visitOpen` turns false run `onVisitClose` and reset the visit counters.
 * Every rule a ruleset makes lives in `rules`; this function branches only
 * on the visit boundary.
 * @throws `rules.doneMessage` when the seat is not `IN_PROGRESS`.
 */
export function applyTrackDart<TExt>(
  seat: TrackSeat<TExt>,
  observation: DartObservation,
  rules: TrackRules<TExt>,
): TrackSeat<TExt> {
  if (seat.status !== "IN_PROGRESS") throw new Error(rules.doneMessage);
  const target = rules.target(seat);
  const hit = rules.hit(target, observation);
  const dart: JudgedDart = {
    observation,
    target,
    hit,
    points: rules.points(target, observation, hit),
  };
  const judged: TrackSeat<TExt> = {
    ...seat,
    score: seat.score + dart.points,
    dartsThisVisit: seat.dartsThisVisit + 1,
    hitsThisVisit: seat.hitsThisVisit + (hit ? 1 : 0),
  };
  const afterDart = rules.onDart ? rules.onDart(judged, dart) : judged;
  if (rules.visitOpen(afterDart)) return afterDart;
  const closed = rules.onVisitClose ? rules.onVisitClose(afterDart) : afterDart;
  return { ...closed, dartsThisVisit: 0, hitsThisVisit: 0 };
}

/** Folds every seat over its own darts through `applyTrackDart`; nothing is stored. */
export function foldTrackSeats<TExt>(
  turns: readonly TurnFact[],
  seats: readonly SeatFact[],
  initialExt: () => TExt,
  rules: TrackRules<TExt>,
): TrackSeat<TExt>[] {
  return foldSeatStates(
    turns,
    seats,
    (seat) => initialTrackSeat(seat, initialExt()),
    (state, observation) => applyTrackDart(state, observation, rules),
  );
}
```

- [ ] **Step 5: Run the kernel test.** Expected: PASS (6 tests).

- [ ] **Step 6: Write the failing policy test** `app/tests/modules/game/track-policies.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  advanceToEnd,
  closeOnHitOrAfter,
  noPoints,
  pathTarget,
} from "@modules/game/track-policies";
import { initialTrackSeat } from "@modules/game/track-kernel.module";
import { doublesPath, targetAt } from "@modules/game/board-progression.module";

const SEAT = { participantRef: "p1", displayName: "P1", sideKey: "A", participantTypeKey: "PLAYER" as const };
const seat = (over: object = {}) => ({ ...initialTrackSeat(SEAT, null), ...over });

describe("track policies", () => {
  it("pathTarget reads the path at targetIndex", () => {
    const path = doublesPath();
    expect(pathTarget(path)(seat({ targetIndex: 4 }))).toEqual(targetAt(path, 4));
  });
  it("noPoints is always 0", () => {
    expect(noPoints()).toBe(0);
  });
  it("closeOnHitOrAfter(3): open until a hit or the third dart", () => {
    const open = closeOnHitOrAfter(3);
    expect(open(seat({ dartsThisVisit: 2, hitsThisVisit: 0 }))).toBe(true);
    expect(open(seat({ dartsThisVisit: 1, hitsThisVisit: 1 }))).toBe(false);
    expect(open(seat({ dartsThisVisit: 3, hitsThisVisit: 0 }))).toBe(false);
  });
  it("advanceToEnd(20): next target, or DONE in place at the last index", () => {
    const advance = advanceToEnd(20);
    expect(advance(seat({ targetIndex: 5 }))).toMatchObject({ targetIndex: 6, status: "IN_PROGRESS" });
    expect(advance(seat({ targetIndex: 20 }))).toMatchObject({ targetIndex: 20, status: "DONE" });
  });
});
```

- [ ] **Step 7: Run it.** Expected: FAIL (module missing).

- [ ] **Step 8: Write** `app/src/modules/game/track-policies.ts`:

```ts
import { targetAt } from "./board-progression.module";
import type { BoardTarget, TrackSeat } from "./types";

/** Target policy: the path entry at the seat's `targetIndex`. */
export function pathTarget<TExt>(
  path: readonly BoardTarget[],
): (seat: TrackSeat<TExt>) => BoardTarget {
  return (seat) => targetAt(path, seat.targetIndex);
}

/** Points policy for rulesets that score nothing per dart. */
export function noPoints(): number {
  return 0;
}

/** Visit policy: open until a dart hits or `darts` darts are thrown. */
export function closeOnHitOrAfter<TExt>(
  darts: number,
): (seat: TrackSeat<TExt>) => boolean {
  return (seat) => seat.hitsThisVisit === 0 && seat.dartsThisVisit < darts;
}

/** Visit-close policy: step to the next target, or finish (`DONE`, index kept) at `lastIndex`. */
export function advanceToEnd<TExt>(
  lastIndex: number,
): (seat: TrackSeat<TExt>) => TrackSeat<TExt> {
  return (seat) =>
    seat.targetIndex === lastIndex
      ? { ...seat, status: "DONE" }
      : { ...seat, targetIndex: seat.targetIndex + 1 };
}
```

If `targetAt`'s parameter type is a mutable array, widen it to `readonly BoardTarget[]` in `board-progression.module.ts`. That is the adjacent edit this task needs.

- [ ] **Step 9: Run both tests plus typecheck.** `cd app && npx vitest run tests/modules/game/track-kernel.module.test.ts tests/modules/game/track-policies.test.ts && npm run check`. Expected: PASS, and check ends `0 errors, 0 warnings, 0 hints`.

  Fallow will flag the kernel and policies as unused exports until Task 1.3. Do not commit until Task 1.3 is done; commit 2 covers Tasks 1.2 and 1.3.

### Task 1.3: Rebind Doubles Training onto the kernel (commit 2)

**Files:**
- Modify: `app/src/modules/game/doubles-training.engine.module.ts`
- Modify: `app/src/modules/game/types.ts` (add `DoublesTrackExt` next to `DoublesVisitOutcome`, ~line 119)
- Modify: `scripts/engine-kernels.txt` (Doubles row → `KERNEL_BOUND`)

**Interfaces:**
- Consumes: Task 1.2's exports.
- Produces: an unchanged public surface — `applyDoublesTrainingDart`, `initialDoublesTrainingState`, `foldDoublesTrainingState`, `DoublesTrainingEngine`, `doublesTrainingEngineFactory`.

- [ ] **Step 1: Add the ext type** to `types.ts`: `export type DoublesTrackExt = { outcomes: DoublesVisitOutcome[] };`

- [ ] **Step 2: Replace the reducer section** of `doubles-training.engine.module.ts`. Delete `resolveVisit` and the body of `applyDoublesTrainingDart`, and add the following. Keep `initialSeatState`, `initialDoublesTrainingState`, `toHitDartNumber`, `dartHitIntendedTarget`, `isVisitOpen`, the spec and the class as they are.

```ts
const COMPLETE_REFUSAL =
  "Cannot record a dart once the session is complete; undo first to correct it.";

/** Visit-close policy: log the visit's outcome (hit dart number, or a miss). */
function recordOutcome(
  seat: TrackSeat<DoublesTrackExt>,
): TrackSeat<DoublesTrackExt> {
  const hit = seat.hitsThisVisit > 0;
  const outcome: DoublesVisitOutcome = {
    targetIndex: seat.targetIndex,
    hit,
    hitDartNumber: hit ? toHitDartNumber(seat.dartsThisVisit) : null,
  };
  return { ...seat, ext: { outcomes: [...seat.ext.outcomes, outcome] } };
}

/** Doubles Training as Track policies: 21 doubles, a visit ends on a hit or 3 darts. */
function doublesRules(
  config: DoublesTrainingSnapshot,
): TrackRules<DoublesTrackExt> {
  const advance = advanceToEnd<DoublesTrackExt>(20);
  return {
    doneMessage: COMPLETE_REFUSAL,
    target: pathTarget(doublesPath(config.targetOrder)),
    hit: isHitOn,
    points: noPoints,
    visitOpen: closeOnHitOrAfter(3),
    onVisitClose: (seat) => advance(recordOutcome(seat)),
  };
}

function toTrackSeat(
  state: DoublesTrainingSeatState,
): TrackSeat<DoublesTrackExt> {
  return {
    participantRef: state.participantRef,
    sideKey: state.sideKey,
    targetIndex: state.targetIndex,
    score: 0,
    dartsThisVisit: state.dartsThisVisit,
    hitsThisVisit: 0,
    status: state.status === "COMPLETE" ? "DONE" : "IN_PROGRESS",
    ext: { outcomes: state.outcomes },
  };
}

function toDoublesSeat(
  seat: TrackSeat<DoublesTrackExt>,
): DoublesTrainingSeatState {
  return {
    participantRef: seat.participantRef,
    sideKey: seat.sideKey,
    targetIndex: seat.targetIndex,
    dartsThisVisit: seat.dartsThisVisit,
    outcomes: seat.ext.outcomes,
    status: seat.status === "IN_PROGRESS" ? "IN_PROGRESS" : "COMPLETE",
  };
}

/**
 * Pure reducer: folds one dart observation onto one seat's
 * `DoublesTrainingSeatState`, via the Track kernel.
 * @throws when `state.status` is not `IN_PROGRESS`; undo first to correct it.
 */
export function applyDoublesTrainingDart(
  config: DoublesTrainingSnapshot,
  state: DoublesTrainingSeatState,
  observation: DartObservation,
): DoublesTrainingSeatState {
  return toDoublesSeat(
    applyTrackDart(toTrackSeat(state), observation, doublesRules(config)),
  );
}
```

`hitsThisVisit: 0` in `toTrackSeat` is exact: a Doubles visit closes on its first hit, so an open visit never holds a hit. Say so in `toTrackSeat`'s JSDoc.

Remove the second `const COMPLETE_REFUSAL` declaration further down, since it moved up.

In `foldDoublesTrainingState`, replace the `foldSeatStates(...)` call with:

```ts
  const seats = foldTrackSeats(
    facts.turns,
    config.seats,
    () => ({ outcomes: [] }),
    doublesRules(config),
  ).map(toDoublesSeat);
```

Fix the imports:
- add `applyTrackDart, foldTrackSeats` from `./track-kernel.module`;
- add `advanceToEnd, closeOnHitOrAfter, noPoints, pathTarget` from `./track-policies`;
- add `TrackRules` to the `./interfaces` type import;
- add `DoublesTrackExt, TrackSeat` to the `./types` import;
- drop `foldSeatStates` and any now-unused names.

- [ ] **Step 3: Flip the registry row** in `scripts/engine-kernels.txt`: `app/src/modules/game/doubles-training.engine.module.ts | TRACK | KERNEL_BOUND | docs/game-rules/rulesets/doubles-training.md |`.

- [ ] **Step 4: Run the proof.**

```bash
cd app && npx vitest run tests/modules/game/doubles-training.oracle.test.ts tests/modules/game/doubles-training.engine.module.test.ts tests/modules/game/doubles-training.golden.test.ts tests/modules/game/track-kernel.module.test.ts tests/modules/game/track-policies.test.ts
```

Expected: all PASS with **no snapshot written or updated** (`Snapshots: N passed`, `0 written`, `0 updated`). If any snapshot is obsolete or written, stop: behaviour changed. Use `superpowers:systematic-debugging`; never update the snapshot.

- [ ] **Step 5: Run the gates.** `cd app && npm test && npm run check && npx fallow` (use the fallow invocation from `app/CLAUDE.md` §validation if it differs). Then `cd .. && bash scripts/check-engine-kernels.sh && bash scripts/check-type-barrels.sh && bash scripts/check-game-engines.sh`. Expected: all green, fallow exit 0, and the duplication count at or below `origin/main`'s (record both numbers).

- [ ] **Step 6: Mutation check.** Temporarily change `closeOnHitOrAfter(3)` to `closeOnHitOrAfter(2)` in `doublesRules` and run the oracle test. Expected: FAIL. Revert and re-run: PASS. Record this in the PR body.

- [ ] **Step 7: Commit.**

```bash
git add app/src/modules/game app/tests/modules/game/track-kernel.module.test.ts app/tests/modules/game/track-policies.test.ts scripts/engine-kernels.txt
git commit -m "refactor(game): Track kernel; Doubles Training bound to it"
```

### Task 1.4: Delete the legacy copy, docs, decision, PR (commit 3)

**Files:**
- Delete: `app/tests/modules/game/legacy/doubles-training.legacy.ts`, `app/tests/modules/game/doubles-training.oracle.test.ts`
- Modify: `docs/architecture/04-Architecture-patterns.md` (Track row status → `built — Doubles Training bound (D467)`; version 1.11.1)
- Modify: `app/src/modules/game/CLAUDE.md` (one bullet: `track-kernel.module.ts` + `track-policies.ts`; a Track engine is a `TrackRules` mapper plus a projection to its legacy state)
- Modify: `decisions/game-engine.md` (append), `docs/architecture/00-File-Inventory.md` (rows for the two new modules), `docs/architecture/00-Context-Map-History.md` (row)

- [ ] **Step 1: Delete the legacy copy and the oracle.** The guarantee stays with the existing Doubles goldens and step traces from #973 (`doubles-training.golden.test.ts`), which pin the same behaviour and passed unchanged in Task 1.3 Step 4 (Hard Invariant: tests re-pointed at the same guarantee). Commit 1 keeps the oracle's proof in history.

- [ ] **Step 2: Append the decision.** Confirm `bash scripts/next-decision-id.sh` prints `D467` (see Global Constraints):

```markdown
### D467 — Track kernel: a reducer driven by a record of policy functions
Status: Accepted · Date: 2026-10-17
Decision: `modules/game/track-kernel.module.ts` holds the Track family's only reducer, `applyTrackDart` (judge → points → `onDart` → visit close → `onVisitClose`), and `foldTrackSeats`; a ruleset is a `TrackRules<TExt>` record of named policies (`track-policies.ts`) built per read from its configuration snapshot, with game-owned extras in `TrackSeat.ext`. A migrated engine keeps its exported reducer, fold and `state()` shape by projecting `TrackSeat` to its legacy seat state. Doubles Training is the first bound engine. Match outcome stays in each fold until a second engine shares it; the umbrella `RuleKernel` interface waits for a second family.
Reason: a pure-data enum config would force each shipped engine's special cases (Shanghai's instant win, Target Scoring's chain) into one generic switch past fallow's complexity limit; policies keep each special case local to the one ruleset that has it, and the projection lets the oracle compare old and new engines on identical state.
Consequences: PRs 2–7 of `docs/superpowers/specs/2026-10-17-track-kernel-design.md` add policies with their first caller and flip their `scripts/engine-kernels.txt` row. Spec: that file; plan: `docs/superpowers/plans/2026-10-17-track-kernel.md`.
Supersedes: none.
```

- [ ] **Step 3: Make the doc edits** listed under Files above, plus these File Inventory rows:

```
| `app/src/modules/game/track-kernel.module.ts` | Track rule kernel: `initialTrackSeat`, `applyTrackDart`, `foldTrackSeats` (D467, 2026-10-17) | canonical |
| `app/src/modules/game/track-policies.ts` | Track policies: `pathTarget`, `noPoints`, `closeOnHitOrAfter`, `advanceToEnd` (D467, 2026-10-17) | canonical |
```

- [ ] **Step 4: Run all gates.** Run the `run-all-gates` and `context-maintenance` skills. `npm test` must be fully green, with the count equal to Task 1.3's minus the deleted oracle tests.

- [ ] **Step 5: Commit, push, open the PR.**

```bash
git add -A app/tests/modules/game docs decisions app/src/modules/game/CLAUDE.md
git commit -m "test(doubles-training): drop legacy copy; goldens hold the guarantee (D467)"
git push -u origin refactor/track-kernel-doubles
```

Open the PR per `finishing-a-dart-branch`. The body includes the oracle seeds and step counts, the mutation-check result, and the fallow duplication before and after. It ends with the generated line plus the session link. Subscribe to the PR's activity and drive it to green.

### Task 1.5: Verify and file the suspected quirks

**Files:**
- Test (scratch only; not committed): `app/tests/modules/game/quirk-probe.test.ts`

- [ ] **Step 1: Write probe tests** for spec §7's three suspected quirks:
  - (a) Shanghai 2 seats: after seat A finishes, check whether `state().activeParticipantRef` can still name A.
  - (b) Timed Around the Clock: check whether a seat with more laps but more darts loses.
  - (c) Bob's 27 2 seats, both reach BULL: check whether `status` stays `IN_PROGRESS`.

  Drive each through the public engine API.
- [ ] **Step 2: Run** each probe, record the observed result, then delete the probe file.
- [ ] **Step 3: File** each confirmed quirk as one GitHub issue per the `capturing-discovered-work` skill (`discovered-work` label), with the probe as the reproduction. Name the issues in PR 1's body. Fix nothing.
