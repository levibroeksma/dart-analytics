# Duplication Backlog Phase 4c Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the last 7 clone-baseline rows (engines, validators, one repository self-clone) so `scripts/dupes-baseline.txt` is empty, with no behaviour change.

**Architecture:** Each group is folded into one shared unit and its copies migrated. Hand-written exercise engines move onto the existing `dartExerciseEngineClass` shell (the pattern 9 sibling engines already use). Persisted facts, refusal strings and validator issues stay byte-identical, pinned by characterization tests written before each refactor.

**Tech Stack:** TypeScript, Vitest, Zod, fallow dupes.

**Spec:** this plan continues `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4b.md`; decisions D513 (rule of three), D264 (exercise engines), D527 (4b); issue #1184 (`validateBatch`).

## Global Constraints

- No behaviour change. Persisted facts (`stages`, `turns`, `darts`, `completedAt` timing, intents), refusal messages, validator `issues` strings and their order stay identical.
- No `//` or `/* */` comments inside function bodies in `app/src`. Doc comments describe the declaration, no decision history (cite `(D…)` only).
- Exported types go in `types.ts` (`interfaces.ts` in `repositories/`).
- Pre-commit coverage gate needs a test edit for every runtime `.ts` source edit. Never `--no-verify`.
- **Every task runs the full `cd app && npm test` before committing and reports file/test counts** (pre-commit does not run vitest; 4b's Task 1 shipped 4 failures this way).
- `scripts/dupes-baseline.txt` is edited by Task 7 only (`--update`, removals only).
- Decisions append-only; next id from `scripts/next-decision-id.sh` (expected D528). Never `prettier --write` docs; run `cd app && npm run format` before the PR.
- Every `*.engine.module.ts` keeps its row in `scripts/engine-kernels.txt` (`scripts/check-engine-kernels.sh` gate); update the row if the migration changes its status or reason.
- Commit trailers: `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>` and `Claude-Session: https://claude.ai/code/session_01UTDrHTNi9HoHm2D3nVY33B`.
- Out of scope: the optional `respond()` route helper; any `discovered-work` finding (file an issue, do not fix).

## Review Focus

- Engine fact equality: for a scripted dart sequence with undo and `expireTimer()`, `facts()` must match before/after for each migrated engine (turn count, dart order, `completedAt` null vs set at the same dart, `intendedTargetNumber`/`intendedZoneKey`, stage `clientKey`). Test: characterization case per engine, written first and green on the old code.
- `expireTimer()` then `undo()` reverses the expiry; a further `undo()` pops a dart; `record()` after completion throws the same message (`"exercise is complete"`). Test: same sequences.
- Prior-facts constructor: engines resume from `prior` facts (`cloneTurns`) and `complete` derives from `expired` only (no `ends`). Test: construct from `prior`, record one dart, compare to a continuous run.
- Validator parity: ScoreTraining and TUOD return identical `issues` text and order for each of: unsupported mode pair, over-max visit, visual-board turns, rounds limit. TUOD applies the rounds limit on the quick-score path only; Score Training on both. Test: table-driven cases on both validators, green before and after.
- Repository mapper: key order and `neverStarted` rule per query (game: `statusKey === "ABANDONED" && turnCount === 0`; routine step: `null` for `WARM_UP_V1`). Test: existing repository tests plus one added case per mapper.

## Baseline / End State

7 rows → 0 (file empty). Rows removed: `bobs27|singles-training`, `bull-up|bullseye-checkout|double-pattern|switching`, `bullseye-checkout|double-pattern|switching`, `double-pattern|switching`, `switching-chain|target-scoring`, `statistics.repository.ts`, `score-training.validator|tuod.validator`.

## File Map

- T1: new `app/src/services/rulesets/scored-batch.validator.ts`; modify `score-training.validator.ts`, `tuod.validator.ts`.
- T2–T3: modify `bull-up`, `bullseye-checkout`, `double-pattern`, `switching` `.engine.module.ts`; reference shape `target-scoring.engine.module.ts` + `dart-exercise-shell.module.ts` + `track-exercise-spec.module.ts`.
- T4: modify `switching-chain.engine.module.ts`, `target-scoring.engine.module.ts`.
- T5: modify `bobs27.engine.module.ts`, `singles-training.engine.module.ts` (and `baseball.engine.module.ts` if it shares the same lines), shared helpers in `modules/game/seat-state.module.ts` or `turn-log.module.ts`.
- T6: modify `app/src/repositories/statistics.repository.ts`.
- T7: docs, baseline.

---

### Task 1 (J1): shared scored-batch validator (#1184)

**Files:**
- Create: `app/src/services/rulesets/scored-batch.validator.ts`
- Modify: `app/src/services/rulesets/score-training/score-training.validator.ts`, `app/src/services/rulesets/tuod/tuod.validator.ts`
- Test: `app/tests/services/rulesets/score-training/`, `app/tests/services/rulesets/tuod/` (parity table), new `app/tests/services/rulesets/scored-batch.validator.test.ts`

**Interfaces:**
- Produces: `validateScoredBatch(input: ModedBatchValidationInput, options: { maxTurnScore: number; limitNoun: "visits" | "attempts"; limitOnVisualBoard: boolean }): BatchValidationResult`. Order inside: visual-board branch (`validateVisualBoardTurns`, then the rounds limit only when `limitOnVisualBoard`), unsupported-pair rejection (`unsupported mode pair ${captureModeKey} + ${inputModeKey}`), `validateQuickScoreTurns`, rounds limit (`session is limited to ${config.duration_value} ${limitNoun}`).
- Consumes: `isVisualBoardCapture`, `validateVisualBoardTurns`, `isQuickScoreCapture`, `validateQuickScoreTurns`, `exceedsRoundsLimit`.
- Score Training passes `{ maxTurnScore: (config.max_visit_score as number | undefined) ?? 180, limitNoun: "visits", limitOnVisualBoard: true }`; TUOD passes `{ maxTurnScore: maxTurnScore(config), limitNoun: "attempts", limitOnVisualBoard: false }`.

- [ ] **Step 1: Write parity tests first** (table-driven, both validators): unsupported mode pair, over-max visit on each path, rounds limit exceeded on quick path, rounds limit on visual-board path (Score Training rejects; TUOD accepts). Run: green on current code.
- [ ] **Step 2: Implement `validateScoredBatch`** and migrate both validators' `validateBatch` bodies to one call. Keep `validateConfig` untouched.
- [ ] **Step 3: Add `scored-batch.validator.test.ts`** covering the option matrix directly.
- [ ] **Step 4: Verify.** Full `npm test`, `npx astro check` 0/0/0, `bash scripts/check-dupes.sh` shows the validator row gone.
- [ ] **Step 5: Commit** `refactor(services): share scored-batch validation across score training and tuod`.

### Task 2 (J2): bull-up and bullseye-checkout onto the exercise shell

**Files:**
- Modify: `app/src/modules/training/exercises/bull-up.engine.module.ts`, `bullseye-checkout.engine.module.ts`; `scripts/engine-kernels.txt` rows if the gate needs it
- Test: existing engine tests under `app/tests/modules/training/exercises/`; add characterization cases

**Interfaces:**
- Consumes: `dartExerciseEngineClass(spec)`, `registerDartExercise(spec, Engine)` (see `target-scoring.engine.module.ts:161-170`), `DartExerciseSpec` in `exercises/interfaces.ts` (`parse`, `fold(facts, config, expired)`, `intent(state, config)`, `isVisitOpen(turn, state)`, `ends?`).
- Produces: each engine keeps its exports (`BullUpEngine`, `foldBullUpState`, factories) with unchanged signatures; callers and registries must not change.
- Differences to preserve: Bull Up closes the visit after every dart (`isVisitOpen` false once the turn has a dart) and aims at `BULL_INTENT`; Bullseye Checkout visits are three darts, intent only on the finishing dart (`FINISHING_DART_INTENT` when `turn.darts.length === DARTS_PER_VISIT - 1`, none otherwise).

- [ ] **Step 1: Characterization first.** For each engine add a test driving a scripted dart sequence plus undo and `expireTimer()`; assert `facts()` shape per Review Focus (completion timing by null/non-null `completedAt`, intents). Also a `prior`-constructor case. Run: green on the old code.
- [ ] **Step 2: Migrate** each engine to a `DartExerciseSpec` + shell class; delete the hand-written `record/undo/expireTimer/isComplete/state`. If `intent` needs the pre-dart visit length, derive it from `state`/`turn` the way the existing shell engines do; if no clean mapping exists, stop and report NEEDS_CONTEXT.
- [ ] **Step 3: Verify.** Characterization still green; full `npm test`; `astro check`; `bash scripts/check-engine-kernels.sh`; `bash scripts/check-game-engines.sh`.
- [ ] **Step 4: Commit** `refactor(training): bind bull-up and bullseye-checkout to the exercise shell`.

### Task 3 (J3): double-pattern and switching onto the exercise shell

**Files:**
- Modify: `double-pattern.engine.module.ts`, `switching.engine.module.ts`; `scripts/engine-kernels.txt` rows if the gate needs it
- Test: existing tests plus characterization cases as in Task 2

**Interfaces:**
- As Task 2. Differences to preserve: Double Pattern aims each dart at `intendedDouble` (pattern index) with `intendedZoneKey: "DOUBLE"` and closes the visit when `turn.darts.length === patternLength`; its `isVisitOpen` today is `last.completedAt === null`. Switching aims at `config.targets[targetIndex]` with `INTENDED_ZONE_KEY` and closes when `turn.darts.length === this.config.targets.length`. Both fold with `(facts, complete)`; the shell passes `(facts, config, expired)`.

- [ ] **Step 1: Characterization first** (pattern wrap-around, a full pass, undo across a visit boundary, `expireTimer()`, `prior` resume). Green on old code.
- [ ] **Step 2: Migrate** both to specs on the shell.
- [ ] **Step 3: Verify:** characterization green, full `npm test`, `astro check`, engine gates, `bash scripts/check-dupes.sh` shows the four-engine rows gone.
- [ ] **Step 4: Commit** `refactor(training): bind double-pattern and switching to the exercise shell`.

### Task 4 (J4): switching-chain and target-scoring rules

**Files:**
- Modify: `switching-chain.engine.module.ts` (~43-50), `target-scoring.engine.module.ts` (~85-92)

**Interfaces:**
- Produces: one exported helper in `target-scoring.engine.module.ts` (or the nearest shared exercise module, implementer's call), `scoringTrackRules<TExt>(config: { targets: readonly number[] }, onDart: TrackRules<TExt>["onDart"]): TrackRules<TExt>`, containing `doneMessage`, `target: pathTarget(numbersPath(config.targets))`, `hit`, `points` (via `targetScoringPoints(sectionOf(target), observation)`), `visitOpen: closeAfter(DARTS_PER_VISIT)`; callers pass `resetOnMiss(n)` / `chainOnTarget(n)`.
- Both engines keep their exports and `DONE_MESSAGE`.

- [ ] **Step 1: Characterization:** confirm existing tests cover both engines' fold (hit, miss reset, chain advance); add cases if not. Green on old code.
- [ ] **Step 2: Extract and migrate.**
- [ ] **Step 3: Verify:** full `npm test`, `astro check`, `check-dupes.sh` shows the switching-chain row gone.
- [ ] **Step 4: Commit** `refactor(training): share track scoring rules between switching-chain and target-scoring`.

### Task 5 (J5): bobs27 and singles-training seated engine helpers

**Files:**
- Modify: `app/src/modules/game/bobs27.engine.module.ts` (~247-254), `singles-training.engine.module.ts` (~279-284), plus other engines only if the identical expression exists (`baseball.engine.module.ts:203` `isVisitOpen: (turn) => turn.darts.length < 3`; Shanghai `refusal` near `:315`)
- Create/modify: helper home in `app/src/modules/game/seat-state.module.ts` or `turn-log.module.ts` (implementer picks one, per file purpose)

**Interfaces:**
- Produces: `seatedRefusal<TState>(matchEnded: Refusal, seatDone: Refusal): (state: TState) => Refusal | null` for states with `status` and an active seat (`activeSeatState`), and `visitOpenUnder(darts: number): (turn: TurnFact) => boolean`. Refusal messages stay per-engine (`GAME_ENDED` vs `SESSION_DONE`, shared `MATCH_ENDED`).
- Constraint: these are `DartGameSpec` fields; `check-game-engines.sh` and `check-engine-kernels.sh` must pass; no `GameEngine` contract change.

- [ ] **Step 1: Characterization:** existing engine tests cover the refusal and visit-open behaviour; add cases for "match ended" vs "seat done" refusals in both engines if absent. Green first.
- [ ] **Step 2: Extract and migrate** bobs27, singles-training, and any engine with the identical expression, only if fallow still flags a group.
- [ ] **Step 3: Verify:** full `npm test`, `astro check`, engine gates, `check-dupes.sh` shows the bobs27|singles-training row gone.
- [ ] **Step 4: Commit** `refactor(game): share seated refusal and visit-open helpers`.

### Task 6 (J6): statistics.repository self-clone

**Files:**
- Modify: `app/src/repositories/statistics.repository.ts` (~1078-1086 game session page; ~2189-2197 routine step page)
- Test: existing `app/tests/repositories/statistics.repository.test.ts` (path may differ), add one case per mapper if no test pins the row shape

**Interfaces:**
- Produces: unexported `mapSessionHead(row: { sessionId: string | null; statusKey: string | null } & SessionTimingsInput): { sessionId: string; statusKey: string; timings: ReturnType<typeof mapSessionTimings> }` (nonNull checks keep messages `session_id`, `status_key`); both mappers call it, then add their own fields in the existing key order.
- `neverStarted` stays per mapper (game: `statusKey === "ABANDONED" && timings.turnCount === 0`; routine step: `null` for `WARM_UP_V1`).

- [ ] **Step 1: Pin first:** add cases asserting full row shape and key order for both queries (via the repo's existing test seam for these functions); green on old code.
- [ ] **Step 2: Extract and migrate.**
- [ ] **Step 3: Verify:** full `npm test`, `astro check`, `check-dupes.sh` shows the `statistics.repository.ts` row gone.
- [ ] **Step 4: Commit** `refactor(repositories): share session row head mapping`.

### Task 7 (J7): close-out

**Files:**
- Modify: `scripts/dupes-baseline.txt` (`--update`, expect 7 → 0 rows), `decisions/<domain>.md` (new decision, extends D513/D527; domain per `DECISIONS.md`), `docs/architecture/00-File-Inventory.md` (new `scored-batch.validator.ts` row; changed rows; decisions row counts if the budget gate asks), `docs/architecture/00-Context-Map-History.md` (next minor), `docs/architecture/04-Architecture-patterns.md` / `app/src/modules/training/CLAUDE.md` only if the shell-bound engine list there is now stale (list the four migrated engines among shell-bound ones; targeted edit).

- [ ] **Step 1:** `bash scripts/check-dupes.sh --update`; `git diff` shows removals only; file is empty.
- [ ] **Step 2:** Write the decision: what was extracted, per-engine mapping choices, characterization method, TUOD's quick-path-only rounds limit preserved as a flag (and filed as discovered work if it looks unintended), what remains open (`respond()` helper).
- [ ] **Step 3:** Inventories and history; run `context-maintenance` and `run-all-gates`; `cd app && npm run format && npm run format:check && npm test && npx astro check`; run `validate:app` steps that do not need `DATABASE_URL` and name the skipped ones.
- [ ] **Step 4:** Commit `docs: phase 4c close-out (decision, inventories, baseline)`. Controller then merges `origin/main`, asks the owner about the design sync (D524; no visual change expected), pushes and opens the PR.

## Self-Review

- Coverage: validators → T1; four exercise engines → T2–T3; switching-chain/target-scoring → T4; bobs27/singles-training → T5; repository → T6; baseline → T7.
- Names fixed once: `validateScoredBatch`, `scoringTrackRules`, `seatedRefusal`, `visitOpenUnder`, `mapSessionHead`.
- Risk: T2–T3 carry the behaviour risk (facts persisted for replay); gated by characterization-first and the final whole-branch opus review. If a shell mapping cannot express an engine's visit-close rule without changing facts, the task stops with NEEDS_CONTEXT and that engine stays hand-written with its baseline row (the baseline then shrinks less than planned).
