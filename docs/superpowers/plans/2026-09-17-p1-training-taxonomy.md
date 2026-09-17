# P1 — Training Taxonomy & Dead Forms Layer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-home `trivia/`, `exercise/` and today's flat `training/` files under one `training/{trivia,exercises,routines}` umbrella in `lib/`, `modules/`, `components/layout/`, `tests/` and `docs/`, and delete the `@forms` layer that has zero instances.

**Architecture:** Pure `git mv` plus import/barrel/doc fixups. No function body changes anywhere. The one structural change is the type-barrel chain: `check-type-barrels.sh` rule 2 allows a barrel to raise only a direct child, so `training/types.ts` becomes a barrel and today's declarations move down into `training/routines/types.ts`.

**Tech Stack:** Astro 7, TypeScript, Vitest, bash gate scripts.

**Spec:** `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §3

**Issues closed:** #297, #348

## Global Constraints

- Branch off `main`, named `refactor/p1-training-taxonomy`. Never commit to `main`. Do not commit unless the user asks.
- Behaviour must not change. If a step requires editing a function body, stop and report — that is outside this plan.
- Each domain moves with its consumers, its barrel update and its tests in **one** commit. `check-test-coverage.sh` and `check-type-barrels.sh` run pre-commit and reject a split.
- Use `git mv`, never `cp`+`rm` — history must follow the file.
- `app/src/components/layout/games/` and `app/src/services/exercise-rulesets/` are **not** touched.
- `docs/game-rules/rulesets/` is **not** touched.
- Run every command from the repo root unless the step says `cd app`.
- Never hand-edit `app/src/db/schema.ts` (generated).
- No local graph refresh: `graphify-out/graph.json` is CI-owned and `context-maintenance` step 6 is a no-op.

---

## File Structure

**New directories:**

```
app/src/lib/training/{trivia,exercises,routines}/
app/src/modules/training/{trivia,exercises,routines}/
app/src/components/layout/training/{trivia,exercises,routines}/
app/tests/lib/training/{trivia,exercises,routines}/
app/tests/modules/training/{trivia,exercises,routines}/
docs/architecture/09-Training/
docs/game-rules/training/{trivia,routines}/
```

**Deleted:** `app/src/lib/trivia/`, `app/src/lib/exercise/`, `app/src/modules/trivia/`, `app/src/modules/exercise/`, `app/src/components/layout/trivia/`, `docs/architecture/09-training-routines.md`, `docs/architecture/10-trivia.md`, `docs/game-rules/trivia/`, `docs/game-rules/routines/`.

**Barrel responsibilities after the move:**

| File | Responsibility |
| ---- | -------------- |
| `app/src/modules/types.ts` | raises `./training/types` (not `./exercise/types`, not `./trivia/types`) |
| `app/src/modules/training/types.ts` | pure barrel: raises `./trivia/types`, `./exercises/types`, `./routines/types` |
| `app/src/modules/training/routines/types.ts` | today's `modules/training/types.ts` declarations |
| `app/src/lib/types.ts` | raises `./training/types` (drops `./exercise/types`) |
| `app/src/lib/training/types.ts` | pure barrel: raises `./exercises/types`, `./routines/types` |
| `app/src/lib/training/routines/types.ts` | today's `lib/training/types.ts` declarations |
| `app/src/lib/training/exercises/types.ts` | today's `lib/exercise/types.ts` — raises `./rulesets/types` |

---

### Task 1: Move the trivia domain

**Files:**
- Move: `app/src/lib/trivia/quick-subtract-play.data.ts` → `app/src/lib/training/trivia/quick-subtract-play.data.ts`
- Move: `app/src/modules/trivia/{dart-scores.module.ts,quick-subtract.module.ts,types.ts,interfaces.ts}` → `app/src/modules/training/trivia/`
- Move: `app/src/components/layout/trivia/QuickSubtract.astro` → `app/src/components/layout/training/trivia/QuickSubtract.astro`
- Move: `app/tests/lib/trivia/quick-subtract-play.data.test.ts` → `app/tests/lib/training/trivia/`
- Move: `app/tests/modules/trivia/{dart-scores.module.test.ts,quick-subtract.module.test.ts}` → `app/tests/modules/training/trivia/`
- Modify: `app/src/modules/types.ts`, `app/src/modules/interfaces.ts`, `app/src/modules/training/types.ts`, `app/src/modules/training/interfaces.ts`
- Modify: `app/src/lib/client/alpine/register-route-data.ts:22`
- Modify: `app/src/pages/training/quick-subtract/index.astro:5`
- Modify: `app/tests/lib/client/alpine/register-route-data.test.ts:4`

**Interfaces:**
- Consumes: nothing (first task).
- Produces: `@modules/training/trivia/quick-subtract.module` exporting `QuickSubtractGame`; `@lib/training/trivia/quick-subtract-play.data` exporting `quickSubtractPlay`; `@components/layout/training/trivia/QuickSubtract.astro`. Task 3 relies on `modules/training/types.ts` already raising `./trivia/types`.

- [ ] **Step 1: Cut the branch**

```bash
git checkout main
git pull
git checkout -b refactor/p1-training-taxonomy
```

- [ ] **Step 2: Create the target directories and move the files**

```bash
mkdir -p app/src/lib/training/trivia app/src/modules/training/trivia \
         app/src/components/layout/training/trivia \
         app/tests/lib/training/trivia app/tests/modules/training/trivia
