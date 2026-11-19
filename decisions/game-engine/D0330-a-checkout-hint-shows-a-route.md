---
id: D0330
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A checkout hint shows a route the darts left can throw, never the longer chart route

## Context and Problem Statement
Issue #291 (migrated `FINDINGS.md` F70). The gate was true reachability after #247, but the text stayed `checkoutPathFor`'s conventional route, whose length is not always the minimum. At 50 with one dart left the hint read "10 D20" — two darts the player no longer had — for a finish that was genuinely still on (BULL). The same mismatch hit 101, 104, 107 and 110 with two darts left. Suppressing the hint instead was rejected: it hides a finish that is still available, and the unconventional route is exactly the one a player is least likely to see unaided.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`checkout-path.module.ts` gains `checkoutPathWithin(remainingScore, dartsAvailable)`, which returns the curated chart route when its length fits `dartsAvailable` and otherwise searches for the shortest true double-out route within the darts left, `null` when none exists. 121's `checkoutHint` and TUOD's `checkoutHintFor` render it and drop their own `isCheckoutReachable` gate, which it subsumes: the gate and the displayed string now come from one call and cannot disagree.".

### Consequences
the chart stays the display default for every route that fits, so normal play reads unchanged; only the five mismatching remainders show a computed route, and they show the BULL finish that is actually throwable. `isCheckoutReachable` keeps its engine callers (`one-twenty-one.engine.module.ts`) and is no longer imported by either play file. TUOD is fixed in the same pass although #291 names 121 only — the two call sites were the same three lines, and TUOD's doc comment already promised the behavior it did not have.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
