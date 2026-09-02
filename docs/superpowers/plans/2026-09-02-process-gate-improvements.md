# Process/Gate Improvements Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close five independent governance/gate findings — a latent regex gap in `check-context-map.sh`, two already-resolved findings that just need their entries deleted, a new structural gate closing the exact hole that broke Shanghai V2's resume path, and a scoped investigation into why `fallow`'s duplication gate stayed silent on a comparable pre-fix clone family.

**Architecture:** Task 1 flips a keyword-exclusion regex to a keyword-inclusion one in one existing gate script. Tasks 2-3 are doc-only closures — no code to fix, the finding's own text already says so. Task 4 adds a new, self-contained section to `check-game-engines.sh` after its existing per-module loop. Task 5 is a research task whose deliverable is a recorded answer, not a diff.

**Tech Stack:** POSIX shell (`scripts/*.sh`), Markdown (`FINDINGS.md`, `docs/architecture/07-Frontend/09-Adding-A-Game.md`).

## Global Constraints

- Closes `FINDINGS.md` F5, F38, F42, F43, F50.
- No change to `.fallowrc.jsonc` as part of this plan — Task 5 only investigates; any tuning change it surfaces is explicitly deferred to a follow-up task.
- No change to `docs/superpowers/specs/**`'s historical-record policy (Task 2 respects it, doesn't touch the cited spec).
- No change to `app/src/services/session.service.ts` (Task 3's `buildSeatPlan` is already correct; nothing to touch).
- No change to `check-game-engines.sh`'s existing per-module checks (Task 4 only adds a new section after them).

---

### Task 1: Fix `check-context-map.sh`'s seed-vs-migration regex gap

**Files:**
- Modify: `scripts/check-context-map.sh:61-63`

**Interfaces:** none — a standalone `set -u` shell script with no imports/exports; verified by running it against the repo, not a unit test file.

The check (lines 51-68, "2. Migration range consistency") flags any doc line quoting a range `0001–NNNN` whose end doesn't match the migration chain's own max, unless the line also contains the literal word "seed" (`grep -iv 'seed'`, an exclusion list of one word standing in for an open-ended set of ways a doc might phrase a seed reference). Flip it to a positive requirement instead: only enforce the check on a line that names "migration" at all.

- [ ] **Step 1: Confirm today's two matching lines still pass under the current script**

Run: `bash scripts/check-context-map.sh`
Expected: exits 0 — establishes the baseline before changing anything. (The two lines this section currently matches repeat-wide are `docs/architecture/README.md:70` and `database/README.md:16`, both reading `migrations/ … 0001–0023`; note them so Step 4 can re-check them by hand.)

- [ ] **Step 2: Edit the regex**

In `scripts/check-context-map.sh`, lines 61-63, replace:

```sh
    for q in $(grep -hiE '0001.?[–-].?.?[0-9]{4}' "$f" 2>/dev/null \
      | grep -iv 'seed' \
      | grep -oE '0001.?[–-].?.?[0-9]{4}' | grep -oE '[0-9]{4}$' | sort -u); do
```

with:

```sh
    for q in $(grep -hiE '0001.?[–-].?.?[0-9]{4}' "$f" 2>/dev/null \
      | grep -iE 'migration' \
      | grep -oE '0001.?[–-].?.?[0-9]{4}' | grep -oE '[0-9]{4}$' | sort -u); do
```

(swaps `grep -iv 'seed'` — an exclusion list — for `grep -iE 'migration'` — a positive requirement; every other line in the section, including the comment above it explaining the seed exclusion, is unchanged by this step. The comment at lines 52-56 still accurately describes the *intent* — "lines naming seeds are skipped too" — even though the mechanism changes from excluding "seed" to requiring "migration"; leave it as-is, it remains true.)

- [ ] **Step 3: Run the script to confirm it still exits 0**

Run: `bash scripts/check-context-map.sh`
Expected: exits 0 — both known-good lines (`docs/architecture/README.md:70`, `database/README.md:16`) contain the word "migrations", so they still pass under the new positive check.

- [ ] **Step 4: Manually verify the fix closes the gap**

Run: `printf 'seeds run 0001-0003 today\n' > /tmp/seed-range-check.md && grep -hiE '0001.?[–-].?.?[0-9]{4}' /tmp/seed-range-check.md | grep -iv 'seed'`
Expected output: the line itself (empty grep -iv match set means it WOULD be checked under the old regex — i.e. the old `grep -iv 'seed'` fails to exclude this line because "seed" doesn't appear as the literal token `seed` inside it... adjust the fixture if needed so it demonstrates a seed-range mention that doesn't contain the literal substring "seed" on that exact line, e.g. `printf 'the seeding chain runs 0001-0003\n'` still contains "seed" as a substring of "seeding" so `grep -iv` would still exclude it — use a phrasing that avoids the substring entirely, e.g. `printf 'bootstrap data covers 0001-0003\n'`).

Run: `printf 'bootstrap data covers 0001-0003\n' > /tmp/seed-range-check.md && grep -hiE '0001.?[–-].?.?[0-9]{4}' /tmp/seed-range-check.md | grep -iE 'migration'`
Expected output: empty (no "migration" on the line) — confirms the new positive check correctly skips a seed-range mention phrased without the word "seed", where the old exclusion-list check would have wrongly flagged it. Clean up: `rm /tmp/seed-range-check.md`.

- [ ] **Step 5: Run the full `check-context-map.sh` one more time**

Run: `bash scripts/check-context-map.sh`
Expected: exits 0.

- [ ] **Step 6: Commit**

```bash
git add scripts/check-context-map.sh
git commit -m "fix(gates): check-context-map.sh requires 'migration' on a line instead of excluding 'seed' (F5)"
```

---

### Task 2: Close FINDINGS.md F38 (already resolved, no action)

**Files:**
- Modify: `FINDINGS.md`

F38's own `Proposed:` field already says "none — historical specs are status notes, never rewritten; noted here only so the discrepancy isn't mistaken for a live doc defect." There is nothing to implement.

- [ ] **Step 1: Delete the F38 block**

In `FINDINGS.md`, delete this entire block (currently lines 147-152, immediately after F37's block and before F42's):

```markdown
### F38 — Issue #169 Part B's own spec names the wrong file for its new shared type
Status: Open · Found: 2026-08-27 · Task: claude/issue-169-brainstorming-hxzm90
Claim: `docs/superpowers/specs/2026-08-27-score-training-rounds-limit-seat-fix-design.md`'s Design section states `ExistingTurnCounts` is defined in `app/src/services/rulesets/types.ts`, but the implementation plan written from that same spec (and the shipped code) correctly places it in `app/src/repositories/interfaces.ts` instead, per `app/CLAUDE.md`'s Controller → Service → Repository type-flow direction and the `ProvisionedPlayer` precedent in that same file
Evidence: `docs/superpowers/specs/2026-08-27-score-training-rounds-limit-seat-fix-design.md:73` (`// app/src/services/rulesets/types.ts`) vs. `docs/superpowers/plans/2026-08-27-score-training-rounds-limit-seat-fix.md:13` and the shipped `app/src/repositories/interfaces.ts`, which both use the repository location
Impact: `docs/superpowers/specs/**` is a historical record (`docs/CLAUDE.md`), so this is not corrected in place; a future reader of the spec alone (not the plan) would look for the type in the wrong file
Proposed: none — historical specs are status notes, never rewritten; noted here only so the discrepancy isn't mistaken for a live doc defect
```

(Note: F37 is fixed in a separate plan, `docs/superpowers/plans/2026-09-02-scoring-stats-correctness.md`; if that plan's Task 5 has already run when this task executes, locate F38 by its own header rather than by "the block after F37".)

- [ ] **Step 2: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

- [ ] **Step 3: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F38 — historical spec discrepancy, no code to fix"
```

---

### Task 3: Close FINDINGS.md F50 (already resolved, verify then close)

**Files:**
- Modify: `FINDINGS.md`

F50 claimed `2026-09-01-dartbot-4-seat-admission.md`'s Task 7 `buildSeatPlan` code, if committed verbatim, would fail `npx fallow`'s health gate — but its own text notes "fixed on this branch by replacing the interleaved ternaries with one early return per `participantTypeKey` branch."

- [ ] **Step 1: Verify the shipped code already has the early-return shape**

Run: `grep -n "buildSeatPlan" app/src/services/session.service.ts`

Then read the function this locates (expected around lines 251-300) and confirm it has one early `return` per `PLAYER`/`DARTBOT`/`GUEST` branch of `participantTypeKey`, not interleaved ternaries across `participantTypeId`/`playerId`/`displayName`. If the shipped code does NOT already have this shape, stop this task and escalate — F50's own claim that the fix already landed would be false, and deleting the entry would be wrong.

- [ ] **Step 2: Confirm `npx fallow` is clean on this function today**

Run: `cd app && npx fallow`
Expected: exits 0, no complexity-gate failure naming `session.service.ts`/`buildSeatPlan`.

- [ ] **Step 3: Delete the F50 block**

In `FINDINGS.md`, delete this entire block (currently lines 182-187, immediately after F46's block and before F51's):

```markdown
### F50 — `2026-09-01-dartbot-4-seat-admission.md`'s Task 7 `buildSeatPlan` code fails `npx fallow`'s health gate as written
Status: Raised · Found: 2026-09-01 · Task: claude/rebase-pr-three-docs-4tm39h
Claim: the plan's Global Constraints and Task 13 both require `npx fallow` to exit zero as part of the definition of done, and Task 7 Step 3's `buildSeatPlan` code is given as complete, ready-to-commit implementation
Evidence: `docs/superpowers/plans/2026-09-01-dartbot-4-seat-admission.md` Task 7 Step 3 — the `buildSeatPlan` map callback given there interleaves three ternaries (`isPlayer`/`isDartbot`) across `participantTypeId`/`playerId`/`displayName` plus a conditional `dartbot` spread; committed verbatim it reports cyclomatic 10 / cognitive 11 / CRAP 31.6, over `npx fallow`'s health threshold — the same failure category as F48, one plan earlier in this same DartBot series; fixed on this branch by replacing the interleaved ternaries with one early return per `participantTypeKey` branch (PLAYER/DARTBOT/GUEST), which the plan never mentions
Impact: an executor following Task 7 Step 3 literally and then running Task 13 Step 1's `run-all-gates` hits an unexplained `npx fallow` failure with no plan text pointing at the cause or a fix — the same discoverable-only-by-trial gap F48 already named for the phase-2 plan, suggesting the plan-writing process for this series doesn't run `npx fallow` against its own example code before publishing
Proposed: give Task 7 Step 3's `buildSeatPlan` the early-return-per-branch shape from the start, or note that a complexity-gate split is expected; more durably, add "run `npx fallow` against every code block before publishing" to whatever process drafts these DartBot phase plans, since this is the second consecutive phase plan in the series to trip the same gate
```

Leave F50's own process suggestion — "run `npx fallow` against every code block before publishing a DartBot phase plan" — for the user to decide whether to adopt going forward; it names a process change for future plan-writing, not a repo file this task edits.

- [ ] **Step 4: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F50 — buildSeatPlan already has the early-return shape, fallow is clean"
```

---

### Task 4: Add a structural gate for resumable-ruleset-version wiring

**Files:**
- Modify: `scripts/check-game-engines.sh` (append new section after line 91), `docs/architecture/07-Frontend/09-Adding-A-Game.md`

**Interfaces:** none — a standalone `set -u` shell script; verified by running it against the repo and against a throwaway local edit, not a unit test file.

`scripts/check-game-engines.sh` already extracts every `rulesetVersionKey` string an engine module names into its per-file `KEYS` variable (lines 65-66). Every `*.engine.module.ts` file's basename already matches its `*-play.data.ts` counterpart 1:1 — verified: `around-the-clock`, `bobs27`, `doubles-training`, `five-oh-one`, `one-twenty-one`, `score-training`, `shanghai`, `singles-training`, `tuod`, nine for nine. For an engine module naming more than one key (e.g. Shanghai's own module reports `SHANGHAI_V1 SHANGHAI_V2`), confirm its paired `*-play.data.ts` file's source text contains every one of those keys literally.

- [ ] **Step 1: Reproduce the bug this gate would have caught**

Run: `grep -c "SHANGHAI_V1\|SHANGHAI_V2" app/src/lib/game/shanghai-play.data.ts`
Expected: 2 or more (both keys present today — this is the post-fix state; the gate you are about to add would have failed on the pre-fix state, where only `SHANGHAI_V1` appeared). This step is a sanity check that today's repo is already correct, so the new gate should pass immediately once added.

- [ ] **Step 2: Add the new gate section**

In `scripts/check-game-engines.sh`, immediately after the closing `done` of the existing `for file in $MODULES; do ... done` loop (line 91, right before `if [ "$FAIL" -eq 0 ]; then` at line 93), insert:

```sh

# --- Resumable ruleset version wiring -----------------------------------
# A game with more than one registered rulesetVersionKey needs its shared
# play page to actually resume all of them, not just the first one ever
# shipped — SHANGHAI_V2 shipped without this and every V2 session silently
# failed to resume (F43).
for file in $MODULES; do
  BASENAME=$(basename "$file" .engine.module.ts)
  PLAY_FILE="app/src/lib/game/${BASENAME}-play.data.ts"
  KEYS=$(grep -oE 'rulesetVersionKey[[:space:]]*[:=][[:space:]]*"[A-Z0-9_]+"' "$file" \
    | grep -oE '"[A-Z0-9_]+"' | tr -d '"' | sort -u)
  KEY_COUNT=$(printf '%s\n' "$KEYS" | grep -c .)
  [ "$KEY_COUNT" -le 1 ] && continue

  if [ ! -f "$PLAY_FILE" ]; then
    echo "FAIL: $file names $KEY_COUNT ruleset versions but $PLAY_FILE does not exist" >&2
    FAIL=1
    continue
  fi
  for key in $KEYS; do
    if ! grep -qF "\"$key\"" "$PLAY_FILE"; then
      echo "FAIL: $PLAY_FILE never references rulesetVersionKey \"$key\" (registered in $file)" >&2
      FAIL=1
    fi
  done
done
```

(`if`/`then` throughout, matching the existing script's own style rather than terser `||`/`&&` chains — a chained `grep || echo && FAIL=1` here would set `FAIL=1` unconditionally, since `||` and `&&` are equal-precedence and left-associative in `sh`; this shape avoids that trap.)

- [ ] **Step 3: Run the script to confirm it still passes**

Run: `bash scripts/check-game-engines.sh`
Expected: exits 0, reports "OK: all 9 game engine module(s) conform to the GameEngine contract." — same conclusion as before, the new section adds no new failures against today's correct repo state.

- [ ] **Step 4: Confirm the gate actually catches the bug it targets**

Run: `sed -i.bak 's/"SHANGHAI_V2"/"SHANGHAI_V2_TEST_REMOVED"/' app/src/lib/game/shanghai-play.data.ts && bash scripts/check-game-engines.sh; echo "exit: $?"; mv app/src/lib/game/shanghai-play.data.ts.bak app/src/lib/game/shanghai-play.data.ts`
Expected: the script prints `FAIL: app/src/lib/game/shanghai-play.data.ts never references rulesetVersionKey "SHANGHAI_V2" ...` and exits non-zero, proving the new section catches the exact bug F43 describes. The final `mv` restores the file — confirm with `git status` that `shanghai-play.data.ts` shows no diff before continuing.

- [ ] **Step 5: Add the failure mode to the frontend touch-list doc**

In `docs/architecture/07-Frontend/09-Adding-A-Game.md`, find the section describing the touch list for adding a new game (or a ruleset version to an existing one) and add a line noting: adding a second `rulesetVersionKey` to an existing engine module requires updating that game's `*-play.data.ts` resume/replay logic to reference every registered version (not just the first one shipped) — enforced by `scripts/check-game-engines.sh`'s "Resumable ruleset version wiring" section.

- [ ] **Step 6: Run the doc-consistency gates**

Run: `bash scripts/check-doc-links.sh && bash scripts/check-context-budget.sh`
Expected: both exit 0.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-game-engines.sh docs/architecture/07-Frontend/09-Adding-A-Game.md
git commit -m "feat(gates): check-game-engines.sh flags a play page that doesn't resume every registered ruleset version (F43)"
```

---

### Task 5: Investigate why `fallow`'s duplication gate missed the pre-fix bust/checkout clone

**Files:** none modified by this task's core deliverable — a throwaway local branch, discarded after, plus a short recorded note (destination decided in Step 3).

This is a research task; its deliverable is an answer, not a diff.

- [ ] **Step 1: Reproduce the pre-fix duplication on a throwaway branch**

```bash
git checkout -b throwaway/f42-fallow-investigation
```

Open `docs/superpowers/specs/2026-08-27-engine-duplication-cleanup-design.md` and read its Tasks 1-7 to see exactly what was extracted (the bust/checkout rule, hand-duplicated 5 times across 3 engine files; `otherSeatsComplete`-shaped inline folds, duplicated 3 times). Hand-copy the pre-extraction rule back into the 3-5 sites it was pulled from, matching what that spec describes as the pre-fix state — do not commit this; it is a local, disposable reconstruction.

- [ ] **Step 2: Run `npx fallow dupes` against the reconstructed state**

Run: `cd app && npx fallow dupes`

Read the output closely: does it list the reconstructed clone family at all? If yes, at what group size/line count does it start reporting — compare against `.fallowrc.jsonc`'s configured threshold (`duplicates.threshold: 0.0`, i.e. unset, meaning fallow's own inferred default is the real gate). If no, that is the answer itself — a structural blind spot, not a threshold gap.

