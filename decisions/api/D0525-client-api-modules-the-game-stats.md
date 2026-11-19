---
id: D0525
status: accepted
date: 2026-11-05
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

# Client API modules, the game stats store, ruleset config schemas and intent-cell folds share small helpers

## Context and Problem Statement
the client API modules, the stats store, the ruleset config schemas and the two intent-cell folds were the clone groups left after D522. Each helper takes data (a schema, a field list, an accessor, a seed and a step), so no flags.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`SessionApiError` moves to `lib/client/api/session-api-error.ts` and `sessions.ts` re-exports it, so every importer and every `instanceof` check resolves to one class; `unwrap.ts` imports it from there (the `sessions.ts` ↔ `unwrap.ts` cycle is gone), and `sessions.ts` and `training-sessions.ts` use `unwrapOrThrow`. `statistics.ts` gains the unexported `unwrapStatistics` (throws `StatisticsApiError(code, message)`) and `appendPage`. `modules/stats/sections/hit-rate-rows.module.ts` holds `foldSeriesByKey`, `hitRateRows`, `bestRate`/`worstRate`, `sumInBand` and `seriesKeys`; `HitRateRow` and `HitRateTotals` live in `modules/stats/types.ts`. The `game-stats.store.ts` getters (`accuracyRows`, `doubleRows`, `favoriteTarget`, `weakestTarget`, `favoriteDouble`, `weakestDouble`, `checkoutRateBands`, `bustRateBands`, `atcConfigGroups`, `bobs27ConfigGroups`, `groupingRows`) keep their names and return shapes. `rulesets/types.ts` gains `durationValueRefinement`, `targetOrderRefinement`, `maxDartsPerTurnField`, `maxVisitScoreField`, `singlesPointsFields`, `singlesV2CommonFields`, `startingScoreField` and `fiveOhOneCommonFields`, spread at the keys' old positions. `intent-cells.module.ts` gains `intentCellBuckets(rows, ctx, empty, add)`, the fold of `target-accuracy` and `loose-darts`.".

### Consequences
no HTTP, SQL, schema or store output change. Pinned by `tests/lib/game/rulesets/schema-shape.test.ts` (key order, strictness, refinement messages) and `tests/modules/stats/sections/hit-rate-rows.module.test.ts`. Accepted difference: `fetchSessionReplay` sends `limit` before `cursor` in the query string (same meaning to the server). `sumInBand` returns an array as wide as the data (callers default each slot to 0). Skipped on purpose: the `validateBatch` copy of `score-training.validator.ts` and `tuod.validator.ts` (Score Training checks its rounds limit on both capture modes, TUOD only on quick score, so sharing it needs a per-mode flag; issue #1184 stays open). Baseline 22 → 17 rows (`sessions.ts | training-sessions.ts`, `statistics.ts`, `rulesets/types.ts`, `loose-darts | target-accuracy` and `game-stats.store.ts` rows gone). Plan: `docs/superpowers/plans/2026-11-05-duplication-backlog-phase-4a.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-05
Supersedes: none. Extends D513, D521, D522.
