---
id: D0404
status: accepted
date: 2026-10-04
origin: contemporaneous
original-date:
tags: [frontend/alpine]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Score Training: no treble rate, square glass 2x2 stat grid

## Context and Problem Statement
treble rate was not wanted; the tinted cards no longer matched the glass surfaces; the abandon rate belongs beside the averages.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Score Training's `/statistics` layout drops the `treble-rate` section. `ScoreAverageCard.astro` renders a square `glass` card instead of a sky `CardWrapper`. The overview groups the 3-dart average, first nine, personal best and the session-result donut (`ScoreCompletionSection.astro`, no longer half-width) in a two-column grid, in that reading order. Page order: stat grid, trend, heatmap, replay.", because treble rate was not wanted; the tinted cards no longer matched the glass surfaces; the abandon rate belongs beside the averages.

### Consequences
`ScoreStatsSection.astro` is deleted (fallow dead-code gate). `scoreTrebleSection()` and `trebleSummary()` have no page caller left (#765). The API `treble-rate` section is unchanged.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: D399 in part (treble-rate section); D401, D402 in part (page order, donut width).
