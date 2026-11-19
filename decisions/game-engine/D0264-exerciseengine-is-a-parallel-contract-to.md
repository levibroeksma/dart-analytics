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
<!-- backfill: pending -->

# `ExerciseEngine` is a parallel contract to `GameEngine`, not built on top of it, with its own ruleset registry and no owned clock

## Context and Problem Statement
`09-Training/01-Routines.md` §9 requires an `ExerciseEngine` to be deterministic with respect to its inputs, configuration and ruleset alone; a state field fed by a wall clock breaks that, so elapsed time is pushed to the frontend controller (sub-phase 4), matching the precedent already set by Score Training's MINUTES countdown living in `game.store.ts` rather than in `ScoreTrainingEngine`. Reusing `services/rulesets/registry.ts`/`RulesetVersionKey` for `WARM_UP_V1` was rejected outright: `scripts/check-game-wiring.sh` requires every key registered there to declare a capture/input mode pair and either game pages or none, and a warm-up exercise has no capture mode and no input mode — widening that gate to accept a modeless entry would weaken the invariant for every real game ruleset just to fit one exception.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/src/modules/training/exercises/interfaces.ts` defines `ExerciseEngine<TState>`/`ExerciseEngineFactory<TConfig, TState>` as a standalone contract — `advance()`/`undo()`/`isComplete()`/`state()`/`facts()` — sharing `EngineFacts`/`StageFact` with `GameEngine` but declaring no dependency on it. `WarmUpEngine` (`modules/training/exercises/warm-up.engine.module.ts`) is its first implementation: it appends one `EXERCISE_SECTION` stage per phase entered and holds no clock — `WarmUpState` carries `phaseIndex`/`phaseName`/`targets`/`phaseDurationSeconds`/`phaseCount`/`status` but no elapsed-time field, dropping the spec's original `overallElapsed`. `WARM_UP_V1` and its Zod config (`lib/training/exercises/rulesets/types.ts`) are kept out of `services/rulesets/registry.ts`, `RulesetVersionKey`, and `RULESET_CAPABILITIES` entirely; exercise rulesets get their own registry (`modules/training/exercises/engine.registry.ts`, `services/exercise-rulesets/registry.ts`) and validator interface (`services/exercise-rulesets/interfaces.ts`).".

### Consequences
A second exercise type (`SWITCHING`, `DOUBLE_PATTERN`, `CHECKOUT`, `ACCURACY`, …) implements `ExerciseEngine` and registers with `modules/training/exercises/engine.registry.ts` + `services/exercise-rulesets/registry.ts`, never `services/rulesets/registry.ts`. `TrainingEngine` (`modules/training/routines/training.module.ts`) orchestrates ordered `RoutineStepSnapshot`s across whichever `ExerciseEngine` each step resolves to, and also holds no clock for the same determinism reason. `routine-duration.module.ts`'s sixty-minute cap (`09-Training/01-Routines.md` §7) is validated independently of any engine, since a routine's total duration is a sum over steps a single `CHECK` constraint cannot express. No API route or UI consumes either engine yet — persistence and the controller are out of scope for this plan. Full design: `docs/superpowers/specs/2026-09-10-training-session-phase-1-warmup-design.md`, implementation plan: `docs/superpowers/plans/2026-09-10-training-session-phase-1-warmup.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-10
