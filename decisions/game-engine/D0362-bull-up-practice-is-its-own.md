---
id: D0362
status: accepted
date: 2026-09-24
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, turns]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Bull Up Practice is its own exercise type with one-dart turns

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/bull-up-practice.md`) judge a single cold dart, and every shipped exercise judges three-dart visits. Target Scoring accepts the bull as a target but builds a chain across visits, so it is not a bull-up configuration.

## Decision Drivers
* The rules judge a single cold dart, and every shipped exercise judges three-dart visits.
* The spec says no shipped engine models a one-dart visit and every exercise type keeps one engine file.

## Considered Options
* Configure Target Scoring with the bull as its target.
* A new `BULL_UP` exercise type with its own engine (chosen).

## Decision Outcome
Chosen option: "`BULL_UP` / `BULL_UP_V1` is a new exercise type (seed `0030`, template "Bull Up Practice") with its own `DartExerciseEngine` (`bull-up.engine.module.ts`). Each throw is one dart and one `turns` row, completed when written; every dart carries `25`/`INNER_BULL`. A throw is a Bullseye (inner bull), an Outer bull, or a Miss; bulls count both rings. Configuration is the empty object `{}`. Routine step only.".

### Consequences
the first exercise whose turns hold one dart; `undoLastDart` removes the emptied turn, so no new turn shape is needed. Board preview marks either bull a hit. A distance-from-centre readout and standalone play stay deferred (V2+).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/bull-up.engine.module.test.ts` and `bull-up.golden.test.ts` cover the engine. `database/verification/0030_bull_up_seed_checks.sql` covers the seed.

## Pros and Cons of the Options
### Target Scoring with the bull as target
* Bad, because Target Scoring builds a chain across visits, so it is not a bull-up configuration.

### New `BULL_UP` type
* Good, because the spec keeps one engine file per exercise type and gives the one-dart visit its own engine.
* Neutral, because it is the first exercise whose turns hold one dart, and the spec finds no constraint in `0007_constraints.sql` that requires more.

## Evidence / More Information
Decided: 2026-09-24

* `docs/superpowers/specs/2026-09-24-bull-up-practice-exercise-design.md` (§ 1, § 2, § 3): rebuilt Decision Drivers, Considered Options, Pros and Cons, Confirmation.
* `docs/superpowers/plans/2026-09-24-bull-up-practice-exercise.md`: names D362; no section rebuilt.
* Commit `f647618f` (2026-09-24, adds the D362 row): the adding commit.
