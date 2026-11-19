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

# Stats sections share bucket get-or-create, visit tally, row buckets, score bands and merge helpers

## Context and Problem Statement
the stats-section clone groups left in the D513 baseline were these copies. Each helper takes only what differs as data or a callback, so no flags were needed.

## Decision Drivers
* The stats-section clone groups left in the D513 baseline.
* A series with no rows must still return `[]` and buckets must sort by start with the same `closed` flag.
* The plan extracts a helper only if it removes a baseline row without a flag parameter.

## Considered Options
* Helpers that take only what differs as data or a callback (chosen).
* Route double-performance through `visitBuckets` too.
* Per-section flags.

## Decision Outcome
Chosen option: "`bucketFor(buckets, row, emptyMetrics)` (`stats/sections/series.module.ts`) is the one get-or-create of a bucket accumulator by `bucketStart`; grouping, loose-darts, target-accuracy, scoring-trend, treble-rate, volume, completion, session-result, training-result, leg-stats and double-performance use it and close with `closeBuckets`; double-performance takes only `bucketFor` (multi-step visits, `sampleSize` = attempts), not `visitBuckets`. `visitBuckets(sessions, ctx, { include, keyOf, empty, add })` covers bust-rate, checkout-rate and checkout-path (one key and one sample per included visit, `dropEmpty`). `rowBuckets(rows, ctx, read)` builds routine-completion, routine-volume and step-volume from pre-aggregated rows (sorts with `localeCompare`, as those modules did). `tallyScoreBands(scores, bands)` (`lib/game/play-visit-stats.ts`) backs `visitScoreBandCounts` and visit-stats' `scoreBandCounts`; bands are data, lowest `min` first. `merge-metrics.ts` keeps two unexported helpers, `mergeNestedCountRecord` and `mergePresentSides`. Routine summaries share an unexported `passRows(passes, darts, hits)` for Hit Count, SwitchBlade and Halve-It.", because the stats-section clone groups left in the D513 baseline were these copies. Each helper takes only what differs as data or a callback, so no flags were needed.

### Consequences
skipped on purpose: double-performance does not use `visitBuckets` (a visit yields several attempt steps and `sampleSize` counts attempts, so one key and one sample per visit cannot express it; only `bucketFor`); Doubles Lock keeps its own summary tail (a Best pass row between Passes and Darts would need a flag). `leg-stats` accumulator now nests `legs`/`bestLeg` under `metrics`; output unchanged. Section output is byte-equivalent. Baseline 47 → 32 rows.

* Good, because section output is byte-equivalent and the baseline fell from 47 to 32 rows.
* Neutral, because double-performance and Doubles Lock keep their own code where a shared helper would need a flag.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Each module's existing test file must pass unmodified. `app/tests/modules/stats/sections/series.module.test.ts` covers `bucketFor` and `visit-buckets.test.ts` covers `visitBuckets`. `scripts/check-dupes.sh` shows the lowered baseline.

## Pros and Cons of the Options
### Helpers taking data or a callback (chosen)

* Good, because it needs no flags.

### Route double-performance through `visitBuckets`

* Bad, because a visit yields several attempt steps and `sampleSize` counts attempts, so one key and one sample per visit cannot express it.

### Per-section flags

* Neutral, because the plan skips a group that would need a flag and names the reason in the task report.

## Evidence / More Information
Decided: 2026-11-04
Supersedes: none. Extends D513.

* `docs/superpowers/plans/2026-11-01-duplication-backlog-phase-2-3a.md` (PR E, Tasks E1–E4, Review Focus): rebuilt Decision Drivers, Confirmation and Pros and Cons.
* `docs/superpowers/specs/2026-10-31-duplication-backlog-design.md` (Phase 3): names the stats-module phase the plan implements.
* Commit `167bfb4a` (PR #1217, 2026-11-04; adds the `decisions/frontend/architecture.md` row): rebuilt Consequences.
