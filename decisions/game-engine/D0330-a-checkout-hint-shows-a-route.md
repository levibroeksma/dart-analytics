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

# A checkout hint shows a route the darts left can throw, never the longer chart route

## Context and Problem Statement
Issue #291 (migrated `FINDINGS.md` F70). The gate was true reachability after #247, but the text stayed `checkoutPathFor`'s conventional route, whose length is not always the minimum. At 50 with one dart left the hint read "10 D20" — two darts the player no longer had — for a finish that was genuinely still on (BULL). The same mismatch hit 101, 104, 107 and 110 with two darts left. Suppressing the hint instead was rejected: it hides a finish that is still available, and the unconventional route is exactly the one a player is least likely to see unaided.

## Decision Drivers
* After #247 the gate was true reachability, but the text stayed `checkoutPathFor`'s conventional route, whose length is not always the minimum (row added by commit `254f3fa7`).
* At 50 with one dart left the hint read "10 D20" for a finish still on with the BULL; 101, 104, 107 and 110 with two darts left showed the same mismatch (same row).

## Considered Options
* Keep the chart route behind the `isCheckoutReachable` gate (status quo).
* Suppress the hint when the chart route does not fit the darts left (rejected in the Context).
* Add `checkoutPathWithin(remainingScore, dartsAvailable)`, which returns the chart route when it fits and the shortest true route otherwise (chosen).

## Decision Outcome
Chosen option: "`checkout-path.module.ts` gains `checkoutPathWithin(remainingScore, dartsAvailable)`, which returns the curated chart route when its length fits `dartsAvailable` and otherwise searches for the shortest true double-out route within the darts left, `null` when none exists. 121's `checkoutHint` and TUOD's `checkoutHintFor` render it and drop their own `isCheckoutReachable` gate, which it subsumes: the gate and the displayed string now come from one call and cannot disagree.".

### Consequences
the chart stays the display default for every route that fits, so normal play reads unchanged; only the five mismatching remainders show a computed route, and they show the BULL finish that is actually throwable. `isCheckoutReachable` keeps its engine callers (`one-twenty-one.engine.module.ts`) and is no longer imported by either play file. TUOD is fixed in the same pass although #291 names 121 only — the two call sites were the same three lines, and TUOD's doc comment already promised the behavior it did not have.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/game/checkout-path.module.test.ts` has a `checkoutPathWithin` describe block, and `app/tests/modules/game/checkout-reachability.module.test.ts` covers `isCheckoutReachable`.

## Pros and Cons of the Options
### Keep the chart route behind the gate
* Bad, because the hint shows darts the player no longer has for a finish that is still available (row added by commit `254f3fa7`).

### Suppress the hint
* Bad, because it hides a finish that is still available, and the unconventional route is the one a player is least likely to see unaided (same row).

### `checkoutPathWithin`
* Good, because the gate and the displayed string come from one call and cannot disagree (same row).
* Good, because the chart stays the display default for every route that fits (same row).

## Evidence / More Information
Decided: 2026-09-19

* Commit `254f3fa7` (2026-09-19, closes #291; adds the D330 row to `decisions/game-engine.md`): rebuilt Decision Drivers, Considered Options and Pros and Cons.
