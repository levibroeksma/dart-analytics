---
id: D0390
status: accepted
date: 2026-10-02
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

# `session-result` carries the best per-session average; Score Training shows it as a personal best

## Context and Problem Statement
the owner asked for a personal best beside the period averages. A total-score PB (`countedScoreMax`) is unfair across Score Training's modes — a 100-visit session always beats a 5-minute one — so the PB is the best single-session 3-dart average, which no sum-based component can yield: a max of a ratio is not derivable from `countedScoreSum`/`dartSum`, so it has to be picked per session in SQL. Extending `session-result` keeps one shared aggregate scan (`00-Overview.md` §5.2) rather than adding a section; the field stays rule-free and a ratio pair per the "never ship an average" rule. The request is all-time because a personal best is a career fact, not a period one.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`session-result` moves to section version 2. Each ruleset slice gains `bestAverage: { sessionId, points, darts, completedAt } | null` — the session with the highest `counted_score / dart_count`, picked in SQL by `findBucketedSessionAggregates` under one `array_agg(... order by counted_score::numeric / nullif(dart_count, 0) desc nulls last, completed_at desc)` ordering so all four picks name the same session; `null` when no session in the slice has darts. `sessionResultBuckets` merges two groups by keeping the higher ratio. Score Training's `/statistics` layout adds a third card, "Personal best": `scoreTrendSection()` makes one all-time, un-bucketed `session-result` request on mount (`personalBestWindow()`), reduces every bucket and slice with `bestSessionAverage()` (a max of maxima), and shows the 3-dart average with the session's date as `30 sept. '26` (`formatShortDate()`: day, lowercase short month, dotted when abbreviated, two-digit year, local zone) in place of a percent change. It does not re-fetch on a Period change and fails independently of the trend.".

### Consequences
a version bump invalidates cached `session-result` entries once. The field is in every game's `session-result` response but only Score Training renders it. The date uses a fixed English month table, not `Intl`, because the owner's format (`sept.`, dotted abbreviations) matches no locale's `short` month output. The card grid becomes three columns. `.astro` markup is untested (D101); the SQL ordering, the merge, the fold, the format and the Alpine getters each have tests.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-02
Supersedes: none (extends D367, D385).
