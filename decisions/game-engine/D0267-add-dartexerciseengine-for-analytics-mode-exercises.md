---
id: D0267
status: accepted
date: 2026-09-11
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, undo]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Add DartExerciseEngine for analytics-mode exercises

## Context and Problem Statement
`ExerciseEngine` was designed for `WARM_UP` alone, which has phases to advance through and no dart input. Forcing `SWITCHING`/`DOUBLE_PATTERN` into that same shape would mean either a meaningless no-op `advance()` or bolting an input parameter onto an interface every existing `WarmUpEngine` caller assumes takes none. A second, additive interface keeps `ExerciseEngine`/`WarmUpEngine` byte-for-byte unchanged while giving dart-driven exercises the same `record(observation)` shape `GameEngine` already uses, so both engine families read the same way.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Analytics-mode exercises (09-Training/01-Routines.md §13) that take dart input — `SWITCHING`, `DOUBLE_PATTERN` — implement a new `DartExerciseEngine<TState>` contract (`record`/`undo`/`isComplete`/`state`/`facts`), not `ExerciseEngine<TState>` (`advance`/`undo`/`isComplete`/`state`/`facts`). The two are siblings, not a hierarchy: `DartExerciseEngine` is not built on `GameEngine` either, mirroring D264's existing rule that `ExerciseEngine` is never layered on `GameEngine`.".

### Consequences
A future training-session route dispatching by `exercise_type_id` must check both `modules/training/exercises/engine.registry.ts` (phase-driven) and `modules/training/exercises/dart-engine.registry.ts` (dart-driven) rather than one shared registry — left to that route's own implementation plan, not resolved here. `SwitchingEngine`/`DoublePatternEngine` both gained `expireTimer()`, unifying with `TuodEngine`/`ScoreTrainingEngine`'s existing "the engine owns no clock" pattern (D264) rather than inventing a new one.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-11
