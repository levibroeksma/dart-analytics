---
id: D0479
status: accepted
date: 2026-10-22
origin: contemporaneous
original-date:
tags: [game-engine, engine, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A dart exercise can end on its own state

## Context and Problem Statement
the shell completed on the timer alone, so a finish needed a hand-written engine as Catch 40 has.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`DartExerciseSpec` and `TrackExerciseDefinition` take an optional `ends(state)`. The exercise shell's `isComplete()` is true once the timer expires or `ends` says so, and `record()` refuses while complete. Doubles Snakes & Ladders is the first caller (three bullseyes in one visit). `moveTable` and `finishOnHits` are Track policies, each with that exercise as first caller (D468).", because the shell completed on the timer alone, so a finish needed a hand-written engine as Catch 40 has.

### Consequences
an exercise that omits `ends` behaves as before. The routine page completes the step on the finishing dart through `COMPLETES_ON_DART`. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-22-track-t2-snakes-ladders.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-22
