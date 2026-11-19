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

# The Marks kernel binds Cricket and Tactics to the game shell; the shell's served-key check replaces the typed key

## Context and Problem Statement
every other kernel family runs on the game shell; a second engine base class kept two ways to record, undo and close a visit. The owner chose the shell over keeping `MarksEngine` (2026-10-28).

## Decision Drivers
* The aim is tidying: one fewer engine base class, with every kernel family on the same shell.
* Behaviour must not change for Cricket and Tactics.

## Considered Options
* Keep `MarksEngine` and D488's compile-time key guard.
* Bind Marks on the game shell and use its runtime served-key check (chosen).

## Decision Outcome
Chosen option: "`marks-kernel.module.ts` holds the Marks family: `MarksRules` (`initialSeat`, `hitOf(seat, opponent | null, observation)` — null when playing alone, `valueOf`), `foldMarks` (one seat alone, two seats through `foldMarksDuel`), `marksWouldComplete` (one trial dart by the active seat on the folded state) and `marksGameSpec`, which builds a `PER_SEAT` `DartGameSpec` from a `MarksRules` record: refuse once `COMPLETE`, `NO_INTENT` darts, a visit open below three darts while the game is in progress. Cricket and Tactics are each `dartGameEngineClass(spec)` with one `dartGameEngineFactory` per key. `MarksEngine`, `marksEngineFactory`, `marks-duel.module.ts` and `recordMarksDart` are deleted; the engine classes lose their `TKey` parameter, and a factory for a key the spec does not serve throws at module load.", because every other kernel family runs on the game shell; a second engine base class kept two ways to record, undo and close a visit. The owner chose the shell over keeping `MarksEngine` (2026-10-28).

### Consequences
no behaviour change — a differential oracle against a frozen copy of the `MarksEngine` engines (1 and 2 seats, both keys, undo and rehydration) passed before the copy was deleted, and golden traces recorded on the old engines hold it now. The wrong-key guard is a runtime test, not a type error. Both registry rows are `KERNEL_BOUND`. Close order, cut-throat scoring and more than two seats land with the first game that needs them. Spec: `docs/superpowers/specs/2026-10-28-marks-kernel-design.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/marks-kernel.module.test.ts`, `cricket.golden.test.ts` and `tactics.golden.test.ts` check the kernel and both engines. `scripts/check-engine-kernels.sh` runs in `quality.yml` and checks the `KERNEL_BOUND` rows for both engines in `scripts/engine-kernels.txt`.

## Pros and Cons of the Options
### Keep `MarksEngine`
* Bad, because a second engine base class kept two ways to record, undo and close a visit.

### Bind on the game shell
* Good, because every other kernel family already runs on the shell.

## Evidence / More Information
Decided: 2026-10-29

* `docs/superpowers/specs/2026-10-28-marks-kernel-design.md` (§ 1 decisions M1-M6, § 2): rebuilt Decision Drivers, Considered Options, Pros and Cons and Confirmation.
* Commit `d88a61dc` (PR #1145, 2026-10-29; adds the D506 row and the golden tests): confirmed Confirmation.
* Supersedes D488.
* Applied in: `docs/superpowers/plans/2026-10-28-marks-kernel.md`, `docs/superpowers/plans/2026-10-30-mickey-mouse-v1.md`.
