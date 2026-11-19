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

# Custom-routine CRUD and the exercise-template catalog get a planned write contract alongside the existing unbuilt reads

## Context and Problem Statement
A full-replace `PUT` avoids a partial-reorder patch DSL for the "swappable list" builder UI, which always holds the complete order in memory client-side. Rejecting writes to system/other-player routines needs no new authorization mechanism — the same identity-from-JWT check every other player-scoped write already uses.

## Decision Drivers
* The builder's "swappable list" always holds the complete step order in memory on the client.
* A full replace avoids partial-reorder race conditions without adding a patch DSL.
* Write rejection reuses the identity-from-JWT check that other player-scoped writes use, so it needs no new authorization mechanism.

## Considered Options
* A full-replace `PUT` that takes the whole ordered step array.
* Incremental patch operations on the step list.

## Decision Outcome
Chosen option: "Per `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` §3.4, the routine contract gains four planned (unbuilt) endpoints alongside the three `GET /api/routines*` rows D299 already marked unbuilt: `GET /api/exercise-templates` (picker catalog), `POST /api/routines`, `PUT /api/routines/:routineId`, `DELETE /api/routines/:routineId`. Writes are player-scoped: a caller may only create/modify/delete their own routines, never a system routine (`is_system_template = TRUE`) or another player's. `PUT` replaces the full ordered step array; `sequence_number` is assigned server-side from array position, never trusted from the request body.".

### Consequences
unbuilt — no route handlers exist yet. `04-Endpoint-Contracts.md` documents the shape now so Phase 1 implementation has a frozen target, consistent with how D299 documented the read side before it was built.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Full-replace `PUT`
* Good, because it avoids partial-reorder race conditions without adding a patch DSL.

### Incremental patch operations
* Bad, because they would need a patch DSL and expose partial-reorder race conditions.

## Evidence / More Information
Decided: 2026-09-17

* `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` (§ 3.4, § 8): rebuilt Decision Drivers, Considered Options and Pros and Cons. § 8 states that D321 refines D306.
* Commit `a34042d6` (PR #417, 2026-09-17; adds the D306 row to `decisions/api.md`): source of the split-copied Context and Consequences.
* Applied in: `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md`, `docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md`, `docs/superpowers/specs/2026-09-18-routine-sharing-design.md`, `docs/superpowers/plans/2026-09-18-custom-routine-builder.md`.
