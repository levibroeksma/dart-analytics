---
id: D0299
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [api, contract]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# Routine steps are read through `v_routine_execution`; the unbuilt `/api/routines` routes stay named as unbuilt

## Context and Problem Statement
issue #344. The Read Contract mapped three routes to `v_routine_execution` — none of which exists — while the route that does exist bypassed the view entirely, so the designated read model for routines had no consumer and the contract described a system that was not running. Dropping the view and the three rows was the alternative; it was rejected because the routes are frozen contract in the same sense as the unimplemented `GET /api/sessions` list, and because deleting the view would leave routine reads permanently on raw tables, against "Reads via views". Annotating them keeps the distinction a reader needs: planned-and-unbuilt is not the same as documented-but-bypassed.

## Decision Drivers
* The Read Contract mapped 3 routes to `v_routine_execution`, none of which exists, while the existing route bypassed the view.
* `v_routine_execution` had zero consumers because it exposed none of `is_system_template`, `exercise_type_key`, `exercise_ruleset_version_key`, `default_configuration` or `step_configuration`.
* Reads go through views.

## Considered Options
* Read `v_routine_execution` and annotate the 3 unbuilt routes as unbuilt (chosen).
* Drop the view and the 3 Read Contract rows.
* Leave `findRoutineTemplateSteps` reading the template tables (the prior state).

## Decision Outcome
Chosen option: "`findRoutineTemplateSteps` reads `v_routine_execution` in a single query filtered on `routine_name` + `is_system_template`, instead of two queries against the template tables. The three `GET /api/routines*` rows stay in the Read Contract table, annotated as contract-defined but not implemented, and the table names `POST /api/training-sessions` as the view's live consumer today.".

### Consequences
a system routine with no steps now reads as no routine at all — the view is built from `routine_steps`, so a stepless template produces no rows and `startTraining` answers `VALIDATION_FAILED` instead of opening an activity with an empty step list. That is a behaviour change, and the better of the two answers. The repository no longer imports `routineTemplates`/`routineSteps`/`exerciseTemplates`/`exerciseTypes`/`gameTypes`/`durationTypes`/`exerciseRulesetVersions` at all; the join shape the D295 pin requires now lives in the view (`0036`), so the test that guarded it asserts the view's column instead of the repository's `leftJoin`. When the three routine routes are built they consume the same view, with no further migration.
* Good, because `POST /api/training-sessions` becomes the view's live consumer, so the routine read runs through its own read model.
* Good, because `findRoutineTemplateSteps` runs 1 query instead of 2.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`app/tests/repositories/training-session.repository.test.ts` covers `findRoutineTemplateSteps` against the view.

## Pros and Cons of the Options
### Read the view and annotate the unbuilt routes
* Good, because it keeps planned-and-unbuilt distinct from documented-but-bypassed.
* Good, because the routes stay frozen contract.

### Drop the view and the 3 rows
* Bad, because it would leave routine reads permanently on raw tables, against "Reads via views".
* Bad, because the routes are frozen contract, like the unimplemented `GET /api/sessions` list.

### Read the template tables directly (prior state)
* Bad, because the designated read model for routines had no consumer and the contract described a system that was not running.

## Evidence / More Information
Decided: 2026-09-17

* Commit `3158c679` (2026-09-17, PR #402, adds the D299 row): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons from the commit message and the Context text. No spec or plan names this record as its origin.
* Applied in: `docs/superpowers/plans/2026-09-17-configurable-training-routines-doc-integration.md`, `docs/superpowers/specs/2026-09-17-configurable-training-routines-roadmap-design.md`.
