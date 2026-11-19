---
id: D0342
status: accepted
date: 2026-09-20
origin: contemporaneous
original-date:
tags: [database, schema, migration, table, column, index]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# A weekly training schedule's weekday is a SMALLINT+CHECK, rest is an absent row, and a scheduled routine cannot be silently orphaned

## Context and Problem Statement
the ISO weekday is a universal constant with nothing to name or grow, so a `weekdays` lookup table would add a join with no benefit over the CHECK — the same reasoning D310's naming convention and D263's rejection of a SMALLINT `exercise_types` both apply, in the opposite direction each time, to whether a set is fixed or growing. A `NULL` routine and a missing day-row would both have meant rest, which is the "half a coordinate" shape D188 already rejected for dart locations — one fact needs one representation, not two independently-possible ways to spell it. `SET NULL` on the routine FK was rejected (recorded as `[decide]` in the spec) because it would turn a training day into rest the moment its routine was deleted, with nothing telling the player it happened; `RESTRICT` plus a named mapping fails loudly instead, at the cost of the service layer owning that translation.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "migration `0041` adds `training_schedules` (`id`, `player_id`, `name`, `is_active`, `created_at`, `updated_at`) and `training_schedule_days` (`id`, `training_schedule_id`, `day_of_week`, `routine_template_id`, `created_at`), both Template-layer: mutable, owned, never referenced by runtime tables. Three choices: (a) `day_of_week` is `SMALLINT NOT NULL` with `chk_training_schedule_days_day_of_week` (`BETWEEN 1 AND 7`, ISO 1 = Monday … 7 = Sunday) rather than a lookup table — a deliberate exception to Pattern 12 (lookup tables for domain-controlled sets that grow or need names); (b) a rest day is the absence of a row for that weekday, not a nullable `routine_template_id` — one representation of rest, not two that could disagree; (c) `fk_training_schedule_days_routine_template` is `ON DELETE RESTRICT`, and `app/src/services/routine.service.ts`'s `deleteRoutine` catches the `23503` (via the new `matchesConstraintError` helper, `db-errors.ts`) and maps it to `VALIDATION_FAILED { reason: "routine in use", scheduleIds }` — `scheduleIds` read back through `findScheduleIdsUsingRoutine` (`v_training_schedule_days`, player-scoped) — rather than a silent `SET NULL`. `uq_training_schedules_player_active`, a partial unique index on `player_id` `WHERE is_active`, enforces "at most one active schedule per player" with no pointer column on `players`. See `docs/superpowers/specs/2026-09-18-weekly-training-schedules-design.md` §3.".

### Consequences
deleting a routine that is still scheduled anywhere now surfaces to the caller as a 422 naming every affected schedule, instead of a silent state change or an unhandled `23503`. `matchesConstraintError` (extracted from `routine.service.ts`'s prior inline cause-walk into `services/db-errors.ts`) is now shared by `isRoutineDurationViolation` (D335's trigger) and the new `isScheduledRoutineViolation`, so a future FK-mapping need reuses it rather than a fourth copy of the same cause-walk. `v_training_schedules`/`v_training_schedule_days` are plain projections/joins, filtered by `player_id`; a schedule with no days still lists, since `v_training_schedules` never joins onto `training_schedule_days` to produce its row. Neither the migration nor its verification script was executed against a live database in this environment — no `DATABASE_URL` reaches this sandbox (D193) — so `database/verification/0041_training_schedule_checks.sql` is what proves the constraints, cascade and RESTRICT behaviour once a human runs it, and `app/src/db/schema.ts` still awaits a `drizzle-kit introspect` pass for the two new tables and views (repository/schema-drift tests stay red until then, per the commit that landed the repository layer). A decision on "today" being resolved client-side (no server timezone knowledge) is deferred to the API-surface doc pass (Task 3 of the implementation plan), since no route exists yet to hang it on.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-20
