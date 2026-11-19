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

# Personal best finish card on 121's `/statistics` page

## Context and Problem Statement
the ladder's highest target reached is already a stored-fact fold in `ladder-progress`; the best finish is that minus one, so no new section, view or schema is needed.

## Decision Drivers
* The ladder's highest target reached is already a stored-fact fold in `ladder-progress`.
* The best finish is that minus one.
* No new section, view or schema should be needed.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`PersonalBestFinishCard.astro` (`personalBestFinishSection()`) mounts in the right cell beside the donut in `HeatmapStatsOverview.astro` when `game === '121_V1'`. One all-time un-bucketed `ladder-progress` request on mount only (`personalBestWindow()`), reduced by `personalBestFinish()` to the highest `maxTarget` minus one; `null` (shown `—`) with no attempt.", because the ladder's highest target reached is already a stored-fact fold in `ladder-progress`; the best finish is that minus one, so no new section, view or schema is needed.

### Consequences
no API or schema change. No date subtext: `maxTarget` carries none. Abandoned sessions are excluded (`includesAbandoned: false`). Not browser-checked.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit adds `personal-best-finish.data.test.ts` and extends `score-summaries.test.ts` and `register-route-data.test.ts`. The card was not browser-checked.

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D411).

* Commit `42a026aa` (2026-10-04; message and the `decisions/frontend/alpine.md` row): rebuilt Decision Drivers and Confirmation.
