---
id: D0347
status: accepted
date: 2026-09-21
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, checkout, 501]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A decoded-but-seatless snapshot is a third unreplayable career-checkout shape, narrowed to the engines that read seats

## Context and Problem Statement
historical 121/TUOD sessions predate `seats` being stored in the exercise-configuration snapshot; their rows still surface through `v_x01_checkout_darts`, and `getStatisticsOverview` folds every X01 session in one batch, so one such session's fold throwing 500s the whole `/statistics` page instead of degrading one card (#540). A blanket "no seats -> skip" would have silently dropped the still-correct seatless 501 sessions the production data shows exist, so the skip is gated per game rather than applied to every ruleset.

## Decision Drivers
* A snapshot decodes but lifts `seats: []` when the historical `exercise_configurations` row predates seats being stored (commit `466beb5b` message).
* 121 and TUOD fold over the seat list and threw, which returned a 500 for the whole `/statistics` overview for the batch (same message, #540).
* 501 does not read seats, so it is unaffected (same message).

## Considered Options
* Skip every session whose snapshot has no seats (rejected in the Context).
* Skip only the engines that read seats, 121 and TUOD (chosen).

## Decision Outcome
Chosen option: "`visitsForSession` (`x01-checkout-sessions.module.ts`) now skips a session when `snapshotOf` decodes its configuration but the result carries an empty `seats` array and the session's `gameTypeKey` is not `501` — the same "nothing to replay" answer as `configuration === null` and an undecodable snapshot, joined to those two checks rather than replacing either. 501 stays out of the gate because `fiveOhOneCheckoutVisits` never reads `seats` at all; 121 and TUOD do, through `foldOneTwentyOneState`/`foldTuodState`'s seat lookup, and threw on the empty list before this fix. `seat-rota.module.ts`'s `activeSeat` also gains a guard: its `PER_SEAT` branch throws a named error on an empty seat list instead of computing `pool[NaN]` (`undefined`) silently, mirroring the existing throw in `seatOf`, so a future engine reaching the same shape fails loudly rather than reproducing this defect.".

### Consequences
a legacy 121/TUOD session with no stored seats now contributes zero checkout visits instead of crashing the whole overview — its Checkout %/related cards read as if that session never happened, same as the other two unreplayable shapes. Any future `PER_SEAT` engine that reads `seats` gets the empty-list throw for free from `activeSeat` rather than needing its own guard.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `466beb5b` added the skip. Commit `d209d42c` (#780) later changed `visitsForSession` to fold a seatless 121 or TUOD session with a synthetic solo seat, and `app/tests/modules/stats/x01-checkout-sessions.module.test.ts` asserts that today. The same file asserts that a seatless 501 session still contributes visits. `app/tests/modules/game/seat-rota.module.test.ts` asserts that `activeSeat` throws for `PER_SEAT` with no seats.

## Pros and Cons of the Options
### Skip every seatless session
* Bad, because it would silently drop the still-correct seatless 501 sessions that production data shows exist (row added by commit `466beb5b`).

### Skip only seat-reading engines
* Good, because the overview degrades one session instead of returning a 500 (commit `466beb5b` message).
* Bad, because a skipped legacy 121/TUOD session contributes zero checkout visits to the Checkout cards (row added by commit `466beb5b`).

## Evidence / More Information
Decided: 2026-09-21

* Commit `466beb5b` (2026-09-21, fixes #540; adds the D347 row to `decisions/game-engine.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* Commit `d209d42c` (#780; fold seatless 121/TUOD sessions with a synthetic solo seat): history only; it is the commit that changed the behaviour the Confirmation asserts. No section rebuilt from it.
