---
id: D0142
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, visit, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Persistence semantics fixed for every game

## Context and Problem Statement
Storing game points or a negative turn total in shared columns silently corrupts every cross-game aggregation (review I5)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Persistence semantics fixed for every game: `darts.score` is the dart's actual board score, never a game-specific point value; `turns.total_score` is the sum of counted dart board scores — `0` for a void visit, never negative — so Bob's 27's full-miss penalty and Singles Training's 1/2/3 points are derived, never written", because Storing game points or a negative turn total in shared columns silently corrupts every cross-game aggregation (review I5).

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-07-26
