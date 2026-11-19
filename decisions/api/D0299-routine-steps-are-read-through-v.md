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
<!-- backfill: pending -->

# Routine steps are read through `v_routine_execution`; the unbuilt `/api/routines` routes stay named as unbuilt

## Context and Problem Statement
issue #344. The Read Contract mapped three routes to `v_routine_execution` — none of which exists — while the route that does exist bypassed the view entirely, so the designated read model for routines had no consumer and the contract described a system that was not running. Dropping the view and the three rows was the alternative; it was rejected because the routes are frozen contract in the same sense as the unimplemented `GET /api/sessions` list, and because deleting the view would leave routine reads permanently on raw tables, against "Reads via views". Annotating them keeps the distinction a reader needs: planned-and-unbuilt is not the same as documented-but-bypassed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`findRoutineTemplateSteps` reads `v_routine_execution` in a single query filtered on `routine_name` + `is_system_template`, instead of two queries against the template tables. The three `GET /api/routines*` rows stay in the Read Contract table, annotated as contract-defined but not implemented, and the table names `POST /api/training-sessions` as the view's live consumer today.".

### Consequences
a system routine with no steps now reads as no routine at all — the view is built from `routine_steps`, so a stepless template produces no rows and `startTraining` answers `VALIDATION_FAILED` instead of opening an activity with an empty step list. That is a behaviour change, and the better of the two answers. The repository no longer imports `routineTemplates`/`routineSteps`/`exerciseTemplates`/`exerciseTypes`/`gameTypes`/`durationTypes`/`exerciseRulesetVersions` at all; the join shape the D295 pin requires now lives in the view (`0036`), so the test that guarded it asserts the view's column instead of the repository's `leftJoin`. When the three routine routes are built they consume the same view, with no further migration.

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
