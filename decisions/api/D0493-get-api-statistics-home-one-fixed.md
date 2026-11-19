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
<!-- backfill: pending -->

# `GET /api/statistics/home`: one fixed-window endpoint for the Home stat blocks

## Context and Problem Statement
the section route is per game and bounded by the §5 range contract, so three Home blocks over two games would take several calls and a client-side merge. One summary route keeps the client to one read and the windows in one place (#808).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Home reads its hero, daily-average and landing blocks from one route, `GET /api/statistics/home?tz=`. The server derives the windows (last 30 local days, the 30 before, the last 7) from the request time in `tz`; the route takes no `from`/`to`. It reads completed `501` and `SCORE_TRAINING` `VISUAL_BOARD` sessions in any context. `findHomeScoring` reads one 60-day `bucket: "day"` scoring row set and the service folds it into the windows; `findHomeHeatmapCells` reads located darts. `findVisitScoring`'s body moves unchanged into a private `selectVisitScoring(db, where, q)` that both readers call.".

### Consequences
no schema or view change. The client sends its IANA `tz`; an unknown zone is `VALIDATION_FAILED`. Home's scope is fixed to `501` + `SCORE_TRAINING`. Spec: `docs/superpowers/specs/2026-10-25-home-real-stats-design.md`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-25
