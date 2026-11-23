---
id: D0240
status: accepted
date: 2026-08-27
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, checkout, 501, Score Training, visit, bust]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The double-out bust/checkout rule and `otherSeatsComplete` join `turn-log.module.ts`/`seat-state.module.ts` as shared pure functions

## Context and Problem Statement
An audit of all 9 `*.engine.module.ts` files against Pattern 18 and the D232 extraction found these as the two remaining pockets of duplication worth extracting without over-engineering; 121's and TUOD's own doc comments already said "mirrors 501's bust matrix" and the duplication was copied anyway. A rejected alternative for the second finding — a separate `otherSeatsBudgetComplete` function for the duration case, leaving the 3 `status`-based callers untouched — was declined because two functions doing the same job under different names is the same drift this task exists to remove, just with a smaller footprint. Full audit and design: `docs/superpowers/specs/2026-08-27-engine-duplication-cleanup-design.md`.

## Decision Drivers
* An audit of all 9 `*.engine.module.ts` files against Pattern 18 found 2 pockets of duplication worth extracting: the double-out bust rule across 501, 121 and TUOD, and the `otherSeatsComplete` fold (spec, Purpose and Scope).
* TUOD's and Score Training's seat states carry no `status` field, so neither could call `otherSeatsComplete`. Each reimplemented the same `filter().every()` fold inline (spec, F2 Problem).

## Considered Options
* Extract `resolveCheckoutAttempt` and give `otherSeatsComplete` an `isComplete` predicate parameter (chosen).
* Add a separate `otherSeatsBudgetComplete` function for the duration case and leave the 3 `status`-based callers untouched (rejected).

## Decision Outcome
Chosen option: "`app/src/modules/game/checkout-bust.module.ts` gains `resolveCheckoutAttempt(remainingBefore, scored, endedOnDouble): { remainingAfter, checkedOut, busted }` — the double-out bust matrix (overshoot busts; leaving exactly 1 busts, since D1 = 2; reaching exactly 0 without a double busts) that 501, 121, and TUOD each hand-wrote at 5 call sites total. `seat-state.module.ts`'s `otherSeatsComplete(seats, participantRef)` gains a third parameter, `isComplete: (seat: TSeat) => boolean`, and its signature widens to `otherSeatsComplete<TSeat extends SeatState>(seats, participantRef, isComplete)`, so TUOD and Score Training (whose seat states carry no `status` field, only a duration budget) can call it instead of reimplementing the identical `filter().every()` fold inline. Both a ruleset's own extra bust condition (121's final-visit unreachable-remainder rule, TUOD's odd-remainder-with-one-dart-left rule) and each of the 3 existing `status`-based callers stay local, ORing onto or supplying the shared function's result rather than being absorbed into it.".

### Consequences
`dartChecksOutFinalLeg` (501) and `wouldCompleteDart` (121) now read `.checkedOut` off the shared function instead of hand-rolling the same zone/remainder check; TUOD's `visitOutcome` delegates its base rule and ORs in its own odd-remainder escalation. `around-the-clock.engine.module.ts`, `singles-training.engine.module.ts`, and `doubles-training.engine.module.ts` each pass `(seat) => seat.status === "COMPLETE"` as the new third argument — no behavior change for any of the 9 engines; every existing engine test suite passed unmodified as the regression proof, and `bash scripts/check-game-engines.sh` was re-run after each engine file's edit. Comparing the 3 touched engines against their `docs/game-rules/rulesets/*.md` source material during this same audit found the staleness was systemic across all 9 files (six had a stale "Multiplayer: TBD" past their 2026-08-22 1v1 ship date, two misfiled shipped 1v1 as V2+, 501's bust-rate limitation was already resolved for VISUAL_BOARD sessions, and 121 had no Capture section) — corrected in the same branch as doc-only edits to non-canonical raw notes, no separate decision. Four smaller duplication pockets noticed during the same audit (`isDartObservation` hand-duplicated 3x, six identical literal `STAGE` constants, two unconsolidated "state before this visit" techniques, and why `fallow`'s duplication gate did not flag any of this before the fix) were deliberately left unpursued and are logged as F39-F42.

* Neutral, because the spec's non-goals leave the write path's stage-opening logic and the `remainingBeforeVisit`, `seatBeforeVisit` and `targetBeforeVisit` helpers untouched.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/checkout-bust.module.test.ts` covers `resolveCheckoutAttempt` directly. `app/tests/modules/game/seat-state.module.test.ts` covers `otherSeatsComplete`. The existing engine suites serve as the regression check, and the spec calls for `npm run validate:app` before either module counts as done.

## Pros and Cons of the Options
### Extract shared functions with a predicate parameter
* Good, because TUOD and Score Training stop reimplementing the same fold inline (spec, Scope item 2).

### Add a separate `otherSeatsBudgetComplete` function
* Bad, because two functions doing the same job under different names repeat the drift this task exists to remove (spec, F2 Rejected alternative).

## Evidence / More Information
Decided: 2026-08-27

* `docs/superpowers/specs/2026-08-27-engine-duplication-cleanup-design.md` (Purpose, Scope, F1 Non-goals, F2 Problem and Rejected alternative, Testing): rebuilt Decision Drivers, Considered Options, Pros and Cons, Consequences and Confirmation.
* Commit `39345535` (2026-08-27; adds the D240 row): no section rebuilt.
