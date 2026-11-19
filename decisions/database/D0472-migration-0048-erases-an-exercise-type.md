---
id: D0472
status: accepted
date: 2026-10-20
origin: contemporaneous
original-date:
tags: [database, schema, migration, seed]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Migration 0048 erases an exercise type's data, and pays for it inside the routine duration bound

## Context and Problem Statement
this is a data migration, which sits against `database/CLAUDE.md`'s "migrations are schema-only; seeds contain controlled data only" and against the precedent of D363/D383, where a new seed removed rows an earlier seed had inserted. A seed cannot carry this one: the rows must go from databases where seed `0024` has already run, and that seed is being deleted, so no seed is left that describes the data at all — a deleting seed would be a permanent file in the chain describing a type the chain no longer knows. The chain's history is the right place for a one-time, irreversible erasure, and `schema_migrations` plus `db:drift` then record where it was applied. The two data rules exist because `trg_routine_steps_duration_bounds` (D305) holds a user routine to 30–60 MINUTES and is checked at COMMIT: dropping a step from a routine sitting on the lower bound would abort the whole migration, and a routine left with zero steps cannot satisfy that bound at all. `uq_routine_steps_sequence` is not deferrable and is checked after each row, so surviving steps are parked above every live value and then ranked back into `1..n`, with `routine_steps` locked `IN SHARE ROW EXCLUSIVE MODE` for the duration.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "`database/migrations/0048_erase_switching_target_scoring.sql` deletes the `SWITCHING_TARGET_SCORING` exercise type and every row descending from it — darts, turns, sessions, routine steps, type tags, template, ruleset version — selecting everything by `implementation_key`, never by a row id, and naming each deletion's count (and, where a player's routine is destroyed, its id and name) with `RAISE NOTICE`. Seed `0024`, which created those rows, and its verification script are deleted in the same commit. Two data rules come with it: the MINUTES a player's routine loses are added back to its first surviving MINUTES step, and a player routine left with no step at all is deleted together with its `training_schedule_days` rows.".

### Consequences
a routine keeps the length its owner chose, but one surviving step is longer than the player made it, and the erased exercise's time is silently folded into it. A player routine built only from this exercise is destroyed, schedule days included; the notices name it so the production run can be read back. System routines are exempt from the bound and are left exactly as seeded. History is untouched: `activity_configurations` is an immutable snapshot and `v_stats_routine_step_facts` resolves a step through it, never through `routine_steps`, so a past run of an erased step simply has no session left and reads as a step that never started. `migrate:down` is a comment — rolling back past `0048` means restoring a backup. This decision is the exception, not a new rule: a change that removes seeded rows while its seed stays in the chain is still a seed (D363, D383).

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-10-20
