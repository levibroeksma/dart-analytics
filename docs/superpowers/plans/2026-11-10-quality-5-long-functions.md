# Quality 5 — Split 27 long service, repository and module functions

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** No function over 60 lines in `services/`, `repositories/`, `modules/`, `lib/**` non-`.data.ts` files and `app/scripts/`; `large_functions_src` drops from 114 to ≤ 87.

**Architecture:** Extract-function only. Each long function keeps its name, signature and export; steps inside it move to unexported helpers in the same file, in call order. No new files, no new exports, no shared helpers across files (rule of three, D513).

**Tech Stack:** TypeScript, Vitest, fallow 3.42.0.

**Spec:** `docs/superpowers/specs/2026-11-10-codebase-quality-audit-design.md` § 2, § 4. Needs plans 1 and 2 merged.

## Global Constraints

- No behaviour change: same SQL text and parameter order, same HTTP bodies, same error codes and messages, same thrown-error order.
- A helper takes data, never a flag that picks a branch.
- No comments inside function bodies; a helper gets a one-line doc comment.
- Every task: `cd app && npm test` → at least `11295 passed`; `npm run check` → 0 errors, 0 warnings, 0 hints; `bash scripts/fallow-gate.sh` → exit 0 (new helpers must stay under cognitive 15, cyclomatic 20).
- `check-test-coverage.sh` needs a test edit per runtime file edit: add one assertion that pins a value the function returns (not a no-op edit).
- Integration suite reads the repositories: run `npm run test:integration` against `scripts/local-pg.sh` for tasks 2 and 3; CI runs it too.
- Each task ends with `bash scripts/check-quality-benchmarks.sh --update` and commits the lowered `large_functions_src`.
- Finish with `context-maintenance`, `run-all-gates`, `finishing-a-dart-branch`.

## Review Focus

- Await order inside a transaction: a helper that awaits must be awaited at the same point; two statements must not become concurrent.
- Early returns: a `return issue` inside the old body becomes `if (issue) return issue` at the call site, in the same position.
- SQL built with drizzle `sql` templates: the helper returns the fragment; the final statement text is identical (the integration suite proves execution, not text — diff `toSQL()` output in a test where one exists).
- Variables captured by closures (`tx`, `requestId`, lookups) are passed in; none becomes module state.
- `createSession` validates in a fixed order and reports the first failure: keep the order.

---

### Task 1: `session.service.ts` and `training-session.service.ts` (6 functions)

**Files:**
- Modify: `app/src/services/session.service.ts` — `createSession` (137), `loadCreateSessionLookups` (76), `appendBatch` (67)
- Modify: `app/src/services/training-session.service.ts` — `startTraining` (84), `resumeTraining` (64), `startTrainingStep` (62)
- Test: `app/tests/services/session.service.test.ts`, `app/tests/services/training-session.service.test.ts`

- [ ] **Step 1:** Run both test files; note pass counts.
- [ ] **Step 2:** Split each function into unexported helpers named for the step (`validateX`, `buildXRecords`, `writeX`); each function and helper ≤ 60 lines.
- [ ] **Step 3: Verify.** `cd app && npx --no-install fallow health --format json -q 2>/dev/null | jq '[.large_functions[]|select(.path|test("services/(training-)?session.service"))]|length'` → `0`. Global checks pass.
- [ ] **Step 4:** Update the benchmark; commit.

### Task 2: `statistics.service.ts` and `routine.service.ts` (5 functions)

**Files:**
- Modify: `app/src/services/statistics.service.ts` — `getRoutineStepSection` (124), `dispatchGameSection` (72), `getSessionReplay` (68), `getRoutineSection` (66)
- Modify: `app/src/services/routine.service.ts` — `writeIssues` (61)
- Test: `app/tests/services/statistics.service.test.ts`, `app/tests/services/routine.service.test.ts`

- [ ] **Step 1–4:** As task 1. `dispatchGameSection` is a dispatch: if it is one `switch`, replace it with a `Record<SectionKey, handler>` lookup only if every case already has the same call shape; otherwise split the case bodies into helpers and keep the `switch`. Verify with the same `jq` filter on `services/(statistics|routine).service`.

### Task 3: Repositories (6 functions)

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts` — `findRoutineRunBuckets` (96), `findBucketedSessionAggregates` (80), `findReplaySession` (77), `findRoutineStepDescriptors` (75)
- Modify: `app/src/repositories/session.repository.ts` — `insertBatchRecords` (77) and the 73-line arrow at the line fallow reports
- Test: matching files under `app/tests/repositories/`

- [ ] **Step 1–4:** As task 1. For a function that is one long query, extract the select-column object and the row mapper as unexported constants/functions; the query call stays in the function. Run `npm run test:integration`.

### Task 4: Modules and lib (8 functions)

**Files:**
- Modify: `app/src/modules/game/dart-engine-shell.module.ts` — `dartGameEngineClass` (222)
- Modify: `app/src/modules/training/exercises/dart-exercise-shell.module.ts` — `dartExerciseEngineClass` (65)
- Modify: `app/src/modules/game/board-input.module.ts` — `boardInput` (91); `app/src/modules/ui/chart.module.ts` — `createTooltip` (69)
- Modify: `app/src/lib/game/setup-session.ts` — `createSetupSession` (114); `setup-controller.ts` — `startPresetSession` (65); `play-lifecycle.ts` — `runPlayAgain` (85); `app/src/lib/client/stats-cache/cache.ts` — `readServerSection` (75)
- Test: the matching test files

- [ ] **Step 1–4:** As task 1. The two `…EngineClass` functions return a class: move method bodies longer than a few lines to module-level functions that take the instance state as arguments; the class stays inside the factory and delegates. `bash scripts/check-game-engines.sh && bash scripts/check-engine-kernels.sh` → `OK`.

### Task 5: Offline scripts (2 functions)

**Files:**
- Modify: `app/scripts/generate-tag-seed.ts` — `buildSeedSql` (181); `app/scripts/dartbot-level-curve-recalibration.ts` — `main` (70)

- [ ] **Step 1:** Before editing: `cd app && npx tsx scripts/generate-tag-seed.ts --check` → passes.
- [ ] **Step 2:** Split into helpers.
- [ ] **Step 3: Verify.** `bash scripts/check-tag-seeds.sh` → `PASS` (the generated SQL is byte-identical to the committed seed). `npm test -- tests/scripts` → passes.
- [ ] **Step 4:** Update the benchmark; commit.

### Task 6: Close out

- [ ] **Step 1: Verify.** `bash scripts/check-quality-benchmarks.sh` → `ok`, and `jq '.rows.large_functions_src.now' scripts/quality-benchmarks.json` → `≤ 87`; `.rows.health_score.now` → `≥ 88.5`.
- [ ] **Step 2:** One decision (next id) listing the files and stating "extract-function only, no contract change".