git mv app/src/lib/trivia/quick-subtract-play.data.ts app/src/lib/training/trivia/
git mv app/src/modules/trivia/dart-scores.module.ts app/src/modules/training/trivia/
git mv app/src/modules/trivia/quick-subtract.module.ts app/src/modules/training/trivia/
git mv app/src/modules/trivia/types.ts app/src/modules/training/trivia/
git mv app/src/modules/trivia/interfaces.ts app/src/modules/training/trivia/
git mv app/src/components/layout/trivia/QuickSubtract.astro app/src/components/layout/training/trivia/
git mv app/tests/lib/trivia/quick-subtract-play.data.test.ts app/tests/lib/training/trivia/
git mv app/tests/modules/trivia/dart-scores.module.test.ts app/tests/modules/training/trivia/
git mv app/tests/modules/trivia/quick-subtract.module.test.ts app/tests/modules/training/trivia/
rmdir app/src/lib/trivia app/src/modules/trivia app/src/components/layout/trivia \
      app/tests/lib/trivia app/tests/modules/trivia
```

- [ ] **Step 3: Rewrite the five import sites**

`app/src/lib/training/trivia/quick-subtract-play.data.ts:1`:

```ts
import { QuickSubtractGame } from "@modules/training/trivia/quick-subtract.module";
```

`app/src/lib/client/alpine/register-route-data.ts:22`:

```ts
import { quickSubtractPlay } from "@lib/training/trivia/quick-subtract-play.data";
```

`app/src/pages/training/quick-subtract/index.astro:5`:

```astro
import QuickSubtract from "@components/layout/training/trivia/QuickSubtract.astro";
```

`app/tests/lib/training/trivia/quick-subtract-play.data.test.ts:3` and `app/tests/lib/client/alpine/register-route-data.test.ts:4`:

```ts
import { quickSubtractPlay } from "@lib/training/trivia/quick-subtract-play.data";
```

`app/tests/modules/training/trivia/dart-scores.module.test.ts:5` and `quick-subtract.module.test.ts:2`: change `@modules/trivia/…` to `@modules/training/trivia/…`.

- [ ] **Step 4: Re-point the barrels**

`app/src/modules/types.ts` — delete the `./trivia/types` line (trivia is now raised one level down):

```ts
export * from "./dartbot/types";
export * from "./exercise/types";
export * from "./game/types";
export * from "./stats/types";
export * from "./training/types";
export * from "./ui/types";
```

`app/src/modules/interfaces.ts` — delete the `./trivia/interfaces` line:

```ts
export * from "./dartbot/interfaces";
export * from "./exercise/interfaces";
export * from "./game/interfaces";
export * from "./training/interfaces";
export * from "./ui/interfaces";
```

`app/src/modules/training/types.ts` — add the raise as the **first** line, above the existing `import type` block:

```ts
export * from "./trivia/types";
```

`app/src/modules/training/interfaces.ts` — add as the first line:

```ts
export * from "./trivia/interfaces";
```

- [ ] **Step 5: Run the type gate and the tests**

```bash
cd app && npm run check && npm test
```

Expected: `astro check` reports 0 errors, 0 warnings, 0 hints; Vitest all green. A "Cannot find module '@modules/trivia/…'" error means a missed import site — find it with `grep -rn "modules/trivia\|lib/trivia\|layout/trivia" app/src app/tests`.

- [ ] **Step 6: Run the structure gates**

```bash
bash scripts/check-type-barrels.sh
bash scripts/check-file-locations.sh
cd app && npx fallow
```

Expected: each prints `OK:` / exits zero. `check-type-barrels.sh` failing with a grandchild-raise complaint means Step 4 was skipped or applied to the wrong file.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: move the trivia domain under training/ (#297)"
```

---

### Task 2: Move the exercise domain

