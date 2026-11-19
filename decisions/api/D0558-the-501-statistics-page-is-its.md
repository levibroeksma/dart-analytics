---
id: D0558
status: accepted
date: 2026-11-15
origin: contemporaneous
original-date:
tags: [api, endpoint, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# The 501 statistics page is its own layout: averages row and tiles first, delta against the preceding period, completion dropped

## Context and Problem Statement
the owner wants the 501 data readable at a glance and judged completion irrelevant; the aim cards follow in later slices of `2026-11-14-x01-statistics-page-design.md`.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`/statistics` renders `X01StatsOverview.astro` for `X01_LAYOUTS` (`501_V1`, `501_V2`), no longer the heatmap-only layout. It shows an averages row (3-dart average, first nine, darts per leg) and a tiles row (checkout %, bust %, best leg), then the heatmap and the session list; the completion donut is not shown on 501. Every value follows the page-level Period and the variation. Each value compares with the preceding equal period: `scoring-trend` from one bucketed request over the doubled `trendWindow`, the three server-computed sections from two unbucketed requests (current and preceding window), since a day-bucketed doubled window costs one request per day per section; All Time has no previous period, so no delta. Darts per leg and bust % are lower-is-better. Best leg is all time, shown with the variation, and opens its session's replay. Count minimums for later cards: a card headline needs `MIN_TARGET_SAMPLE` (30) darts, a breakdown row `MIN_ROW_SAMPLE` (10) to show a rate.", because the owner wants the 501 data readable at a glance and judged completion irrelevant; the aim cards follow in later slices of `2026-11-14-x01-statistics-page-design.md`.

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.9.0 (§2 layout paragraph). No endpoint, section or migration changes. `HEATMAP_ONLY_LAYOUTS` loses the two 501 keys.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-15
