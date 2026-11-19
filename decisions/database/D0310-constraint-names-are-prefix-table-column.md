---
id: D0310
status: accepted
date: 2026-09-18
origin: contemporaneous
original-date:
tags: [database, schema, migration, table, column, constraint, Neon]
scope: repository
decision-makers: [owner]
consulted: []
informed: []
supersedes:
superseded-by:
---
<!-- backfill: pending -->

# Constraint names are `<prefix>_<table>_<column>`, with the column named in full

## Context and Problem Statement
`exercise_configurations` (`0005`) used a singular table noun and a shortened column (`uq_exercise_configuration_session`), so two tables that mirror each other column-for-column carried two conventions with no functional difference to explain it (issue #295). A reader comparing them had to know which era each came from. Deriving the name mechanically removes the judgement call: `exercise_session_id` yields `exercise_session`, even though the shorter `_session` reads better, because the shorter form repeats `0005`'s habit of naming something other than the column.

## Decision Drivers
Rationale unknown — backfill pending.

## Considered Options
Rationale unknown — backfill pending.

## Decision Outcome
Chosen option: "every constraint is named `uq_`/`fk_`/`chk_` + the table's own (plural) name + the local column with `_id` stripped. Migration `0037` repoints `exercise_configurations`' two constraints onto it; `activity_configurations` (`0030`), `exercise_types` and `exercise_ruleset_versions` (`0027`) already follow it. Applied migrations are not edited — the rename is a new migration.".

### Consequences
constraint names are longer. Nothing queries them by name today, but `app/src/services/session.service.ts` does branch on `uq_sessions_single_active` when mapping a unique violation to a domain error — so any future rename of a constraint in an error-mapping path must change both in the same commit. `0037` was committed unapplied: no `DATABASE_URL` reaches this environment (D193), so `db:migrate`, the up → down → up reversal check and `db:introspect` never ran, and `app/src/db/schema.ts` was hand-edited to match, as `0034`–`0036` were. `database/verification/0037_exercise_configuration_constraint_naming_checks.sql` is what proves the rename landed, once the deploy pipeline's Neon-branch rehearsal (D288) applies it.

### Confidence
Rationale unknown — backfill pending.

### Revisit When
Rationale unknown — backfill pending.

### Confirmation
Rationale unknown — backfill pending.

## Pros and Cons of the Options
Rationale unknown — backfill pending.

## Evidence / More Information
Decided: 2026-09-18