**Files:**
- Move: `app/src/lib/exercise/{rulesets/,solo-participant-upload.ts,types.ts}` → `app/src/lib/training/exercises/`
- Move: `app/src/modules/exercise/*.ts` (8 files) → `app/src/modules/training/exercises/`
- Move: `app/tests/lib/exercise/**` → `app/tests/lib/training/exercises/`
- Move: `app/tests/modules/exercise/**` → `app/tests/modules/training/exercises/`
- Modify: `app/src/lib/types.ts`, `app/src/modules/types.ts`, `app/src/modules/interfaces.ts`, `app/src/lib/training/types.ts`, `app/src/modules/training/types.ts`, `app/src/modules/training/interfaces.ts`
- Modify: `app/src/services/exercise-rulesets/{double-pattern/double-pattern,warm-up/warm-up,switching/switching}.validator.ts:1`
- Modify: `app/src/lib/training/balanced-training-play.data.ts:9,10,16,17,18,21`

**Interfaces:**
- Consumes: Task 1's barrel shape (`modules/training/types.ts` already raises `./trivia/types`).
- Produces: `@modules/training/exercises/{engine.registry,dart-engine.registry,switching.engine.module,double-pattern.engine.module,warm-up.engine.module,solo-participant.module}`; `@lib/training/exercises/{rulesets/types,solo-participant-upload}`.

- [ ] **Step 1: Move the files**

```bash
mkdir -p app/src/lib/training/exercises app/src/modules/training/exercises \
         app/tests/lib/training/exercises app/tests/modules/training/exercises
git mv app/src/lib/exercise/rulesets app/src/lib/training/exercises/rulesets
git mv app/src/lib/exercise/solo-participant-upload.ts app/src/lib/training/exercises/
git mv app/src/lib/exercise/types.ts app/src/lib/training/exercises/
git mv app/src/modules/exercise/dart-engine.registry.ts app/src/modules/training/exercises/
git mv app/src/modules/exercise/double-pattern.engine.module.ts app/src/modules/training/exercises/
git mv app/src/modules/exercise/engine.registry.ts app/src/modules/training/exercises/
git mv app/src/modules/exercise/interfaces.ts app/src/modules/training/exercises/
git mv app/src/modules/exercise/solo-participant.module.ts app/src/modules/training/exercises/
git mv app/src/modules/exercise/switching.engine.module.ts app/src/modules/training/exercises/
git mv app/src/modules/exercise/types.ts app/src/modules/training/exercises/
git mv app/src/modules/exercise/warm-up.engine.module.ts app/src/modules/training/exercises/
git mv app/tests/lib/exercise/rulesets app/tests/lib/training/exercises/rulesets
git mv app/tests/lib/exercise/solo-participant-upload.test.ts app/tests/lib/training/exercises/
git mv app/tests/modules/exercise/dart-engine.registry.test.ts app/tests/modules/training/exercises/
git mv app/tests/modules/exercise/double-pattern.engine.module.test.ts app/tests/modules/training/exercises/
git mv app/tests/modules/exercise/engine.registry.test.ts app/tests/modules/training/exercises/
git mv app/tests/modules/exercise/solo-participant.module.test.ts app/tests/modules/training/exercises/
git mv app/tests/modules/exercise/switching.engine.module.test.ts app/tests/modules/training/exercises/
git mv app/tests/modules/exercise/warm-up.engine.module.test.ts app/tests/modules/training/exercises/
rmdir app/src/lib/exercise app/src/modules/exercise app/tests/lib/exercise app/tests/modules/exercise
```

- [ ] **Step 2: Rewrite every `exercise/` import**

Find them all first:

```bash
grep -rn "@lib/exercise\|@modules/exercise" app/src app/tests
```

Apply the mechanical rewrite `@lib/exercise/` → `@lib/training/exercises/` and `@modules/exercise/` → `@modules/training/exercises/`:

```bash
grep -rl "@lib/exercise\|@modules/exercise" app/src app/tests \
  | xargs sed -i '' -e 's|@lib/exercise/|@lib/training/exercises/|g' \
                    -e 's|@modules/exercise/|@modules/training/exercises/|g'
```

Then re-run the grep from the start of this step; expected output: nothing.

- [ ] **Step 3: Re-point the barrels**

`app/src/lib/types.ts` — replace the `./exercise/types` line so the file reads:

```ts
export * from "./auth/types";
export * from "./game/types";
export * from "./utils/types";
export * from "./stats/types";
export * from "./training/types";
```

`app/src/modules/types.ts` — delete the `./exercise/types` line, leaving `dartbot`, `game`, `stats`, `training`, `ui`.

