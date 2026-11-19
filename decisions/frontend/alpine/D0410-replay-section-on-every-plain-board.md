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
<!-- backfill: pending -->

# Replay section on every plain board game's `/statistics` page

## Context and Problem Statement
the session list endpoint, replay route and replay card already work for every game; a per-game list is a client change only. Sessions with no darts are left out by the endpoint (D405), so every game shares that rule.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`scoreSessionList()` becomes `gameSessionList()` (`GameSessionList.astro`): it resolves the page-level `game` to its game type, reloads on `game` and `rangeKey`, and scopes the cache per game. `HeatmapStatsOverview.astro` mounts it under the heatmap, so every `HEATMAP_ONLY_LAYOUTS` game gets a replay list. Only Score Training's caption shows a 3-dart average; other games show darts and minutes.".

### Consequences
no API or schema change. A counted-score average is not comparable across sessions of other games, so it is not shown.

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
Supersedes: none (extends D399, D401, D405, D406).
