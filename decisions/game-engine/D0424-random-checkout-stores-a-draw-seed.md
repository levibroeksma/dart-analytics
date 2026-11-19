---
id: D0424
status: accepted
date: 2026-10-07
origin: contemporaneous
original-date:
tags: [game-engine, ruleset, checkout, undo, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Random Checkout stores a draw seed, not drawn scores

## Context and Problem Statement
the start score is a fact no dart can fold to, and no turn/dart column holds it. A seed is one stored value that makes every draw derivable — store what happened, derive what it means — with no migration. Index-keying makes a draw independent of prior darts, so undo and replay are exact.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`RANDOM_CHECKOUT` / `RANDOM_CHECKOUT_V1` (seed `0036`, template "Random Checkout") is a time-bound exercise of one-visit attempts from a random start score. The server mints `drawSeed` (uint32, Web Crypto) into the step configuration at training start, overwriting any template or step value; the immutable `exercise_configurations` snapshot holds it. Attempt *n*'s start score is a uniform pick over the 124 three-dart-finishable scores in 40–170, keyed by `(drawSeed, n)` through `seededUniform` (`app/src/modules/game/seeded-rng.module.ts`), the hash + mulberry32 lifted unchanged from DartBot's `rng.module.ts`.".

### Consequences
the pool and the PRNG are frozen for `RANDOM_CHECKOUT_V1`; changing either is a new ruleset version. DartBot and Random Checkout share one PRNG definition. Configurable range, round bound, average darts per checkout and head-to-head are later versions. Rules: `docs/game-rules/training/exercises/random-checkout.md`. Spec: `docs/superpowers/specs/2026-10-07-random-checkout-exercise-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-07
