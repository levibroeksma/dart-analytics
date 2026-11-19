---
id: D0399
status: accepted
date: 2026-10-03
origin: contemporaneous
original-date:
tags: [frontend/alpine, state]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Score Training's remaining sections are period sections sharing one fetch helper (#695, #696)

## Context and Problem Statement
a factory per section keeps fetch, state and failure local (D385); four near-identical fetch loops would drift, so the loop is written once. The current period alone (no previous-period doubling) matches the heatmap, since these cards show totals and no deltas.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Score Training's dedicated layout gains `treble-rate`, `session-result`, `completion` and `volume` sections and a session list. The four stat sections mount through `ScoreStatsSection.astro` (title, three tiles, optional footnote) and their factories (`scoreTrebleSection`, `scoreResultSection`, `scoreCompletionSection`, `scoreVolumeSection`) spread `periodSection()` (`period-section.ts`): one un-bucketed request over the current period (`heatmapWindow()`) on mount and on `rangeKey` change, with a stale-response ticket. Derivations are pure functions in `score-summaries.ts`. The session list (`ScoreSessionList.astro`, `scoreSessionList()`) reads `readSessionPage` 25 per page over the same window, reloads from the first page on a period change, and links each row to replay. Section order: trend, treble rate, heatmap, session result, completion, volume, sessions.".

### Consequences
`session-result` shows mean counted score and the best session with a replay link; the personal-best average card (D390) is unchanged. `.astro` markup is untested (D101); `period-section`, `score-summaries`, the five factories and their registration are covered. Closes #695 and #696.

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
Supersedes: none (extends D385, D386, D387).
Referenced by D0401's `Supersedes:` line.
Referenced by D0402's `Supersedes:` line.
Referenced by D0404's `Supersedes:` line.
