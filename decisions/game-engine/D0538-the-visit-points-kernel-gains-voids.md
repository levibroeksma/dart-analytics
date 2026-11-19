---
id: D0538
status: accepted
date: 2026-11-08
origin: contemporaneous
original-date:
tags: [game-engine, Score Training, leg, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The Visit points kernel gains `voids` and `goal`; Fives V1 is the first caller

## Context and Problem Statement
Visit-points spec V2: a rule lands with its first caller. Fives needs exact-goal, void and bust; no new dart fact is needed because every on-board dart scores at least 1.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`VisitPointsRules` gains optional `voids(darts)` (a closed visit that books no points whatever its total) and `goal` (a closed visit whose points would take the seat above it is a bust and books nothing). `VisitPointsSeat` gains `voids`, `busts` and `scoringVisits`. A dart with board score 0 is off the board, so Fives voids a visit on any score-0 dart. The leg ends the moment a seat reaches 51, so seat 1 has a first-throw edge. An off-board dart is a `MISS` zone dart with no landing coordinate. A void and a bust are counted apart; a total not divisible by 5 is a plain zero.", because Visit-points spec V2: a rule lands with its first caller. Fives needs exact-goal, void and bust; no new dart fact is needed because every on-board dart scores at least 1.

### Consequences
Score Training and Score Threshold set neither rule and fold as before. Fives is a `SHARED`-leg `DartGameSpec`, 2–4 seats, darts only (QUICK_SCORE cannot show an off-board dart).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-08
