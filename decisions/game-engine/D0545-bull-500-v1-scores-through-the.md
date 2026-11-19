---
id: D0545
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Bull 500 V1 scores through the kernel's `visitPoints`; the engine ends the game, `goal` stays unset

## Context and Problem Statement
Bull 500 scores by dart order (a bull unlocks, then only the 20 counts); no function of the dart sum can express that, and D543's `visitPoints` already scores a visit from its darts, so no second kernel hook is added.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Bull 500 sets `VisitPointsRules.visitPoints` (D543) to `bull500VisitPoints(darts)`, ignoring the visit index, and leaves `goal` unset, because `goal` makes an overshoot a bust and Bull 500 lets the total pass 500; the engine ends the game at the close of the visit whose total is 500 or more. A bull is `hitTargetNumber` 25; a live dart is a non-bull dart on the 20; darts to target is `dartsThrown`; the useful unlock rate is computed in the results presenter, not the kernel. `visitRaceVisitOpen` and `visitRaceWouldComplete` give Fives and Bull 500 their `isVisitOpen` and `wouldComplete`. Bull 500 is single-seat, so `SEAT_CAPS` and `SEAT_FLOORS` get no entry.".

### Consequences
Score Training, Score Threshold, Fives and Ace fold as before. Bull 500 is a `PER_SEAT` `DartGameSpec`, darts only (QUICK_SCORE cannot show bull order).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-10
