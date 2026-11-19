---
id: D0406
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

# Heatmap on every plain board game's `/statistics` page

## Context and Problem Statement
the `heatmap` section is already served for every `board` game, so the page was the only gap. One game-agnostic factory keeps Score Training a caller, not a special case, and avoids a second heatmap renderer.

## Decision Drivers
* The `heatmap` section is already served for every `board` game; the page is the only gap.
* Score Training should stay a caller, not a special case.
* A second heatmap renderer is unwanted.

## Considered Options
Rationale unknown — no source found.

## Decision Outcome
Chosen option: "`scoreHeatmapSection()` becomes `gameHeatmapSection()` and `ScoreHeatmapSection.astro` becomes `GameHeatmapSection.astro`. The factory reads the page-level `game` (a ruleset version key) and resolves it through `GAME_TYPE_BY_RULESET`, reloading on `game` as well as `rangeKey`; an unknown key loads nothing. `HEATMAP_ONLY_LAYOUTS` (`lib/stats/constants.ts`) names 501, 121, Ten Up One Down, Singles Training, Shanghai and Around the Clock; `/statistics` mounts `HeatmapStatsOverview.astro` (the heatmap alone) for them. Requests carry no `target`.".

### Consequences
Doubles Training and Bob's 27 (`intent-stored`) keep the placeholder until a target picker is designed. Singles, Shanghai and Around the Clock get no per-target heatmap: their intent is derived and `target` is rejected there. `.astro` markup is untested (D101); the factory, constants and registration are covered.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The record states that the factory, constants and registration are covered; `game-heatmap.data.test.ts`, `constants.test.ts` and `register-route-data.test.ts` change in the commit. `.astro` markup is untested (D101).

## Pros and Cons of the Options
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D387).

* Commit `2deda9f4` (PR #768, 2026-10-04): rebuilt Decision Drivers and Confirmation.
