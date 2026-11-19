---
id: D0506
status: accepted
date: 2026-10-29
origin: contemporaneous
original-date:
tags: [game-engine, engine, scoring, undo, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes: D0488
superseded-by:
---
<!-- backfill: pending -->

# The Marks kernel binds Cricket and Tactics to the game shell; the shell's served-key check replaces the typed key

## Context and Problem Statement
every other kernel family runs on the game shell; a second engine base class kept two ways to record, undo and close a visit. The owner chose the shell over keeping `MarksEngine` (2026-10-28).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`marks-kernel.module.ts` holds the Marks family: `MarksRules` (`initialSeat`, `hitOf(seat, opponent | null, observation)` — null when playing alone, `valueOf`), `foldMarks` (one seat alone, two seats through `foldMarksDuel`), `marksWouldComplete` (one trial dart by the active seat on the folded state) and `marksGameSpec`, which builds a `PER_SEAT` `DartGameSpec` from a `MarksRules` record: refuse once `COMPLETE`, `NO_INTENT` darts, a visit open below three darts while the game is in progress. Cricket and Tactics are each `dartGameEngineClass(spec)` with one `dartGameEngineFactory` per key. `MarksEngine`, `marksEngineFactory`, `marks-duel.module.ts` and `recordMarksDart` are deleted; the engine classes lose their `TKey` parameter, and a factory for a key the spec does not serve throws at module load.", because every other kernel family runs on the game shell; a second engine base class kept two ways to record, undo and close a visit. The owner chose the shell over keeping `MarksEngine` (2026-10-28).

### Consequences
no behaviour change — a differential oracle against a frozen copy of the `MarksEngine` engines (1 and 2 seats, both keys, undo and rehydration) passed before the copy was deleted, and golden traces recorded on the old engines hold it now. The wrong-key guard is a runtime test, not a type error. Both registry rows are `KERNEL_BOUND`. Close order, cut-throat scoring and more than two seats land with the first game that needs them. Spec: `docs/superpowers/specs/2026-10-28-marks-kernel-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-29
