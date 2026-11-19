---
id: D0298
status: accepted
date: 2026-09-17
origin: contemporaneous
original-date:
tags: [database, schema, migration, table, column, constraint, view]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---

# A read-model view carries the columns its consumer reads, rather than the consumer going around it

## Context and Problem Statement
issues #342 and #344. Both views were documented as the source for a read that did not use them. `findStartingScores` selected `exercise_configurations.configuration` directly because no view exposed the session's starting score, making the statistics read the one raw-table dependency in a path `06-API/00-Overview.md` calls view-backed — a silent exception to "Reads via views" that no reviewer could distinguish from a violation, and a coupling of career statistics to a JSONB snapshot's shape with no view boundary between them. `v_routine_execution` had zero consumers at all: `findRoutineTemplateSteps` re-implemented the same read against `routine_templates`/`routine_steps`/`exercise_templates`/`duration_types`, because the view exposed none of what a step resolves from. That left two divergent definitions of "a routine's steps" with nothing keeping them in sync. `0033` had already fixed the view's `game_types` join (issue #343), but nothing consumed the result.
Migration `0024` had justified leaving `starting_score` out on the grounds that the view should stay "a plain arithmetic projection, never a JSONB-parsing one". `0025` overtook that one migration later by projecting `(configuration ->> 'max_darts_per_turn')` on `v_player_visit_facts`; `0036` follows `0025`. The alternative — reconciling the documentation to admit the raw-table read — was rejected because it writes down the coupling instead of removing it.

## Decision Drivers
* Reads go through views, and the statistics and routine reads bypassed them (issues #342, #344).
* `v_routine_execution` had no consumer, and two definitions of "a routine's steps" could diverge.
* The statistics read coupled to a JSONB snapshot's shape with no view boundary.

## Considered Options
* Recreate the two views with the columns their consumers read, so the reads run through them (chosen).
* Reconcile the documentation to admit the raw-table read (rejected in Context).

## Decision Outcome
Chosen option: "migration `0036` recreates two views so the reads that run can run through them. `v_double_out_checkout_darts` gains `starting_score` as `(ec.configuration ->> 'starting_score')::int` over a LEFT JOIN onto `exercise_configurations`. `v_routine_execution` gains `is_system_template`, `exercise_type_key`, `exercise_ruleset_version_key` (from the pin D295 added), `default_configuration` and `step_configuration`. Neither view loses or renames a column. `database/verification/0036_read_model_view_consumers_checks.sql` proves it against a live database.".

### Consequences
the statistics read path is now entirely view-backed, and `findDoubleOutVisits` issues one query where it issued two. The new LEFT JOIN is non-fanning only because `uq_exercise_configuration_session` makes `exercise_configurations` at most one row per session; the verification script (10 checks) asserts that constraint still exists, because dropping it would silently multiply every dart row rather than error. A session with no configuration snapshot projects NULL `starting_score`, which the read layer treats as 0 — the same fallback the two-query version applied to a missing row. `v_routine_execution` now exposes two JSONB snapshot columns; that is the step definition itself, not derived data, so it does not make the view a source of truth. Both views were recreated rather than `CREATE OR REPLACE`d because column order changes. The migration was not executed here — no `DATABASE_URL` in this environment (D193) — so `schema.ts` was hand-edited to match, as `0034` and `0035` were; the drift gate (D290) covers that the two agree, never that either agrees with the live database.

* Good, because the statistics read path is now view-backed and `findDoubleOutVisits` issues one query where it issued two.
* Bad, because the migration was not executed in the authoring environment (no `DATABASE_URL`), so `schema.ts` was hand-edited and the drift gate covers only the two files agreeing.
* Neutral, because the new LEFT JOIN is non-fanning only while `uq_exercise_configuration_session` exists.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
`database/verification/0036_read_model_view_consumers_checks.sql` (10 checks) proves the views against a live database, including that `uq_exercise_configuration_session` still exists. The commit message records it as written but not executed.

## Pros and Cons of the Options
### Recreate the views with the consumers' columns
* Good, because the read path becomes view-backed, which removes the raw-table dependency in the statistics read.
* Good, because `findRoutineTemplateSteps` gets one definition of a routine's steps from the view.

### Reconcile the documentation to admit the raw-table read
* Bad, because it writes down the coupling instead of removing it (Context, as rejected in the source).

## Evidence / More Information
Decided: 2026-09-17

* Commit `3158c679` (PR #402, 2026-09-17; adds the D298 row and migration `0036`): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
