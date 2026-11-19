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
<!-- backfill: pending -->

# Bull Up Practice is its own exercise type with one-dart turns

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/bull-up-practice.md`) judge a single cold dart, and every shipped exercise judges three-dart visits. Target Scoring accepts the bull as a target but builds a chain across visits, so it is not a bull-up configuration.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`BULL_UP` / `BULL_UP_V1` is a new exercise type (seed `0030`, template "Bull Up Practice") with its own `DartExerciseEngine` (`bull-up.engine.module.ts`). Each throw is one dart and one `turns` row, completed when written; every dart carries `25`/`INNER_BULL`. A throw is a Bullseye (inner bull), an Outer bull, or a Miss; bulls count both rings. Configuration is the empty object `{}`. Routine step only.".

### Consequences
the first exercise whose turns hold one dart; `undoLastDart` removes the emptied turn, so no new turn shape is needed. Board preview marks either bull a hit. A distance-from-centre readout and standalone play stay deferred (V2+).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-24
