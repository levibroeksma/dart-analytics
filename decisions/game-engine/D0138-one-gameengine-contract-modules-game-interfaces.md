---
id: D0138
status: accepted
date: 2026-07-26
origin: contemporaneous
original-date:
tags: [game-engine, engine, GameEngine, 501, undo, leg]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# One `GameEngine` contract (`modules/game/interfaces.ts`, Pattern 18) replaces five

## Context and Problem Statement
Five engines shipped five APIs, three fact models and no rehydrate path, so every shared consumer (play page, store, undo, leave/abandon, hard-gate) had to special-case each game; `wouldComplete` exists because deciding completion by record-then-rollback strands the `LEG` stage 501's `record()` opens (review C1, I1–I3, ST6, P2)

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "One `GameEngine` contract (`modules/game/interfaces.ts`, Pattern 18) replaces five bespoke engine APIs: a `GameEngineFactory` builds every engine from a validated config snapshot bound to a `rulesetVersionKey`; the engine mints `clientKey`/`sequence`/`completedAt`, rehydrates via `create(config, prior)`, answers `wouldComplete(input)` as a pure non-mutating predicate, and `undo()` is an exact inverse of `record()` over `facts()` including any stage the record opened; one generic `events.payload.module.ts` builds every batch".

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
