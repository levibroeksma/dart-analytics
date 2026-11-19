---
id: D0520
status: accepted
date: 2026-11-04
origin: contemporaneous
original-date:
tags: [frontend/architecture]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Stats sections share bucket get-or-create, visit tally, row buckets, score bands and merge helpers

## Context and Problem Statement
the stats-section clone groups left in the D513 baseline were these copies. Each helper takes only what differs as data or a callback, so no flags were needed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`bucketFor(buckets, row, emptyMetrics)` (`stats/sections/series.module.ts`) is the one get-or-create of a bucket accumulator by `bucketStart`; grouping, loose-darts, target-accuracy, scoring-trend, treble-rate, volume, completion, session-result, training-result, leg-stats and double-performance use it and close with `closeBuckets`; double-performance takes only `bucketFor` (multi-step visits, `sampleSize` = attempts), not `visitBuckets`. `visitBuckets(sessions, ctx, { include, keyOf, empty, add })` covers bust-rate, checkout-rate and checkout-path (one key and one sample per included visit, `dropEmpty`). `rowBuckets(rows, ctx, read)` builds routine-completion, routine-volume and step-volume from pre-aggregated rows (sorts with `localeCompare`, as those modules did). `tallyScoreBands(scores, bands)` (`lib/game/play-visit-stats.ts`) backs `visitScoreBandCounts` and visit-stats' `scoreBandCounts`; bands are data, lowest `min` first. `merge-metrics.ts` keeps two unexported helpers, `mergeNestedCountRecord` and `mergePresentSides`. Routine summaries share an unexported `passRows(passes, darts, hits)` for Hit Count, SwitchBlade and Halve-It.", because the stats-section clone groups left in the D513 baseline were these copies. Each helper takes only what differs as data or a callback, so no flags were needed.

### Consequences
skipped on purpose: double-performance does not use `visitBuckets` (a visit yields several attempt steps and `sampleSize` counts attempts, so one key and one sample per visit cannot express it; only `bucketFor`); Doubles Lock keeps its own summary tail (a Best pass row between Passes and Darts would need a flag). `leg-stats` accumulator now nests `legs`/`bestLeg` under `metrics`; output unchanged. Section output is byte-equivalent. Baseline 47 → 32 rows.

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
