---
id: D0336
status: accepted
date: 2026-09-19
origin: contemporaneous
original-date:
tags: [database, schema, migration, constraint]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Migration 0038 builds D305's duration-bound trigger and D306/D321's owner-aware routine views; committed unapplied

## Context and Problem Statement
implements the design D305 recorded as unbuilt and D306/D321 as planned; no new design choice beyond what those decisions already fixed.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`database/migrations/0038_custom_routines.sql` implements D305's deferred duration-bound trigger exactly as designed — `fn_routine_templates_duration_bounds()` fires as a constraint trigger on both `routine_steps` and `routine_templates` (the second catches a user routine created with zero steps, which the first would never see), exempts `is_system_template` routines, and sums only `MINUTES` steps. It adds `chk_routine_templates_player_ownership` (a system routine has no owner, a user routine always has one) alongside the trigger, stricter than `chk_configuration_templates_system_ownership`. `v_routine_execution` is recreated with `player_id`, `routine_description` and `exercise_description` (D306/D321), and the new `v_exercise_template_catalog` exposes the system exercise templates a routine step can be built from. `database/seeds/0020_finishing_default_configuration.sql` backfills the Finishing (TUOD) template's `default_configuration` from Balanced Training's own step override, so a user step referencing it does not resolve to `{}`.", because implements the design D305 recorded as unbuilt and D306/D321 as planned; no new design choice beyond what those decisions already fixed.

### Consequences
no `DATABASE_URL` reaches this environment (D193), so `db:migrate`, the up → down → up reversal check and `db:introspect` never ran, and `app/src/db/schema.ts` was hand-edited to match, as `0034`–`0037` were. `database/verification/0038_custom_routine_checks.sql` (10 checks) is what proves the CHECK, both triggers and both views land, once a human runs it against a live database.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-19
