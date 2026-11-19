---
id: D0484
status: accepted
date: 2026-10-23
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, checkout, undo, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Random Checkout fails an attempt once its finish is unreachable

## Context and Problem Statement
a player on 120 who hit a 1 with two darts left kept throwing at a target that could not be finished.

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`RANDOM_CHECKOUT_V1` folds a visit to `FAILED` the moment the remainder has no double-out within the darts left (`isCheckoutReachable(remaining, 3 - dartsThrown)`), alongside the bust and third-dart rules. The next draw replaces the attempt at once (#1064).", because a player on 120 who hit a 1 with two darts left kept throwing at a target that could not be finished.

### Consequences
no new ruleset version. The outcome folds from the visit's darts alone, so undo and replay agree. A stored visit that kept throwing after the finish became unreachable still folds to the same attempt and checkout counts, since it could not have checked out. Rules: `docs/game-rules/training/exercises/random-checkout.md`.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/random-checkout.engine.module.test.ts` and `app/tests/modules/game/checkout-reachability.module.test.ts` cover the unreachable-finish rule.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-23

* Commit `10d4c1b9` (#1064): adds the D484 row; it rebuilt no section.
* `docs/superpowers/plans/2026-10-27-checkout-kernel-pr2.md` (Task text on `unreachableFails`): the rule moves into the kernel judge; it rebuilt no section.
