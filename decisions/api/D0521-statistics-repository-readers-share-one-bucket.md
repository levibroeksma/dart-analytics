---
id: D0521
status: accepted
date: 2026-11-04
origin: contemporaneous
original-date:
tags: [api, status]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Statistics repository readers share one bucket window; section request resolution and timing schema fields are shared

## Context and Problem Statement
the statistics repository, service and API types were the largest clone groups left in the D513 baseline. Each helper takes only what differs, so no flags.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`bucketWindow(completedAt, q)` in `statistics.repository.ts` gives each of the nine bucketed readers one query; drizzle drops an empty GROUP BY, so `bucket: "none"` SQL is unchanged, and `findStepBuckets` keeps `sessions > 0` as a post-query step on `"none"`. Other helpers: `X01_FOLD_COLUMNS` reused by `findX01CheckoutDarts`, `selectHeatmapCells`, `gameWindowConditions`, `stepScopeConditions`, `mapSessionTimings`, `newestFirst`. `resolveGameSectionRequest` now uses `resolveSectionRange` (bucket → target → status order kept); `SESSION_TIMING_FIELDS` is spread into the three statistics API schemas (`pages/api/statistics/types.ts`).", because the statistics repository, service and API types were the largest clone groups left in the D513 baseline. Each helper takes only what differs, so no flags.

### Consequences
skipped on purpose: `findRoutineRunBuckets` (raw SQL; its two branches are different statements, so merging needs a flag). Residual clone group kept: page-reader tail of `findGameSessionsPage`/`findStepSessionPage` (different views, selects, mappers). Accepted difference: in the two page mappers (`findGameSessionsPage`, `findStepSessionPage`) the timing block now runs before `session_id`/identity columns, so when more than one non-null column of a page row is null, the thrown `nonNull` error may name a different column (view-invariant breach only); single-null behaviour and the replay mappers' order are unchanged. Safety net: `tests/repositories/statistics-sql-golden.test.ts` snapshots the rendered SQL. Baseline 32 → 30 rows (`types.ts` and `statistics.service.ts` rows gone, `statistics.repository.ts` 11 → 1). Issue #1172.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-04
Supersedes: none. Extends D513.
