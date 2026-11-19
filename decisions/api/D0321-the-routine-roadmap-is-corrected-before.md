---
id: D0321
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [api, endpoint]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# The routine roadmap is corrected before its phases are planned: custom routines start by id, routine reads need an owner-aware view, and Phase 2 generalises step kinds before it adds content

## Context and Problem Statement
the roadmap was written against the architecture docs and not against the code. Four things it assumed do not hold: the training start path is name-keyed and system-only (D299), the play page is one hardcoded routine, `startGameStep` hardcodes `TUOD`/`TUOD_V1`, and `v_routine_execution` carries no owner column. Left as written, Phase 1 would ship a builder whose routines cannot start and a list endpoint that cannot be view-backed, and Phase 2's "pure content expansion" would fail on its first non-TUOD game. Its file path (`09-training-routines.md`) also resolved nowhere since D308 — repeated into D305 and `02-Template-Layer.md`, which is how a stale spec path becomes a stale canonical one.

## Decision Drivers
* The roadmap was written against the architecture docs, not the code.
* The training start path is name-keyed and system-only, the play page is 1 hardcoded routine, and `startGameStep` hardcodes `TUOD`/`TUOD_V1`.
* `v_routine_execution` carries no owner column, and `routine_templates` has no ownership `CHECK` where `configuration_templates` has one.
* `ROUNDS` and `MINUTES` are both seeded, but a `ROUNDS` step cannot satisfy a minute floor.
* `players` has no timezone column, and `display_name` is not unique.

## Considered Options
* Correct the roadmap with the 9 corrections before planning the phases (chosen).
* Keep the roadmap as first written.

## Decision Outcome
Chosen option: "Nine corrections to `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` (its §8), recorded once here. (1) Phase 1 delivers build + edit + **run**: `POST /api/training-sessions` takes `routineTemplateId` in place of `routineTemplateName`, resolving a system routine or one the caller owns; the activity snapshot gains `routineTemplateId`. (2) `v_routine_execution` is recreated with `player_id` and `description` so the "system + own" list stays view-backed; a `v_exercise_template_catalog` view backs the picker. (3) `GET /api/routines/:routineId/execution` is dropped unbuilt — same shape as the detail route. (4) `routine_templates` gains the ownership `CHECK` `configuration_templates` already has. (5) Phase 1 user steps accept `MINUTES` only; `ROUNDS` is seeded but has no wall-clock length and cannot satisfy a minute floor. (6) The seeded Finishing template gets a `default_configuration`, and `startTraining` validates a `GAME` step's configuration against its game ruleset (issue #392) — the builder's write path needs both. (7) Writes against another player's routine return `NOT_FOUND`, against a system routine `VALIDATION_FAILED` with a reason — the closed error registry is not reopened for a generic 403. (8) Phase 2 is step-kind generalisation first — `game_ruleset_version_id` pinned on `GAME` templates, a per-kind client adapter registry — and content second. (9) Phase 3 resolves "today" client-side, models a rest day as an absent row and a weekday as `SMALLINT` 1–7 with a `CHECK`; Phase 4 identifies a recipient by a server-generated share code.".

### Consequences
D305 and D306 stand — the floor, the trigger, the full-replace `PUT` and server-assigned `sequence_number` are unchanged; this refines D306's read side and error mapping. Every planned DTO in `04-Endpoint-Contracts.md` gains the ownership/description fields the UI needs, still unbuilt. `05-Database/06-Spec/02-Template-Layer.md` and `06-API/00-Overview.md` are corrected in the same change. D305's own text keeps the stale path: decisions are append-only, and the Consequences line is provenance. Four phase specs dated 2026-09-18 carry the detail; each phase still gets its own plan, and any decision a phase makes beyond these nine is recorded when that phase lands, not here.
* Good, because Phase 1 delivers a builder whose routines can start, and the "system + own" list stays view-backed.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
Rationale unknown — no source found.

## Pros and Cons of the Options
### Correct the roadmap first
* Good, because Phase 1 ships routines that can start and a list endpoint that can be view-backed.
* Good, because Phase 2 starts with step-kind generalisation, so it does not fail on its first non-TUOD game.

### Keep the roadmap as first written
* Bad, because Phase 1 would ship a builder whose routines cannot start and a list endpoint that cannot be view-backed.
* Bad, because Phase 2's "pure content expansion" would fail on its first non-TUOD game.

## Evidence / More Information
Decided: 2026-09-18
Refines: D306

* `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md` (§8 Corrections table, rows 1-9): rebuilt Decision Drivers (all but the first), Considered Options, Consequences and the Good bullets of Pros and Cons.
* Commit `b67d6016` (2026-09-18, adds the D321 row; its message calls the record D320): rebuilt the first Decision Driver and the Bad bullets of Pros and Cons from the row's Reason.
* Applied in: `docs/superpowers/specs/2026-09-18-custom-routine-builder-design.md`, `docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md`, `docs/superpowers/specs/2026-09-18-routine-sharing-design.md`, `docs/superpowers/plans/2026-09-18-custom-routine-builder.md`.
