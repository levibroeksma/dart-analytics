---
id: D0181
status: accepted
date: 2026-08-02
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, 501, leg, visit]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The double-out confirm gate (D180) tests a direct `remaining - score === 0` predicate

## Context and Problem Statement
For 501, `wouldComplete` (`five-oh-one.engine.module.ts`) answers whether a visit wins the *match* (`legsWon` reaches `legsToWin`), not whether it wins the current *leg* — using it would skip the confirm on every non-final-leg checkout. The distinction lives only as a code comment on `wouldComplete` today; the next X01-family game (301/701 variants, `docs/game-rules/rulesets/501.md`'s Later Versions) inherits the identical trap with no rule text to check against

## Decision Drivers
Rationale unknown — no source found.

## Considered Options
* Gate on `engine.wouldComplete()` (rejected: it answers whether a visit wins the match, so the confirm would skip every non-final-leg checkout).
* Test `remaining - score === 0` directly (chosen).

## Decision Outcome
Chosen option: "The double-out confirm gate (D180) tests a direct `remaining - score === 0` predicate, not `engine.wouldComplete()`".

### Consequences
Rationale unknown — no source found.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Gate on `engine.wouldComplete()`
* Bad, because it answers match-win, so the double-out confirm would not open on a checkout that wins only the leg.

### Test `remaining - score === 0` directly
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-08-02

* Commit `c40fb8ec` (PR #66, 2026-08-02; adds the D181 row): adds the row; no section rebuilt.
* `docs/superpowers/plans/2026-08-01-501-recreational-v1.md` (the D183 redesign note in the play-page task): rebuilt Considered Options and Pros and Cons; it calls `engine.wouldComplete` a match-win, not leg-win, predicate.
