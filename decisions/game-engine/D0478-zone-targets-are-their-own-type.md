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

# Zone targets are their own type; TrackRules takes a defaulted target parameter

## Context and Problem Statement
widening `BoardTarget` itself breaks every game that reads `target.number` once BULL is ruled out — 33 type errors in 20 files, 12 in append-only tests. The defaulted parameter changes no existing engine or test.

## Decision Drivers
* Widening `BoardTarget` breaks every game that reads `target.number` once BULL is ruled out: 33 type errors in 20 files, 12 in append-only tests (spec, § 1).
* The defaulted parameter leaves every existing engine and test untouched (spec § 2.1).

## Considered Options
* A separate `ZoneTarget` type reached through a defaulted `TTarget` parameter on `TrackRules` (chosen).
* Widen `BoardTarget` with the zone kinds (rejected in the spec, § 1).

## Decision Outcome
Chosen option: "a number-less Track target (`ANY_DOUBLE`, `ANY_TREBLE`) is a `ZoneTarget`, and `TrackTarget = BoardTarget | ZoneTarget`. `TrackRules`, `JudgedDart`, the kernel's three folds, `TrackExerciseDefinition` and `trackExerciseSpec` take `TTarget extends TrackTarget = BoardTarget`; `isHitOn`, `boardTargetLabel`, `targetAt`, `pathTarget`, `anyRingEitherBull`, `tallyOnTarget` and `boardScorePoints` accept a `TrackTarget`. `BoardTarget` is unchanged. Halve-It is the first caller.".

### Consequences
a game or exercise that never aims at a zone keeps `BoardTarget` and its narrowings. A zone target's dart carries `intendedTargetNumber` null and the zone as `intendedZoneKey`. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-21-track-t2-halve-it.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/halve-it.engine.module.test.ts` and `app/tests/modules/training/exercises/halve-it.aimed.golden.test.ts` cover Halve-It, the first caller.

## Pros and Cons of the Options
### Separate `ZoneTarget` with a defaulted parameter
* Good, because the defaulted parameter changes no existing engine or test.
* Good, because `BoardTarget` is unchanged.

### Widen `BoardTarget`
* Bad, because it breaks every game that reads `target.number` once BULL is ruled out: 33 type errors in 20 files, 12 in append-only tests.

## Evidence / More Information
Decided: 2026-10-21

* `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (§ 1, 2.1): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons.
* `docs/superpowers/plans/2026-10-21-track-t2-halve-it.md` (Task 12): the plan step that appends the D478 row.
* Commit `c97fde9d` (PR #1055, adds the D478 row): Halve-It V1 on the Track kernel.
