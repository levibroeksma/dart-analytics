---
id: D0478
status: accepted
date: 2026-10-21
origin: contemporaneous
original-date:
tags: [game-engine, engine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Zone targets are their own type; TrackRules takes a defaulted target parameter

## Context and Problem Statement
widening `BoardTarget` itself breaks every game that reads `target.number` once BULL is ruled out — 33 type errors in 20 files, 12 in append-only tests. The defaulted parameter changes no existing engine or test.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "a number-less Track target (`ANY_DOUBLE`, `ANY_TREBLE`) is a `ZoneTarget`, and `TrackTarget = BoardTarget | ZoneTarget`. `TrackRules`, `JudgedDart`, the kernel's three folds, `TrackExerciseDefinition` and `trackExerciseSpec` take `TTarget extends TrackTarget = BoardTarget`; `isHitOn`, `boardTargetLabel`, `targetAt`, `pathTarget`, `anyRingEitherBull`, `tallyOnTarget` and `boardScorePoints` accept a `TrackTarget`. `BoardTarget` is unchanged. Halve-It is the first caller.".

### Consequences
a game or exercise that never aims at a zone keeps `BoardTarget` and its narrowings. A zone target's dart carries `intendedTargetNumber` null and the zone as `intendedZoneKey`. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-21-track-t2-halve-it.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-21
