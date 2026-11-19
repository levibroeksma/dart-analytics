---
id: D0277
status: accepted
date: 2026-09-14
origin: contemporaneous
original-date:
tags: [api, contract, batch, session, validation]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A dart exercise's step session carries a capture pair and uploads through the same batch route, with no per-ruleset batch validator

## Context and Problem Statement
Balanced Training died at "Could not continue to the next step. Try again." the moment the Switching countdown expired, and D276's intended-zone fix did not reach the real cause. `advanceAfterStepCompletion` uploads the step's darts first, and `appendBatch` rejected every dart-exercise batch before any dart was ever examined: the step session is created with `ruleset_version_id`, `capture_mode_id` and `input_mode_id` all NULL (D264's parallel-contract split puts the exercise ruleset in its own column), and the service hard-required all three plus a game `RulesetValidator` — of which `SWITCHING_V1` has none, and cannot: exercise rulesets validate configuration only. Reproduced as a unit test against `appendBatch` before the fix (`session.service.test.ts`), which returned `INTERNAL_ERROR` for exactly that session shape.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`startTrainingStep`'s non-game path creates a `SWITCHING`/`DOUBLE_PATTERN` step session under the `ANALYTICS` + `VISUAL_BOARD` capture pair (`WARM_UP` keeps the NULL pair it had), as the playable-Balanced-Training design already specified. `appendBatch` no longer requires a *game* ruleset version on the session: `findSessionRow` now also returns `exercise_ruleset_versions.implementation_key`, and the batch is validated as (a) a game session — game ruleset key present, its `RulesetValidator` required and run, unchanged — or (b) a dart-exercise session — `exerciseRulesetWritesDarts(key)` true for `SWITCHING_V1`/`DOUBLE_PATTERN_V1`, admitted on the structural checks alone. A capture pair remains mandatory for any batch, so a Warm-Up session (no capture pair, writes no dart) still returns `INTERNAL_ERROR`.".

### Consequences
`SessionRow` gains `exerciseRulesetVersionKey` (one added LEFT JOIN in `findSessionRow`); every mocked session row in the service tests gains the field. Switching and Double Pattern darts now persist, so the step's facts reach `turns`/`darts` and the routine advances to the next step. Server-side rule validation of a dart-exercise batch is a deliberate gap, not an oversight: the exercise engines are the only authority on their own scoring today, and adding `validateBatch` to `ExerciseRulesetValidator` is a separate design. The stale comment on that interface ("a non-game exercise writes no turns and no darts") is corrected in place. The pre-existing test asserting `INTERNAL_ERROR` for "a non-GAME exercise session" is re-pointed at Warm-Up — the same guarantee, now named by the session that actually holds it — rather than deleted.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-14
Referenced by D0281's `Supersedes:` line.
