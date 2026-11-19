---
id: D0500
status: accepted
date: 2026-10-27
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, checkout, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The Checkout kernel folds judged visits; its engines migrate simplest first

## Context and Problem Statement
the four engines share one attempt loop but judge visits from different facts (darts vs a settled `totalScore`), so judging is the ruleset's policy and the loop is the kernel; simplest first keeps each shell change in the PR of the first engine that needs it (D468 method).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`checkout-kernel.module.ts` folds a `CheckoutSeat` over visits a ruleset has already judged: `CheckoutRules` names `judge` (turn → `VisitVerdict`), `visitsPerAttempt`, `onAttemptClose` and `nextTarget` (`null` ends the seat). The kernel never applies a bust rule itself; record-time rules that settle a turn stay in the engine. The shipped Checkout engines migrate Checkout Sequence → Random Checkout → Ten Up One Down → 121, reversing the umbrella order, because the two exercises fit the existing exercise shell and the two games each need a shell extension (visit-total input; a stage per attempt). Checkout Sequence lands first and moves onto the exercise shell, whose `isVisitOpen` now sees the folded state.".

### Consequences
Checkout Sequence's hand-written class is gone; its behaviour is pinned by goldens recorded before the rebind. Bullseye Checkout stays `PENDING`. Spec: `docs/superpowers/specs/2026-10-27-checkout-kernel-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-27