- [ ] **Step 3: Record the answer**

Decide, based on Step 2's actual output, which of these applies, then write a few sentences recording it:

- If `fallow` DID flag the reconstructed clone family, but only once it crossed some size the pre-fix pattern happened to sit just under: the gap is a configuration/threshold question (relevant to F27's own open question about `.fallowrc.jsonc`'s tuning) — add a short note to `FINDINGS.md` as a new finding cross-referencing F27 (bump `highest-issued`), rather than tuning `.fallowrc.jsonc` in this task.
- If `fallow` never flagged it regardless of size, because method-body clones spread across a TypeScript class are not tokenized the same way as free-function clones: this is a structural limitation of the tool itself, not a config gap. Record it in `docs/architecture/07-Frontend/06-Test-Strategy.md` (wherever `fallow`'s own gate is already documented) as a known limitation, so a future near-miss isn't re-investigated from scratch.

Either way, this step's output is prose, not code — do not open a source file to fix in this task.

- [ ] **Step 4: Discard the throwaway branch**

```bash
git checkout claude/rebase-pr-three-docs-4tm39h
git branch -D throwaway/f42-fallow-investigation
```

(This is the one throwaway/disposable-branch exception in this repo's otherwise "no discarded task branches" posture — Step 1 explicitly built it to be discarded, and Step 3 already captured everything worth keeping as a committed doc/finding change on the real branch.)

- [ ] **Step 5: Commit the recorded answer**

If Step 3 added a `FINDINGS.md` entry:

```bash
git add FINDINGS.md
git commit -m "docs: record F42 investigation — [threshold gap|structural limitation], see new finding"
```

If Step 3 added a `06-Test-Strategy.md` note instead:

```bash
git add docs/architecture/07-Frontend/06-Test-Strategy.md
git commit -m "docs: record fallow's clone-detection limitation found while investigating F42"
```

(Pick the message and files matching whichever branch of Step 3 actually applied — do not commit both.)

---

### Task 6: Close FINDINGS.md F42, run the full gate suite

**Files:**
- Modify: `FINDINGS.md`

- [ ] **Step 1: Delete the F42 block**

In `FINDINGS.md`, delete the entire `### F42 — Why fallow's duplication gate did not flag the bust/checkout or otherSeatsComplete duplication this task extracted was never investigated` block — Task 5 answered the "never investigated" question, so the finding itself (the absence of an answer) is resolved even if its answer surfaces a new, separate finding or doc note. Leave one blank line between the surrounding blocks.

- [ ] **Step 2: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

- [ ] **Step 3: Run the full `run-all-gates` suite**

Invoke the `run-all-gates` skill's "Always run" set plus the "If `app/` changed" set (Task 1 and 4 touched `scripts/*.sh`, which are in scope for the structural gates even though no `app/src/` file changed this plan — run the full set regardless to be safe). State each script's result explicitly in the completion report.

- [ ] **Step 4: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F42 — fallow duplication-gate silence investigated (F5, F38, F42, F43, F50 all closed)"
```

## Testing

- Task 1: no test file — `check-context-map.sh` has none today; verified by running the script directly (Steps 1, 3, 5) and a manual regex demonstration (Step 4).
- Tasks 2, 3: doc-only (`FINDINGS.md` entry deletion); Task 3 additionally verifies its own claim against the shipped source before deleting.
- Task 4: `check-game-engines.sh` has no existing unit test either; verified by running it against the current repo (should still report all 9 conforming) and against a throwaway local edit reintroducing the exact bug F43 describes (should newly FAIL), then reverting the throwaway edit.
- Task 5: no code artifact to test — the investigation's own procedure (Steps 1-2) is its verification.
- Task 6: doc-only; verified by the findings gate and the full `run-all-gates` suite.

## Non-goals

No change to `.fallowrc.jsonc`. No change to `docs/superpowers/specs/**`'s historical-record policy. No change to `app/src/services/session.service.ts`. No change to `check-game-engines.sh`'s existing per-module checks (only a new section appended after them).
