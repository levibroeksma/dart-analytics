---
id: D0357
status: superseded
date: 2026-10-20
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, scoring, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by: D0474
---
<!-- backfill: pending -->

# Switching Target Scoring is its own exercise type, sharing Target Scoring's locked point table

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/switching-target-scoring.md`) advance on every hit and restart on every miss — neither Target Scoring's fold (advance only on a broken chain, D356) nor Switching's (dart-by-dart cycle, no chain, no bull, D297). Sharing the point function keeps the two exercises' scoring from drifting apart.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SWITCHING_TARGET_SCORING` / `SWITCHING_TARGET_SCORING_V1` is a new exercise type (seed `0024`) with its own `DartExerciseEngine` (`switching-target-scoring.engine.module.ts`). Its configuration is `targets` alone — exactly three distinct board targets, `1`–`20` or `25`. A hit advances to the next target (wrapping after the last, chain kept); a miss resets the chain and restarts the sequence at the first target, mid-visit included; the sequence carries across visit boundaries. Scoring reuses `targetScoringPoints` from the Target Scoring engine rather than copying the table. Intended zone and turn shape as D356. Routine step only.".

### Consequences
a change to Target Scoring's point table changes both exercises at once, which is the intent; a divergent table would be a new ruleset version on one of them. A sequence length other than three is a new ruleset version, not a config edit. Standalone play stays deferred (V2+).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-23