`app/src/modules/interfaces.ts` — delete the `./exercise/interfaces` line, leaving `dartbot`, `game`, `training`, `ui`.

`app/src/modules/training/types.ts` — the raise block at the top becomes:

```ts
export * from "./exercises/types";
export * from "./trivia/types";
```

`app/src/modules/training/interfaces.ts` — top block becomes:

```ts
export * from "./exercises/interfaces";
export * from "./trivia/interfaces";
```

`app/src/lib/training/types.ts` — add as the first line:

```ts
export * from "./exercises/types";
```

- [ ] **Step 4: Run the type gate and tests**

```bash
cd app && npm run check && npm test
```

Expected: 0 errors, 0 warnings, 0 hints; all tests pass.

- [ ] **Step 5: Run the structure gates**

```bash
bash scripts/check-type-barrels.sh
bash scripts/check-game-engines.sh
cd app && npx fallow
```

Expected: all exit zero.

- [ ] **Step 6: Commit**

```bash
git add -A
git commit -m "refactor: move the exercise domain under training/ (#297)"
```

---

### Task 3: Sink today's flat training files into `routines/`

**Files:**
- Move: `app/src/lib/training/{balanced-training-play.data.ts,finishing-step.data.ts,routine-start.data.ts,step-advance-error.ts,step-session-conflict.ts}` → `app/src/lib/training/routines/`
- Move: `app/src/lib/training/types.ts` declarations → `app/src/lib/training/routines/types.ts` (barrel stays behind)
- Move: `app/src/modules/training/{routine-duration.module.ts,routine-summary.module.ts,training.module.ts}` → `app/src/modules/training/routines/`
- Move: `app/src/modules/training/types.ts` / `interfaces.ts` declarations → `app/src/modules/training/routines/`
- Move: `app/src/components/layout/training/{WarmUpPanel,SwitchingPanel,DoublePatternPanel,ExerciseBoardInputPanel,BlockedStepModal}.astro` → `components/layout/training/exercises/`
- Move: `app/src/components/layout/training/{RoutineDetail,RoutineSummaryModal}.astro` → `components/layout/training/routines/`
- Move: `app/tests/lib/training/*.test.ts` → `app/tests/lib/training/routines/`; `app/tests/modules/training/*.test.ts` → `app/tests/modules/training/routines/`
- Modify: `app/src/lib/client/alpine/register-route-data.ts:23-24`, `app/src/pages/training/balanced-training/index.astro:5`, `app/src/pages/training/balanced-training/play/index.astro:4,5,6,12,13`

**Interfaces:**
- Consumes: Tasks 1–2's barrels.
- Produces: final barrel shape — `lib/training/types.ts` raises `./exercises/types` + `./routines/types`; `modules/training/types.ts` raises `./exercises/types` + `./routines/types` + `./trivia/types`.

- [ ] **Step 1: Move the source and test files**

```bash
mkdir -p app/src/lib/training/routines app/src/modules/training/routines \
         app/src/components/layout/training/{exercises,routines} \
         app/tests/lib/training/routines app/tests/modules/training/routines
git mv app/src/lib/training/balanced-training-play.data.ts app/src/lib/training/routines/
git mv app/src/lib/training/finishing-step.data.ts app/src/lib/training/routines/
git mv app/src/lib/training/routine-start.data.ts app/src/lib/training/routines/
git mv app/src/lib/training/step-advance-error.ts app/src/lib/training/routines/
git mv app/src/lib/training/step-session-conflict.ts app/src/lib/training/routines/
git mv app/src/modules/training/routine-duration.module.ts app/src/modules/training/routines/
git mv app/src/modules/training/routine-summary.module.ts app/src/modules/training/routines/
git mv app/src/modules/training/training.module.ts app/src/modules/training/routines/
git mv app/src/components/layout/training/WarmUpPanel.astro app/src/components/layout/training/exercises/
git mv app/src/components/layout/training/SwitchingPanel.astro app/src/components/layout/training/exercises/
git mv app/src/components/layout/training/DoublePatternPanel.astro app/src/components/layout/training/exercises/
git mv app/src/components/layout/training/ExerciseBoardInputPanel.astro app/src/components/layout/training/exercises/
git mv app/src/components/layout/training/BlockedStepModal.astro app/src/components/layout/training/exercises/
git mv app/src/components/layout/training/RoutineDetail.astro app/src/components/layout/training/routines/
git mv app/src/components/layout/training/RoutineSummaryModal.astro app/src/components/layout/training/routines/
git mv app/tests/lib/training/balanced-training-play.data.test.ts app/tests/lib/training/routines/
git mv app/tests/lib/training/finishing-step.data.test.ts app/tests/lib/training/routines/
git mv app/tests/lib/training/routine-start.data.test.ts app/tests/lib/training/routines/
git mv app/tests/lib/training/step-advance-error.test.ts app/tests/lib/training/routines/
git mv app/tests/lib/training/step-session-conflict.test.ts app/tests/lib/training/routines/
git mv app/tests/modules/training/routine-duration.module.test.ts app/tests/modules/training/routines/
git mv app/tests/modules/training/routine-summary.module.test.ts app/tests/modules/training/routines/
git mv app/tests/modules/training/training.module.test.ts app/tests/modules/training/routines/
```

