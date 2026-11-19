---
id: D0150
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# No engine hands out live internals

## Context and Problem Statement
Four engines returned derived copies and one returned live state, so the same caller write drove completion in one game and silently no-opped in the other four; the shared `STAGE` constant also landed inside an Alpine `$persist` proxy (D120)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "No engine hands out live internals: `state()` returns a freshly derived object and `facts()` returns detached stage/turn records (the module-level `STAGE` constant is cloned). Score Training's MINUTES timer expiry moves from a write through the returned state to an explicit `ScoreTrainingEngine.expireTimer()`".

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
