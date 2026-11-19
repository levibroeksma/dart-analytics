---
id: D0361
status: accepted
date: 2026-09-24
origin: contemporaneous
original-date:
tags: [game-engine, engine, checkout, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Bullseye Checkouts is its own exercise type, start score in config but locked to 81

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/bullseye-checkout.md`) judge a visit on its setup total and its last dart's ring together — neither `SCORE_THRESHOLD` (total only) nor the target types (per dart) do that. A separate engine keeps the shipped 65 or More engine untouched.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`BULLSEYE_CHECKOUT` / `BULLSEYE_CHECKOUT_V1` is a new exercise type (seed `0029`, template "Bullseye Checkouts") with its own `DartExerciseEngine` (`bullseye-checkout.engine.module.ts`). Each three-dart visit starts at `startScore`; darts 1–2 carry no intent, dart 3 always carries `25`/`INNER_BULL`. A visit is judged once its third dart lands and checks out when darts 1–2 total `startScore − 50` and dart 3 hits the inner bull; the outer bull never finishes. A visit unfinished at timer expiry is not judged. Configuration is `{ startScore }`, which V1 accepts only as `81`. Routine step only.".

### Consequences
another bull finish is widening `BullseyeCheckoutV1Config` plus a template, with no engine, seed-type or schema change. Board preview treats setup darts as 65 or More does and dart 3 as a hit only on the bullseye. Standalone play stays deferred (V2+).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-24
