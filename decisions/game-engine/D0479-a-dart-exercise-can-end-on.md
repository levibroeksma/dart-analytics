---
id: D0479
status: accepted
date: 2026-10-22
origin: contemporaneous
original-date:
tags: [game-engine, engine, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A dart exercise can end on its own state

## Context and Problem Statement
the shell completed on the timer alone, so a finish needed a hand-written engine as Catch 40 has.

## Decision Drivers
* The exercise shell's `isComplete()` is true on the timer alone, so no exercise can end on its own dart.
* Catch 40 is hand-written because of that gap.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`DartExerciseSpec` and `TrackExerciseDefinition` take an optional `ends(state)`. The exercise shell's `isComplete()` is true once the timer expires or `ends` says so, and `record()` refuses while complete. Doubles Snakes & Ladders is the first caller (three bullseyes in one visit). `moveTable` and `finishOnHits` are Track policies, each with that exercise as first caller (D468).", because the shell completed on the timer alone, so a finish needed a hand-written engine as Catch 40 has.

### Consequences
an exercise that omits `ends` behaves as before. The routine page completes the step on the finishing dart through `COMPLETES_ON_DART`. Spec: `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md`; plan: `docs/superpowers/plans/2026-10-22-track-t2-snakes-ladders.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/dart-exercise-shell.module.test.ts` and `track-exercise-spec.module.test.ts` cover the `ends` hook.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-22

* `docs/superpowers/plans/2026-10-22-track-t2-snakes-ladders.md` (Spec refinements item 1, Task 2): rebuilt Decision Drivers, Confirmation.
* `docs/superpowers/specs/2026-10-21-track-wave-t2-design.md` (§ 2.2): the policy table naming `finishOnHits` and `moveTable` with Doubles Snakes & Ladders as first caller.
* Commit `5c21233a` (PR #1058, 2026-10-22): the adding commit.
