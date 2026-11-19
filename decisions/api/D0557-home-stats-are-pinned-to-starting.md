---
id: D0557
status: accepted
date: 2026-11-13
origin: contemporaneous
original-date:
tags: [api, endpoint, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Home stats are pinned to starting score 501 for the 501 game

## Context and Problem Statement
a 301, 701 or custom game mixed into the Home first-9 average and heatmap is the same clutter D556 removed from the 501 page; the owner wants Home to describe real 501 games.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "the Home reads (`findHomeScoring`, `findHomeHeatmapCells`) count a `501`-game session only when `COALESCE(configuration ->> 'starting_score', 501) = 501`; the predicate applies to `game_type_key = '501'` rows only, so Score Training is not narrowed. Dart facts filter through the same session sub-select as the variation filter.", because a 301, 701 or custom game mixed into the Home first-9 average and heatmap is the same clutter D556 removed from the 501 page; the owner wants Home to describe real 501 games.

### Consequences
`10-Statistics/00-Overview.md` 1.9.0 (§6 `GET home` row) and `06-API/04-Endpoint-Contracts.md` 1.20.0 (the Home endpoint scope). Read-time and derived, nothing stored; no migration.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-11-13
