---
id: D0410
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

# Replay section on every plain board game's `/statistics` page

## Context and Problem Statement
the session list endpoint, replay route and replay card already work for every game; a per-game list is a client change only. Sessions with no darts are left out by the endpoint (D405), so every game shares that rule.

## Decision Drivers
* The session list endpoint, replay route and replay card already work for every game, so a per-game list is a client change only.
* The endpoint leaves out sessions with no darts (D405), so every game shares that rule.

## Considered Options
* `gameSessionList()` mounted under the heatmap of every `HEATMAP_ONLY_LAYOUTS` game (chosen).

## Decision Outcome
Chosen option: "`scoreSessionList()` becomes `gameSessionList()` (`GameSessionList.astro`): it resolves the page-level `game` to its game type, reloads on `game` and `rangeKey`, and scopes the cache per game. `HeatmapStatsOverview.astro` mounts it under the heatmap, so every `HEATMAP_ONLY_LAYOUTS` game gets a replay list. Only Score Training's caption shows a 3-dart average; other games show darts and minutes.".

### Consequences
no API or schema change. A counted-score average is not comparable across sessions of other games, so it is not shown.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Commit `277cba99` renames and extends `app/tests/lib/stats/sections/game-session-list.data.test.ts`, the test for the per-game list factory.

## Pros and Cons of the Options
### `gameSessionList()` on every plain board game
* Good, because every `HEATMAP_ONLY_LAYOUTS` game gets a replay list from the existing endpoint, with no API change.

## Evidence / More Information
Decided: 2026-10-04
Supersedes: none (extends D399, D401, D405, D406).

* Commit `277cba99` (2026-10-04, PR #776, adds the D410 row): rebuilt Decision Drivers, Considered Options, Confirmation and Pros and Cons from the row's Reason and Decision.
* No spec or plan in `docs/superpowers/` cites D410.