- [ ] **Step 2: Split the two barrel files**

`app/src/lib/training/types.ts` holds declarations today. Move the file down and put a barrel in its place:

```bash
git mv app/src/lib/training/types.ts app/src/lib/training/routines/types.ts
git mv app/src/modules/training/types.ts app/src/modules/training/routines/types.ts
git mv app/src/modules/training/interfaces.ts app/src/modules/training/routines/interfaces.ts
```

Now remove the raise lines that Tasks 1–2 added (they belong in the new parent barrel, not in `routines/`): delete `export * from "./exercises/types";` from `app/src/lib/training/routines/types.ts`, and delete `export * from "./exercises/types";` / `export * from "./trivia/types";` from `app/src/modules/training/routines/types.ts`, plus the two matching lines from `app/src/modules/training/routines/interfaces.ts`.

Create `app/src/lib/training/types.ts`:

```ts
export * from "./exercises/types";
export * from "./routines/types";
```

Create `app/src/modules/training/types.ts`:

```ts
export * from "./exercises/types";
export * from "./routines/types";
export * from "./trivia/types";
```

Create `app/src/modules/training/interfaces.ts`:

```ts
export * from "./exercises/interfaces";
export * from "./routines/interfaces";
export * from "./trivia/interfaces";
```

- [ ] **Step 3: Fix relative imports inside the moved files**

`check-type-barrels.sh` rule 4: a relative type import may only reach the file's own folder. `app/src/lib/training/routines/types.ts:…` imports `./finishing-step.data` — that file moved alongside it, so the specifier still resolves. Verify no moved file reaches a parent:

```bash
grep -rn 'from "\.\./' app/src/lib/training app/src/modules/training
```

Expected: no hits. Any hit must be rewritten to an alias (`@lib/…` / `@modules/…`) for a value import, or to the area-root barrel (`@lib/types`, `@modules/types`) for a type import.

- [ ] **Step 4: Rewrite the consumer imports**

```bash
grep -rl "@lib/training/\|@modules/training/\|@components/layout/training/" app/src app/tests \
  | xargs sed -i '' \
      -e 's|@lib/training/balanced-training-play.data|@lib/training/routines/balanced-training-play.data|g' \
      -e 's|@lib/training/finishing-step.data|@lib/training/routines/finishing-step.data|g' \
      -e 's|@lib/training/routine-start.data|@lib/training/routines/routine-start.data|g' \
      -e 's|@lib/training/step-advance-error|@lib/training/routines/step-advance-error|g' \
      -e 's|@lib/training/step-session-conflict|@lib/training/routines/step-session-conflict|g' \
      -e 's|@modules/training/training.module|@modules/training/routines/training.module|g' \
      -e 's|@modules/training/routine-summary.module|@modules/training/routines/routine-summary.module|g' \
      -e 's|@modules/training/routine-duration.module|@modules/training/routines/routine-duration.module|g' \
      -e 's|@components/layout/training/WarmUpPanel|@components/layout/training/exercises/WarmUpPanel|g' \
      -e 's|@components/layout/training/SwitchingPanel|@components/layout/training/exercises/SwitchingPanel|g' \
      -e 's|@components/layout/training/DoublePatternPanel|@components/layout/training/exercises/DoublePatternPanel|g' \
      -e 's|@components/layout/training/ExerciseBoardInputPanel|@components/layout/training/exercises/ExerciseBoardInputPanel|g' \
      -e 's|@components/layout/training/BlockedStepModal|@components/layout/training/exercises/BlockedStepModal|g' \
      -e 's|@components/layout/training/RoutineDetail|@components/layout/training/routines/RoutineDetail|g' \
      -e 's|@components/layout/training/RoutineSummaryModal|@components/layout/training/routines/RoutineSummaryModal|g'
```

- [ ] **Step 5: Run the full type gate, tests and structure gates**

