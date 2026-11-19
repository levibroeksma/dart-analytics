---
id: D0412
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

# Personal best finish card on 121's `/statistics` page

## Context and Problem Statement
the ladder's highest target reached is already a stored-fact fold in `ladder-progress`; the best finish is that minus one, so no new section, view or schema is needed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`PersonalBestFinishCard.astro` (`personalBestFinishSection()`) mounts in the right cell beside the donut in `HeatmapStatsOverview.astro` when `game === '121_V1'`. One all-time un-bucketed `ladder-progress` request on mount only (`personalBestWindow()`), reduced by `personalBestFinish()` to the highest `maxTarget` minus one; `null` (shown `—`) with no attempt.", because the ladder's highest target reached is already a stored-fact fold in `ladder-progress`; the best finish is that minus one, so no new section, view or schema is needed.

### Consequences
no API or schema change. No date subtext: `maxTarget` carries none. Abandoned sessions are excluded (`includesAbandoned: false`). Not browser-checked.

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
Supersedes: none (extends D411).
