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

# Add DartExerciseEngine for analytics-mode exercises

## Context and Problem Statement
`ExerciseEngine` was designed for `WARM_UP` alone, which has phases to advance through and no dart input. Forcing `SWITCHING`/`DOUBLE_PATTERN` into that same shape would mean either a meaningless no-op `advance()` or bolting an input parameter onto an interface every existing `WarmUpEngine` caller assumes takes none. A second, additive interface keeps `ExerciseEngine`/`WarmUpEngine` byte-for-byte unchanged while giving dart-driven exercises the same `record(observation)` shape `GameEngine` already uses, so both engine families read the same way.

## Decision Drivers
* `ExerciseEngine<TState>` has `advance()` and takes no input, which fits phase-driven exercises such as `WARM_UP` only (plan, Architecture).
* `SWITCHING` and `DOUBLE_PATTERN` are dart-driven exercises, analytics-mode input in `09-training-routines.md` § 13 (plan, Architecture).
* `ExerciseEngine`/`WarmUpEngine` must stay unchanged (plan, Architecture).

## Considered Options
* Force the dart-driven exercises into `ExerciseEngine` with a no-op `advance()` (row added by commit `bdcfc89d`).
* Add an input parameter to `ExerciseEngine` (same row).
* Add a sibling contract `DartExerciseEngine<TState>` with `record(observation)` (chosen).

## Decision Outcome
Chosen option: "Analytics-mode exercises (09-Training/01-Routines.md §13) that take dart input — `SWITCHING`, `DOUBLE_PATTERN` — implement a new `DartExerciseEngine<TState>` contract (`record`/`undo`/`isComplete`/`state`/`facts`), not `ExerciseEngine<TState>` (`advance`/`undo`/`isComplete`/`state`/`facts`). The two are siblings, not a hierarchy: `DartExerciseEngine` is not built on `GameEngine` either, mirroring D264's existing rule that `ExerciseEngine` is never layered on `GameEngine`.".

### Consequences
A future training-session route dispatching by `exercise_type_id` must check both `modules/training/exercises/engine.registry.ts` (phase-driven) and `modules/training/exercises/dart-engine.registry.ts` (dart-driven) rather than one shared registry — left to that route's own implementation plan, not resolved here. `SwitchingEngine`/`DoublePatternEngine` both gained `expireTimer()`, unifying with `TuodEngine`/`ScoreTrainingEngine`'s existing "the engine owns no clock" pattern (D264) rather than inventing a new one.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`npm run check` (`astro check`) type-checks every engine against its contract in `app/src/modules/training/exercises/interfaces.ts`. `app/tests/modules/training/exercises/dart-engine.registry.test.ts` covers `dart-engine.registry.ts`.

## Pros and Cons of the Options
### No-op `advance()` on `ExerciseEngine`
* Bad, because `advance()` would be meaningless for a dart-driven exercise (row added by commit `bdcfc89d`).

### Input parameter on `ExerciseEngine`
* Bad, because every existing `WarmUpEngine` caller assumes the interface takes no input (same row).

### Sibling `DartExerciseEngine`
* Good, because it is additive: `ExerciseEngine`/`WarmUpEngine` stay byte-for-byte unchanged (same row).
* Good, because `record(observation)` matches the shape `GameEngine` uses, so both engine families read the same way (same row).

## Evidence / More Information
Decided: 2026-09-11

* Commit `bdcfc89d` (2026-09-12; adds the D267 row to `decisions/game-engine.md`): rebuilt Considered Options and Pros and Cons.
* `docs/superpowers/plans/2026-09-11-switching-double-pattern-balanced-training-seed.md` (Architecture, File map): rebuilt Decision Drivers.
* `app/package.json` (`check` script): rebuilt Confirmation.
* Applied in: `docs/superpowers/plans/2026-09-12-singles-training-accuracy-mode.md`.
