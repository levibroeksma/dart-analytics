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
<!-- backfill: pending -->

# A decoded-but-seatless snapshot is a third unreplayable career-checkout shape, narrowed to the engines that read seats

## Context and Problem Statement
historical 121/TUOD sessions predate `seats` being stored in the exercise-configuration snapshot; their rows still surface through `v_x01_checkout_darts`, and `getStatisticsOverview` folds every X01 session in one batch, so one such session's fold throwing 500s the whole `/statistics` page instead of degrading one card (#540). A blanket "no seats -> skip" would have silently dropped the still-correct seatless 501 sessions the production data shows exist, so the skip is gated per game rather than applied to every ruleset.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`visitsForSession` (`x01-checkout-sessions.module.ts`) now skips a session when `snapshotOf` decodes its configuration but the result carries an empty `seats` array and the session's `gameTypeKey` is not `501` — the same "nothing to replay" answer as `configuration === null` and an undecodable snapshot, joined to those two checks rather than replacing either. 501 stays out of the gate because `fiveOhOneCheckoutVisits` never reads `seats` at all; 121 and TUOD do, through `foldOneTwentyOneState`/`foldTuodState`'s seat lookup, and threw on the empty list before this fix. `seat-rota.module.ts`'s `activeSeat` also gains a guard: its `PER_SEAT` branch throws a named error on an empty seat list instead of computing `pool[NaN]` (`undefined`) silently, mirroring the existing throw in `seatOf`, so a future engine reaching the same shape fails loudly rather than reproducing this defect.".

### Consequences
a legacy 121/TUOD session with no stored seats now contributes zero checkout visits instead of crashing the whole overview — its Checkout %/related cards read as if that session never happened, same as the other two unreplayable shapes. Any future `PER_SEAT` engine that reads `seats` gets the empty-list throw for free from `activeSeat` rather than needing its own guard.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-21
