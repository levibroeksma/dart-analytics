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

# Home stats are pinned to starting score 501 for the 501 game

## Context and Problem Statement
a 301, 701 or custom game mixed into the Home first-9 average and heatmap is the same clutter D556 removed from the 501 page; the owner wants Home to describe real 501 games.

## Decision Drivers
* The 501 variation spec left the Home page as a non-goal and an open item. D557 resolves it by pinning Home to 501 (spec, Non-goals and Open items).
* A session with an absent snapshot or score counts as 501, as in the 501 variation filter (spec, Open items).

## Considered Options
* Pin the Home reads to starting score 501 for the 501 game (chosen).
* Leave Home counting every completed session of game types `501` and `SCORE_TRAINING`, as the Home spec scoped it.

## Decision Outcome
Chosen option: "the Home reads (`findHomeScoring`, `findHomeHeatmapCells`) count a `501`-game session only when `COALESCE(configuration ->> 'starting_score', 501) = 501`; the predicate applies to `game_type_key = '501'` rows only, so Score Training is not narrowed. Dart facts filter through the same session sub-select as the variation filter.", because a 301, 701 or custom game mixed into the Home first-9 average and heatmap is the same clutter D556 removed from the 501 page; the owner wants Home to describe real 501 games.

### Consequences
`10-Statistics/00-Overview.md` 1.9.0 (§6 `GET home` row) and `06-API/04-Endpoint-Contracts.md` 1.20.0 (the Home endpoint scope). Read-time and derived, nothing stored; no migration.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`tests/repositories/statistics.repository.test.ts` has a `home 501 pin` describe that covers `findHomeScoring` and `findHomeHeatmapCells`. `tests/repositories/statistics-sql-golden.test.ts` snapshots both readers.

## Pros and Cons of the Options
### Pin the Home reads to starting score 501
* Good, because 301, 701 and custom games leave both the Home averages and the landing cells (Overview row added by commit `e4415225`).

### Leave Home counting every completed session
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-11-13

* `docs/superpowers/specs/2026-11-13-x01-variation-filter-design.md` (Non-goals, Open items; the header names D557): rebuilt Decision Drivers and Considered Options.
* `docs/superpowers/specs/2026-10-25-home-real-stats-design.md` (Scope): rebuilt Considered Options.
* Commit `e4415225` (2026-11-13; repository change, tests, golden snapshot and Overview row): rebuilt Confirmation and Pros and Cons.
