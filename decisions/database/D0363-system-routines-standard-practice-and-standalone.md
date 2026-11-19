---
id: D0363
status: accepted
date: 2026-09-25
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

# System routines "Standard Practice" and standalone "Warm-Up" are removed by a deleting seed

## Context and Problem Statement
the player never asked for either routine. Editing seeds `0002`/`0015` is a one-time exception the player granted; seeds re-run on every deploy (`deploy.yml`), so dropping the inserts alone would only stop them on fresh databases. A seed, not a migration, carries the delete because migrations are schema-only and seeds own controlled data (`database/CLAUDE.md`).

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "seeds `0002` and `0015` no longer insert the "Standard Practice" (`0198f400-…-01`) and "Warm-Up" (`0199c000-…-01`) system routines; new seed `0031_remove_default_routines.sql` deletes both, steps first, from databases that already hold them. A routine a `training_schedule_days` row still names (FK `ON DELETE RESTRICT`) is kept and reported with a `NOTICE`, never deleted out from under the player's schedule. The Warm-Up exercise template (`0199b000-…-01`) stays.".

### Consequences
Balanced Training is the only system routine left. D305's system-routine exemption from the 30-60 minute floor stands, but its original motivating case — the 5-minute Warm-Up routine — no longer exists; `verification/0038_custom_routine_checks.sql` case 7 now proves the exemption against its own 5-minute system-routine fixture instead of the seeded row. Past sessions of either routine are untouched: `activity_configurations` holds a snapshot and no runtime row FKs a template.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-25
