---
id: D0396
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [api, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# `training-result` gives Singles and Doubles Training their own headline and personal best (#738)

## Context and Problem Statement
#615 found the rule-free `session-result` cannot express either game's headline (`turns.total_score` is board value, not the training point or the hit that decides the match) and was closed because the other five null games already had dedicated sections. The author chose a dedicated server-fold section over extending `session-result`, and splitting each config group so Hard/Extreme and Accuracy runs never blend into one PB.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "a new `server` section `training-result` (version 1, `games: ["SINGLES_TRAINING", "DOUBLES_TRAINING"]`, `bucketable`, `configSensitive: ["ruleset_version_key", "difficulty", "scoring_mode"]`) folds each board-captured session through its engine reducer and reads the last step: Singles Training's `totalPoints`, Doubles Training's count of hit visits (`outcomes`). Metrics are `Record<configGroupKey, { sessions, total, best }>`: `sessions`/`total` sum and `best` takes the max, so two buckets and two chunks re-aggregate exactly (`mergeMetrics`). Higher is better for both, so the personal best is `best`; the mean is `total / sessions`, derived client-side. Doubles Training gains a `WALKERS` entry in `derived-aims.module.ts`; `derivedGameOf` is untouched, so its aim-recovery and its `sql`-site stored-intent sections are unchanged. `RESULT_DIRECTION` stays `null` for both games: `session-result` is still rule-free and the PB lives in the new section.".

### Consequences
only VISUAL_BOARD sessions are counted — the dart fold reads `v_stats_dart_facts`, which holds board-captured darts with coordinates; keypad (`DETAILED_DARTS`) sessions of either game are not in the headline, as they are not in any other fold-based Singles section. Covering them needs a coordinate-independent dart view, a new migration, and is not done here. The new section leads both pages. Singles V1/V2 sessions that lack the V3 `scoring_mode` field group with an empty value.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-03
Supersedes: none (resolves #615's remaining gap; extends D370).
