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

# Bullseye Checkouts is its own exercise type, start score in config but locked to 81

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/bullseye-checkout.md`) judge a visit on its setup total and its last dart's ring together — neither `SCORE_THRESHOLD` (total only) nor the target types (per dart) do that. A separate engine keeps the shipped 65 or More engine untouched.

## Decision Drivers
* The shipped 65 or More engine stays untouched, and every exercise type keeps one engine file.
* The start score lives in config, so a later widening can serve another bull finish without a new type.

## Considered Options
* Generalise `ScoreThresholdEngine` to cover the bull finish.
* Add a new exercise type with its own engine (chosen).

## Decision Outcome
Chosen option: "`BULLSEYE_CHECKOUT` / `BULLSEYE_CHECKOUT_V1` is a new exercise type (seed `0029`, template "Bullseye Checkouts") with its own `DartExerciseEngine` (`bullseye-checkout.engine.module.ts`). Each three-dart visit starts at `startScore`; darts 1–2 carry no intent, dart 3 always carries `25`/`INNER_BULL`. A visit is judged once its third dart lands and checks out when darts 1–2 total `startScore − 50` and dart 3 hits the inner bull; the outer bull never finishes. A visit unfinished at timer expiry is not judged. Configuration is `{ startScore }`, which V1 accepts only as `81`. Routine step only.".

### Consequences
another bull finish is widening `BullseyeCheckoutV1Config` plus a template, with no engine, seed-type or schema change. Board preview treats setup darts as 65 or More does and dart 3 as a hit only on the bullseye. Standalone play stays deferred (V2+).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/modules/training/exercises/bullseye-checkout.engine.module.test.ts` and `bullseye-checkout.golden.test.ts` check the engine.

## Pros and Cons of the Options
### Generalise `ScoreThresholdEngine`
* Bad, because `SCORE_THRESHOLD` judges the visit total only and cannot also judge the last dart's ring.

### New exercise type with its own engine
* Good, because the shipped 65 or More engine stays untouched.
* Good, because every exercise type keeps one engine file.

## Evidence / More Information
Decided: 2026-09-24

* `docs/superpowers/specs/2026-09-24-bullseye-checkout-exercise-design.md` (§ 1, § 3, § 4): rebuilt Decision Drivers, Considered Options and Pros and Cons.
* Commit `423242b2` (PR #586, 2026-09-24; adds the D361 row and the engine): confirmed Confirmation.
* Applied in: `docs/superpowers/plans/2026-09-24-bullseye-checkout-exercise.md`.
