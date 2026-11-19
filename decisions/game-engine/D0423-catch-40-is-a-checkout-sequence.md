---
id: D0423
status: accepted
date: 2026-10-06
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, visit, bust, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Catch 40 is a checkout-sequence exercise that ends itself

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/catch-40.md`) carry a remaining score across two visits with bust and double-out, which no shipped exercise does. Range and limit live in config so Catch 20/70 widen the schema, not the type.

## Decision Drivers
* The rules carry a remaining score across two visits with bust and double-out, which no shipped exercise does.
* Range and limit live in config so Catch 20 and Catch 70 widen the schema, not the type.
* The spec keeps Finishing Pyramid a separate future type that shares `resolveCheckoutAttempt`.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`CHECKOUT_SEQUENCE` / `CHECKOUT_SEQUENCE_V1` is a new exercise type (seed `0035`, template "Catch 40") with its own `DartExerciseEngine` (`checkout-sequence.engine.module.ts`). Outshots 61–100 in order, six darts (two visits) each, X01 double-out via the shared `resolveCheckoutAttempt`. A bust ends the visit, as in 121; its unthrown darts count toward the six and get no `darts` row. Attempt points 3/2/1/0 by darts used; 99 in three scores 3. Config `{firstOutshot: 61, lastOutshot: 100, dartLimit: 6}`, each a literal. Every run starts at 61; preset 30 minutes. Routine step only. Finishing Pyramid stays a separate future type.".

### Consequences
the first dart exercise that completes without its timer — `isComplete()` is true once the timer expired or the fold reports the sequence done, and the controller completes the step on that dart. Visit closure is derived from darts, never from `completedAt`. Stats gain an eighth `DartExerciseKind` (headline points, rate checkouts/attempts).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/checkout-sequence.engine.module.test.ts` and `checkout-sequence.golden.test.ts` cover the engine. `database/verification/0035_checkout_sequence_seed_checks.sql` covers the seed.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-06

* `docs/superpowers/specs/2026-10-06-catch-40-exercise-design.md` (§ 1, § 2, § 3, engine section): rebuilt Decision Drivers, Confirmation.
* Commit `da6cf787` (PR #804, 2026-10-07; adds the D423 row and the engine): the adding commit.
* Applied in: `docs/superpowers/plans/2026-10-07-random-checkout-v1.md`.
