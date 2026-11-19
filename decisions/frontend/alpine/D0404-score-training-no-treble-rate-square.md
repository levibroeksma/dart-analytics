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

# Score Training: no treble rate, square glass 2x2 stat grid

## Context and Problem Statement
treble rate was not wanted; the tinted cards no longer matched the glass surfaces; the abandon rate belongs beside the averages.

## Decision Drivers
* Treble rate was not wanted.
* The tinted cards no longer matched the glass surfaces.
* The abandon rate belongs beside the averages.

## Considered Options
* Drop the `treble-rate` section and use a square `glass` 2x2 stat grid (chosen).

## Decision Outcome
Chosen option: "Score Training's `/statistics` layout drops the `treble-rate` section. `ScoreAverageCard.astro` renders a square `glass` card instead of a sky `CardWrapper`. The overview groups the 3-dart average, first nine, personal best and the session-result donut (`ScoreCompletionSection.astro`, no longer half-width) in a two-column grid, in that reading order. Page order: stat grid, trend, heatmap, replay.", because treble rate was not wanted; the tinted cards no longer matched the glass surfaces; the abandon rate belongs beside the averages.

### Consequences
`ScoreStatsSection.astro` is deleted (fallow dead-code gate). `scoreTrebleSection()` and `trebleSummary()` have no page caller left (#765). The API `treble-rate` section is unchanged.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Drop treble rate, square glass 2x2 grid
* Good, because the stat cards match the glass surfaces.
* Good, because the session-result donut sits beside the averages.
* Bad, because 2 functions lose their page caller.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: D399 in part (treble-rate section); D401, D402 in part (page order, donut width).

* Commit `0a7ce6c5` (2026-10-04, PR #766, adds the D404 row): rebuilt Decision Drivers, Considered Options and Pros and Cons from the row's Reason and Decision.
* No spec or plan in `docs/superpowers/` cites D404.
