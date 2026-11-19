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

# System routines "Standard Practice" and standalone "Warm-Up" are removed by a deleting seed

## Context and Problem Statement
the player never asked for either routine. Editing seeds `0002`/`0015` is a one-time exception the player granted; seeds re-run on every deploy (`deploy.yml`), so dropping the inserts alone would only stop them on fresh databases. A seed, not a migration, carries the delete because migrations are schema-only and seeds own controlled data (`database/CLAUDE.md`).

## Decision Drivers
* The player never asked for either routine.
* Seeds re-run on every deploy (`deploy.yml`), so dropping the inserts alone would only stop them on fresh databases.
* Migrations are schema-only and seeds own controlled data (`database/CLAUDE.md`).

## Considered Options
* Stop the inserts in seeds `0002`/`0015` and add a deleting seed `0031` (chosen).
* Drop the inserts only (rejected in Context: it would stop them on fresh databases alone).
* Delete through a migration (rejected in Context: migrations are schema-only).

## Decision Outcome
Chosen option: "seeds `0002` and `0015` no longer insert the "Standard Practice" (`0198f400-…-01`) and "Warm-Up" (`0199c000-…-01`) system routines; new seed `0031_remove_default_routines.sql` deletes both, steps first, from databases that already hold them. A routine a `training_schedule_days` row still names (FK `ON DELETE RESTRICT`) is kept and reported with a `NOTICE`, never deleted out from under the player's schedule. The Warm-Up exercise template (`0199b000-…-01`) stays.".

### Consequences
* Neutral, because Balanced Training is the only system routine left.
* Neutral, because D305's exemption stands but its motivating 5-minute Warm-Up routine no longer exists. `verification/0038_custom_routine_checks.sql` case 7 now uses its own 5-minute system-routine fixture.
* Neutral, because past sessions are untouched: `activity_configurations` holds a snapshot and no runtime row references a template.

Balanced Training is the only system routine left. D305's system-routine exemption from the 30-60 minute floor stands, but its original motivating case — the 5-minute Warm-Up routine — no longer exists; `verification/0038_custom_routine_checks.sql` case 7 now proves the exemption against its own 5-minute system-routine fixture instead of the seeded row. Past sessions of either routine are untouched: `activity_configurations` holds a snapshot and no runtime row FKs a template.

### Confidence
Rationale unknown — no source found.

### Revisit When
Rationale unknown — no source found.

### Confirmation
The commit changed `database/verification/0015_warm_up_routine_checks.sql` and `database/verification/0038_custom_routine_checks.sql` to match the removal. `0031_remove_default_routines.sql` reports a kept routine with a `NOTICE`.

## Pros and Cons of the Options
### Deleting seed plus removed inserts
* Good, because it removes the routines from databases that already hold them, as well as from fresh ones.
* Good, because it keeps a routine a schedule day still names, so the player's schedule is not deleted out from under them.

### Removing the inserts only
* Bad, because it would stop the routines only on fresh databases (Context).

### Migration-based delete
* Bad, because migrations are schema-only (Context).

## Evidence / More Information
Decided: 2026-09-25

* Commit `352902e3` (2026-09-25, subject cites #599; adds the D363 row, seed `0031` and the verification edits): rebuilt Decision Drivers, Considered Options, Consequences, Confirmation and Pros and Cons.
