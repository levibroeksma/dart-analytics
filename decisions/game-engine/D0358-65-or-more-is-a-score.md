---
id: D0358
status: accepted
date: 2026-09-23
origin: contemporaneous
original-date:
tags: [game-engine, engine, ruleset, visit, darts]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# 65 or More is a Score Threshold exercise type, threshold in config but locked to 65

## Context and Problem Statement
the rules (`docs/game-rules/training/exercises/score-threshold.md`) judge a whole visit by its board total with no target — no existing exercise fold does that. The author wants only 65 for now but a later threshold without a new type, so the type is named for the rule and the number sits in config from day one.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SCORE_THRESHOLD` / `SCORE_THRESHOLD_V1` is a new exercise type (seed `0025`, template "65 or More") with its own `DartExerciseEngine` (`score-threshold.engine.module.ts`). Three darts per visit, free aim: darts carry no intended target or zone. A visit is judged once its third dart lands; it beats when the sum of its board scores is at least `threshold`. A visit unfinished at timer expiry is not judged. Configuration is `{ threshold }`, which V1 accepts only as `65` (`z.literal(65)`). Routine step only.".

### Consequences
allowing another threshold is widening `ScoreThresholdV1Config` (or a V2 ruleset) plus a template, with no engine, seed-type or schema change. Board preview marks a dart on the board as a hit and off it as a miss, since there is no target to judge against. Standalone play stays deferred (V2+).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-23
