---
id: D0493
status: accepted
date: 2026-10-25
origin: contemporaneous
original-date:
tags: [api, endpoint, contract]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# `GET /api/statistics/home`: one fixed-window endpoint for the Home stat blocks

## Context and Problem Statement
the section route is per game and bounded by the §5 range contract, so three Home blocks over two games would take several calls and a client-side merge. One summary route keeps the client to one read and the windows in one place (#808).

## Decision Drivers
* The returned shape of `homeSnapshot()` stays the contract while the three fixtures give way to the player's own numbers (spec, Goal).
* The Home windows are fixed, so the server derives them and the §5 range contract does not apply (spec, Unit 4).
* Reads use existing views: no migration and no new view (spec, Unit 1 and Unit 4).

## Considered Options
* One fixed-window summary route, `GET /api/statistics/home?tz=` (chosen).
* Per-game section calls, which the plan names as the alternative to one fixed-window endpoint.

## Decision Outcome
Chosen option: "Home reads its hero, daily-average and landing blocks from one route, `GET /api/statistics/home?tz=`. The server derives the windows (last 30 local days, the 30 before, the last 7) from the request time in `tz`; the route takes no `from`/`to`. It reads completed `501` and `SCORE_TRAINING` `VISUAL_BOARD` sessions in any context. `findHomeScoring` reads one 60-day `bucket: "day"` scoring row set and the service folds it into the windows; `findHomeHeatmapCells` reads located darts. `findVisitScoring`'s body moves unchanged into a private `selectVisitScoring(db, where, q)` that both readers call.".

### Consequences
no schema or view change. The client sends its IANA `tz`; an unknown zone is `VALIDATION_FAILED`. Home's scope is fixed to `501` + `SCORE_TRAINING`. Spec: `docs/superpowers/specs/2026-10-25-home-real-stats-design.md`.

* Neutral, because the route is view-backed over `v_player_visit_facts`, `v_stats_session_facts` and `v_stats_dart_facts`, with no raw tables (spec, Unit 4).
* Neutral, because a failed or pending fetch shows dashes and hides the bars and the landing card (spec, Behaviour table).

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Spec § Testing lists a route test for `tz` validation. `tests/pages/api/statistics/home.test.ts` rejects a missing and an unknown `tz` with 422. `tests/repositories/statistics-sql-golden.test.ts` snapshots `findVisitScoring`, `findHomeScoring` and `findHomeHeatmapCells`. The spec calls the unchanged `findVisitScoring` SQL tests the proof that the shared body moved intact.

## Pros and Cons of the Options
### One fixed-window summary route
* Good, because the server derives the windows from the request time, so the client sends no `from` or `to` (spec, Unit 4).
* Good, because the readers aggregate in SQL and return at most a few hundred cells (spec, Risks).

### Per-game section calls
Rationale unknown — no source found.

## Evidence / More Information
Decided: 2026-10-25

* `docs/superpowers/specs/2026-10-25-home-real-stats-design.md` (Goal, Scope, Units 1–5, Behaviour, Testing, Risks): rebuilt Decision Drivers, Considered Options, Confirmation, Pros and Cons and Consequences.
* `docs/superpowers/plans/2026-10-25-home-real-stats.md` (the decision step): rebuilt Considered Options.
* Commit `8361f92c` (PR #1088, issue #808; adds the D493 row): source of the Context and Decision Outcome text.