```bash
cd app && npm run check && npm test && npx fallow
bash scripts/check-type-barrels.sh
bash scripts/check-file-locations.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-astro-class-composition.sh
```

Expected: every command exits zero; `astro check` reports 0/0/0.

- [ ] **Step 6: Confirm the source tree is clean of the old names**

```bash
grep -rn "trivia" app/src | grep -v trivial | grep -v "training/trivia"
grep -rn "@lib/exercise\|@modules/exercise" app/src app/tests
```

Expected: the first may print only files whose *copy* says "trivia" (Quick Subtract's own UI text); the second prints nothing.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: sink flat training files into training/routines (#297)"
```

---

### Task 4: Delete the `@forms` layer

**Files:**
- Modify: `app/tsconfig.json:17`
- Modify: `app/vitest.config.ts:17`
- Modify: `app/CLAUDE.md:118`
- Modify: `docs/architecture/07-Frontend/02-Folder-Structure.md:48,73,74,84,96,133,141,150,160,163,166`

**Interfaces:**
- Consumes: nothing from Tasks 1–3.
- Produces: no `@forms` alias anywhere.

- [ ] **Step 1: Prove the layer is empty before deleting anything**

```bash
ls app/src/forms 2>&1
grep -rn "@forms" app/src app/tests
find app/src -name "*.form.ts"
```

Expected: `No such file or directory`, then no output from either search. If any command prints a hit, **stop** — the premise of issue #348 no longer holds and the task needs re-scoping.

- [ ] **Step 2: Drop the alias from both configs**

`app/tsconfig.json` — delete the line:

```json
      "@forms/*": ["./src/forms/*"],
```

`app/vitest.config.ts` — delete the line:

```ts
      "@forms": path.resolve(__dirname, "./src/forms"),
```

Both must go in this one commit: `check-alias-sync.sh` fails when the two sets diverge.

- [ ] **Step 3: Drop `.form.ts` from the app rule file**

In `app/CLAUDE.md:118`, the suffix list reads:

```
file suffix conventions (`.store.ts`, `.form.ts`, `.data.ts`, `*.module.ts`)
```

Change it to:

```
file suffix conventions (`.store.ts`, `.data.ts`, `*.module.ts`)
```

Make exactly two edits to that line and nothing else: drop `` `.form.ts`, `` from the suffix list, and change `` `$persist` only in stores/forms `` to `` `$persist` only in stores ``. Every other clause on the line — the Alpine shorthand rule, the `x-init` ban, D120's `PersistFactory` rule — stays byte-identical.

`app/AGENT.md` needs no edit: `check-agent-mirrors.sh` requires it to be a fixed pointer stub with no rules.

- [ ] **Step 4: Remove the layer from the folder-structure doc**

In `docs/architecture/07-Frontend/02-Folder-Structure.md`:
- line 48: delete the `├── forms/` tree row
- line 73: drop `@forms` from the Worker import-direction row
- lines 74, 84, 150, 160, 163, 166: drop `forms/` (and `forms`) from each list, keeping the surrounding sentence grammatical
- line 96: delete the `| @forms/* | src/forms/* |` alias row
- line 133: delete the `.form.ts` suffix row
- line 141: drop `session-setup.form.ts` from the examples list

- [ ] **Step 5: Record the decision**

Derive the next free id — do not assume `D294`:

```bash
git fetch origin main
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Both id forms must be searched: migrated table rows (`| D123 |`) and block headings (`### D123`) share one id space. This is the command `DECISIONS.md` §"How to add a decision" prescribes.

Append a block to `decisions/frontend/alpine.md`, using that id + 1, in the file's existing format:

```markdown
### D<next> — The `forms/` layer is retired unbuilt; `settings.store.ts` is D77's substitute in practice
Status: Accepted · Date: 2026-09-17 · Refines: D77
Decision: the `@forms` alias, the `src/forms/` tree entry, the `.form.ts` suffix convention and its `$persist` permission are removed from `app/tsconfig.json`, `app/vitest.config.ts`, `app/CLAUDE.md` and `07-Frontend/02-Folder-Structure.md`. D77 and D86 are not edited — the ledger is append-only and their reasoning was sound at the time.
Reason: D77 deferred `player_settings` post-v1 and named `forms/` as the local-persistence substitute. The substitute that actually shipped was `settings.store.ts`, and `src/forms/` was never created: no `*.form.ts` file exists, nothing imports `@forms`, and the alias resolves to a missing directory in both configs (issue #348). A documented non-negotiable convention governing a layer with zero instances costs attention on every read and traps the first file that tries to use the broken alias.
Consequences: a future forms layer is a new decision, not a resumption of this one — it would re-add both alias entries in one commit (`check-alias-sync.sh`) and restate the suffix convention. Local per-device preferences continue to live in stores, as D86's handedness field already does.
```

- [ ] **Step 6: Run the gates**

```bash
bash scripts/check-alias-sync.sh
bash scripts/check-decision-ids.sh
bash scripts/check-doc-links.sh
cd app && npm run check && npm test
```

Expected: all exit zero.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "refactor: remove the unbuilt forms layer and its @forms alias (#348)"
```

---

### Task 5: Move the docs tree

**Files:**
- Create: `docs/architecture/09-Training/00-Overview.md`
- Move: `docs/architecture/09-training-routines.md` → `docs/architecture/09-Training/01-Routines.md`
- Move: `docs/architecture/10-trivia.md` → `docs/architecture/09-Training/02-Trivia.md`
- Move: `docs/game-rules/trivia/` → `docs/game-rules/training/trivia/`
- Move: `docs/game-rules/routines/` → `docs/game-rules/training/routines/`
- Modify: `docs/architecture/00-Context-Map.md`, `docs/architecture/00-File-Inventory.md`, `docs/game-rules/README.md`, `decisions/frontend/architecture.md`, `app/.fallowrc.jsonc` (verify only)

**Interfaces:**
- Consumes: the source layout from Tasks 1–3.
- Produces: the doc paths every later plan and the Context Map cite.

- [ ] **Step 1: Move the doc files**

```bash
mkdir -p docs/architecture/09-Training docs/game-rules/training
git mv docs/architecture/09-training-routines.md docs/architecture/09-Training/01-Routines.md
git mv docs/architecture/10-trivia.md docs/architecture/09-Training/02-Trivia.md
git mv docs/game-rules/trivia docs/game-rules/training/trivia
git mv docs/game-rules/routines docs/game-rules/training/routines
```

- [ ] **Step 2: Write the folder overview**

Create `docs/architecture/09-Training/00-Overview.md`, matching the front-matter shape every canonical doc uses (`05-Database/00-OVERVIEW.md` is the reference):

```markdown
<!--
status: canonical
scope: architecture/training
read-when: orienting in the /training surface before reading either sibling
updated: 2026-09-17
-->

# Training — Overview

`/training` bundles two kinds of thing, and this folder holds one file per kind:

| File | Covers |
| ---- | ------ |
| `01-Routines.md` | the Training/Routine/`ExerciseEngine` model, routine steps, exercise types, persistence |
| `02-Trivia.md` | the non-persisted client tools (Quick Subtract, Checkout Trivia) that sit outside `ExerciseEngine` (D261) |

Both surfaces are flat cards on `/training` — "trivia" is a source and docs domain, not a UI category (D265). The source tree mirrors this split: `lib/training/{trivia,exercises,routines}`, and the same three sub-domains under `modules/` and `components/layout/training/`.
```

- [ ] **Step 3: Update the Context Map**

In `docs/architecture/00-Context-Map.md`, the Context Packs table row reading `| New non-game client tool (Trivia) | ... 10-trivia.md ... docs/game-rules/trivia/README.md | ~18.5k |` must cite `09-Training/02-Trivia.md` and `docs/game-rules/training/trivia/README.md`. Update every other row that names `09-training-routines.md` or `10-trivia.md` the same way, and add `09-Training/00-Overview.md` to the training pack.

Find them all:

```bash
grep -n "09-training-routines\|10-trivia\|game-rules/trivia\|game-rules/routines" docs/architecture/00-Context-Map.md
```

- [ ] **Step 4: Update the File Inventory**

```bash
grep -n "09-training-routines\|10-trivia\|game-rules/trivia\|game-rules/routines\|lib/trivia\|modules/trivia\|lib/exercise\|modules/exercise\|layout/trivia\|lib/training/\|modules/training/\|layout/training/" docs/architecture/00-File-Inventory.md
```

Rewrite every hit to its new path, and add a row for `docs/architecture/09-Training/00-Overview.md`.

- [ ] **Step 5: Update the remaining references**

```bash
grep -rn "10-trivia\|09-training-routines\|game-rules/trivia\|game-rules/routines" docs decisions app .claude --include="*.md" --include="*.jsonc"
```

Rewrite each hit. `decisions/**` is append-only for *decision blocks*, but a path inside an existing block is a reference, not a decision — update it in place and do not renumber anything. Confirm `app/.fallowrc.jsonc` names no moved path:

```bash
grep -n "trivia\|exercise\|training" app/.fallowrc.jsonc
```

Expected: no hits.

- [ ] **Step 6: Record the taxonomy decision**

Derive the next free id again (Task 4 consumed one):

```bash
git fetch origin main
git grep -ohE '^\| D[0-9]+ \||^### D[0-9]+' -- 'decisions/**.md' | grep -oE 'D[0-9]+' | sed 's/D0*//' | sort -n | tail -1
```

Append to `decisions/frontend/architecture.md`:

```markdown
### D<next> — `training/` is the umbrella domain; trivia and exercises are its sub-domains
Status: Accepted · Date: 2026-09-17 · Refines: D261, D265
Decision: `lib/`, `modules/` and `components/layout/` each carry one `training/` domain with three children — `trivia/`, `exercises/`, `routines/`. `docs/architecture/09-Training/` and `docs/game-rules/training/` mirror it. `components/layout/games/`, `services/exercise-rulesets/` and `docs/game-rules/rulesets/` stay outside the umbrella.
Reason: D265 retired "trivia" as a UI category — Quick Subtract is a flat card under `/training`, a sibling of Balanced Training — but only the page routes moved, leaving three source folders named after an IA that no longer exists (issue #297). `/training` bundles trivia tools and routine exercises, so one umbrella with named sub-domains says what the app is, where three flat siblings said what it used to be.
Consequences: the type-barrel chain gained a level — `training/types.ts` is now a pure barrel raising its three children, and the routine declarations live in `training/routines/types.ts`, because `check-type-barrels.sh` rule 2 forbids raising a grandchild. `services/exercise-rulesets/` keeps its name and does not mirror `lib/training/exercises/`: the two sit on opposite sides of the Worker/browser boundary and were never a mirrored pair. Games are not training, so `components/layout/games/` stays where it is.
```

- [ ] **Step 7: Run the doc gates**

```bash
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
bash scripts/check-decision-ids.sh
bash scripts/check-file-locations.sh
```

Expected: every script prints `OK:`. `check-doc-links.sh` failing names the unresolved path — that is a reference Step 5's grep missed.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "docs: mirror the training taxonomy in the docs tree (#297)"
```

---

### Task 6: Final verification and PR

**Files:** none changed; verification only.

- [ ] **Step 1: Run the whole app validation chain**

```bash
cd app && npm run check && npm test && npx fallow && npm run format:check
```

Expected: `astro check` 0 errors / 0 warnings / 0 hints; Vitest green; fallow exits zero; Prettier reports no unformatted file. If `format:check` fails, run `npm run format` and amend the last commit.

- [ ] **Step 2: Run every structure gate the pre-commit hook runs**

```bash
bash scripts/check-file-locations.sh
bash scripts/check-agent-mirrors.sh
bash scripts/check-astro-class-composition.sh
bash scripts/check-astro-conventions.sh
bash scripts/check-doc-links.sh
bash scripts/check-context-map.sh
bash scripts/check-context-budget.sh
bash scripts/check-decision-ids.sh
bash scripts/check-type-barrels.sh
bash scripts/check-alias-sync.sh
bash scripts/check-game-engines.sh
bash scripts/check-no-inline-comments.sh
bash scripts/check-style-tokens.sh
bash scripts/check-game-wiring.sh
```

Record each script's own pass/fail line. A skipped script is a failed verification.

- [ ] **Step 3: Run the coverage gate against the branch**

```bash
TEST_COVERAGE_BASE_REF=origin/main bash scripts/check-test-coverage.sh
```

Expected: zero exit. A failure naming a moved source file means its test did not move with it — fix by moving the test, never by adding a silencer.

- [ ] **Step 4: Open the PR**

```bash
git push -u origin refactor/p1-training-taxonomy
gh pr create --base main --title "refactor: one training umbrella, and delete the unbuilt forms layer (#297, #348)" --body "$(cat <<'EOF'
Re-homes `trivia/`, `exercise/` and the flat `training/` files under `training/{trivia,exercises,routines}` in `lib/`, `modules/`, `components/layout/`, `tests/` and `docs/`. Deletes the `@forms` alias, the `.form.ts` convention and the documented forms layer, which had zero instances.

Moves only — no function body changed. The one structural change is the type-barrel chain gaining a level, required by `check-type-barrels.sh` rule 2.

Spec: `docs/superpowers/specs/2026-09-17-technical-debt-sweep-design.md` §3

Closes #297
Closes #348

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

- [ ] **Step 5: Re-derive the decision ids against the merge state**

If CI's `check-decision-ids.sh` fails on a duplicate, another branch landed the same id first. Renumber both decision blocks on this branch and every citation of them, then push again. P5 delivers a helper for exactly this; until it lands, do it by hand with `grep -rn "D<old>" .`
