---
id: D0264
status: accepted
date: 2026-09-10
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, ruleset, checkout, Score Training, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `ExerciseEngine` is a parallel contract to `GameEngine`, not built on top of it, with its own ruleset registry and no owned clock

## Context and Problem Statement
`09-Training/01-Routines.md` §9 requires an `ExerciseEngine` to be deterministic with respect to its inputs, configuration and ruleset alone; a state field fed by a wall clock breaks that, so elapsed time is pushed to the frontend controller (sub-phase 4), matching the precedent already set by Score Training's MINUTES countdown living in `game.store.ts` rather than in `ScoreTrainingEngine`. Reusing `services/rulesets/registry.ts`/`RulesetVersionKey` for `WARM_UP_V1` was rejected outright: `scripts/check-game-wiring.sh` requires every key registered there to declare a capture/input mode pair and either game pages or none, and a warm-up exercise has no capture mode and no input mode — widening that gate to accept a modeless entry would weaken the invariant for every real game ruleset just to fit one exception.

## Decision Drivers
* `09-training-routines.md` § 9 requires an `ExerciseEngine` to be deterministic with respect to its inputs, configuration and ruleset. An engine that reads a wall clock is not (plan, Deviation from the spec).
* `scripts/check-game-wiring.sh` requires every key in `services/rulesets/registry.ts` to declare a capture/input mode pair. A warm-up has none, so adding `WARM_UP_V1` there fails the gate (plan, Why a separate ruleset registry).
* `RULESET_CONFIGS` is a `Record<RulesetVersionKey, ...>`, so widening that union forces an entry there too (plan, Why a separate ruleset registry).

## Considered Options
* A standalone `ExerciseEngine` contract with its own registries and no clock (chosen).
* Register `WARM_UP_V1` in `services/rulesets/registry.ts` and `RulesetVersionKey` (rejected).
* Keep `overallElapsed` in the engine state, as the spec's § 4 shape had it, as the plan reports.

## Decision Outcome
Chosen option: "`app/src/modules/training/exercises/interfaces.ts` defines `ExerciseEngine<TState>`/`ExerciseEngineFactory<TConfig, TState>` as a standalone contract — `advance()`/`undo()`/`isComplete()`/`state()`/`facts()` — sharing `EngineFacts`/`StageFact` with `GameEngine` but declaring no dependency on it. `WarmUpEngine` (`modules/training/exercises/warm-up.engine.module.ts`) is its first implementation: it appends one `EXERCISE_SECTION` stage per phase entered and holds no clock — `WarmUpState` carries `phaseIndex`/`phaseName`/`targets`/`phaseDurationSeconds`/`phaseCount`/`status` but no elapsed-time field, dropping the spec's original `overallElapsed`. `WARM_UP_V1` and its Zod config (`lib/training/exercises/rulesets/types.ts`) are kept out of `services/rulesets/registry.ts`, `RulesetVersionKey`, and `RULESET_CAPABILITIES` entirely; exercise rulesets get their own registry (`modules/training/exercises/engine.registry.ts`, `services/exercise-rulesets/registry.ts`) and validator interface (`services/exercise-rulesets/interfaces.ts`).".

### Consequences
A second exercise type (`SWITCHING`, `DOUBLE_PATTERN`, `CHECKOUT`, `ACCURACY`, …) implements `ExerciseEngine` and registers with `modules/training/exercises/engine.registry.ts` + `services/exercise-rulesets/registry.ts`, never `services/rulesets/registry.ts`. `TrainingEngine` (`modules/training/routines/training.module.ts`) orchestrates ordered `RoutineStepSnapshot`s across whichever `ExerciseEngine` each step resolves to, and also holds no clock for the same determinism reason. `routine-duration.module.ts`'s sixty-minute cap (`09-Training/01-Routines.md` §7) is validated independently of any engine, since a routine's total duration is a sum over steps a single `CHECK` constraint cannot express. No API route or UI consumes either engine yet — persistence and the controller are out of scope for this plan. Full design: `docs/superpowers/specs/2026-09-10-training-session-phase-1-warmup-design.md`, implementation plan: `docs/superpowers/plans/2026-09-10-training-session-phase-1-warmup.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/warm-up.engine.module.test.ts` and `app/tests/modules/training/exercises/engine.registry.test.ts` exist today. `scripts/check-game-wiring.sh` keeps the game registry's capture/input mode invariant.

## Pros and Cons of the Options
### Standalone contract with its own registries and no clock
* Good, because the engine stays deterministic with respect to its inputs, configuration and ruleset (plan, Deviation from the spec).
* Good, because `scripts/check-game-wiring.sh`'s invariant stays intact for every real game ruleset (plan, Why a separate ruleset registry).

### Register `WARM_UP_V1` in the game ruleset registry
* Bad, because a modeless warm-up fails `scripts/check-game-wiring.sh` and forces an entry in `RULESET_CONFIGS` (plan, Why a separate ruleset registry).

### Keep `overallElapsed` in the engine state
* Bad, because an engine that reads a wall clock is not deterministic (plan, Deviation from the spec).

## Evidence / More Information
Decided: 2026-09-10

* `docs/superpowers/plans/2026-09-10-training-session-phase-1-warmup.md` (Deviation from the spec, Why a separate ruleset registry): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
* Commit `74a31408` (PR #261, 2026-09-10; adds the D264 row): no section rebuilt.
* The spec the record names, `docs/superpowers/specs/2026-09-10-training-session-phase-1-warmup-design.md`, is not in the repository today; the plan is the source here.
