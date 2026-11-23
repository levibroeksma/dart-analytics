---
id: D0545
status: accepted
date: 2026-11-10
origin: contemporaneous
original-date:
tags: [game-engine, engine, Score Training, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Bull 500 V1 scores through the kernel's `visitPoints`; the engine ends the game, `goal` stays unset

## Context and Problem Statement
Bull 500 scores by dart order (a bull unlocks, then only the 20 counts); no function of the dart sum can express that, and D543's `visitPoints` already scores a visit from its darts, so no second kernel hook is added.

## Decision Drivers
* Bull 500 scores by dart order, which no function of the dart sum can express (spec § 2).
* Existing Visit points callers (Score Training, Score Threshold, Fives) fold byte-identically (spec § 2).
* Bull 500 must bind to its correct kernel, `VISIT_POINTS`, registered `KERNEL_BOUND` (spec B2).
* Bull 500 lets the total pass 500, so `goal` stays unset (spec B5).

## Considered Options
* Score through the kernel's `visitPoints(darts, visitIndex)`, already on `main` from Ace (chosen).
* Add a second kernel hook `pointsOf(darts)`. The spec proposed it; D545 supersedes that proposal because `visitPoints` already scores a visit from its darts.

## Decision Outcome
Chosen option: "Bull 500 sets `VisitPointsRules.visitPoints` (D543) to `bull500VisitPoints(darts)`, ignoring the visit index, and leaves `goal` unset, because `goal` makes an overshoot a bust and Bull 500 lets the total pass 500; the engine ends the game at the close of the visit whose total is 500 or more. A bull is `hitTargetNumber` 25; a live dart is a non-bull dart on the 20; darts to target is `dartsThrown`; the useful unlock rate is computed in the results presenter, not the kernel. `visitRaceVisitOpen` and `visitRaceWouldComplete` give Fives and Bull 500 their `isVisitOpen` and `wouldComplete`. Bull 500 is single-seat, so `SEAT_CAPS` and `SEAT_FLOORS` get no entry.".

### Consequences
Score Training, Score Threshold, Fives and Ace fold as before. Bull 500 is a `PER_SEAT` `DartGameSpec`, darts only (QUICK_SCORE cannot show bull order).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`scripts/engine-kernels.txt` lists `bull-500.engine.module.ts` as `VISIT_POINTS | KERNEL_BOUND`, checked by `scripts/check-engine-kernels.sh`. `app/tests/modules/game/bull-500.engine.module.test.ts` asserts `BULL_500_RULES.visitPoints` is `bull500VisitPoints`.

## Pros and Cons of the Options
### `visitPoints` on `main`
* Good, because no second kernel hook is added.

### `pointsOf` hook
* Bad, because it duplicates what `visitPoints` already does once Ace lands it.

## Evidence / More Information
Decided: 2026-11-10

* `docs/superpowers/specs/2026-11-10-bull-500-design.md` (§ 1 B2, B5, § 2; banner superseding `pointsOf`): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons.
* Commit `b15c2270` (2026-11-10, "decision for pointsOf") and commit `4e7a0e24` (2026-11-10, rebase onto `visitPoints`; renumbers D545/D546): add the original ledger block.
