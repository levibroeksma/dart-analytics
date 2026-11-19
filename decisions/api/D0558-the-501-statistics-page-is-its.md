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

# The 501 statistics page is its own layout: averages row and tiles first, delta against the preceding period, completion dropped

## Context and Problem Statement
the owner wants the 501 data readable at a glance and judged completion irrelevant; the aim cards follow in later slices of `2026-11-14-x01-statistics-page-design.md`.

## Decision Drivers
* The page makes the data the backend serves readable: headline numbers first, detail one tap away.
* Every period-based value compares with the preceding equal period where a comparison makes sense.
* The variations dropdown applies to every section, the heatmap and the session list.
* The owner judged the completion donut and the abandon rate irrelevant on 501.
* Anti-goal: a wall of numbers.

## Considered Options
* Keep the heatmap-only 501 layout: completion, heatmap and session list (the page before this record).
* Replace it with the averages row, tiles row, heatmap and session list (chosen).

## Decision Outcome
Chosen option: "`/statistics` renders `X01StatsOverview.astro` for `X01_LAYOUTS` (`501_V1`, `501_V2`), no longer the heatmap-only layout. It shows an averages row (3-dart average, first nine, darts per leg) and a tiles row (checkout %, bust %, best leg), then the heatmap and the session list; the completion donut is not shown on 501. Every value follows the page-level Period and the variation. Each value compares with the preceding equal period: `scoring-trend` from one bucketed request over the doubled `trendWindow`, the three server-computed sections from two unbucketed requests (current and preceding window), since a day-bucketed doubled window costs one request per day per section; All Time has no previous period, so no delta. Darts per leg and bust % are lower-is-better. Best leg is all time, shown with the variation, and opens its session's replay. Count minimums for later cards: a card headline needs `MIN_TARGET_SAMPLE` (30) darts, a breakdown row `MIN_ROW_SAMPLE` (10) to show a rate.", because the owner wants the 501 data readable at a glance and judged completion irrelevant; the aim cards follow in later slices of `2026-11-14-x01-statistics-page-design.md`.

### Consequences
`10-Statistics/01-Section-Catalog.md` 1.9.0 (§2 layout paragraph). No endpoint, section or migration changes. `HEATMAP_ONLY_LAYOUTS` loses the two 501 keys.

* Neutral, because the aim cards show the period only, with no preceding-period delta: a delta on a rate over few darts misleads.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/lib/stats/sections/x01-overview.data.test.ts` covers the doubled-window and two-window reads, the percent deltas, and the All Time case with no deltas. `app/tests/lib/stats/constants.test.ts` pins the heatmap-only layout set, which holds neither 501 key.

## Pros and Cons of the Options
### Keep the heatmap-only 501 layout
* Bad, because the page shows completion, the heatmap and the session list while the backend serves checkout, bust, leg and scoring sections.

### Averages row and tiles first
* Good, because headline numbers come first and detail sits one tap away.

## Evidence / More Information
Decided: 2026-11-15

* `docs/superpowers/specs/2026-11-14-x01-statistics-page-design.md` (Intent, Goals, Non-goals, Page top to bottom, Data flow): rebuilt Decision Drivers, Considered Options, Consequences and Pros and Cons. The spec is a draft for owner review.
* Commit `55132386` (PR #1335, 2026-11-15; adds the D558 row and `x01-overview.data.test.ts`): rebuilt Confirmation.
* Applied in: `docs/superpowers/specs/2026-11-17-ace-statistics-page-design.md` (Data).
