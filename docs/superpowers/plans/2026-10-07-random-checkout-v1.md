# Random Checkout V1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship `RANDOM_CHECKOUT_V1`: a time-bound routine-step exercise — one visit per attempt from a seed-drawn start score in 40–170, X01 double-out, checkout rate as the result.

**Architecture:** Lift DartBot's hash + mulberry32 into `modules/game/seeded-rng.module.ts` (output-preserving); new `RandomCheckoutEngine` folds turns with `resolveCheckoutAttempt`, start score = `drawStartScore(config, attemptIndex)`; server mints `drawSeed` into the step config before validation; seed `0036`; client copied from Catch 40. No migration.

**Tech Stack:** TypeScript, Zod, Astro, Alpine.js, Vitest, PostgreSQL seeds.

**Spec:** `docs/superpowers/specs/2026-10-07-random-checkout-exercise-design.md` (rules input: `docs/game-rules/training/exercises/random-checkout.md`).

Branch `feat/random-checkout-v1`. Run app commands from `app/`; tests by path (`npx vitest run <path>`). Match the surrounding code: JSDoc on exports, no `//` comments in function bodies, exported types in `types.ts` files. Reference exercise for every "copy" instruction: **Catch 40** (PR #804, squash commit `da6cf78`) — `git show da6cf78 -- <path>` is the template; its 51-file stat is the touch list.

## Global Constraints

- Type key `RANDOM_CHECKOUT`; ruleset key `RANDOM_CHECKOUT_V1`; template "Random Checkout"; code slug `random-checkout`; panel key `random-checkout`.
- Config `{minStart: 40, maxStart: 170, drawSeed: uint32}`, strict; range keys literal. Template default `{"minStart":40,"maxStart":170}` — no seed.
- Pool: 40–170 minus `159, 162, 163, 165, 166, 168, 169` → 124 scores, ascending. Engine constant.
- Draw for attempt *n* (0-based) = `pool[floor(seededUniform(drawSeed, n)() × 124)]`. Never depends on darts.
- Pool + PRNG frozen for `RANDOM_CHECKOUT_V1`; any change is a `_V2` ruleset.
- One attempt = one turn = one visit; closes on checkout, bust or dart 3. Finishing dart: `hitZoneKey` `DOUBLE` or `INNER_BULL`.
- Time-bound only: no self-complete. Attempt open at expiry: unjudged, darts still counted.
- Mode pair `ANALYTICS` + `VISUAL_BOARD`. Dart fact: both intended columns `null`; `score` = board score.
- Seed is minted server-side (`generateDrawSeed`, Web Crypto) and **overwrites** any template/step value.
- Seeds only; applied migrations `0001`–`0045` untouched (`0046` exists, not touched).
- DartBot output unchanged: existing `rng.module.test.ts`, `throw-engine.determinism.test.ts` and its `__snapshots__` stay green, unedited.

## Review Focus

1. RNG lift is byte-identical: golden vector pinned **before** the move passes after it. (Task 2.)
2. Draw is index-keyed: undo across an attempt boundary restores the earlier start score; replay from `prior` equals live. (Task 3.)
3. Bust edge cases: 0 on a non-double, leaving 1, going below 0 — each closes the turn, voids later darts. (Task 3.)
4. Seed injection runs **before** `stepConfigurationIssues` and overwrites a step-supplied `drawSeed`; a snapshot without a seed fails validation. (Task 4.)
5. Open attempt at expiry is excluded from `attempts` and rate. (Tasks 3, 6.)
6. Dependency direction: `modules/dartbot` → `modules/game` is new; confirm no `game` → `dartbot` import exists (no cycle). (Task 2.)

---

### Task 1: Docs — rules amendment, decision

**Files:**
- Modify: `docs/game-rules/training/exercises/random-checkout.md`
- Modify: `decisions/game-engine.md`

- [ ] **Step 1: Amend `random-checkout.md`** (`authoring-game-rules` amend mode, targeted edits):
  - Exercise type: drop "(proposed; …)" → seeded in `0036`.
  - Config & presets: add row `Draw seed | minted per run | Not shown`.
  - Capture: replace the "Where it lives … is a spec decision" sentence with: the run's `drawSeed` in the configuration snapshot is the stored fact; each start score is derived from it (D424).
  - Open questions: strike both with "**Resolved:** seed in config, start score derived (D424)" and "**Resolved:** uniform over the 124 finishable scores".
  - Glossary: add `Draw seed` `V1` "The per-run number every start score is derived from".
  - `Current version:` stays `none (V1 in design)` until Task 8.
- [ ] **Step 2: Append D424** to `decisions/game-engine.md`, shaped on D423:

```md
### D424 — Random Checkout stores a draw seed, not drawn scores
Status: Accepted · Date: 2026-10-07
Decision: `RANDOM_CHECKOUT` / `RANDOM_CHECKOUT_V1` (seed `0036`, template "Random Checkout") is a time-bound exercise of one-visit attempts from a random start score. The server mints `drawSeed` (uint32, Web Crypto) into the step configuration at training start, overwriting any template or step value; the immutable `exercise_configurations` snapshot holds it. Attempt *n*'s start score is a uniform pick over the 124 three-dart-finishable scores in 40–170, keyed by `(drawSeed, n)` through `seededUniform` (`app/src/modules/game/seeded-rng.module.ts`), the hash + mulberry32 lifted unchanged from DartBot's `rng.module.ts`.
Reason: the start score is a fact no dart can fold to, and no turn/dart column holds it. A seed is one stored value that makes every draw derivable — store what happened, derive what it means — with no migration. Index-keying makes a draw independent of prior darts, so undo and replay are exact.
Consequences: the pool and the PRNG are frozen for `RANDOM_CHECKOUT_V1`; changing either is a new ruleset version. DartBot and Random Checkout share one PRNG definition. Configurable range, round bound, average darts per checkout and head-to-head are later versions. Rules: `docs/game-rules/training/exercises/random-checkout.md`. Spec: `docs/superpowers/specs/2026-10-07-random-checkout-exercise-design.md`.
Supersedes: none.
```

- [ ] **Step 3: Commit** `docs(random-checkout): resolve open questions, record D424`.

---

### Task 2: Lift the seeded RNG out of DartBot

**Files:**
- Create: `app/src/modules/game/seeded-rng.module.ts`
- Modify: `app/src/modules/dartbot/rng.module.ts`
- Create: `app/tests/modules/game/seeded-rng.module.test.ts`
- Modify: `app/tests/modules/dartbot/rng.module.test.ts` (add one test; edit none)

- [ ] **Step 1: Pin current output (characterisation).** Add to `rng.module.test.ts`: `createDartRng(42, 3)` first three `uniform()` and one `gaussianPair()` equal a literal array. Generate the literals by running the current code once (`npx tsx -e …`), paste them in. Run → PASS on unchanged code.
- [ ] **Step 2: Write failing test** `seeded-rng.module.test.ts`: `seededUniform(42, 3)` yields the same first three values as the Step 1 literals; same `(seed, index)` → same stream; different index → different first value; values in `[0, 1)`; never calls `Math.random`. Run → FAIL (module missing).
- [ ] **Step 3: Implement** `seeded-rng.module.ts`:

```ts
/**
 * A deterministic uniform stream in [0, 1) keyed by `(seed, index)`.
 * Shared by DartBot's per-dart RNG (`08-DartBot.md` §Determinism and Replay)
 * and Random Checkout's start-score draw (D424). Frozen: any change alters
 * every stored seed's replay.
 */
export function seededUniform(seed: number, index: number): () => number {
  return mulberry32(hashSeed(seed, index));
}
```

  with `hashSeed` and `mulberry32` moved verbatim (private).
- [ ] **Step 4: Rebuild `createDartRng`** on `seededUniform(seed, dartIndex)`; delete the moved helpers from `rng.module.ts`.
- [ ] **Step 5: Run** `npx vitest run tests/modules/dartbot tests/modules/game/seeded-rng.module.test.ts` → all PASS, snapshots unchanged. `grep -rn "@modules/dartbot" app/src/modules/game` → empty.
- [ ] **Step 6: Commit** `refactor(rng): lift seeded uniform into modules/game`.

---

### Task 3: Config schema, draw and engine

**Files:**
- Modify: `app/src/lib/training/exercises/rulesets/types.ts` (+ `@lib/types` re-export `RandomCheckoutConfigData`)
- Modify: `app/src/modules/training/exercises/types.ts` (`RandomCheckoutState`)
- Create: `app/src/modules/training/exercises/random-checkout.engine.module.ts`
- Test: `app/tests/lib/training/exercises/rulesets/types.test.ts`, `app/tests/modules/training/exercises/random-checkout.engine.module.test.ts`

- [ ] **Step 1: Failing schema tests:** accepts `{minStart:40,maxStart:170,drawSeed:0}` and `drawSeed: 0xffffffff`; rejects missing seed, `-1`, `2**32`, `1.5`, `minStart: 2`, `maxStart: 80`, extra key. Run → FAIL.
- [ ] **Step 2: Implement** `RandomCheckoutV1Config` per spec §5. Run → PASS.
- [ ] **Step 3: Failing draw tests:**
  - `RANDOM_CHECKOUT_POOL` length 124, ascending, first 40, last 170, contains none of the seven.
  - `drawStartScore(config, n)` stable for same `(seed, n)`; in pool; golden vector — seed `42`, `n = 0..4` → literal array (generate after Step 4, then freeze; comment-free, the test name says "frozen for RANDOM_CHECKOUT_V1").
  - 2 000 draws over seeds `0..1999`, index 0, hit ≥ 110 distinct pool values (smoke test of spread, not a statistical proof).
- [ ] **Step 4: Implement** `RANDOM_CHECKOUT_POOL` and `drawStartScore` in the engine module (exported). Run → PASS; paste golden vector; re-run → PASS.
- [ ] **Step 5: Failing engine tests** (copy harness from `checkout-sequence.engine.module.test.ts`; pick a seed whose attempt-0 draw is known from the golden vector):
  - checkout on D-ring at dart 1/2/3 → `checkouts 1`, `attempts 1`, `lastAttempt "CHECKOUT"`, next `startScore` = draw 1.
  - checkout on `INNER_BULL` counts.
  - 0 on a single/treble → bust, attempt failed, turn closed.
  - leaving 1 → bust; below 0 → bust; `record()` after bust opens a new turn from draw 1.
  - three darts no checkout → failed, closed.
  - open attempt mid-visit: `remaining` walked, `dartsInVisit` n.
  - `expireTimer()` with open attempt → `isComplete()`, `attempts` excludes it, `dartsThrown` includes its darts; `record()` after expiry throws.
  - `undo()` after expiry un-expires; next `undo()` pops a dart.
  - undo of the closing dart of attempt 0 → `startScore` back to draw 0, turn reopened.
  - `foldRandomCheckoutState(prior facts)` equals live-recorded state.
  - rate is never stored on state (derived by consumers).
  Run → FAIL.
- [ ] **Step 6: Implement** `RandomCheckoutEngine` per spec §6, structure copied from `checkout-sequence.engine.module.ts` minus `visitIndex`, points and self-complete. `walkVisit` may be copied (private, 15 lines) — do not export it from Catch 40 (Catch 40 unchanged). Register via `registerDartExerciseEngineFactory`. Run → PASS. Run Catch 40 engine tests → PASS.
- [ ] **Step 7: Commit** `feat(random-checkout): RANDOM_CHECKOUT_V1 config, draw and engine`.

---

### Task 4: Server — validator, keys, seed injection

**Files:**
- Modify: `app/src/lib/id.ts` (`generateDrawSeed`)
- Create: `app/src/services/exercise-rulesets/random-checkout/random-checkout.validator.ts`
- Modify: `app/src/services/exercise-rulesets/registry.ts`, `app/src/services/types.ts`, `app/src/pages/api/training-sessions/types.ts`, `app/src/services/training-session.service.ts`
- Test: matching files under `app/tests/` (copy Catch 40's additions from `da6cf78`)

- [ ] **Step 1: Failing tests:**
  - validator parses valid config, rejects seedless; registry resolves `RANDOM_CHECKOUT_V1`; API types accept `RANDOM_CHECKOUT`.
  - `generateDrawSeed()` is an integer in `[0, 2**32)`; never calls `Math.random`.
  - training-session service: a `RANDOM_CHECKOUT` step's snapshot `configuration.drawSeed` is a uint32; a step row supplying `drawSeed: 7` gets overwritten (mock `generateDrawSeed` → `123`, expect `123`); other step kinds get no `drawSeed`; step uses the `ANALYTICS`/`VISUAL_BOARD` pair.
  Run → FAIL.
- [ ] **Step 2: Implement:**
  - `generateDrawSeed` beside `generateBotSeed`, same body, own JSDoc citing D424.
  - Validator copied from `checkout-sequence.validator.ts`; register.
  - Enum + `DART_EXERCISE_TYPE_KEYS` gain `RANDOM_CHECKOUT`.
  - `injectDrawSeed(row, configuration)` — sets `configuration.drawSeed = generateDrawSeed()` when `row.exerciseTypeKey === "RANDOM_CHECKOUT"`; called after `injectGameStepDuration`, before `stepConfigurationIssues`.
  Run → PASS.
- [ ] **Step 3: Commit** `feat(random-checkout): validator, keys and server-minted draw seed`.

---

### Task 5: Seed `0036`

**Files:**
- Create: `database/seeds/0036_random_checkout_exercise_type.sql`
- Create: `database/verification/0036_random_checkout_seed_checks.sql`
- Modify: `database/README.md`

- [ ] **Step 1:** Copy `0035_checkout_sequence_exercise_type.sql`; IDs per spec §8 (type `…00000000000b`, ruleset `…00000000000a`, template `…000000000011`); default config `{"minStart":40,"maxStart":170}`; idempotent as `0035`.
- [ ] **Step 2:** Copy `0035_checkout_sequence_seed_checks.sql`; assert the three rows, keys, config, `game_type_id IS NULL`, catalog row in `v_exercise_template_catalog`.
- [ ] **Step 3:** With `DATABASE_URL`: `npm run db:seed:ci` then `npm run db:verify:ci` → all checks pass. Without it: state that in the report — do not claim applied.
- [ ] **Step 4: Commit** `feat(random-checkout): seed RANDOM_CHECKOUT type, ruleset and template`.

---

### Task 6: Client — adapter, play, panel, summary

**Files:** (copy each Catch 40 counterpart from `da6cf78`)
- Create: `app/src/lib/training/routines/adapters/random-checkout.adapter.ts`, `app/src/components/layout/training/exercises/RandomCheckoutPanel.astro`
- Modify: `adapters/step-adapter.registry.ts`, `adapters/types.ts`, `routines/types.ts`, `routine-play.data.ts`, `ExerciseBoardInputPanel.astro`, `pages/training/routines/play/index.astro`, `modules/training/routines/routine-summary.module.ts`
- Test: adapter, step-adapter registry, `routine-play.data.test.ts`, `routine-summary-engines.module.test.ts`

- [ ] **Step 1: Failing tests:** adapter key/header/panel; registry lists it; routine-play dispatches darts to the engine, free-aim preview marks a board dart as a hit, timeout calls `expireTimer()` and completes the step, a dart never self-completes the step; summary `{Checkouts, Attempts, Rate, Darts}` with rate `—` at 0 attempts. Run → FAIL.
- [ ] **Step 2: Implement.** Do **not** copy Catch 40's `completeCurrentStep()`-on-complete branch. Panel readouts per spec §9: Checkouts (score), Start, Left, Dart n/3, Last ✓/✗/—, Rate, Time. Run → PASS.
- [ ] **Step 3: Commit** `feat(random-checkout): routine play, panel and summary`.

---

### Task 7: Stats and replay

**Files:** `app/src/modules/stats/types.ts`, `step-metrics.module.ts`, `sections/step-result.module.ts`, `app/src/lib/stats/replay-fold.ts`, `replay-presenters.ts`, `app/src/stores/routine-stats.store.ts`; tests as `da6cf78` (incl. `tests/lib/stats/replay-step-games.ts` fixture).

- [ ] **Step 1: Failing tests:** `DartExerciseKind` includes `RANDOM_CHECKOUT`; `STEP_METRIC_SPECS` `{checkouts, attempts, darts}` all `sum`, headline `checkouts`, rate `checkouts/attempts`; replay fold of a fixture run reproduces each attempt's start score from the snapshot seed; presenter darts key `darts`. Run → FAIL.
- [ ] **Step 2: Implement** per spec §9. Run → PASS.
- [ ] **Step 3: Commit** `feat(random-checkout): step metrics and replay`.

---

### Task 8: Canonical docs, gates, finish

- [ ] **Step 1: Docs** (targeted edits, per spec §11): `09-Training/01-Routines.md` §3.4 list + "Random Checkout" section; `00-File-Inventory.md` rows for every new file; seed range → `0036`; `08-DartBot.md` §Determinism → `seededUniform`; `app/src/modules/training/CLAUDE.md` exercise list; `07-Frontend/08-Component-Inventory.md`; `10-Statistics/01-Section-Catalog.md`; `00-Context-Map-History.md`. Rules file `Current version:` → `V1 (shipped <merge date>)` in the shipping PR.
- [ ] **Step 2: Gates:** `run-all-gates` skill (app + database + docs touched) and `validate-app` skill. Report each script's pass/fail explicitly.
- [ ] **Step 3:** `context-maintenance` skill; file any discovered work per `capturing-discovered-work`.
- [ ] **Step 4: Finish:** `superpowers:finishing-a-development-branch` + `finishing-a-dart-branch` → push, open PR.
