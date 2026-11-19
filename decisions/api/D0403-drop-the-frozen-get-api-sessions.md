---
id: D0403
status: accepted
date: 2026-10-04
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, session]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Drop the frozen `GET /api/sessions/:sessionId/replay` unbuilt (#636)

## Context and Problem Statement
the route was never built and has no caller. The statistics replay reads the same view, and it is paginated, owner-gated and carries a header. Two documented contracts for one view invite a future task to build the wrong one. Aliasing would add a second, unpaginated shape to maintain with no consumer. This follows D321's drop of the unbuilt `/execution` route: the freeze covers what is routed, and a decision is the recorded way to change it.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "The frozen `GET /api/sessions/:sessionId/replay` (`ReplayEntry[]`, backed by `v_game_replay`) is dropped from the v1 route surface without being built, along with its `ReplayEntry` schema. Session replay is served only by `GET /api/statistics/sessions/:sessionId/replay` (D371, widened by D372). This settles D371 decision 11.".

### Consequences
`06-API/00-Overview.md` drops the route from the Sessions list and the Read Contract table, and keeps a dropped-unbuilt note (version 1.16.1). `06-API/04-Endpoint-Contracts.md` marks the row dropped and removes `ReplayEntry` (version 1.16.3). No code, test, view or migration changes: `v_game_replay` keeps its statistics readers.

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
Supersedes: none (settles D371 decision 11).
