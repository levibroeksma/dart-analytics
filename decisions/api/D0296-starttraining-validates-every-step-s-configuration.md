---
id: D0296
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [api, session, validation]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `startTraining` validates every step's configuration before the snapshot is written

## Context and Problem Statement
issue #337. `warmUpValidator`, `switchingValidator` and `doublePatternValidator` had no importer outside their own unit tests, so the training path snapshotted step configuration into `activity_configurations` unvalidated while the game path ran `validateConfig` on every create (`session.service.ts`). D277 names `validateConfig` as the mechanism exercise rulesets have; it existed and was wired to nothing. Blast radius was low only because step configs originate from seeded system templates — the layer that would catch a bad seed, or any future user-authored routine, was inert. Failing the whole routine rather than the individual step was chosen because an unvalidatable step means the routine cannot be trusted to run, and a per-step failure would let the player get partway through before hitting the wall.

## Decision Drivers
* `warmUpValidator`, `switchingValidator` and `doublePatternValidator` had no importer outside their own unit tests.
* The training path snapshotted step configuration unvalidated, while the game path ran `validateConfig` on every create.
* An unvalidatable step means the routine cannot be trusted to run.

## Considered Options
* Validate every step before the snapshot and fail the whole routine (chosen).
* Fail only the individual step.
* Leave step configuration unvalidated (the prior state).

## Decision Outcome
Chosen option: "`startTraining` runs `getExerciseRulesetValidator(step.exerciseRulesetVersionKey).validateConfig` over each resolved step's merged configuration and returns `VALIDATION_FAILED` with `{ reason: "invalid step configuration", steps: [{ sequenceNumber, issues }] }` if any step fails — no activity is created. A GAME step is skipped: its configuration belongs to a game ruleset. A non-game step that resolves no validator — an unpinned ruleset version, or a version key absent from the registry — is itself a failure.".

### Consequences
one validation point covers both writes — `startTrainingStep` reads the already-validated snapshot back from `activity_configurations` and hands that same object to `exercise_configurations`. Validation runs on the template/step merge *before* `resolveStep` injects `stepDurationSeconds`: `WarmUpV1Config` is `.strict()` and does not declare that key, so validating the finished object would reject every Warm-Up step ever written; the ordering is covered by its own test and both orderings were mutation-checked. The no-validator branch is what makes D295's decision to leave the pin column nullable safe — a template the seed `0019` backfill missed fails loudly here instead of reaching the snapshot. A GAME step's configuration is still not validated against `TuodConfig` on this path; that is the game-side registry and out of this issue's scope (filed as discovered work).
* Good, because the layer that would catch a bad seed, or any future user-authored routine, is no longer inert.
* Good, because a non-game step that resolves no validator fails loudly, which is what makes D295's nullable pin column safe.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/services/training-session.service.test.ts` covers the `invalid step configuration` failure and asserts that validation runs on the merged configuration before `stepDurationSeconds` is injected.

## Pros and Cons of the Options
### Validate every step and fail the whole routine
* Good, because the player cannot get partway through the routine before hitting the wall.

### Fail only the individual step
* Bad, because the player could get partway through before hitting the wall.

### Leave step configuration unvalidated (prior state)
* Bad, because `validateConfig` existed and was wired to nothing on the training path.

## Evidence / More Information
Decided: 2026-09-17

* Commit `9ffca098` (2026-09-17, PR #393, adds the D296 row): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons from the commit message, its test files and the Context text. No spec or plan names this record as its origin.
