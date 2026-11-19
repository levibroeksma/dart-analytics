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
<!-- backfill: pending -->

# The double-out confirm gate (D180) tests a direct `remaining - score === 0` predicate

## Context and Problem Statement
For 501, `wouldComplete` (`five-oh-one.engine.module.ts`) answers whether a visit wins the *match* (`legsWon` reaches `legsToWin`), not whether it wins the current *leg* — using it would skip the confirm on every non-final-leg checkout. The distinction lives only as a code comment on `wouldComplete` today; the next X01-family game (301/701 variants, `docs/game-rules/rulesets/501.md`'s Later Versions) inherits the identical trap with no rule text to check against

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The double-out confirm gate (D180) tests a direct `remaining - score === 0` predicate, not `engine.wouldComplete()`".

### Consequences
Rationale unknown — backfill pending.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-08-02
