---
id: D0402
status: accepted
date: 2026-10-03
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

# Score Training: no session-result section, thicker donut, replay in glass

## Context and Problem Statement
sessions differ in length and mode, so a mean counted score or a best score across them is not comparable.

## Decision Drivers
* Sessions differ in length and mode, so a mean counted score or a best score across them is not comparable (the commit's Reason).

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "Score Training's `/statistics` layout drops the `session-result` section (`scoreResultSection`, `scoreResultSummary`, `ScoreResultSummary`, `score-result.data.ts`). The doughnut cutout goes from 68% to 34%, a ring about twice as thick. The replay section sits in a glass container (sibling glass layer, as `ScoreStatsSection.astro`); its `ReplayCard` rows stay link cards. Page order: trend, treble rate, heatmap, completion, replay.", because sessions differ in length and mode, so a mean counted score or a best score across them is not comparable.

### Consequences
the API `session-result` section is unchanged (the personal-best card and other games still read it). Tests for the removed factory and summary are deleted with their subject.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-03
Supersedes: D399 in part (the session-result section); D401 in part (page order, donut cutout).
Referenced by D0404's `Supersedes:` line.

* Commit `aeacdc40` (2026-10-03; adds the D402 row): rebuilt Decision Drivers.
