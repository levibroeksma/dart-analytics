---
id: D0263
status: accepted
date: 2026-09-10
origin: contemporaneous
original-date:
tags: [database, schema, migration, table, column, constraint, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Exercise sessions carry an exercise-type discriminator, and exercise rulesets are a separate table

## Context and Problem Statement
Every game-bound column was `NOT NULL`, which forced a game abstraction onto a non-game exercise — exactly what `docs/architecture/09-Training/01-Routines.md` §12 forbids. Three alternatives were weighed and rejected. A discriminator on `ruleset_versions` was rejected because a game-backed exercise (§11) holds an exercise ruleset and a game ruleset simultaneously and one `ruleset_version_id` column cannot carry both. A SMALLINT primary key for `exercise_types` was rejected because §26 makes each new exercise type ship with its own ruleset, engine and configuration schema — a growing catalog like `game_types`, not a fixed structural enum like `stage_types`. Putting the warm-up's phase list in `configuration_templates` was rejected because that table is game-keyed and models the §19 named-preset concept; §3.5's per-routine exercise configuration belongs on the step.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "Migrations `0027`–`0031` add an `exercise_types` catalog (UUID primary key) and an `exercise_ruleset_versions` table, give `exercise_templates` and `exercise_sessions` an `exercise_type_id`, relax `game_type_id`/`ruleset_version_id`/`capture_mode_id`/`input_mode_id` on `exercise_sessions` to nullable under two independent CHECK constraints, add `routine_steps.configuration` (JSONB), and add an `activity_configurations` snapshot table. `ruleset_versions` and `configuration_templates` are left unchanged.".

### Consequences
The two CHECK constraints are deliberately independent — `SWITCHING` (§17) takes dart observations with no game engine, so a capture pair must be settable without a game pair — and neither names a specific exercise type, so no new exercise type requires a constraint change. Migration `0020`'s composite `fk_sessions_capability` is left in place: it is `MATCH SIMPLE`, so a fully-NULL warm-up row satisfies it trivially, at the cost of the capability guarantee not extending to non-game exercises that take dart input. `exercise_sessions.exercise_type_id` needs the `db:migrate` → `db:seed` → `db:migrate` apply order that `0019`/`0020` established, because its backfill is seed data. Adaptive resolution (§21) has a place to land with no further schema change: it rewrites the resolved step list before it is snapshotted into `activity_configurations`.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-10
Referenced by D0266's `Supersedes:` line.
