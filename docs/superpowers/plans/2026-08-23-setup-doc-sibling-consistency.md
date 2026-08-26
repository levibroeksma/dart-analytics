# Setup/Ruleset-Doc Sibling Consistency Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close findings F8 and F26 — two sibling-file doc-drift findings: a redundant JSDoc line surviving in five of six preset setup-data modules, and a missing 1v1 win-condition subsection in one ruleset doc.

**Architecture:** Two independent, small edits — a 5-file JSDoc deletion in `app/src/lib/game/` (comment-only, no behavior change) and a markdown subsection addition in `docs/game-rules/rulesets/singles-training.md` — followed by the mandatory FINDINGS.md cleanup and context-maintenance self-registration.

**Tech Stack:** TypeScript JSDoc comments; Markdown; `npx tsc --noEmit`; Vitest (existing suites, unaffected but re-run for confirmation); bash gate scripts.

**Source spec:** `docs/superpowers/specs/2026-08-23-setup-doc-sibling-consistency-design.md`

## Global Constraints

- Every task branches from `main` per root `CLAUDE.md`; this plan assumes a single branch already checked out for the whole plan (no git worktrees).
- Minimal diffs only — do not touch any line not named by a task below.
- JSDoc-only changes are exempt from `scripts/check-test-coverage.sh` (D224's runtime-source-file trigger does not apply to comment-only edits) — no test file needs to change for Task 1.
- `singles-training.md` lives under `docs/game-rules/`, non-canonical per `docs/game-rules/README.md` — no canonical-doc gate applies to it beyond `scripts/check-doc-links.sh`.
- `FINDINGS.md` closures are deletions, not status changes — never write `Status: Resolved`.
- Substitute the actual execution date (`YYYY-MM-DD`, today when each task actually runs) everywhere this plan says "today's date."

---

## File Structure

| File | Change |
| ---- | ------ |
| `app/src/lib/game/around-the-clock-setup.data.ts` | Delete redundant JSDoc line (F8) |
| `app/src/lib/game/bobs27-setup.data.ts` | Delete redundant JSDoc line (F8) |
| `app/src/lib/game/one-twenty-one-setup.data.ts` | Delete redundant JSDoc line (F8) |
| `app/src/lib/game/shanghai-setup.data.ts` | Delete redundant JSDoc line (F8) |
| `app/src/lib/game/singles-training-setup.data.ts` | Delete redundant JSDoc line (F8) |
| `app/src/lib/game/doubles-training-setup.data.ts` | No change — already correct, has no such line |
| `docs/game-rules/rulesets/singles-training.md` | Add "### Variants — Multiplayer (1v1)" subsection (F26) |
| `docs/architecture/00-Context-Map-History.md` | Append this task's version entry |
| `FINDINGS.md` | Delete the F8, F26 blocks |

---

### Task 1: Drop the redundant preset-count JSDoc line (F8)

**Files:**
- Modify: `app/src/lib/game/around-the-clock-setup.data.ts:4`
- Modify: `app/src/lib/game/bobs27-setup.data.ts:4`
- Modify: `app/src/lib/game/one-twenty-one-setup.data.ts:4`
- Modify: `app/src/lib/game/shanghai-setup.data.ts:4`
- Modify: `app/src/lib/game/singles-training-setup.data.ts:5`

**Interfaces:** None — comment-only, no exported signature changes. `createPresetSetupController` (`app/src/lib/game/setup-controller.ts:27-28`) already states the same fact factory-side: "V1 seeds exactly one configuration preset per game; index 0 is always that preset."

- [ ] **Step 1: Confirm the finding still holds**

Run: `grep -rln "V1 seeds exactly one configuration preset" app/src/lib/game/*-setup.data.ts`
Expected: exactly 5 files — `around-the-clock-setup.data.ts`, `bobs27-setup.data.ts`, `one-twenty-one-setup.data.ts`, `shanghai-setup.data.ts`, `singles-training-setup.data.ts`. `doubles-training-setup.data.ts` must NOT appear.

- [ ] **Step 2: Edit `around-the-clock-setup.data.ts`**

Current (lines 1-5):

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { AroundTheClockSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function aroundTheClockSetup() {
```

Replace with:

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { AroundTheClockSetupContext } from "./types";

export function aroundTheClockSetup() {
```

- [ ] **Step 3: Edit `bobs27-setup.data.ts`**

Current (lines 1-5):

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { Bobs27SetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function bobs27Setup() {
```

Replace with:

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { Bobs27SetupContext } from "./types";

export function bobs27Setup() {
```

- [ ] **Step 4: Edit `one-twenty-one-setup.data.ts`**

Current (lines 1-5):

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { OneTwentyOneSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function oneTwentyOneSetup() {
```

Replace with:

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { OneTwentyOneSetupContext } from "./types";

export function oneTwentyOneSetup() {
```

- [ ] **Step 5: Edit `shanghai-setup.data.ts`**

Current (lines 1-5):

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function shanghaiSetup() {
```

Replace with:

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import type { ShanghaiSetupContext } from "./types";

export function shanghaiSetup() {
```

- [ ] **Step 6: Edit `singles-training-setup.data.ts`**

Current (lines 1-6):

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

/** V1 seeds exactly one configuration preset; index 0 is always that preset. */
export function singlesTrainingSetup() {
```

Replace with:

```typescript
import { createPresetSetupController } from "@lib/game/setup-controller";
import { targetOrderFor } from "@lib/game/target-order";
import type { SinglesTrainingSetupContext } from "./types";

export function singlesTrainingSetup() {
```

- [ ] **Step 7: Verify the line is gone from all five, and `doubles-training-setup.data.ts` is untouched**

Run: `grep -rl "V1 seeds exactly one configuration preset" app/src/lib/game/*-setup.data.ts`
Expected: no output (exit code 1).

Run: `git diff --stat app/src/lib/game/doubles-training-setup.data.ts`
Expected: no output (file not in the diff).

- [ ] **Step 8: Type-check**

Run: `cd app && npx tsc --noEmit`
Expected: 0 errors (comment-only removal cannot change type checking, but this proves no accidental syntax break).

- [ ] **Step 9: Run the setup-data test suites**

Run: `cd app && npx vitest run tests/lib/game/around-the-clock-setup.data.test.ts tests/lib/game/bobs27-setup.data.test.ts tests/lib/game/one-twenty-one-setup.data.test.ts tests/lib/game/shanghai-setup.data.test.ts tests/lib/game/singles-training-setup.data.test.ts`
Expected: all pass, unchanged pass count from before this edit (comment removal has no behavioral effect).

- [ ] **Step 10: Commit**

```bash
git add app/src/lib/game/around-the-clock-setup.data.ts app/src/lib/game/bobs27-setup.data.ts app/src/lib/game/one-twenty-one-setup.data.ts app/src/lib/game/shanghai-setup.data.ts app/src/lib/game/singles-training-setup.data.ts
git commit -m "fix: drop redundant preset-count JSDoc line from five setup-data modules (F8)"
```

---

### Task 2: Add singles-training's missing 1v1 win condition (F26)

**Files:**
- Modify: `docs/game-rules/rulesets/singles-training.md` (append a new subsection under "## Later versions (V2+)")

**Interfaces:** None. Reference wording/placement: `docs/game-rules/rulesets/doubles-training.md:82-84`.

- [ ] **Step 1: Confirm the finding still holds**

Run: `grep -n "1v1 win condition" docs/game-rules/rulesets/singles-training.md`
Expected: no output (exit code 1).

Run: `grep -n "1v1 win condition" docs/game-rules/rulesets/doubles-training.md`
Expected: `84:1v1 win condition: most doubles hit across all 21 targets; ties possible, no tiebreak in this version.` — confirms the reference wording/placement to mirror.

- [ ] **Step 2: Edit `singles-training.md`**

Current (lines 81-85):

```markdown
### Match structure

- Multiplayer / online multiplayer

## Glossary
```

Replace with:

```markdown
### Match structure

- Multiplayer / online multiplayer

### Variants — Multiplayer (1v1)

1v1 win condition: highest total points; ties possible, no tiebreak in this version.

## Glossary
```

- [ ] **Step 3: Verify the insertion**

Run: `grep -n "1v1 win condition" docs/game-rules/rulesets/singles-training.md`
Expected: `1v1 win condition: highest total points; ties possible, no tiebreak in this version.`

- [ ] **Step 4: Run the doc-links gate**

Run: `bash scripts/check-doc-links.sh`
Expected: exits 0.

- [ ] **Step 5: Commit**

```bash
git add docs/game-rules/rulesets/singles-training.md
git commit -m "docs: add singles-training's missing 1v1 win condition (F26)"
```

---

### Task 3: Close F8, F26 in `FINDINGS.md`

**Files:**
- Modify: `FINDINGS.md` (delete 2 blocks, update `updated:` front matter)

**Interfaces:** None.

- [ ] **Step 1: Delete the two closed blocks**

Delete the entire `### F8 — ...` block (from `### F8` through the line before the next `### F<n>` header) and the entire `### F26 — ...` block, each including its trailing blank line. Do not touch `highest-issued: F27` — deleted ids are never reused.

- [ ] **Step 2: Update the front-matter `updated` date**

Current (line 5 of `FINDINGS.md`):

```
updated: 2026-08-23
```

Replace with today's actual execution date in the same format (leave unchanged if this task runs on 2026-08-23).

- [ ] **Step 3: Run the findings gate**

Run: `bash scripts/check-findings-log.sh`
Expected: exits 0.

Run: `grep -cE '^### F(8|26) —' FINDINGS.md`
Expected: `0`

- [ ] **Step 4: Commit**

```bash
git add FINDINGS.md
git commit -m "docs: close F8, F26 (setup/ruleset-doc sibling consistency fixes)"
```

---

### Task 4: Context-maintenance self-registration and full gate run

**Files:**
- Modify: `docs/architecture/00-Context-Map-History.md` (append this task's own entry at the top of the Version History section)

**Interfaces:** None — this is the plan's final task.

- [ ] **Step 1: Confirm the current top version number**

Run: `grep -m1 "Version:" docs/architecture/00-Context-Map-History.md`
Expected: the current highest entry (e.g. `> **Version:** 1.21.0 ...`, or `1.23.0 ...` if the governance-context-doc-drift plan already landed first on this branch history — use whichever version is actually at the top when this step runs, and increment it by 0.1.0 for this entry).

- [ ] **Step 2: Insert this task's own version entry**

Insert immediately below the `---` / `# Version History` heading and above the current top entry found in Step 1, substituting today's actual date for `YYYY-MM-DD` and `N.N.0` for the version number derived in Step 1:

```markdown
> **Version:** N.N.0 (YYYY-MM-DD — setup/ruleset-doc sibling consistency closed: F8 (dropped the redundant "V1 seeds exactly one configuration preset" JSDoc line from five preset setup-data modules — `around-the-clock-setup.data.ts`, `bobs27-setup.data.ts`, `one-twenty-one-setup.data.ts`, `shanghai-setup.data.ts`, `singles-training-setup.data.ts` — `doubles-training-setup.data.ts` needed no edit and `createPresetSetupController` (`setup-controller.ts:27`) remains the single source of that fact), F26 (added a "### Variants — Multiplayer (1v1)" subsection with the 1v1 win-condition line to `docs/game-rules/rulesets/singles-training.md`, mirroring `doubles-training.md`'s existing wording/placement). Comment-only + one non-canonical doc addition, no runtime behavior change. Validation: `npx tsc --noEmit` clean, affected setup-data Vitest suites pass unchanged, `check-doc-links.sh` and `check-findings-log.sh` pass)
```

- [ ] **Step 3: Run the applicable gate set**

Per the `run-all-gates` skill (`app/` changed in Task 1, `docs/` changed in Task 2):

```bash
bash scripts/check-context-map.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-budget.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-file-locations.sh
bash scripts/check-findings-log.sh
bash scripts/check-test-coverage.sh
cd app && npm run validate:app && cd ..
```

Expected: every script/command exits 0.

- [ ] **Step 4: Commit**

```bash
git add docs/architecture/00-Context-Map-History.md
git commit -m "docs: register setup-doc-sibling-consistency task in context-map-history"
```

- [ ] **Step 5: Report**

State in the completion report: F8 and F26 closed, the Context-Map-History version added, and that every gate in Step 3 passed — per `context-maintenance`'s step 7 (confirm work is on an open PR targeting `main`, or note why not).

---

## Self-Review Notes

- **Spec coverage:** F8 → Task 1 (all 5 files named in the spec, `doubles-training-setup.data.ts` explicitly confirmed unchanged); F26 → Task 2 (exact subsection text and placement from the spec); FINDINGS.md closure → Task 3; context-maintenance registration → Task 4. All spec sections plus the two standing repo-wide obligations are covered.
- **Task order:** Tasks 1 and 2 are independent and can run in either order; Task 3 depends on both having landed (it closes both findings together); Task 4 depends on Task 3.
- **Type consistency:** no new functions, types, or exported signatures are introduced by this plan — every task is a comment/prose-only edit, so there is no signature to keep consistent across tasks.
- **Placeholder scan:** `YYYY-MM-DD` and `N.N.0` in Task 4 are explicitly defined as execution-time-derived values (today's date; current top version + 0.1.0), the same sanctioned pattern used in the sibling governance-context-doc-drift plan — not unresolved TBDs.
