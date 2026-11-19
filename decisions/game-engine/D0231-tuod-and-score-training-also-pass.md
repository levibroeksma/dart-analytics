---
id: D0231
status: accepted
date: 2026-08-22
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, Score Training, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# TUOD and Score Training also pass `activeSeat()` a real completion predicate; only Around the Clock's does work

## Context and Problem Statement
D230's underlying architectural point was right — Around the Clock is the one engine whose seats can genuinely diverge, because a miss costs it an extra visit, so its predicate is the only one that ever redirects a turn. TUOD's and Score Training's seats share one fixed ROUNDS budget under lockstep alternation, so their predicates are structurally no-ops: the seat `activeSeat()` returns is identical with or without them, proven by `app/tests/modules/game/seat-rota.module.test.ts`'s own no-op case. They are passed anyway so the fold stays correct if either ruleset ever gains a non-uniform per-seat budget — a deliberate choice D230 recorded as an absence. The literal claim then propagated into three engine doc comments and `docs/architecture/04-Architecture-patterns.md`'s Pattern 18, where a reader checking "does my engine need a predicate?" against the source would find the docs and the code disagreeing.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "D230 states that "only `AroundTheClockEngine` passes a real one" to `activeSeat()`'s optional 4th parameter. That is wrong as written. `foldTuodState` (`app/src/modules/game/tuod.engine.module.ts`) and `foldScoreTrainingState` (`app/src/modules/game/score-training.engine.module.ts`) both call the 4-argument form too, each passing a predicate that reads its own seat's `seatCompletesAt` result. The correct statement is: three engines pass a predicate — Around the Clock, TUOD and Score Training — and only Around the Clock's changes the answer. The other five 1v1 engines (Bob's 27, 121, Shanghai, Singles Training, Doubles Training) omit the argument entirely and take the `() => false` default.".

### Consequences
`tuod.engine.module.ts`, `score-training.engine.module.ts` and `seat-rota.module.ts` doc comments corrected to state that a predicate IS passed and why it is a no-op; `04-Architecture-patterns.md`'s Pattern 18 paragraph corrected and pointed here. D230's block is untouched, per the append-only rule — this decision is the correction of record. Three regression tests lock the corrected claim: the two engines' folds hand the final round to the seat that still has one (`tuod.engine.module.test.ts`, `score-training.engine.module.test.ts`), and `activeSeat()` returns the same seat with or without a predicate under a uniform budget (`seat-rota.module.test.ts`).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-22
Supersedes: D230 — on this one point only (which engines PASS a completion predicate). Every other clause of D230 — the three win-condition categories, `SEAT_CAPS`, and the parameter's existence and default — stands unchanged.
