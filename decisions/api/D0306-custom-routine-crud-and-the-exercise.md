---
id: D0306
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [api, endpoint, contract, JWT]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Custom-routine CRUD and the exercise-template catalog get a planned write contract alongside the existing unbuilt reads

## Context and Problem Statement
A full-replace `PUT` avoids a partial-reorder patch DSL for the "swappable list" builder UI, which always holds the complete order in memory client-side. Rejecting writes to system/other-player routines needs no new authorization mechanism — the same identity-from-JWT check every other player-scoped write already uses.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Per `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §3.4, the routine contract gains four planned (unbuilt) endpoints alongside the three `GET /api/routines*` rows D299 already marked unbuilt: `GET /api/exercise-templates` (picker catalog), `POST /api/routines`, `PUT /api/routines/:routineId`, `DELETE /api/routines/:routineId`. Writes are player-scoped: a caller may only create/modify/delete their own routines, never a system routine (`is_system_template = TRUE`) or another player's. `PUT` replaces the full ordered step array; `sequence_number` is assigned server-side from array position, never trusted from the request body.".

### Consequences
unbuilt — no route handlers exist yet. `04-Endpoint-Contracts.md` documents the shape now so Phase 1 implementation has a frozen target, consistent with how D299 documented the read side before it was built.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-17
