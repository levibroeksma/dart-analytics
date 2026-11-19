---
id: D0242
status: accepted
date: 2026-08-28
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, 501, Score Training, visit, bust, turns, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `visitScoreBandCounts` gains a `sixtyPlus` band; `checkout-bust.module.ts` gains `checkoutAttemptCount`

## Context and Problem Statement
Issue #167 asked for a 60+ tally alongside the existing four bands, and for a checkout-percentage stat. Checkout % is only computable for VISUAL_BOARD sessions (QUICK_SCORE never persists dart rows, so a bust is indistinguishable from a genuine zero-score visit — `05-Database/06-Spec/04-Runtime-Layer.md`); for VISUAL_BOARD, a bust and a failed checkout attempt are the same event for every X01-style engine sharing `resolveCheckoutAttempt`, so `made = legsWon` and `attempted = legsWon + checkoutAttemptCount(...)` needs no new persisted fact or engine change. Both additions extend existing shared helpers rather than introducing 501-local versions, per D238's and D240's own stated intent that the next caller reuse them.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`app/src/lib/game/play-visit-stats.ts`'s `visitScoreBandCounts(turns)` (D238/Pattern 21) gains a fifth exclusive band, `sixtyPlus` (60-99, the lowest of the five — a visit still counts into only its single highest qualifying band). `app/src/modules/game/checkout-bust.module.ts` (D240) gains `checkoutAttemptCount(turns)`, counting completed visits whose `totalScore` was zeroed by a bust but whose own darts summed to more than zero — provably, by `resolveCheckoutAttempt`'s own rule, exactly the visits where a checkout was attempted and failed. 501's per-player match summary (issue #167) is the first caller of both.".

### Consequences
Score Training's and Shanghai's existing `visitScoreBandCounts` callers gain an unused `sixtyPlus` field via the object spread they already use (`...visitScoreBandCounts(seatTurns)`) — additive, no call-site change, their modals don't render it. 121 and TUOD could call `checkoutAttemptCount` under the same reasoning later; this task wires it into 501 only. `play-visit-stats.test.ts` and `checkout-bust.module.test.ts` cover both additions directly.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-28
